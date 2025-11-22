// STOMP + SockJS WebSocket implementation for React Native (matches backend)
// Shared STOMP client manager for efficient connection multiplexing
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import ENV from '../config/environment';
import { createLogger } from './logger';

const logger = createLogger('StompClientManager');

interface WebSocketMessage {
  type: 'chat' | 'poll' | 'broadcast_update';
  data: any;
  broadcastId?: number;
}

interface WebSocketService {
  connect: (broadcastId: number, authToken: string) => void;
  disconnect: () => void;
  sendMessage: (message: any) => void;
  onMessage: (callback: (message: WebSocketMessage) => void) => void;
  onConnect: (callback: () => void) => void;
  onDisconnect: (callback: () => void) => void;
  onError: (callback: (error: any) => void) => void;
  isConnected: () => boolean;
  subscribe: (topic: string, callback: (message: any) => void) => { unsubscribe: () => void };
}

/**
 * Shared STOMP client manager for React Native (similar to web implementation)
 * Ensures a single underlying WebSocket connection is reused across features
 */
class StompClientManager {
  private stompClient: any = null;
  private connectPromise: Promise<any> | null = null;
  private subscriptions: Map<string, any> = new Map();

  private _getAuthHeaders(token?: string): any {
    const headers: any = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Ensure we have a STOMP client instance
   */
  private _ensureClient(): any {
    if (!this.stompClient) {
      const wsUrl = `${ENV.BACKEND_BASE_URL}/ws-radio`;
      logger.debug(`StompClientManager: Creating STOMP client for ${wsUrl}`);

      const sockjs = new SockJS(wsUrl);
      this.stompClient = Stomp.over(sockjs);

      // Configure for mobile reliability
      this.stompClient.debug = () => {}; // Disable debug logs
      this.stompClient.reconnect_delay = 0; // Manual reconnect handling
      this.stompClient.heartbeat = { outgoing: 20000, incoming: 20000 }; // 20s heartbeat
    }
    return this.stompClient;
  }

  /**
   * Connect the shared STOMP client (idempotent)
   */
  async connect(token?: string): Promise<any> {
    if (this.connectPromise) {
      return this.connectPromise;
    }

    const client = this._ensureClient();

    if (client.connected) {
      logger.debug('StompClientManager: STOMP already connected');
      this.connectPromise = Promise.resolve(client);
      return this.connectPromise;
    }

    const headers = this._getAuthHeaders(token);

    this.connectPromise = new Promise((resolve, reject) => {
      try {
        client.connect(
          headers,
          () => {
            logger.debug('StompClientManager: STOMP connected successfully');
            resolve(client);
          },
          (error: any) => {
            logger.error('StompClientManager: STOMP connection failed:', error);
            this.stompClient = null;
            this.connectPromise = null;
            reject(error);
          }
        );
      } catch (e) {
        logger.error('StompClientManager: STOMP connect threw error:', e);
        this.stompClient = null;
        this.connectPromise = null;
        reject(e);
      }
    });

    return this.connectPromise;
  }

  /**
   * Subscribe to a topic
   */
  async subscribe(topic: string, onMessage: (message: any) => void, token?: string): Promise<{ unsubscribe: () => void }> {
    const client = await this.connect(token);

    const subscription = client.subscribe(topic, (message: any) => {
      try {
        onMessage(message);
      } catch (e) {
        logger.error('StompClientManager: Error in subscription handler for topic', topic, e);
      }
    });

    this.subscriptions.set(topic, subscription);

    const unsubscribe = () => {
      try {
        subscription.unsubscribe();
      } catch (e) {
        logger.error('StompClientManager: Error unsubscribing from topic', topic, e);
      } finally {
        this.subscriptions.delete(topic);
      }
    };

    return { unsubscribe };
  }

  /**
   * Publish a message to a destination
   */
  async publish(destination: string, body: any, token?: string): Promise<void> {
    const client = await this.connect(token).catch((e) => {
      logger.error('StompClientManager: Cannot publish, failed to connect', e);
      return null;
    });

    if (!client || !client.connected) {
      logger.warn('StompClientManager: Cannot publish, client not connected', { destination });
      return;
    }

    try {
      const headers = this._getAuthHeaders(token);
      client.send(destination, headers, body != null ? JSON.stringify(body) : '{}');
    } catch (e) {
      logger.error('StompClientManager: Error publishing message', { destination, error: e });
    }
  }

  /**
   * Returns true if the shared client is connected
   */
  isConnected(): boolean {
    return !!(this.stompClient?.connected);
  }

  /**
   * Disconnect the shared client
   */
  disconnect(): void {
    if (this.stompClient?.connected) {
      try {
        this.stompClient.disconnect(() => {
          logger.debug('StompClientManager: STOMP disconnected');
        });
      } catch (e) {
        logger.error('StompClientManager: Error disconnecting STOMP:', e);
      }
    }
    this.stompClient = null;
    this.connectPromise = null;
    this.subscriptions.clear();
  }
}

// Singleton instance
const stompClientManager = new StompClientManager();

class WebSocketManager implements WebSocketService {
  private subscriptions: Map<string, any> = new Map();
  private messageHandlers: ((message: WebSocketMessage) => void)[] = [];
  private connectHandlers: (() => void)[] = [];
  private disconnectHandlers: (() => void)[] = [];
  private errorHandlers: ((error: any) => void)[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private currentBroadcastId: number | null = null;
  private currentAuthToken: string | null = null;
  private isConnecting = false;

  connect(broadcastId: number, authToken: string): void {
    // Skip if already connected to same broadcast using shared manager
    if (stompClientManager.isConnected() &&
        this.currentBroadcastId === broadcastId &&
        this.currentAuthToken === authToken) {
      console.log('📡 Already connected to broadcast', broadcastId, 'via shared STOMP client');
      this.connectHandlers.forEach(handler => handler());
      return;
    }

    // Skip if currently connecting
    if (this.isConnecting) {
      console.log('📡 Connection already in progress...');
      return;
    }

    this.isConnecting = true;
    this.currentBroadcastId = broadcastId;
    this.currentAuthToken = authToken;

    // Disconnect existing subscriptions (but keep shared STOMP connection alive)
    this.clearSubscriptions();

    try {
      console.log(`📡 Connecting to shared STOMP WebSocket for broadcast ${broadcastId}`);

      // Set connection timeout (increased for slow mobile connections)
      const connectionTimeout = setTimeout(() => {
        console.error('❌ WebSocket connection timeout after 20 seconds');
        this.isConnecting = false;
        this.errorHandlers.forEach(handler => handler({ type: 'timeout' }));
      }, 20000); // 20 second timeout for mobile

      // Connect using shared STOMP client manager
      stompClientManager.connect(authToken).then(
        () => {
          clearTimeout(connectionTimeout);
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          console.log('✅ Shared STOMP WebSocket connected successfully to broadcast', broadcastId);

          // Subscribe to topics if broadcastId > 0
          if (broadcastId > 0) {
            this.subscribeToTopics(broadcastId, authToken);
          }

          console.log(`📡 Calling ${this.connectHandlers.length} connect handlers`);
          this.connectHandlers.forEach(handler => handler());
        },
        (error: any) => {
          clearTimeout(connectionTimeout);
          this.isConnecting = false;

          const errorMsg = error?.message || error?.toString() || 'Unknown error';
          console.error('❌ Shared STOMP WebSocket connection failed:', errorMsg);

          this.errorHandlers.forEach(handler => handler(error || new Error('Connection failed')));
          this.disconnectHandlers.forEach(handler => handler());

          // Attempt reconnect
          this.attemptReconnect();
        }
      );

    } catch (error) {
      this.isConnecting = false;
      console.error('❌ Error connecting to shared STOMP WebSocket:', error);
      this.errorHandlers.forEach(handler => handler(error));
      this.disconnectHandlers.forEach(handler => handler());
    }
  }

  private async subscribeToTopics(broadcastId: number, authToken?: string): Promise<void> {
    if (!stompClientManager.isConnected()) return;

    try {
      // Subscribe to chat messages using shared manager
      const chatSub = await stompClientManager.subscribe(
        `/topic/broadcast/${broadcastId}/chat`,
        (message: any) => {
          try {
            const chatMessage = JSON.parse(message.body);
            this.messageHandlers.forEach(handler => handler({
              type: 'chat',
              data: chatMessage,
              broadcastId: broadcastId
            }));
          } catch (error) {
            console.error('❌ Error parsing chat message:', error);
          }
        },
        authToken
      );
      this.subscriptions.set('chat', chatSub);

      // Subscribe to polls using shared manager
      const pollSub = await stompClientManager.subscribe(
        `/topic/broadcast/${broadcastId}/polls`,
        (message: any) => {
          try {
            const pollData = JSON.parse(message.body);
            this.messageHandlers.forEach(handler => handler({
              type: 'poll',
              data: pollData,
              broadcastId: broadcastId
            }));
          } catch (error) {
            console.error('❌ Error parsing poll message:', error);
          }
        },
        authToken
      );
      this.subscriptions.set('poll', pollSub);

      // Subscribe to broadcast updates using shared manager
      const broadcastSub = await stompClientManager.subscribe(
        `/topic/broadcast/${broadcastId}`,
        (message: any) => {
          try {
            const broadcastData = JSON.parse(message.body);
            this.messageHandlers.forEach(handler => handler({
              type: 'broadcast_update',
              data: broadcastData,
              broadcastId: broadcastId
            }));
          } catch (error) {
            console.error('❌ Error parsing broadcast update:', error);
          }
        },
        authToken
      );
      this.subscriptions.set('broadcast', broadcastSub);

      console.log('✅ Subscribed to broadcast topics via shared STOMP client');
    } catch (error) {
      console.error('❌ Error subscribing to topics:', error);
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.errorHandlers.forEach(handler => handler({ type: 'max_reconnect_attempts' }));
      return;
    }

    if (!this.currentBroadcastId || !this.currentAuthToken) {
      return;
    }

    this.reconnectAttempts++;
    const delay = 3000; // 3 seconds

    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      if (this.currentBroadcastId && this.currentAuthToken) {
        this.connect(this.currentBroadcastId, this.currentAuthToken);
      }
    }, delay);
  }

