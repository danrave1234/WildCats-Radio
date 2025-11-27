import { ChatMessage } from './broadcastService';
import { websocketService } from './websocketService';
import { BaseService, ServiceConnection, ServiceResult, ServiceSubscriptionOptions } from './baseService';
import { createLogger } from './logger';

const logger = createLogger('ChatService');

interface ChatConnection extends ServiceConnection {}

class ChatService extends BaseService<ChatConnection> {
  /**
   * Subscribe to real-time chat messages for a broadcast (WebSocket)
   * @param broadcastId - The broadcast ID
   * @param authToken - Authentication token (optional)
   * @param onNewMessage - Callback for new messages
   * @param options - Subscription options
   * @returns Promise with connection object
   */
  async subscribeToChatMessages(
    broadcastId: number,
    authToken?: string,
    onNewMessage?: (message: ChatMessage) => void,
    options?: ServiceSubscriptionOptions
  ): Promise<ChatConnection> {
    // Clean up any existing subscription for this broadcast
    this.cleanupSubscription(broadcastId);

    try {
      // Subscribe directly to the chat topic
      const subscription = await websocketService.subscribe(
        `/topic/broadcast/${broadcastId}/chat`,
        (message: any) => {
          try {
            const raw = typeof message?.body === 'string' ? JSON.parse(message.body) : message;
            // Normalize backend DTO: ensure createdAt exists
            const normalized: ChatMessage = {
              ...raw,
              createdAt: raw?.createdAt ?? raw?.timestamp ?? raw?.created_at ?? new Date().toISOString(),
            };
            if (onNewMessage) {
              onNewMessage(normalized);
            }
          } catch (error) {
            logger.error('Error parsing chat message:', error);
            options?.onError?.(error);
          }
        },
        authToken
      );

      options?.onConnectionChange?.(true);

      const connection: ChatConnection = {
        disconnect: () => {
          try {
            subscription?.unsubscribe?.();
          } catch (error) {
            logger.error('Error unsubscribing from chat:', error);
          }
          options?.onConnectionChange?.(false);
          this.subscriptions.delete(broadcastId);
        },
      };

      // Store connection
      this.subscriptions.set(broadcastId, connection);
      logger.debug(`Subscribed to chat for broadcast ${broadcastId}`);
      return connection;
    } catch (error: any) {
      logger.error('Failed to subscribe to chat messages:', error);
      options?.onError?.(error);
      options?.onConnectionChange?.(false);
      
      // Return a connection object that does nothing (graceful degradation)
      const connection: ChatConnection = {
        disconnect: () => {
          this.subscriptions.delete(broadcastId);
        },
      };
      return connection;
    }
  }

  /**
   * Subscribe to global broadcast updates (start/end events)
   * @param callback - Callback function for broadcast updates
   * @param authToken - Authentication token (optional)
   * @returns Promise with connection or error
   */
  async subscribeToGlobalBroadcastUpdates(
    callback: (update: {
      type: string;
      broadcast?: any;
      broadcastId?: number;
      data?: any;
      listenerCount?: number;
      message?: string;
      timestamp?: number;
    }) => void,
    authToken?: string
  ): Promise<ServiceResult<ChatConnection>> {
    try {
      const subscription = await websocketService.subscribe(
        '/topic/broadcast/status',
        (message: any) => {
          try {
            const payload = typeof message?.body === 'string' ? JSON.parse(message.body) : message;
            callback(payload);
          } catch (error) {
            logger.error('Error parsing global broadcast update:', error);
          }
        },
        authToken
      );

      return this.createResult({
        disconnect: () => {
          try {
            subscription?.unsubscribe();
          } catch (error) {
            logger.error('Failed to unsubscribe from global updates:', error);
          }
        },
      });
    } catch (error) {
      const errorMessage = this.handleError(error, 'ChatService: Failed to subscribe to global updates');
      return this.createResult(undefined, errorMessage);
    }
  }
}

// Export a singleton instance
export const chatService = new ChatService();
export default chatService;

