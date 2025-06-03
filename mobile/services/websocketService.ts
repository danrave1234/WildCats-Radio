// Import SockJS and STOMP for React Native
import SockJS from 'sockjs-client';
import { Stomp, StompSubscription } from '@stomp/stompjs';

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
  onError: (callback: (error: Event) => void) => void;
  isConnected: () => boolean;
}

class WebSocketManager implements WebSocketService {
  private stompClient: any = null;
  private chatSubscription: StompSubscription | null = null;
  private pollSubscription: StompSubscription | null = null;
  private broadcastSubscription: StompSubscription | null = null;
  private messageHandlers: ((message: WebSocketMessage) => void)[] = [];
  private connectHandlers: (() => void)[] = [];
  private disconnectHandlers: (() => void)[] = [];
  private errorHandlers: ((error: Event) => void)[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private currentBroadcastId: number | null = null;
  private currentAuthToken: string | null = null;
  private connectionMonitorInterval: any = null;

  connect(broadcastId: number, authToken: string): void {
    // Don't reconnect if already connected to the same broadcast
    if (this.stompClient && this.stompClient.connected && 
        this.currentBroadcastId === broadcastId && 
        this.currentAuthToken === authToken) {
      console.log('✅ Already connected to broadcast:', broadcastId);
      this.connectHandlers.forEach(handler => handler());
      return;
    }
    
    // Disconnect any existing connection
    if (this.stompClient && this.stompClient.connected) {
      console.log('🔄 Disconnecting existing connection before connecting to new broadcast');
      this.disconnect();
    }
    
    this.currentBroadcastId = broadcastId;
    this.currentAuthToken = authToken;
    
    console.log('🔄 Attempting STOMP connection to broadcast:', broadcastId);
    
    try {
      // Use the same base as your API service for consistency
      const API_BASE_URL = 'https://wildcat-radio-f05d362144e6.autoidleapp.com'; // Match your deployed backend
      //const API_BASE_URL = 'http://192.168.5.60:8080'; // Match your apiService.ts Expo
      //const API_BASE_URL = 'http://10.0.2.2:8080'; // For Android emulator (localhost)
      const wsUrl = `${API_BASE_URL}/ws-radio`;
      
      console.log('🔗 WebSocket URL:', wsUrl);
      console.log('🔑 Auth token present:', !!authToken);
    
      // Use SockJS + STOMP like the web implementation
      const socket = new SockJS(wsUrl);
      this.stompClient = Stomp.over(socket);
      
      // Enable debug logging to see what's happening
      this.stompClient.debug = (str: string) => {
        // Only log important STOMP messages to reduce noise
        if (str.includes('CONNECTED') || str.includes('ERROR') || str.includes('RECEIPT') || str.includes('MESSAGE')) {
          console.log('📡 STOMP DEBUG:', str);
        }
      };
      
      // Configure heartbeat to keep connection alive (especially important for mobile)
      this.stompClient.heartbeatIncoming = 4000; // Server sends heartbeat every 4 seconds
      this.stompClient.heartbeatOutgoing = 4000; // Client sends heartbeat every 4 seconds
      this.stompClient.reconnectDelay = 5000; // Auto-reconnect after 5 seconds
      
      const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
      console.log('📋 STOMP headers:', headers);
      console.log('💓 Heartbeat configured: incoming=4s, outgoing=4s');
      
      this.stompClient.connect(headers, (frame: any) => {
        console.log('✅ STOMP connected successfully for broadcast:', broadcastId);
        console.log('📄 Connection frame:', frame);
        this.reconnectAttempts = 0;
        
        // Set up connection monitoring
        this.monitorConnection();
        
        this.connectHandlers.forEach(handler => handler());
        
        // Special case for broadcastId 0 - skip broadcast subscriptions for global connections
        if (broadcastId === 0) {
          console.log('✅ Global connection established (no broadcast subscriptions)');
          return;
        }
        
        // Only subscribe to broadcast-specific topics if broadcastId is valid (not 0)
        if (broadcastId > 0) {
          // Subscribe to chat messages for this broadcast
          console.log('📡 Subscribing to chat topic:', `/topic/broadcast/${broadcastId}/chat`);
          this.chatSubscription = this.stompClient.subscribe(
            `/topic/broadcast/${broadcastId}/chat`, 
            (message: any) => {
              try {
                console.log('📨 Received chat message:', message.body);
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
          
          // Subscribe to poll updates for this broadcast
          console.log('📊 Subscribing to poll topic:', `/topic/broadcast/${broadcastId}/polls`);
          this.pollSubscription = this.stompClient.subscribe(
            `/topic/broadcast/${broadcastId}/polls`, 
            (message: any) => {
              try {
                console.log('📊 Received poll update:', message.body);
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
          
          // Also subscribe to broadcast status updates
          console.log('🎙️ Subscribing to broadcast updates:', `/topic/broadcast/${broadcastId}`);
          this.broadcastSubscription = this.stompClient.subscribe(
            `/topic/broadcast/${broadcastId}`, 
            (message: any) => {
              try {
                console.log('🎙️ Received broadcast update:', message.body);
                const broadcastData = JSON.parse(message.body);
                this.messageHandlers.forEach(handler => handler({
                  type: 'broadcast_update',
                  data: broadcastData,
                  broadcastId: broadcastId
                }));
              } catch (error) {
                console.error('❌ Error parsing broadcast update message:', error);
              }
            }
          );
        }
        
        console.log('✅ All subscriptions set up successfully!');
        console.log('📊 Active subscriptions:', {
          chat: !!this.chatSubscription,
          poll: !!this.pollSubscription,
          broadcast: !!this.broadcastSubscription
        });
      }, (error: any) => {
        console.error('❌ STOMP connection error:', error);
        console.error('🔍 Error details:', JSON.stringify(error, null, 2));
        this.errorHandlers.forEach(handler => handler(error));
        this.disconnectHandlers.forEach(handler => handler()); // Call disconnect handlers on connection failure
        this.attemptReconnect();
      });
    } catch (error) {
      console.error('❌ Error setting up WebSocket connection:', error);
      this.errorHandlers.forEach(handler => handler(error as Event));
      this.disconnectHandlers.forEach(handler => handler());
    }
  }

  private monitorConnection(): void {
    // Clear any existing monitor
    if (this.connectionMonitorInterval) {
      clearInterval(this.connectionMonitorInterval);
    }
    
    // Monitor connection every 10 seconds
    this.connectionMonitorInterval = setInterval(() => {
      if (this.stompClient) {
        const isConnected = this.stompClient.connected;
        console.log('🔍 Connection status check:', isConnected ? 'CONNECTED' : 'DISCONNECTED');
        
        if (!isConnected) {
          console.log('⚠️ Connection lost, triggering reconnect...');
          this.disconnectHandlers.forEach(handler => handler());
          this.attemptReconnect();
        }
      }
    }, 10000); // Check every 10 seconds
  }

  private attemptReconnect(): void {
    // Clear connection monitor during reconnect
    if (this.connectionMonitorInterval) {
      clearInterval(this.connectionMonitorInterval);
      this.connectionMonitorInterval = null;
    }
    
    if (this.reconnectAttempts < this.maxReconnectAttempts && 
        this.currentBroadcastId && this.currentAuthToken) {
      this.reconnectAttempts++;
      const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000); // Exponential backoff, max 30s
      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
      
      setTimeout(() => {
        if (this.currentBroadcastId && this.currentAuthToken) {
          this.connect(this.currentBroadcastId, this.currentAuthToken);
        }
      }, delay);
    } else {
      console.log('❌ Max reconnection attempts reached or missing connection data');
    }
  }

  disconnect(): void {
    console.log('🔌 Disconnecting WebSocket...');
    
    // Clear connection monitor
    if (this.connectionMonitorInterval) {
      clearInterval(this.connectionMonitorInterval);
      this.connectionMonitorInterval = null;
    }
    
    // Unsubscribe from topics
    if (this.chatSubscription) {
      this.chatSubscription.unsubscribe();
      this.chatSubscription = null;
    }
    if (this.pollSubscription) {
      this.pollSubscription.unsubscribe();
      this.pollSubscription = null;
    }
    if (this.broadcastSubscription) {
      this.broadcastSubscription.unsubscribe();
      this.broadcastSubscription = null;
    }
    
    // Disconnect STOMP client
    if (this.stompClient && this.stompClient.connected) {
      this.stompClient.disconnect(() => {
        console.log('💬 STOMP disconnected gracefully');
        this.disconnectHandlers.forEach(handler => handler());
      });
    } else {
      console.log('💬 STOMP was already disconnected');
      this.disconnectHandlers.forEach(handler => handler());
    }
    this.stompClient = null;
    
    this.currentBroadcastId = null;
    this.currentAuthToken = null;
    this.reconnectAttempts = 0;
  }

  sendMessage(message: any): void {
    if (this.stompClient && this.stompClient.connected && this.currentBroadcastId) {
      const destination = `/app/broadcast/${this.currentBroadcastId}/chat`;
      const messageBody = JSON.stringify(message);
      console.log('📤 Sending STOMP message to:', destination);
      console.log('📝 Message content:', messageBody);
      
      try {
        // Send chat message with authorization header
        const headers: any = {};
        if (this.currentAuthToken) {
          headers['Authorization'] = `Bearer ${this.currentAuthToken}`;
        }
        
        // Send chat message to the appropriate topic
        this.stompClient.send(destination, headers, messageBody);
        console.log('✅ STOMP message sent successfully');
      } catch (error) {
        console.error('❌ Failed to send STOMP message:', error);
        throw error;
      }
    } else {
      console.warn('❌ STOMP not connected, cannot send message');
      console.log('🔍 STOMP client status:', {
        hasClient: !!this.stompClient,
        isConnected: this.stompClient?.connected,
        broadcastId: this.currentBroadcastId
      });
      throw new Error('STOMP not connected');
    }
  }

  onMessage(callback: (message: WebSocketMessage) => void): void {
    // Prevent duplicate handlers
    if (!this.messageHandlers.includes(callback)) {
      this.messageHandlers.push(callback);
    }
  }

  onConnect(callback: () => void): void {
    // Prevent duplicate handlers
    if (!this.connectHandlers.includes(callback)) {
      this.connectHandlers.push(callback);
    }
  }

  onDisconnect(callback: () => void): void {
    // Prevent duplicate handlers
    if (!this.disconnectHandlers.includes(callback)) {
      this.disconnectHandlers.push(callback);
    }
  }

  onError(callback: (error: Event) => void): void {
    // Prevent duplicate handlers
    if (!this.errorHandlers.includes(callback)) {
      this.errorHandlers.push(callback);
    }
  }

  // Check if WebSocket is connected
  isConnected(): boolean {
    return !!(this.stompClient && this.stompClient.connected);
  }

  // Clean up handlers
  removeHandlers(): void {
    this.messageHandlers = [];
    this.connectHandlers = [];
    this.disconnectHandlers = [];
    this.errorHandlers = [];
  }
}

export const websocketService = new WebSocketManager();
export type { WebSocketMessage, WebSocketService }; 