  disconnect(): void {
    console.log('📡 Disconnecting from shared STOMP WebSocket...');

    // Unsubscribe from all topics (but keep shared connection alive)
    this.clearSubscriptions();

    // Disconnect shared STOMP client completely
    stompClientManager.disconnect();

    console.log('✅ Shared STOMP WebSocket disconnected');
    this.disconnectHandlers.forEach(handler => handler());

    this.currentBroadcastId = null;
    this.currentAuthToken = null;
    this.reconnectAttempts = 0;
    this.isConnecting = false;
  }

  async sendMessage(message: any): Promise<void> {
    if (!stompClientManager.isConnected()) {
      throw new Error('WebSocket not connected');
    }

    if (!this.currentBroadcastId) {
      throw new Error('No broadcast ID set');
    }

    try {
      const destination = `/app/broadcast/${this.currentBroadcastId}/chat`;
      await stompClientManager.publish(destination, message, this.currentAuthToken);
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      throw error;
    }
  }

  sendListenerStatus(action: 'START_LISTENING' | 'STOP_LISTENING', userId: number | null, userName: string): void {
    if (!stompClientManager.isConnected() || !this.currentBroadcastId) {
      return;
    }

    const message = {
      type: 'LISTENER_STATUS',
      action,
      broadcastId: this.currentBroadcastId,
      userId,
      userName,
      timestamp: Date.now()
    };

    try {
      stompClientManager.publish('/app/listener/status', message, this.currentAuthToken);
    } catch (error) {
      console.error(`❌ Failed to send listener ${action}:`, error);
    }
  }

