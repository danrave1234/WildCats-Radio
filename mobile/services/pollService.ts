import { 
  PollDTO, 
  VoteOnPollPayload, 
  PollResultDTO, 
  getActivePollsForBroadcast, 
  voteOnPoll, 
  getPollResults 
} from './apiService';
import { websocketService } from './websocketService';

interface PollConnection {
  disconnect: () => void;
}



interface PollUpdateMessage {
  type: 'POLL_VOTE' | 'NEW_POLL' | 'POLL_UPDATED' | 'POLL_RESULTS';
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

class PollService {
  private subscriptions: Map<number, PollConnection> = new Map();

  /**
   * Get polls for a specific broadcast
   */
  async getPollsForBroadcast(broadcastId: number, authToken: string): Promise<{ data: PollDTO[] } | { error: string }> {
    try {
      console.log('📊 PollService: Fetching polls for broadcast:', broadcastId);
      const result = await getActivePollsForBroadcast(broadcastId, authToken);

      if ('error' in result) {
        console.error('❌ PollService: Error fetching polls:', result.error);
        return { error: result.error || 'Failed to fetch polls' };
      }
      
      console.log('✅ PollService: Fetched', result.length, 'polls');
      return { data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ PollService: Exception fetching polls:', errorMessage);
      return { error: errorMessage };
    }
  }

  /**
   * Vote on a poll option
   */
  async voteOnPoll(
    pollId: number, 
    voteData: VoteOnPollPayload, 
    authToken: string
  ): Promise<{ data: PollResultDTO } | { error: string }> {
    try {
      console.log('🗳️ PollService: Voting on poll:', pollId, 'option:', voteData.optionId);
      const result = await voteOnPoll(pollId, voteData, authToken);

      if ('error' in result) {
        console.error('❌ PollService: Error voting on poll:', result.error);
        return { error: result.error || 'Failed to vote on poll' };
      }
      
      console.log('✅ PollService: Vote submitted successfully for poll:', pollId);
      return { data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ PollService: Exception voting on poll:', errorMessage);
      return { error: errorMessage };
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
      this.subscriptions.get(broadcastId)?.disconnect();
      this.subscriptions.delete(broadcastId);
    }

    return new Promise((resolve, reject) => {
      try {
        console.log('🔄 PollService: Setting up poll WebSocket for broadcast:', broadcastId);
        
        // Set up message handler
        const handleMessage = (message: any) => {
          console.log('📊 PollService: Received WebSocket message:', message);
          
          // Filter for poll messages
          if (message.type === 'poll' && message.broadcastId === broadcastId) {
            console.log('📊 PollService: Processing poll update:', message.data);
            if (typeof onPollUpdate === 'function') {
              onPollUpdate(message.data as PollUpdateMessage);
            }
          }
        };

        // Set up connection handlers
        const handleConnect = () => {
          console.log('✅ PollService: Poll WebSocket connected for broadcast:', broadcastId);
        };

        const handleDisconnect = () => {
          console.log('🔌 PollService: Poll WebSocket disconnected for broadcast:', broadcastId);
        };

        const handleError = (error: Event) => {
          console.error('❌ PollService: Poll WebSocket error for broadcast:', broadcastId, error);
        };

        // Connect to WebSocket for this broadcast
        websocketService.connect(broadcastId, authToken);
        
        // Set up event handlers
        websocketService.onMessage(handleMessage);
        websocketService.onConnect(handleConnect);
        websocketService.onDisconnect(handleDisconnect);
        websocketService.onError(handleError);

        // Create connection object with disconnect method
        const connection: PollConnection = {
          disconnect: () => {
            console.log('🧹 PollService: Manually disconnecting poll WebSocket for broadcast:', broadcastId);
            
            // Remove from subscriptions map
            this.subscriptions.delete(broadcastId);
            
            // Note: websocketService.disconnect() is managed globally, not per-service
            console.log('✅ PollService: Poll subscription cleaned up for broadcast:', broadcastId);
          }
        };

        // Store subscription
        this.subscriptions.set(broadcastId, connection);
        
        resolve(connection);
        
      } catch (error) {
        console.error('❌ PollService: Failed to setup poll WebSocket:', error);
        reject(error);
      }
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