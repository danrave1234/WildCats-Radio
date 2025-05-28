import { ChatMessageDTO, SendChatMessagePayload, getChatMessages, sendChatMessage } from './apiService';
import { websocketService } from './websocketService';

interface ChatConnection {
  disconnect: () => void;
}

class ChatService {
  private subscriptions: Map<number, ChatConnection> = new Map();

  /**
   * Get initial chat messages for a broadcast (HTTP call)
   * @param broadcastId - The broadcast ID
   * @param authToken - Authentication token
   * @returns Promise with messages or error
   */
  async getMessages(broadcastId: number, authToken: string): Promise<{ data: ChatMessageDTO[] } | { error: string }> {
    try {
      console.log('📝 ChatService: Fetching initial messages for broadcast:', broadcastId);
      const result = await getChatMessages(broadcastId, authToken);
      
      if ('error' in result) {
        console.error('❌ ChatService: Error fetching messages:', result.error);
        return { error: result.error };
      }
      
      console.log('✅ ChatService: Fetched', result.length, 'messages');
      return { data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ ChatService: Exception fetching messages:', errorMessage);
      return { error: errorMessage };
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
  ): Promise<{ data: ChatMessageDTO } | { error: string }> {
    try {
      console.log('💬 ChatService: Sending message for broadcast:', broadcastId, messageData);
      const result = await sendChatMessage(broadcastId, messageData, authToken);
      
      if ('error' in result) {
        console.error('❌ ChatService: Error sending message:', result.error);
        return { error: result.error || 'Failed to send message' };
      }
      
      console.log('✅ ChatService: Message sent successfully:', result.id);
      return { data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ ChatService: Exception sending message:', errorMessage);
      return { error: errorMessage };
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
    onNewMessage: (message: ChatMessageDTO) => void
  ): Promise<ChatConnection> {
    return new Promise((resolve, reject) => {
      console.log('🔔 ChatService: Setting up WebSocket subscription for broadcast:', broadcastId);
      
      // Clean up any existing subscription for this broadcast
      const existingConnection = this.subscriptions.get(broadcastId);
      if (existingConnection) {
        console.log('🧹 ChatService: Cleaning up existing subscription');
        existingConnection.disconnect();
        this.subscriptions.delete(broadcastId);
      }

      let isConnected = false;
      let connectionResolved = false;

      // Set up message handler
      const handleMessage = (message: any) => {
        if (message.type === 'chat' && message.broadcastId === broadcastId) {
          console.log('📨 ChatService: Received new chat message:', message.data);
          onNewMessage(message.data);
        }
      };

      // Set up connection handler
      const handleConnect = () => {
        console.log('✅ ChatService: WebSocket connected for broadcast:', broadcastId);
        isConnected = true;
        if (!connectionResolved) {
          connectionResolved = true;
          resolve(connection);
        }
      };

      // Set up disconnect handler
      const handleDisconnect = () => {
        console.log('🔴 ChatService: WebSocket disconnected for broadcast:', broadcastId);
        isConnected = false;
      };

      // Set up error handler
      const handleError = (error: Event) => {
        console.error('❌ ChatService: WebSocket error for broadcast:', broadcastId, error);
        isConnected = false;
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
          console.log('🔌 ChatService: Disconnecting chat subscription for broadcast:', broadcastId);
          websocketService.removeHandlers();
          websocketService.disconnect();
          this.subscriptions.delete(broadcastId);
          isConnected = false;
        }
      };

      // Store connection
      this.subscriptions.set(broadcastId, connection);

      // Timeout fallback for connection
      setTimeout(() => {
        if (!connectionResolved) {
          connectionResolved = true;
          if (isConnected) {
            resolve(connection);
          } else {
            reject(new Error('WebSocket connection timeout'));
          }
        }
      }, 10000); // 10 second timeout
    });
  }

  /**
   * Disconnect all chat subscriptions
   */
  disconnectAll(): void {
    console.log('🧹 ChatService: Disconnecting all chat subscriptions');
    this.subscriptions.forEach((connection, broadcastId) => {
      console.log('🔌 ChatService: Disconnecting subscription for broadcast:', broadcastId);
      connection.disconnect();
    });
    this.subscriptions.clear();
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
export const chatService = new ChatService();
export default chatService; 