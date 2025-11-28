import { config } from '../config';
import { websocketService } from './websocketService';
import { BaseService, ServiceConnection, ServiceResult, ServiceSubscriptionOptions } from './baseService';
import { createLogger } from './logger';

const logger = createLogger('PollService');

const getApiUrl = (endpoint: string) => {
  const baseUrl = config.apiBaseUrl.replace(/\/$/, '');
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.replace('/api', '');
  }
  return `${baseUrl}${cleanEndpoint}`;
};

export interface PollOption {
  id: number;
  text: string;
  voteCount: number;
}

export interface Poll {
  id: number;
  question: string;
  options: PollOption[];
  isActive: boolean;
  isEnded: boolean;
  broadcastId: number;
  createdAt: string;
}

export interface VotePayload {
  optionId: number;
}

interface PollConnection extends ServiceConnection {}

interface PollUpdateMessage {
  type: 'POLL_VOTE' | 'NEW_POLL' | 'POLL_UPDATED' | 'POLL_RESULTS' | 'POLL_DELETED';
  pollId?: number;
  poll?: Poll;
  results?: any;
}

class PollService extends BaseService<PollConnection> {
  async getActivePolls(broadcastId: number, authToken: string): Promise<ServiceResult<Poll[]>> {
    try {
      const response = await fetch(getApiUrl(`/broadcasts/${broadcastId}/polls/active`), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch active polls');
      }

      const data = await response.json();
      return this.createResult(Array.isArray(data) ? data : []);
    } catch (error) {
      const errorMessage = this.handleError(error, 'PollService: Exception fetching active polls');
      return this.createResult(undefined, errorMessage);
    }
  }

  async voteOnPoll(pollId: number, voteData: VotePayload, authToken: string): Promise<ServiceResult<any>> {
    try {
      const response = await fetch(getApiUrl(`/polls/${pollId}/vote`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        credentials: 'include',
        body: JSON.stringify(voteData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to vote on poll');
      }

      return this.createResult(await response.json());
    } catch (error) {
      const errorMessage = this.handleError(error, 'PollService: Exception voting on poll');
      return this.createResult(undefined, errorMessage);
    }
  }

  async subscribeToPolls(
    broadcastId: number,
    authToken: string,
    onPollUpdate: (update: PollUpdateMessage) => void
  ): Promise<PollConnection> {
    this.cleanupSubscription(broadcastId);

    try {
      const subscription = await websocketService.subscribe(
        `/topic/broadcast/${broadcastId}/polls`,
        (message: any) => {
          try {
            const payload = typeof message?.body === 'string' ? JSON.parse(message.body) : message;
            onPollUpdate(payload);
          } catch (error) {
            logger.error('Error parsing poll update:', error);
          }
        },
        authToken
      );

      const connection: PollConnection = {
        disconnect: () => {
          try {
            subscription?.unsubscribe?.();
          } catch (error) {
            logger.error('Error unsubscribing from polls:', error);
          }
          this.subscriptions.delete(broadcastId);
        },
      };

      this.subscriptions.set(broadcastId, connection);
      return connection;
    } catch (error) {
      logger.error('Failed to subscribe to polls:', error);
      const connection: PollConnection = {
        disconnect: () => {
          this.subscriptions.delete(broadcastId);
        },
      };
      return connection;
    }
  }
}

export const pollService = new PollService();
export default pollService;


