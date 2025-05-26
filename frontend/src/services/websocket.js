import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import { getCookie } from './cookies';

// Base URL for WebSocket connections
let wsBaseUrl = null;

/**
 * Initialize WebSocket base URL
 * Should be called at application startup
 */
export const initWebSocketBaseUrl = (apiBaseUrl) => {
  wsBaseUrl = apiBaseUrl.replace('/api', '');
  return wsBaseUrl;
};

/**
 * Get WebSocket base URL
 * Falls back to dynamic calculation if not initialized
 */
export const getWebSocketBaseUrl = () => {
  if (!wsBaseUrl) {
    wsBaseUrl = `http://${window.location.hostname}:8080`;
  }
  return wsBaseUrl;
};

/**
 * Create a STOMP client with auto reconnect capabilities
 * @param {string} endpoint - WebSocket endpoint path
 * @param {object} options - Additional configuration options
 * @returns {Client} STOMP client instance
 */
export const createStompClient = (endpoint = '/ws-radio', options = {}) => {
  const baseUrl = getWebSocketBaseUrl();
  const wsUrl = `${baseUrl}${endpoint}`;
  
  // Get authentication token from cookies
  const token = getCookie('token');
  const defaultHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
  
  const client = new Client({
    // WebSocket factory function that creates a new SockJS instance
    webSocketFactory: () => new SockJS(wsUrl),
    
    // Connection headers
    connectHeaders: {
      ...defaultHeaders,
      ...options.connectHeaders
    },
    
    // Reconnection settings
    reconnectDelay: options.reconnectDelay || 5000,
    heartbeatIncoming: options.heartbeatIncoming || 4000,
    heartbeatOutgoing: options.heartbeatOutgoing || 4000,
    
    // Debug logging - disable in production
    debug: function(msg) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(msg);
      }
    }
  });
  
  return client;
};

/**
 * Subscribe to a broadcast-specific topic using a STOMP client
 * @param {string} broadcastId - ID of the broadcast
 * @param {string} topic - Topic name (chat, song-requests, polls)
 * @param {function} callback - Callback to handle incoming messages
 * @returns {Promise} Promise resolved with subscription object
 */
export const subscribeToBroadcast = (broadcastId, topic, callback) => {
  return new Promise((resolve, reject) => {
    try {
      const client = createStompClient();
      
      client.onConnect = (frame) => {
        console.log(`Connected to ${topic} WebSocket for broadcast:`, broadcastId);
        
        const subscription = client.subscribe(
          `/topic/broadcast/${broadcastId}/${topic}`, 
          (message) => {
            try {
              const data = JSON.parse(message.body);
              callback(data);
            } catch (error) {
              console.error(`Error parsing ${topic} message:`, error);
            }
          }
        );
        
        resolve({
          subscription,
          client,
          disconnect: () => {
            if (subscription) {
              subscription.unsubscribe();
            }
            if (client.connected) {
              client.deactivate();
            }
          },
          isConnected: () => client.connected
        });
      };
      
      client.onStompError = (frame) => {
        console.error('STOMP protocol error:', frame);
        reject(new Error(`STOMP error: ${frame.headers?.message || 'Unknown error'}`));
      };
      
      client.onWebSocketError = (event) => {
        console.error('WebSocket error:', event);
      };
      
      // Activate the client to start connection
      client.activate();
      
    } catch (error) {
      console.error(`Error creating ${topic} WebSocket:`, error);
      reject(error);
    }
  });
};

/**
 * Subscribe to user-specific notifications
 * @param {function} callback - Callback to handle incoming notifications
 * @returns {Promise} Promise resolved with subscription object
 */
export const subscribeToUserNotifications = (callback) => {
  return new Promise((resolve, reject) => {
    try {
      const client = createStompClient();
      let pollingInterval = null;
      
      client.onConnect = (frame) => {
        console.log('Connected to notifications WebSocket');
        
        const subscription = client.subscribe(
          '/user/queue/notifications', 
          (message) => {
            try {
              const notification = JSON.parse(message.body);
              callback(notification);
            } catch (error) {
              console.error('Error parsing notification:', error);
            }
          }
        );
        
        resolve({
          subscription,
          client,
          disconnect: () => {
            if (subscription) {
              subscription.unsubscribe();
            }
            if (client.connected) {
              client.deactivate();
            }
            if (pollingInterval) {
              clearInterval(pollingInterval);
            }
          },
          isConnected: () => client.connected
        });
      };
      
      client.onStompError = (frame) => {
        console.error('STOMP protocol error:', frame);
        setupPollingFallback(callback, resolve);
      };
      
      client.onWebSocketError = (event) => {
        console.error('WebSocket error:', event);
        setupPollingFallback(callback, resolve);
      };
      
      // Activate the client to start connection
      client.activate();
      
    } catch (error) {
      console.error('Error creating notifications WebSocket:', error);
      setupPollingFallback(callback, resolve);
    }
  });
  
  // Local function to set up polling fallback
  function setupPollingFallback(callback, resolve) {
    console.log('WebSocket connection failed. Falling back to polling.');
    const pollingInterval = setInterval(async () => {
      try {
        const response = await fetch(`${getWebSocketBaseUrl()}/api/notifications/unread`, {
          headers: {
            'Authorization': getCookie('token') ? `Bearer ${getCookie('token')}` : ''
          }
        });
        const data = await response.json();
        if (data && data.length > 0) {
          data.forEach(notification => callback(notification));
        }
      } catch (pollError) {
        console.error('Polling error:', pollError);
      }
    }, 30000); // Poll every 30 seconds as fallback

    resolve({
      disconnect: () => {
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }
      },
      isConnected: () => false
    });
  }
};

export default {
  initWebSocketBaseUrl,
  getWebSocketBaseUrl,
  createStompClient,
  subscribeToBroadcast,
  subscribeToUserNotifications
}; 