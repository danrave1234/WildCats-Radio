// STOMP + SockJS WebSocket implementation for React Native
// NOTE: Requires installation of @stomp/stompjs and sockjs-client packages
import { config } from '../config';
import { createLogger } from './logger';

const logger = createLogger('WebSocketService');

// Dynamic imports to handle missing packages gracefully
let SockJS: any = null;
let Stomp: any = null;

// Try to load STOMP libraries (will fail gracefully if not installed)
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SockJS = require('sockjs-client');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Stomp = require('@stomp/stompjs').Stomp;
} catch (error) {
  logger.warn('STOMP libraries not installed. WebSocket features will be disabled.');
  logger.warn('Install with: npm install @stomp/stompjs sockjs-client');
}

interface Subscription {
  unsubscribe: () => void;
}

class WebSocketService {
  private stompClient: any = null;
  private connectPromise: Promise<any> | null = null;
  private subscriptions: Map<string, { callback: (message: any) => void; token?: string }> = new Map();
  private lastConnectionAttempt: number = 0;
  private readonly CONNECTION_COOLDOWN_MS = 2000;
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

  private _ensureClient(): any {
    if (!SockJS || !Stomp) {
      throw new Error('STOMP libraries not installed. Please run: npm install @stomp/stompjs sockjs-client');
    }

    if (!this.stompClient) {
      const wsUrl = `${config.backendBaseUrl}/ws-radio`;
      logger.debug(`Creating STOMP client for ${wsUrl}`);

      const socketFactory = () => new SockJS(wsUrl);
      this.stompClient = Stomp.over(socketFactory);

      this.stompClient.debug = () => {}; // Disable debug logs
      this.stompClient.reconnect_delay = 0; // Manual reconnect handling
      this.stompClient.heartbeat = { outgoing: 15000, incoming: 15000 }; // 15s heartbeat
      
      this.stompClient.onStompError = (frame: any) => {
        logger.error('STOMP error frame:', frame);
      };
      
      this.stompClient.onWebSocketError = (error: any) => {
        logger.error('WebSocket error:', error);
      };
      
      this.stompClient.onWebSocketClose = (event: any) => {
        logger.warn('WebSocket closed:', { code: event.code, reason: event.reason });
        this.connectPromise = null;
        
        if (this.subscriptions.size > 0 && !this.isReconnecting) {
          logger.info(`Connection lost with ${this.subscriptions.size} active subscriptions, attempting reconnect...`);
          this.attemptReconnect();
        }
      };
    }
    return this.stompClient;
  }

  async connect(token?: string): Promise<any> {
    if (!SockJS || !Stomp) {
      throw new Error('STOMP libraries not installed');
    }

    const client = this._ensureClient();
    if (client.connected) {
      logger.debug('STOMP already connected');
      this.connectPromise = null;
      return Promise.resolve(client);
    }

    const now = Date.now();
    if (now - this.lastConnectionAttempt < this.CONNECTION_COOLDOWN_MS) {
      const waitTime = this.CONNECTION_COOLDOWN_MS - (now - this.lastConnectionAttempt);
      logger.debug(`Connection cooldown, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    if (this.connectPromise) {
      logger.debug('Connection already in progress, waiting...');
      return this.connectPromise;
    }

    this.lastConnectionAttempt = Date.now();
    const headers = this._getAuthHeaders(token);

    this.connectPromise = new Promise((resolve, reject) => {
      const connectionTimeout = setTimeout(() => {
        logger.error('Connection timeout after 30 seconds');
        this.stompClient = null;
        this.connectPromise = null;
        reject(new Error('Connection timeout'));
      }, 30000);

      try {
        client.connect(
          headers,
          () => {
            clearTimeout(connectionTimeout);
            logger.debug('STOMP connected successfully');
            this.connectPromise = null;
            this.reconnectAttempts = 0;
            resolve(client);
          },
          (error: any) => {
            clearTimeout(connectionTimeout);
            logger.error('STOMP connection failed:', error);
            this.connectPromise = null;
            reject(error);
          }
        );
      } catch (error) {
        clearTimeout(connectionTimeout);
        this.connectPromise = null;
        reject(error);
      }
    });

    return this.connectPromise;
  }

  private attemptReconnect(): void {
    if (this.isReconnecting || this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      logger.warn('Max reconnect attempts reached or already reconnecting');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    logger.info(`Attempting reconnect ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);

    this.reconnectTimeout = setTimeout(async () => {
      try {
        // Get token from first subscription if available
        const firstSub = Array.from(this.subscriptions.values())[0];
        const token = firstSub?.token;

        await this.connect(token);
        this.isReconnecting = false;
        this.reconnectAttempts = 0;

        // Re-subscribe to all topics
        for (const [topic, sub] of this.subscriptions.entries()) {
          try {
            await this.subscribe(topic, sub.callback, sub.token);
          } catch (error) {
            logger.error(`Failed to re-subscribe to ${topic}:`, error);
          }
        }
      } catch (error) {
        logger.error('Reconnect failed:', error);
        this.isReconnecting = false;
        if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
          this.attemptReconnect();
        }
      }
    }, delay);
  }

  async subscribe(
    topic: string,
    callback: (message: any) => void,
    token?: string
  ): Promise<Subscription> {
    if (!SockJS || !Stomp) {
      throw new Error('STOMP libraries not installed. Please run: npm install @stomp/stompjs sockjs-client');
    }

    try {
      const client = await this.connect(token);
      
      const subscription = client.subscribe(topic, (message: any) => {
        try {
          callback(message);
        } catch (error) {
          logger.error(`Error in subscription callback for ${topic}:`, error);
        }
      });

      this.subscriptions.set(topic, { callback, token });

      return {
        unsubscribe: () => {
          try {
            subscription.unsubscribe();
            this.subscriptions.delete(topic);
            logger.debug(`Unsubscribed from ${topic}`);
          } catch (error) {
            logger.error(`Error unsubscribing from ${topic}:`, error);
          }
        },
      };
    } catch (error) {
      logger.error(`Failed to subscribe to ${topic}:`, error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.stompClient && this.stompClient.connected) {
      try {
        this.stompClient.disconnect();
        logger.debug('STOMP disconnected');
      } catch (error) {
        logger.error('Error disconnecting STOMP:', error);
      }
    }

    this.subscriptions.clear();
    this.stompClient = null;
    this.connectPromise = null;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
  }

  isConnected(): boolean {
    return this.stompClient?.connected || false;
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
export default websocketService;


