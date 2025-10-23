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
  async getMessages(broadcastId: number, authToken: string): Promise<ServiceResult<ChatMessageDTO[]>> {
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
    authToken: string,
    onNewMessage: (message: ChatMessageDTO) => void,
    options?: ServiceSubscriptionOptions
  ): Promise<ChatConnection> {
    return new Promise((resolve, reject) => {
      // Clean up any existing subscription for this broadcast
      this.cleanupSubscription(broadcastId);

      let isConnected = false;
      let connectionResolved = false;

      // Set up message handler
      const handleMessage = (message: any) => {
        if (message.type === 'chat' && message.broadcastId === broadcastId) {
          onNewMessage(message.data);
        }
      };

      // Set up connection handler
      const handleConnect = () => {
        isConnected = true;
        options?.onConnectionChange?.(true);
        if (!connectionResolved) {
          connectionResolved = true;
          resolve(connection);
        }
      };

      // Set up disconnect handler
      const handleDisconnect = () => {
        isConnected = false;
        options?.onConnectionChange?.(false);
      };

      // Set up error handler
      const handleError = (error: any) => {
        this.handleError(error, `ChatService: WebSocket error for broadcast ${broadcastId}`);
        isConnected = false;
        options?.onConnectionChange?.(false);
        options?.onError?.(error);
        if (!connectionResolved) {
          connectionResolved = true;
          reject(new Error('Failed to connect to chat WebSocket'));
        }
      };

      // Set up WebSocket handlers
      websocketService.onMessage(handleMessage);
      websocketService.onConnect(handleConnect);
      websocketService.onDisconnect(handleDisconnect);
      websocketService.onError(handleError);

      // Connect to WebSocket
      websocketService.connect(broadcastId, authToken);

      // Create connection object
      const connection: ChatConnection = {
        disconnect: () => {
          websocketService.removeHandlers();
          websocketService.disconnect();
          this.subscriptions.delete(broadcastId);
          isConnected = false;
        }
      };

      // Store connection
      this.subscriptions.set(broadcastId, connection);

      // Timeout fallback for connection (match WebSocket timeout)
      setTimeout(() => {
        if (!connectionResolved) {
          connectionResolved = true;
          if (isConnected) {
            resolve(connection);
          } else {
            reject(new Error('WebSocket connection timeout after 20 seconds'));
          }
        }
      }, 25000); // 25 second timeout (5 seconds longer than WebSocket timeout)
    });
  }

  /**
   * Subscribe to global broadcast updates (start/end events)
   * @param callback - Callback function for broadcast updates
   * @returns Promise with connection or error
   */
  async subscribeToGlobalBroadcastUpdates(
    callback: (update: { type: string; broadcast?: any; broadcastId?: number }) => void,
    authToken?: string
  ): Promise<ServiceResult<ChatConnection>> {
    return new Promise((resolve, reject) => {
      // Set up connection handler to wait for connection before subscribing
      const handleConnect = () => {
        try {
          // Subscribe to global broadcast topic
          const subscription = websocketService.subscribe('/topic/broadcasts/global', (message) => {
            try {
              const update = JSON.parse(message.body);
              callback(update);
            } catch (error) {
              console.error('❌ ChatService: Error parsing global broadcast update:', error);
            }
          });

          resolve(this.createResult({
            disconnect: () => {
              subscription?.unsubscribe();
            }
          }));
        } catch (error) {
          const errorMessage = this.handleError(error, 'ChatService: Failed to subscribe to global updates');
          reject(new Error(errorMessage));
        }
      };

      // Set up error handler
      const handleError = (error: any) => {
        const errorMessage = this.handleError(error, 'ChatService: WebSocket connection error');
        reject(new Error(errorMessage));
      };

      // Register handlers
      websocketService.onConnect(handleConnect);
      websocketService.onError(handleError);
      
      // Start the connection
      websocketService.connect(0, authToken || ''); // Use broadcast ID 0 for global updates
      
      // Set a timeout to prevent hanging (match WebSocket timeout)
      setTimeout(() => {
        if (!websocketService.isConnected()) {
          reject(new Error('WebSocket connection timeout after 20 seconds'));
        }
      }, 25000); // 25 second timeout (5 seconds longer than WebSocket timeout)
    });
  }
}

// Export a singleton instance
export const chatService = new ChatService();
export default chatService; 