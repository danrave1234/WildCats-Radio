import axios from 'axios';
import { handleSecuritySoftwareErrors } from './errorHandler';
// WebSocket support libraries
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import { config, configUtils } from '../config';
import { createLogger } from './logger';

const logger = createLogger('APIService');

/**
 * Enhanced API Proxy Base System
 * Provides centralized API configuration and automatic environment detection
 */
class ApiProxyBase {
  constructor() {
    this.config = config;
    this.logger = logger;
    this.axiosInstance = null;
    this.initialize();
  }

  /**
   * Initialize the API proxy with current configuration
   */
  initialize() {
    this.logEnvironmentInfo();
    this.axiosInstance = this.createAxiosInstance();
    this.setupInterceptors();
  }

  /**
   * Log current environment and configuration info
   */
  logEnvironmentInfo() {
    this.logger.info('🚀 API Proxy Base Initialized');
    this.logger.info(`Environment: ${this.config.environment.toUpperCase()}`);
    this.logger.info(`API Base URL: ${this.config.apiBaseUrl}`);
    this.logger.info(`WebSocket Base URL: ${this.config.wsBaseUrl}`);
    this.logger.info(`SockJS Base URL: ${this.config.sockJsBaseUrl}`);
    this.logger.info(`Debug Logs: ${this.config.enableDebugLogs ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Create enhanced axios instance with retry logic
   */
  createAxiosInstance() {
    const instance = axios.create({
      baseURL: this.config.apiBaseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: this.config.apiTimeout,
    });

    // Add retry logic for failed requests
    instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Don't retry if we've already retried max times
        if (originalRequest._retryCount >= this.config.maxRetries) {
          return handleSecuritySoftwareErrors(error);
        }

        // Check if we should retry (network errors, timeouts, 5xx errors)
        const shouldRetry = !originalRequest._retryCount && (
          error.code === 'ECONNABORTED' || // timeout
          error.code === 'NETWORK_ERROR' || // network error
          (error.response && error.response.status >= 500) // server error
        );

        if (shouldRetry) {
          originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;

          // Wait before retrying (with exponential backoff)
          const delay = this.config.retryDelay * Math.pow(2, originalRequest._retryCount - 1);
          this.logger.info(`Retrying request (attempt ${originalRequest._retryCount}/${this.config.maxRetries}) after ${delay}ms`);

          await new Promise(resolve => setTimeout(resolve, delay));
          return instance(originalRequest);
        }

        return handleSecuritySoftwareErrors(error);
      }
    );

    return instance;
  }

  /**
   * Setup request/response interceptors
   */
  setupInterceptors() {
    // Request interceptor for authentication
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = this.getCookie('token');
        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`;
        }

        // Log request in debug mode
        if (this.config.enableDebugLogs) {
          this.logger.debug(`🔄 API Request: ${config.method?.toUpperCase()} ${config.url}`);
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        if (this.config.enableDebugLogs) {
          this.logger.debug(`✅ API Response: ${response.status} ${response.config.url}`);
        }
        return response;
      },
      (error) => {
        if (this.config.enableDebugLogs) {
          this.logger.error(`❌ API Error: ${error.response?.status || 'Network'} ${error.config?.url}`);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get cookie value
   */
  getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    return null;
  }

  /**
   * Get the axios instance
   */
  getAxiosInstance() {
    return this.axiosInstance;
  }

  /**
   * Create WebSocket connection with enhanced configuration
   */
  createWebSocketConnection(endpoint) {
    const sockJsUrl = configUtils.getSockJsUrl(endpoint);

    // Use factory function for proper auto-reconnect support
    const stompClient = Stomp.over(() => new SockJS(sockJsUrl));

    // Enhanced reconnection settings
    stompClient.reconnect_delay = this.config.wsReconnectDelay;
    stompClient.heartbeat.outgoing = this.config.wsHeartbeatInterval;
    stompClient.heartbeat.incoming = this.config.wsHeartbeatInterval;
    stompClient.maxConnectAttempts = this.config.wsMaxReconnectAttempts;

    // Add debug logging
    stompClient.debug = (str) => {
      if (str.includes('ERROR') || str.includes('DISCONNECT') || str.includes('CONNECT')) {
        this.logger.warn('STOMP Important:', str);
      } else if (this.config.enableVerboseLogs) {
        this.logger.debug('STOMP Debug:', str);
      }
    };

    // Add connection state tracking
    stompClient.onWebSocketError = (error) => {
      this.logger.error('WebSocket error:', error);
    };

    stompClient.onWebSocketClose = (event) => {
      this.logger.warn('WebSocket closed:', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });
    };

    return stompClient;
  }

  /**
   * Get full API URL for an endpoint
   */
  getApiUrl(endpoint) {
    return configUtils.getApiUrl(endpoint);
  }

  /**
   * Get WebSocket URL for an endpoint
   */
  getWsUrl(endpoint) {
    return configUtils.getWsUrl(endpoint);
  }

  /**
   * Get SockJS URL for an endpoint
   */
  getSockJsUrl(endpoint) {
    return configUtils.getSockJsUrl(endpoint);
  }
}

// Create singleton instance of API proxy
const apiProxy = new ApiProxyBase();

// Export the axios instance for backward compatibility
const api = apiProxy.getAxiosInstance();

// Export the API proxy instance for advanced usage
export { apiProxy };

// Legacy function for backward compatibility
const constructUrl = (configKey, fallbackPath = '') => {
  logger.debug('Using legacy constructUrl - consider migrating to configUtils');

  let baseUrl;
  if (configKey === 'apiBaseUrl') {
    baseUrl = config.apiBaseUrl;
  } else if (configKey === 'wsBaseUrl') {
    baseUrl = config.wsBaseUrl;
  } else if (configKey === 'sockJsBaseUrl') {
    baseUrl = config.sockJsBaseUrl;
  } else if (configKey === 'icecastUrl') {
    baseUrl = config.icecastUrl;
  } else {
    throw new Error(`Unknown config key: ${configKey}`);
  }

  return baseUrl + fallbackPath;
};

// Legacy constants for backward compatibility
const API_BASE_URL = config.apiBaseUrl;

// Cookie helper function for backward compatibility
const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return null;
};

