import { createWebSocketConnection, getCookie, logger } from './apiBase';

/**
 * Shared STOMP client manager for `/ws-radio`.
 *
 * Ensures:
 * - A single underlying WebSocket connection is reused across features
 *   (chat, polls, song requests, broadcast status, notifications).
 * - Centralized connection handling and basic error logging.
 *
 * NOTE:
 * - This manager does NOT auto-disconnect when the last subscriber unsubscribes.
 *   Keeping the connection warm is preferred for long-lived sessions.
 */
class StompClientManager {
  constructor() {
    this.stompClient = null;
    this.connectPromise = null;
    this.subscriptions = new Set();
  }

  _getAuthHeaders() {
    try {
      const token = getCookie('token');
      return token ? { 'Authorization': `Bearer ${token}` } : {};
    } catch (e) {
      logger.error('StompClientManager: Failed to read auth cookie', e);
      return {};
    }
  }

  /**
   * Ensure we have a STOMP client instance.
   */
  _ensureClient() {
    if (!this.stompClient) {
      this.stompClient = createWebSocketConnection('/ws-radio');
    }
    return this.stompClient;
  }

  /**
   * Connect the shared STOMP client (idempotent).
   * @returns {Promise<any>} Resolves with the connected client
   */
  connect() {
    if (this.connectPromise) {
      return this.connectPromise;
    }

    const client = this._ensureClient();
    const headers = this._getAuthHeaders();

    if (client.connected) {
      logger.debug('StompClientManager: STOMP already connected');
      this.connectPromise = Promise.resolve(client);
      return this.connectPromise;
    }

    this.connectPromise = new Promise((resolve, reject) => {
      try {
        client.connect(
          headers,
          () => {
            logger.debug('StompClientManager: STOMP connected (shared client)');
            resolve(client);
          },
          (error) => {
            logger.error('StompClientManager: STOMP connection error', error);
            this.stompClient = null;
            this.connectPromise = null;
            reject(error);
          }
        );
      } catch (e) {
        logger.error('StompClientManager: STOMP connect threw error', e);
        this.stompClient = null;
        this.connectPromise = null;
        reject(e);
      }
    });

    return this.connectPromise;
  }

  /**
   * Subscribe to a topic. The callback receives the raw STOMP message; callers
   * are responsible for JSON parsing to keep backwards compatibility.
   *
   * @param {string} topic - STOMP destination (e.g. /topic/broadcast/1/chat)
   * @param {(message: any) => void} onMessage - Handler for messages
   * @returns {Promise<{unsubscribe: () => void, isConnected: () => boolean}>}
   */
  async subscribe(topic, onMessage) {
    const client = await this.connect();

    const subscription = client.subscribe(topic, (message) => {
      try {
        onMessage(message);
      } catch (e) {
        logger.error('StompClientManager: Error in subscription handler for topic', topic, e);
      }
    });

    this.subscriptions.add(subscription);

    const unsubscribe = () => {
      try {
        subscription.unsubscribe();
      } catch (e) {
        logger.error('StompClientManager: Error unsubscribing from topic', topic, e);
      } finally {
        this.subscriptions.delete(subscription);
      }
    };

    return {
      unsubscribe,
      isConnected: () => !!this.stompClient && this.stompClient.connected,
    };
  }

  /**
   * Publish a message to a destination.
   * @param {string} destination
   * @param {any} body - Will be JSON.stringify'ed
   */
  async publish(destination, body) {
    const client = await this.connect().catch((e) => {
      logger.error('StompClientManager: Cannot publish, failed to connect', e);
      return null;
    });

    if (!client || !client.connected) {
      logger.warn('StompClientManager: Cannot publish, client not connected', { destination });
      return;
    }

    try {
      client.publish({
        destination,
        body: body != null ? JSON.stringify(body) : '{}',
      });
    } catch (e) {
      logger.error('StompClientManager: Error publishing message', { destination, error: e });
    }
  }

  /**
   * Returns true if the shared client is connected.
   */
  isConnected() {
    return !!this.stompClient && this.stompClient.connected;
  }
}

const stompClientManager = new StompClientManager();

export default stompClientManager;