  private clearSubscriptions(): void {
    // Unsubscribe from all topics but keep shared STOMP connection alive
    this.subscriptions.forEach((sub, key) => {
      try {
        sub.unsubscribe();
      } catch (error) {
        console.error(`❌ Error unsubscribing from ${key}:`, error);
      }
    });
    this.subscriptions.clear();
  }

  onMessage(callback: (message: WebSocketMessage) => void): void {
    if (!this.messageHandlers.includes(callback)) {
      this.messageHandlers.push(callback);
    }
  }

  onConnect(callback: () => void): void {
    if (!this.connectHandlers.includes(callback)) {
      this.connectHandlers.push(callback);
    }
  }

  onDisconnect(callback: () => void): void {
    if (!this.disconnectHandlers.includes(callback)) {
      this.disconnectHandlers.push(callback);
    }
  }

  onError(callback: (error: any) => void): void {
    if (!this.errorHandlers.includes(callback)) {
      this.errorHandlers.push(callback);
    }
  }

  isConnected(): boolean {
    return stompClientManager.isConnected();
  }

  removeHandlers(): void {
    this.messageHandlers = [];
    this.connectHandlers = [];
    this.disconnectHandlers = [];
    this.errorHandlers = [];
  }

  subscribe(topic: string, callback: (message: any) => void): { unsubscribe: () => void } {
    if (!stompClientManager.isConnected()) {
      throw new Error('Shared STOMP client not connected');
    }

    // Use shared manager for subscriptions
    const subscription = stompClientManager.subscribe(topic, (message: any) => {
      try {
        callback(message);
      } catch (error) {
        console.error(`❌ Error handling message from ${topic}:`, error);
      }
    }, this.currentAuthToken);

    return subscription;
  }
}

export const websocketService = new WebSocketManager();
export type { WebSocketMessage, WebSocketService };