// Enhanced WebSocket connection function with better error handling for cloud backend
const createWebSocketConnection = (endpoint) => {
  return apiProxy.createWebSocketConnection(endpoint);
};

// Services for user authentication
export const authService = {
  login: (credentials) => api.post('/api/auth/login', credentials),
  register: (userData) => api.post('/api/auth/register', userData),
  verify: (email, code) => api.post(`/api/auth/verify?email=${email}&code=${code}`),
  sendCode: (email) => api.post(`/api/auth/send-code?email=${email}`),
  getProfile: (id) => api.get(`/api/auth/${id}`),
  getCurrentUser: () => api.get('/api/auth/me'),
  updateProfile: (id, data) => api.put(`/api/auth/${id}`, data),
  changePassword: (id, data) => api.post(`/api/auth/${id}/change-password`, data),
  // Admin-specific methods
  getAllUsers: () => api.get('/api/auth/getAll'),
  getUsersByRole: (role) => api.get(`/api/auth/by-role/${role}`),
  updateUserRole: (id, newRole) => api.put(`/api/auth/${id}/role?newRole=${newRole}`),
};

// Services for broadcasts
export const broadcastService = {
  getAll: () => api.get('/api/broadcasts'),
  getById: (id) => api.get(`/api/broadcasts/${id}`),
  create: (broadcastData) => api.post('/api/broadcasts', broadcastData),
  schedule: (broadcastData) => api.post('/api/broadcasts/schedule', broadcastData),
  update: (id, broadcastData) => api.put(`/api/broadcasts/${id}`, broadcastData),
  delete: (id) => api.delete(`/api/broadcasts/${id}`),
  start: (id) => api.post(`/api/broadcasts/${id}/start`),
  startTest: (id) => api.post(`/api/broadcasts/${id}/start-test`),
  end: (id) => api.post(`/api/broadcasts/${id}/end`),
  test: (id) => api.post(`/api/broadcasts/${id}/test`),
  getAnalytics: (id) => api.get(`/api/broadcasts/${id}/analytics`),
  getUpcoming: () => api.get('/api/broadcasts/upcoming'),
  getLive: () => api.get('/api/broadcasts/live'),
  getActiveBroadcast: () => api.get('/api/broadcasts/live').then(response => response.data[0] || null),

  // Subscribe to real-time broadcast updates (for broadcast status, listener count, etc.)
  subscribeToBroadcastUpdates: (broadcastId, callback) => {
    const stompClient = createWebSocketConnection('/ws-radio');

    const token = getCookie('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    return new Promise((resolve, reject) => {
      stompClient.connect(headers, () => {
        logger.debug('Connected to Broadcast WebSocket for broadcast:', broadcastId);

        // Subscribe to broadcast-specific updates
        const subscription = stompClient.subscribe(`/topic/broadcast/${broadcastId}`, (message) => {
          try {
            const broadcastMessage = JSON.parse(message.body);
            callback(broadcastMessage);
          } catch (error) {
            logger.error('Error parsing broadcast message:', error);
          }
        });

        // Only send join/leave messages if broadcastId is valid (not null or "null")
        const shouldSendJoinLeave = broadcastId && broadcastId !== 'null' && broadcastId.toString().trim() !== '';

        if (shouldSendJoinLeave) {
          // Send join broadcast message to notify server that listener joined
          stompClient.publish({
            destination: `/app/broadcast/${broadcastId}/join`,
            body: JSON.stringify({})
          });
        }

        const disconnectFunction = () => {
          // Send leave broadcast message before disconnecting (only if valid broadcastId)
          if (stompClient && stompClient.connected && shouldSendJoinLeave) {
            try {
              stompClient.publish({
                destination: `/app/broadcast/${broadcastId}/leave`,
                body: JSON.stringify({})
              });
            } catch (error) {
              logger.error('Error sending leave message:', error);
            }
          }

          if (subscription) {
            subscription.unsubscribe();
          }
          if (stompClient && stompClient.connected) {
            stompClient.disconnect();
          }
        };

        resolve({
          disconnect: disconnectFunction,
          isConnected: () => stompClient.connected,
          // Method to send messages to the broadcast channel
          sendMessage: (type, data) => {
            if (stompClient && stompClient.connected && shouldSendJoinLeave) {
              stompClient.publish({
                destination: `/app/broadcast/${broadcastId}/message`,
                body: JSON.stringify({ type, data })
              });
            }
          }
        });
      }, (error) => {
        logger.error('Broadcast WebSocket connection error:', error);
        reject(error);
      });
    });
  },
};

