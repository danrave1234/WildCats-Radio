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
  subscribe: (topic: string, callback: (message: any) => void, token?: string) => Promise<{ unsubscribe: () => void }>;
}

/**
 * Shared STOMP client manager for React Native (similar to web implementation)
 * Ensures a single underlying WebSocket connection is reused across features
 */
class StompClientManager {
  private stompClient: any = null;
  private connectPromise: Promise<any> | null = null;
  private subscriptions: Map<string, { callback: (message: any) => void; token?: string }> = new Map();
  private lastConnectionAttempt: number = 0;
  private readonly CONNECTION_COOLDOWN_MS = 2000; // Prevent rapid reconnection attempts
  private isReconnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

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

      const socketFactory = () => new SockJS(wsUrl);
      this.stompClient = Stomp.over(socketFactory);

      // Configure for mobile reliability
      this.stompClient.debug = () => {}; // Disable debug logs
      this.stompClient.reconnect_delay = 0; // Manual reconnect handling (we handle it ourselves)
      // Balanced heartbeat - not too frequent (battery drain) but frequent enough to detect disconnects
      this.stompClient.heartbeat = { outgoing: 15000, incoming: 15000 }; // 15s heartbeat
      
      // Add error handler to detect disconnections
      this.stompClient.onStompError = (frame: any) => {
        logger.error('StompClientManager: STOMP error frame:', frame);
        // On error, mark as disconnected but keep client for potential recovery
        if (this.stompClient && frame.command === 'ERROR') {
          logger.warn('StompClientManager: STOMP protocol error, connection may be lost');
        }
      };
      
      // Add WebSocket error handler
      this.stompClient.onWebSocketError = (error: any) => {
        logger.error('StompClientManager: WebSocket error:', error);
        // Mark connection as failed
        if (this.stompClient) {
          this.stompClient.connected = false;
        }
      };
      
