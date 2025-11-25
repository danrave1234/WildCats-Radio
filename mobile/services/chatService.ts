import { ChatMessageDTO, SendChatMessagePayload, getChatMessages, sendChatMessage } from './apiService';
import { websocketService } from './websocketService';
import { BaseService, ServiceConnection, ServiceResult, ServiceSubscriptionOptions } from './baseService';
import ENV from '../config/environment';

interface ChatConnection extends ServiceConnection {}

class ChatService extends BaseService<ChatConnection> {

  /**
   * Get initial chat messages for a broadcast (HTTP call)
   * @param broadcastId - The broadcast ID
   * @param authToken - Authentication token
   * @returns Promise with messages or error
   */
  async getMessages(broadcastId: number, authToken?: string): Promise<ServiceResult<ChatMessageDTO[]>> {
    try {
      const result = await getChatMessages(broadcastId, authToken);
      
      if ('error' in result) {
        return this.createResult(undefined, result.error);
      }
      
      return this.createResult(result);
    } catch (error) {
      const errorMessage = this.handleError(error, 'ChatService: Exception fetching messages');
      return this.createResult(undefined, errorMessage);
    }
  }

  /**
   * Send a chat message (HTTP call)
   * @param broadcastId - The broadcast ID
   * @param messageData - Message content
   * @param authToken - Authentication token
   * @returns Promise with sent message or error
   */
  async sendMessage(
    broadcastId: number, 
    messageData: SendChatMessagePayload, 
    authToken: string
  ): Promise<ServiceResult<ChatMessageDTO>> {
    try {
      const result = await sendChatMessage(broadcastId, messageData, authToken);
      
      if ('error' in result) {
        return this.createResult(undefined, result.error || 'Failed to send message');
      }
      
      return this.createResult(result);
    } catch (error) {
      const errorMessage = this.handleError(error, 'ChatService: Exception sending message');
      return this.createResult(undefined, errorMessage);
    }
  }

  /**
   * Subscribe to real-time chat messages for a broadcast (WebSocket)
   * @param broadcastId - The broadcast ID
   * @param authToken - Authentication token
   * @param onNewMessage - Callback for new messages
   * @returns Promise with connection object
   */
  async subscribeToChatMessages(
    broadcastId: number,
    authToken?: string,
    onNewMessage: (message: ChatMessageDTO) => void,
    options?: ServiceSubscriptionOptions
  ): Promise<ChatConnection> {
    // Clean up any existing subscription for this broadcast
    this.cleanupSubscription(broadcastId);

    // Subscribe directly to the chat topic (match website behavior)
    const subscription = await websocketService.subscribe(
      `/topic/broadcast/${broadcastId}/chat`,
      (message: any) => {
        try {
          const raw = typeof message?.body === 'string' ? JSON.parse(message.body) : message;
          // Normalize backend DTO: ensure createdAt exists (fallback to timestamp)
          const normalized = {
            ...raw,
            createdAt: raw?.createdAt ?? raw?.timestamp ?? raw?.created_at ?? raw?.time,
          } as ChatMessageDTO;
          onNewMessage(normalized);
        } catch (error) {
          options?.onError?.(error);
        }
      },
      authToken
    ).catch((err) => {
      options?.onError?.(err);
      throw err;
    });

    options?.onConnectionChange?.(true);

    const connection: ChatConnection = {
      disconnect: () => {
        try {
          subscription?.unsubscribe?.();
        } catch {}
        options?.onConnectionChange?.(false);
        this.subscriptions.delete(broadcastId);
      }
    };

    // Store connection
    this.subscriptions.set(broadcastId, connection);
    return connection;
  }

  /**
   * Subscribe to global broadcast updates (start/end events)
   * @param callback - Callback function for broadcast updates
   * @returns Promise with connection or error
   */
  async subscribeToGlobalBroadcastUpdates(
    callback: (update: { type: string; broadcast?: any; broadcastId?: number; data?: any; listenerCount?: number }) => void,
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
            console.error('❌ ChatService: Error parsing global broadcast update:', error);
          }
        },
        authToken
      );

      return this.createResult({
        disconnect: () => {
          try {
            subscription?.unsubscribe();
          } catch (error) {
            console.error('❌ ChatService: Failed to unsubscribe from global updates:', error);
          }
        }
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