// Services for chat messages
export const chatService = {
  getMessages: (broadcastId) => api.get(`/api/chats/${broadcastId}`),
  sendMessage: (broadcastId, message) => api.post(`/api/chats/${broadcastId}`, message),

  // Subscribe to real-time chat messages for a specific broadcast
  subscribeToChatMessages: (broadcastId, callback) => {
    const stompClient = createWebSocketConnection('/ws-radio');

    const token = getCookie('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    return new Promise((resolve, reject) => {
      stompClient.connect(headers, () => {
        logger.debug('Connected to Chat WebSocket for broadcast:', broadcastId);

        // Subscribe to chat messages for this broadcast
        const subscription = stompClient.subscribe(`/topic/broadcast/${broadcastId}/chat`, (message) => {
          try {
            const chatMessage = JSON.parse(message.body);
            logger.debug('Received chat message via WebSocket:', chatMessage);
            callback(chatMessage);
          } catch (error) {
            logger.error('Error parsing chat message:', error);
          }
        });

        resolve({
          disconnect: () => {
            if (subscription) {
              subscription.unsubscribe();
            }
            if (stompClient && stompClient.connected) {
              stompClient.disconnect();
            }
          },
          isConnected: () => stompClient.connected,
          // Method to send messages to the chat
          sendMessage: (messageText) => {
            if (stompClient && stompClient.connected) {
              const messagePayload = { content: messageText };
              logger.debug('Sending chat message via WebSocket:', messagePayload);
              stompClient.send(`/app/broadcast/${broadcastId}/chat`, {}, JSON.stringify(messagePayload));
            } else {
              logger.error('WebSocket not connected, cannot send message');
            }
          }
        });
      }, (error) => {
        logger.error('Chat WebSocket connection error:', error);
        reject(error);
      });
    });
  }
};

