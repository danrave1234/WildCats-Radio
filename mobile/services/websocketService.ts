// STOMP + SockJS WebSocket implementation for React Native (matches backend)
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import ENV from '../config/environment';

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

class WebSocketManager implements WebSocketService {
  private stompClient: any = null;
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
    // Skip if already connected to same broadcast
    if (this.stompClient?.connected && 
        this.currentBroadcastId === broadcastId && 
        this.currentAuthToken === authToken) {
      console.log('📡 Already connected to broadcast', broadcastId);
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

    // Disconnect existing connection
    if (this.stompClient?.connected) {
      console.log('📡 Disconnecting existing connection...');
      this.disconnect();
    }

    try {
      const wsUrl = `${ENV.BACKEND_BASE_URL}/ws-radio`;
      console.log(`📡 Connecting to STOMP WebSocket: ${wsUrl}`);

      // Create SockJS + STOMP client (matches backend configuration)
      const sockjs = new SockJS(wsUrl);
      this.stompClient = Stomp.over(sockjs);

      // Configure STOMP client for better reliability
      this.stompClient.debug = () => {}; // Disable debug logs
      this.stompClient.reconnect_delay = 0; // Disable auto-reconnect (we handle it manually)
      this.stompClient.heartbeat = { outgoing: 20000, incoming: 20000 }; // 20 second heartbeat

      // Set connection timeout (increased for slow mobile connections)
      const connectionTimeout = setTimeout(() => {
        console.error('❌ WebSocket connection timeout after 20 seconds');
        this.isConnecting = false;
        this.errorHandlers.forEach(handler => handler({ type: 'timeout' }));
        if (this.stompClient) {
          try {
            this.stompClient.disconnect();
          } catch (e) {
            console.error('Error disconnecting timed out client:', e);
          }
        }
      }, 20000); // 20 second timeout for mobile

      // Connect with auth headers
      const headers: any = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      this.stompClient.connect(
        headers,
        // Success callback
        (frame: any) => {
          clearTimeout(connectionTimeout);
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          console.log('✅ STOMP WebSocket connected successfully to broadcast', broadcastId);
          
          // Subscribe to topics if broadcastId > 0
          if (broadcastId > 0) {
            this.subscribeToTopics(broadcastId);
          }
          
          console.log(`📡 Calling ${this.connectHandlers.length} connect handlers`);
          this.connectHandlers.forEach(handler => handler());
        },
        // Error callback
        (error: any) => {
          clearTimeout(connectionTimeout);
          this.isConnecting = false;
          
          const errorMsg = error?.message || error?.toString() || 'Unknown error';
          console.error('❌ STOMP WebSocket connection failed:', errorMsg);
          
          this.errorHandlers.forEach(handler => handler(error || new Error('Connection failed')));
          this.disconnectHandlers.forEach(handler => handler());
          
          // Attempt reconnect
          this.attemptReconnect();
        }
      );

    } catch (error) {
      this.isConnecting = false;
      console.error('❌ Error creating STOMP WebSocket:', error);
      this.errorHandlers.forEach(handler => handler(error));
      this.disconnectHandlers.forEach(handler => handler());
    }
  }

  private subscribeToTopics(broadcastId: number): void {
    if (!this.stompClient?.connected) return;

    try {
      // Subscribe to chat messages
      const chatSub = this.stompClient.subscribe(
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
        }
      );
      this.subscriptions.set('chat', chatSub);

      // Subscribe to polls
      const pollSub = this.stompClient.subscribe(
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
        }
      );
      this.subscriptions.set('poll', pollSub);

      // Subscribe to broadcast updates
      const broadcastSub = this.stompClient.subscribe(
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
        }
      );
      this.subscriptions.set('broadcast', broadcastSub);

      console.log('✅ Subscribed to broadcast topics');
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
    console.log('📡 Disconnecting STOMP WebSocket...');

    // Unsubscribe from all topics
    this.subscriptions.forEach((sub, key) => {
      try {
        sub.unsubscribe();
      } catch (error) {
        console.error(`❌ Error unsubscribing from ${key}:`, error);
      }
    });
    this.subscriptions.clear();

    // Disconnect STOMP client
    if (this.stompClient?.connected) {
      try {
        this.stompClient.disconnect(() => {
          console.log('✅ STOMP WebSocket disconnected');
          this.disconnectHandlers.forEach(handler => handler());
        });
      } catch (error) {
        console.error('❌ Error disconnecting STOMP:', error);
        this.disconnectHandlers.forEach(handler => handler());
      }
    } else {
      this.disconnectHandlers.forEach(handler => handler());
    }

    this.stompClient = null;
    this.currentBroadcastId = null;
    this.currentAuthToken = null;
    this.reconnectAttempts = 0;
    this.isConnecting = false;
  }

  sendMessage(message: any): void {
    if (!this.stompClient?.connected) {
      throw new Error('WebSocket not connected');
    }

    if (!this.currentBroadcastId) {
      throw new Error('No broadcast ID set');
    }

    try {
      const destination = `/app/broadcast/${this.currentBroadcastId}/chat`;
      const headers: any = {};
      if (this.currentAuthToken) {
        headers['Authorization'] = `Bearer ${this.currentAuthToken}`;
      }

      this.stompClient.send(destination, headers, JSON.stringify(message));
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      throw error;
    }
  }

  sendListenerStatus(action: 'START_LISTENING' | 'STOP_LISTENING', userId: number | null, userName: string): void {
    if (!this.stompClient?.connected || !this.currentBroadcastId) {
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
      const headers: any = {};
      if (this.currentAuthToken) {
        headers['Authorization'] = `Bearer ${this.currentAuthToken}`;
      }
      this.stompClient.send('/app/listener/status', headers, JSON.stringify(message));
    } catch (error) {
      console.error(`❌ Failed to send listener ${action}:`, error);
    }
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
    return !!(this.stompClient?.connected);
  }

  removeHandlers(): void {
    this.messageHandlers = [];
    this.connectHandlers = [];
    this.disconnectHandlers = [];
    this.errorHandlers = [];
  }

  subscribe(topic: string, callback: (message: any) => void): { unsubscribe: () => void } {
    if (!this.stompClient?.connected) {
      throw new Error('STOMP client not connected');
    }

    const subscription = this.stompClient.subscribe(topic, (message: any) => {
      try {
        callback(message);
      } catch (error) {
        console.error(`❌ Error handling message from ${topic}:`, error);
      }
    });

    return {
      unsubscribe: () => {
        try {
          subscription.unsubscribe();
        } catch (error) {
          console.error(`❌ Error unsubscribing from ${topic}:`, error);
        }
      }
    };
  }
}

export const websocketService = new WebSocketManager();
export type { WebSocketMessage, WebSocketService };
