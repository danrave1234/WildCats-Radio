import { 
  PollDTO, 
  VoteOnPollPayload, 
  PollResultDTO, 
  getAllPollsForBroadcast,
  getActivePollsForBroadcast, 
  voteOnPoll, 
  getPollResults,
  hasUserVotedOnPoll,
  getUserVoteForPoll
} from './apiService';
import { websocketService } from './websocketService';
import { BaseService, ServiceConnection, ServiceResult, ServiceSubscriptionOptions } from './baseService';

interface PollConnection extends ServiceConnection {}

interface PollUpdateMessage {
  type: 'POLL_VOTE' | 'NEW_POLL' | 'POLL_UPDATED' | 'POLL_RESULTS' | 'POLL_DELETED';
  pollId?: number;
  poll?: PollDTO;
  results?: {
    options: Array<{
      id: number;
      optionText: string;
      votes: number;
    }>;
    totalVotes: number;
  };
}

class PollService extends BaseService<PollConnection> {

  /**
   * Get polls for a specific broadcast
   */
  async getPollsForBroadcast(broadcastId: number, authToken: string): Promise<ServiceResult<PollDTO[]>> {
    try {
      const result = await getAllPollsForBroadcast(broadcastId, authToken);

      if ('error' in result) {
        return this.createResult(undefined, result.error || 'Failed to fetch polls');
      }
      
      return this.createResult(result);
    } catch (error) {
      const errorMessage = this.handleError(error, 'PollService: Exception fetching polls');
      return this.createResult(undefined, errorMessage);
    }
  }

  async getActivePolls(broadcastId: number, authToken: string): Promise<ServiceResult<PollDTO[]>> {
    try {
      const result = await getActivePollsForBroadcast(broadcastId, authToken);

      if ('error' in result) {
        return this.createResult(undefined, result.error || 'Failed to fetch active polls');
      }

      return this.createResult(result);
    } catch (error) {
      const errorMessage = this.handleError(error, 'PollService: Exception fetching active polls');
      return this.createResult(undefined, errorMessage);
    }
  }

  async hasUserVoted(pollId: number, authToken: string): Promise<ServiceResult<boolean>> {
    try {
      const result = await hasUserVotedOnPoll(pollId, authToken);

      if (typeof result === 'object' && 'error' in result) {
        return this.createResult(undefined, result.error || 'Failed to check poll vote status');
      }

      return this.createResult(result as boolean);
    } catch (error) {
      const errorMessage = this.handleError(error, 'PollService: Exception checking vote status');
      return this.createResult(undefined, errorMessage);
    }
  }

  async getUserVote(pollId: number, authToken: string): Promise<ServiceResult<{ optionId: number }>> {
    try {
      const result = await getUserVoteForPoll(pollId, authToken);

      if ('error' in result) {
        return this.createResult(undefined, result.error || 'Failed to fetch user vote');
      }

      return this.createResult(result);
    } catch (error) {
      const errorMessage = this.handleError(error, 'PollService: Exception fetching user vote');
      return this.createResult(undefined, errorMessage);
    }
  }

  /**
   * Vote on a poll option
   */
  async voteOnPoll(
    pollId: number, 
    voteData: VoteOnPollPayload, 
    authToken: string
  ): Promise<ServiceResult<PollResultDTO>> {
    try {
      const result = await voteOnPoll(pollId, voteData, authToken);

      if ('error' in result) {
        return this.createResult(undefined, result.error || 'Failed to vote on poll');
      }
      
      return this.createResult(result);
    } catch (error) {
      const errorMessage = this.handleError(error, 'PollService: Exception voting on poll');
      return this.createResult(undefined, errorMessage);
    }
  }

  /**
   * Get poll results
   */
  async getPollResults(pollId: number, authToken: string): Promise<{ data: PollResultDTO } | { error: string }> {
    try {
      console.log('📈 PollService: Fetching poll results for:', pollId);
      const result = await getPollResults(pollId, authToken);

      if ('error' in result) {
        console.error('❌ PollService: Error fetching poll results:', result.error);
        return { error: result.error || 'Failed to fetch poll results' };
      }
      
      console.log('✅ PollService: Fetched results for poll:', pollId);
      return { data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ PollService: Exception fetching poll results:', errorMessage);
      return { error: errorMessage };
    }
  }

  /**
   * Subscribe to real-time poll updates for a broadcast
   */
  async subscribeToPolls(
    broadcastId: number,
    authToken: string,
    onPollUpdate: (update: PollUpdateMessage) => void
  ): Promise<PollConnection> {
    // Clean up existing subscription for this broadcast
    if (this.subscriptions.has(broadcastId)) {
      console.log('🧹 PollService: Cleaning up existing poll subscription for broadcast:', broadcastId);
      try {
        this.subscriptions.get(broadcastId)?.disconnect();
      } catch (e) {
        console.warn('PollService: Error during cleanup:', e);
      }
      this.subscriptions.delete(broadcastId);
    }

    return new Promise((resolve, reject) => {
      console.log('🔄 PollService: Setting up poll WebSocket for broadcast:', broadcastId);

      // Add timeout for subscription setup
      const setupTimeout = setTimeout(() => {
        console.error('❌ PollService: Subscription setup timeout');
        reject(new Error('Subscription setup timeout'));
      }, 15000);

      websocketService
        .subscribe(
          `/topic/broadcast/${broadcastId}/polls`,
          (message: any) => {
            try {
              const payload = typeof message?.body === 'string' ? JSON.parse(message.body) : message;
              console.log('📊 PollService: Processing poll update:', payload.type);
              if (typeof onPollUpdate === 'function') {
                onPollUpdate(payload as PollUpdateMessage);
              }
            } catch (error) {
              console.error('❌ PollService: Error parsing poll data:', error);
            }
          },
          authToken
        )
        .then((subscription) => {
          clearTimeout(setupTimeout);
          console.log('✅ PollService: Poll subscription established for broadcast:', broadcastId);
          
          const connection: PollConnection = {
            disconnect: () => {
              console.log('🧹 PollService: Manually disconnecting poll WebSocket for broadcast:', broadcastId);
              try {
                subscription?.unsubscribe?.();
              } catch (e) {
                console.warn('PollService: Error unsubscribing:', e);
              }
              this.subscriptions.delete(broadcastId);
              console.log('✅ PollService: Poll subscription cleaned up for broadcast:', broadcastId);
            },
          };

          this.subscriptions.set(broadcastId, connection);
          resolve(connection);
        })
        .catch((error) => {
          clearTimeout(setupTimeout);
          console.error('❌ PollService: Failed to setup poll WebSocket:', error);
          reject(error);
        });
    });
  }

  /**
   * Disconnect all poll subscriptions
   */
  disconnectAll(): void {
    console.log('🧹 PollService: Disconnecting all poll subscriptions');
    this.subscriptions.forEach((connection) => {
      connection.disconnect();
    });
    this.subscriptions.clear();
    console.log('✅ PollService: All poll subscriptions disconnected');
  }

  /**
   * Check if there's an active subscription for a broadcast
   */
  hasActiveSubscription(broadcastId: number): boolean {
    return this.subscriptions.has(broadcastId);
  }

  /**
   * Get the number of active subscriptions
   */
  getActiveSubscriptionCount(): number {
    return this.subscriptions.size;
  }
}

// Export a singleton instance
export const pollService = new PollService();
export default pollService; 