// Services for notifications
export const notificationService = {
  getAll: () => api.get('/api/notifications'),
  getUnread: () => api.get('/api/notifications/unread'),
  getUnreadCount: () => api.get('/api/notifications/count-unread'),
  markAsRead: (id) => api.put(`/api/notifications/${id}/read`),
  getByType: (type) => api.get(`/api/notifications/by-type/${type}`),
  getRecent: (since) => api.get(`/api/notifications/recent?since=${since}`),

  subscribeToNotifications: (callback) => {
    const stompClient = createWebSocketConnection('/ws-radio');
    let isConnected = false;

    const token = getCookie('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    return new Promise((resolve) => {
      stompClient.connect(headers, (frame) => {
        logger.debug('Connected to WebSocket for notifications:', frame);
        isConnected = true;

        stompClient.subscribe('/user/queue/notifications', (message) => {
          try {
            const notification = JSON.parse(message.body);
            callback(notification);
          } catch (error) {
            logger.error('Error parsing notification:', error);
          }
        });

        resolve({
          disconnect: () => {
            if (stompClient && stompClient.connected) {
              stompClient.disconnect();
            }
            isConnected = false;
          },
          isConnected: () => isConnected
        });
      }, (error) => {
        logger.error('WebSocket connection error for notifications:', error);
        isConnected = false;

        // REMOVED: No fallback polling - rely entirely on WebSocket
        logger.error('WebSocket connection failed for notifications. No fallback polling.');
        
        resolve({
          disconnect: () => {
            // No cleanup needed since no polling
          },
          isConnected: () => false
        });
      });
    });
  },

  // Helper methods for broadcast-specific notifications
  getBroadcastNotifications: () => {
    return api.get('/notifications').then(response => {
      // Filter notifications related to broadcasts
      return response.data.filter(notification => 
        notification.type === 'BROADCAST_SCHEDULED' || 
        notification.type === 'BROADCAST_STARTING_SOON' || 
        notification.type === 'BROADCAST_STARTED' || 
        notification.type === 'BROADCAST_ENDED' || 
        notification.type === 'NEW_BROADCAST_POSTED'
      );
    });
  }
};

// Services for activity logs
export const activityLogService = {
  getLogs: () => api.get('/api/activity-logs'),
  getUserLogs: (userId) => api.get(`/api/activity-logs/user/${userId}`),
};

// Services for song requests
export const songRequestService = {
  getStats: () => api.get('/api/song-requests/stats'),
  getAllRequests: () => api.get('/api/song-requests'),
  getRequestsByBroadcast: (broadcastId) => api.get(`/api/broadcasts/${broadcastId}/song-requests`),
  getRequests: (broadcastId) => api.get(`/api/broadcasts/${broadcastId}/song-requests`), // Alias for compatibility
  createRequest: (broadcastId, requestData) => api.post(`/api/broadcasts/${broadcastId}/song-requests`, requestData),
  deleteRequest: (broadcastId, requestId) => api.delete(`/api/broadcasts/${broadcastId}/song-requests/${requestId}`),

  // Subscribe to real-time song request updates for a specific broadcast
  subscribeToSongRequests: (broadcastId, callback) => {
    const stompClient = createWebSocketConnection('/ws-radio');

    const token = getCookie('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    return new Promise((resolve, reject) => {
      stompClient.connect(headers, () => {
        logger.debug('Connected to Song Requests WebSocket for broadcast:', broadcastId);

        // Subscribe to broadcast-specific song request updates
        const subscription = stompClient.subscribe(`/topic/broadcast/${broadcastId}/song-requests`, (message) => {
          try {
            const songRequestData = JSON.parse(message.body);
            callback(songRequestData);
          } catch (error) {
            logger.error('Error parsing song request data:', error);
          }
        });

        resolve({
          disconnect: () => {
            if (subscription) {
              subscription.unsubscribe();
            }
            if (stompClient && stompClient.connected) {
              stompClient.disconnect();
            }
          },
          isConnected: () => stompClient.connected
        });
      }, (error) => {
        logger.error('Song Requests WebSocket connection error:', error);
        reject(error);
      });
    });
  },
};