      // Add WebSocket close handler
      this.stompClient.onWebSocketClose = (event: any) => {
        logger.warn('StompClientManager: WebSocket closed:', { code: event.code, reason: event.reason });
        // Mark as disconnected but don't clear client immediately
        if (this.stompClient) {
          this.stompClient.connected = false;
        }
        // Clear connect promise so next subscribe can reconnect
        this.connectPromise = null;
        
        // Auto-reconnect if we have active subscriptions
        if (this.subscriptions.size > 0 && !this.isReconnecting) {
          logger.info(`StompClientManager: Connection lost with ${this.subscriptions.size} active subscriptions, attempting reconnect...`);
          this.attemptReconnect();
        }
      };
    }
    return this.stompClient;
  }

  /**
   * Connect the shared STOMP client (idempotent with connection health monitoring)
   */
  async connect(token?: string): Promise<any> {
    // If already connected and healthy, return immediately
    const client = this._ensureClient();
    if (client.connected) {
      logger.debug('StompClientManager: STOMP already connected');
      // Clear any stale connectPromise
      this.connectPromise = null;
      return Promise.resolve(client);
    }

    // Prevent rapid reconnection attempts (cooldown period)
    const now = Date.now();
    if (now - this.lastConnectionAttempt < this.CONNECTION_COOLDOWN_MS) {
      const waitTime = this.CONNECTION_COOLDOWN_MS - (now - this.lastConnectionAttempt);
      logger.debug(`StompClientManager: Connection cooldown, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // If connection is in progress, wait for it
    if (this.connectPromise) {
      logger.debug('StompClientManager: Connection already in progress, waiting...');
      return this.connectPromise;
    }

    this.lastConnectionAttempt = Date.now();

    const headers = this._getAuthHeaders(token);

    this.connectPromise = new Promise((resolve, reject) => {
      const connectionTimeout = setTimeout(() => {
        logger.error('StompClientManager: Connection timeout after 15 seconds');
        this.stompClient = null;
        this.connectPromise = null;
        reject(new Error('Connection timeout'));
      }, 15000);

      try {
        client.connect(
          headers,
          () => {
            clearTimeout(connectionTimeout);
            logger.debug('StompClientManager: STOMP connected successfully');
            this.connectPromise = null; // Clear promise on success
            // Set up connection health monitoring
            this._setupConnectionHealthMonitoring();
            resolve(client);
          },
          (error: any) => {
            clearTimeout(connectionTimeout);
            logger.error('StompClientManager: STOMP connection failed:', error);
            this.stompClient = null;
            this.connectPromise = null;
            reject(error);
          }
        );
      } catch (e) {
        clearTimeout(connectionTimeout);
        logger.error('StompClientManager: STOMP connect threw error:', e);
        this.stompClient = null;
        this.connectPromise = null;
        reject(e);
      }
    });

    return this.connectPromise;
  }

  /**
   * Monitor connection health and auto-reconnect if needed
   */
  private _setupConnectionHealthMonitoring(): void {
    // Clear any existing monitoring
    if ((this as any).healthCheckInterval) {
      clearInterval((this as any).healthCheckInterval);
    }

    // Check connection health every 30 seconds
    (this as any).healthCheckInterval = setInterval(() => {
      if (this.stompClient) {
        if (!this.stompClient.connected) {
          logger.warn('StompClientManager: Connection lost, attempting reconnect...');
          // Trigger reconnection if we have active subscriptions
          if (this.subscriptions.size > 0 && !this.isReconnecting) {
            this.attemptReconnect();
          }
        } else {
          logger.debug('StompClientManager: Connection healthy');
          // Reset reconnect attempts on successful health check
          this.reconnectAttempts = 0;
        }
      }
    }, 30000);
  }

  /**
   * Subscribe to a topic (prevents duplicate subscriptions, auto-reconnects)
   */
  async subscribe(topic: string, onMessage: (message: any) => void, token?: string): Promise<{ unsubscribe: () => void }> {
    // Store subscription info for reconnection
    const subscriptionInfo = { callback: onMessage, token };
    
    // Check if we already have a subscription for this topic
    if (this.subscriptions.has(topic)) {
      logger.debug(`StompClientManager: Already subscribed to ${topic}, updating callback`);
      // Update the callback in case it changed
      this.subscriptions.set(topic, subscriptionInfo);
      // Return a no-op unsubscribe since we're reusing
      return {
        unsubscribe: () => {
          logger.debug(`StompClientManager: Unsubscribe requested for ${topic}`);
          this.subscriptions.delete(topic);
        }
      };
    }

    // Store subscription info before connecting (for reconnection)
    this.subscriptions.set(topic, subscriptionInfo);

    try {
      const client = await this.connect(token);

      // Double-check connection before subscribing
      if (!client.connected) {
        logger.warn(`StompClientManager: Client not connected, attempting reconnect for ${topic}`);
        // Wait a bit and try again
        await new Promise(resolve => setTimeout(resolve, 500));
        const reconnectedClient = await this.connect(token);
        if (!reconnectedClient.connected) {
          throw new Error(`Failed to connect STOMP client for topic ${topic}`);
        }
      }

      const subscription = client.subscribe(topic, (message: any) => {
        try {
          onMessage(message);
        } catch (e) {
          logger.error('StompClientManager: Error in subscription handler for topic', topic, e);
        }
      });

      logger.debug(`StompClientManager: Subscribed to ${topic}`);

      const unsubscribe = () => {
        try {
          if (subscription && typeof subscription.unsubscribe === 'function') {
            subscription.unsubscribe();
            logger.debug(`StompClientManager: Unsubscribed from ${topic}`);
          }
        } catch (e) {
          logger.error('StompClientManager: Error unsubscribing from topic', topic, e);
        } finally {
          this.subscriptions.delete(topic);
        }
      };

      return { unsubscribe };
    } catch (error) {
      // If subscription fails, remove from tracking
      this.subscriptions.delete(topic);
      throw error;
    }
  }

  /**
   * Attempt to reconnect and re-subscribe to all topics
   */
  private async attemptReconnect(): Promise<void> {
    if (this.isReconnecting) {
      logger.debug('StompClientManager: Reconnection already in progress');
      return;
    }

    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      logger.error(`StompClientManager: Max reconnection attempts (${this.MAX_RECONNECT_ATTEMPTS}) reached`);
      this.reconnectAttempts = 0; // Reset for next time
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);
    logger.info(`StompClientManager: Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);

    this.reconnectTimeout = setTimeout(async () => {
      try {
        // Clear the old client
        if (this.stompClient) {
          try {
            if (this.stompClient.connected) {
              this.stompClient.disconnect();
            }
          } catch (e) {
            // Ignore errors during cleanup
          }
          this.stompClient = null;
        }
        this.connectPromise = null;

        // Get the first token from subscriptions (they should all use the same token)
        const firstSub = Array.from(this.subscriptions.values())[0];
        const token = firstSub?.token;

        // Reconnect
        const client = await this.connect(token);
        
        if (client.connected) {
          logger.info(`StompClientManager: Reconnected successfully, re-subscribing to ${this.subscriptions.size} topics`);
          
          // Re-subscribe to all topics
          const topicsToResubscribe = Array.from(this.subscriptions.entries());
          for (const [topic, info] of topicsToResubscribe) {
            try {
              const subscription = client.subscribe(topic, (message: any) => {
                try {
                  info.callback(message);
                } catch (e) {
                  logger.error(`StompClientManager: Error in re-subscribed handler for ${topic}:`, e);
                }
              });
              logger.debug(`StompClientManager: Re-subscribed to ${topic}`);
            } catch (e) {
              logger.error(`StompClientManager: Failed to re-subscribe to ${topic}:`, e);
            }
          }

          this.reconnectAttempts = 0; // Reset on success
          this.isReconnecting = false;
        } else {
          throw new Error('Reconnection failed - client not connected');
        }
      } catch (error) {
        logger.error('StompClientManager: Reconnection attempt failed:', error);
        this.isReconnecting = false;
        // Try again if we haven't exceeded max attempts
        if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS && this.subscriptions.size > 0) {
          this.attemptReconnect();
        } else {
          this.reconnectAttempts = 0; // Reset for next time
        }
      }
    }, delay) as any;
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
    // Clear reconnection timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Clear health monitoring
    if ((this as any).healthCheckInterval) {
      clearInterval((this as any).healthCheckInterval);
      (this as any).healthCheckInterval = null;
    }

    // Stop reconnection attempts
    this.isReconnecting = false;
    this.reconnectAttempts = 0;

    // Unsubscribe from all topics first
    this.subscriptions.forEach((sub, topic) => {
      try {
        // Note: sub is now { callback, token }, not a subscription object
        // The actual subscription was created by STOMP and will be cleaned up when we disconnect
      } catch (e) {
        logger.error(`StompClientManager: Error cleaning up ${topic}:`, e);
      }
    });
    this.subscriptions.clear();

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

  onMessage(callback: (message: WebSocketMessage) => void): () => void {
    if (!this.messageHandlers.includes(callback)) {
      this.messageHandlers.push(callback);
    }
    return () => {
      this.messageHandlers = this.messageHandlers.filter((handler) => handler !== callback);
    };
  }

  offMessage(callback: (message: WebSocketMessage) => void): void {
    this.messageHandlers = this.messageHandlers.filter((handler) => handler !== callback);
  }

  onConnect(callback: () => void): () => void {
    if (!this.connectHandlers.includes(callback)) {
      this.connectHandlers.push(callback);
    }
    return () => {
      this.connectHandlers = this.connectHandlers.filter((handler) => handler !== callback);
    };
  }

  offConnect(callback: () => void): void {
    this.connectHandlers = this.connectHandlers.filter((handler) => handler !== callback);
  }

  onDisconnect(callback: () => void): () => void {
    if (!this.disconnectHandlers.includes(callback)) {
      this.disconnectHandlers.push(callback);
    }
    return () => {
      this.disconnectHandlers = this.disconnectHandlers.filter((handler) => handler !== callback);
    };
  }

  offDisconnect(callback: () => void): void {
    this.disconnectHandlers = this.disconnectHandlers.filter((handler) => handler !== callback);
  }

  onError(callback: (error: any) => void): () => void {
    if (!this.errorHandlers.includes(callback)) {
      this.errorHandlers.push(callback);
    }
    return () => {
      this.errorHandlers = this.errorHandlers.filter((handler) => handler !== callback);
    };
  }

  offError(callback: (error: any) => void): void {
    this.errorHandlers = this.errorHandlers.filter((handler) => handler !== callback);
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

  async subscribe(topic: string, callback: (message: any) => void, token?: string): Promise<{ unsubscribe: () => void }> {
    const effectiveToken = token && token.length > 0 ? token : this.currentAuthToken || undefined;

    if (token !== undefined) {
      this.currentAuthToken = token;
    }

    const subscription = await stompClientManager.subscribe(
      topic,
      (message: any) => {
        try {
          callback(message);
        } catch (error) {
          console.error(`❌ Error handling message from ${topic}:`, error);
        }
      },
      effectiveToken
    );

    this.subscriptions.set(topic, subscription);

    return subscription;
  }
}

export const websocketService = new WebSocketManager();
export type { WebSocketMessage, WebSocketService };