// Services for polls
export const pollService = {
  createPoll: (pollData) => api.post('/api/polls', pollData),
  getPollsForBroadcast: (broadcastId) => api.get(`/api/polls/broadcast/${broadcastId}`),
  getActivePollsForBroadcast: (broadcastId) => api.get(`/api/polls/broadcast/${broadcastId}/active`),
  getPoll: (pollId) => api.get(`/api/polls/${pollId}`),
  vote: (pollId, voteData) => api.post(`/api/polls/${pollId}/vote`, voteData),
  getPollResults: (pollId) => api.get(`/api/polls/${pollId}/results`),
  endPoll: (pollId) => api.post(`/api/polls/${pollId}/end`),
  hasUserVoted: (pollId) => api.get(`/api/polls/${pollId}/has-voted`),
  getUserVote: (pollId) => api.get(`/api/polls/${pollId}/user-vote`),

  // WebSocket subscription for polls
  subscribeToPolls: (broadcastId, callback) => {
    return new Promise((resolve, reject) => {
      const stompClient = createWebSocketConnection('/ws-radio');
      let isConnected = false;

      const token = getCookie('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      stompClient.connect(headers, () => {
        logger.debug('Connected to Polls WebSocket for broadcast:', broadcastId);

        // Subscribe to broadcast-specific poll updates
        const subscription = stompClient.subscribe(`/topic/broadcast/${broadcastId}/polls`, (message) => {
          try {
            const pollData = JSON.parse(message.body);
            callback(pollData);
          } catch (error) {
            logger.error('Error parsing poll data:', error);
          }
        });

        resolve({
          disconnect: () => {
            if (subscription) {
              subscription.unsubscribe();
            }
            if (stompClient && stompClient.connected) {
              stompClient.disconnect();
            }
          },
          isConnected: () => stompClient.connected
        });
      }, (error) => {
        logger.error('Polls WebSocket connection error:', error);
        reject(error);
      });
    });
  },
};

// Services for Icecast streaming
export const streamService = {
  start: () => api.post('/api/stream/start'),
  stop: () => api.post('/api/stream/stop'),
  getStatus: () => api.get('/api/stream/status'),
  getConfig: () => api.get('/api/stream/config'),
  getHealth: () => api.get('/api/stream/health'),

  // WebSocket URL for DJs to send audio to the server
  getStreamUrl: () => {
    const wsBaseUrl = constructUrl('wsBaseUrl');
    return Promise.resolve(wsBaseUrl + '/ws/live');
  },

  // Stream URL for listeners to tune in to the broadcast
  getListenerStreamUrl: () => {
    return Promise.resolve(constructUrl('icecastUrl'));
  },

  // Check if Icecast server is running
  checkIcecastServer: () => {
    return api.get('/stream/health')
      .then(response => {
        if (response.data.icecastServer === 'UP') {
          return { isUp: true, status: response.data };
        }
        return { isUp: false, status: response.data };
      })
      .catch(error => {
        logger.error('Error checking Icecast server:', error);
        return { isUp: false, error: error.message };
      });
  }
};

// Services for analytics
export const analyticsService = {
  getBroadcastStats: () => api.get('/api/analytics/broadcasts'),
  getUserStats: () => api.get('/api/analytics/users'),
  getEngagementStats: () => api.get('/api/analytics/engagement'),
  getActivityStats: () => api.get('/api/analytics/activity'),
  getRealtimeStats: () => api.get('/api/analytics/realtime'),
  getDemographicAnalytics: () => api.get('/api/analytics/demographics'),
  getPopularBroadcasts: () => api.get('/api/analytics/popular-broadcasts'),
  getAnalyticsSummary: () => api.get('/api/analytics/summary'),
  getHealthStatus: () => api.get('/api/analytics/health'),
  // Individual broadcast analytics
  getBroadcastAnalytics: (broadcastId) => api.get(`/api/analytics/broadcast/${broadcastId}`),
  getAllBroadcastAnalytics: () => api.get('/api/analytics/broadcasts/detailed'),
};

export default api;
