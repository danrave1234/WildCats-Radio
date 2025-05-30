import axios from 'axios';
import { handleSecuritySoftwareErrors } from './errorHandler';
// WebSocket support libraries
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import { useLocalBackend, config } from '../config';
import { createLogger } from './logger';

const logger = createLogger('APIService');

// Simple function to construct URLs using the explicit protocols from config
const constructUrl = (configKey, fallbackPath = '') => {
  logger.debug('Using useLocalBackend setting from config.js:', useLocalBackend);

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

// Create axios instance with base URL pointing to our backend
const API_BASE_URL = constructUrl('apiBaseUrl');

logger.info('API_BASE_URL constructed:', API_BASE_URL);
logger.info(`Using ${useLocalBackend ? 'LOCAL' : 'DEPLOYED'} backend`);

// Cookie helper function
const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return null;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include authentication token
api.interceptors.request.use(
  (config) => {
    const token = getCookie('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => handleSecuritySoftwareErrors(error)
);

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
    // Use SockJS base URL for SockJS connections
    const sockJsBaseUrl = constructUrl('sockJsBaseUrl');

    // Use factory function for proper auto-reconnect support
    const stompClient = Stomp.over(() => new SockJS(`${sockJsBaseUrl}/ws-radio`));

    // Enable auto-reconnect with 5 second delay
    stompClient.reconnect_delay = 5000;

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

        // Send join broadcast message to notify server that listener joined
        stompClient.publish({
          destination: `/app/broadcast/${broadcastId}/join`,
          body: JSON.stringify({})
        });

        const disconnectFunction = () => {
          // Send leave broadcast message before disconnecting
          if (stompClient && stompClient.connected) {
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
            if (stompClient && stompClient.connected) {
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
    // Use SockJS base URL for SockJS connections
    const sockJsBaseUrl = constructUrl('sockJsBaseUrl');

    // Use factory function for proper auto-reconnect support
    const stompClient = Stomp.over(() => new SockJS(`${sockJsBaseUrl}/ws-radio`));

    // Enable auto-reconnect with 5 second delay
    stompClient.reconnect_delay = 5000;

    const token = getCookie('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    return new Promise((resolve, reject) => {
      stompClient.connect(headers, () => {
        logger.debug('Connected to Chat WebSocket for broadcast:', broadcastId);

        // Subscribe to broadcast-specific chat messages
        const subscription = stompClient.subscribe(`/topic/broadcast/${broadcastId}/chat`, (message) => {
          try {
            const chatMessage = JSON.parse(message.body);
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
          isConnected: () => stompClient.connected
        });
      }, (error) => {
        logger.error('Chat WebSocket connection error:', error);
        reject(error);
      });
    });
  }
};

// Services for song requests
export const songRequestService = {
  getRequests: (broadcastId) => api.get(`/api/broadcasts/${broadcastId}/song-requests`),
  createRequest: (broadcastId, request) => api.post(`/api/broadcasts/${broadcastId}/song-requests`, request),
  getStats: () => api.get('/api/song-requests/stats'),

  // Subscribe to real-time song requests for a specific broadcast
  subscribeToSongRequests: (broadcastId, callback) => {
    // Use SockJS base URL for SockJS connections
    const sockJsBaseUrl = constructUrl('sockJsBaseUrl');

    // Use factory function for proper auto-reconnect support
    const stompClient = Stomp.over(() => new SockJS(`${sockJsBaseUrl}/ws-radio`));

    // Enable auto-reconnect with 5 second delay
    stompClient.reconnect_delay = 5000;

    const token = getCookie('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    return new Promise((resolve, reject) => {
      stompClient.connect(headers, () => {
        logger.debug('Connected to Song Requests WebSocket for broadcast:', broadcastId);

        // Subscribe to broadcast-specific song requests
        const subscription = stompClient.subscribe(`/topic/broadcast/${broadcastId}/song-requests`, (message) => {
          try {
            const songRequest = JSON.parse(message.body);
            callback(songRequest);
          } catch (error) {
            logger.error('Error parsing song request:', error);
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
    // Use SockJS base URL for SockJS connections
    const sockJsBaseUrl = constructUrl('sockJsBaseUrl');

    // Use factory function for proper auto-reconnect support
    const stompClient = Stomp.over(() => new SockJS(`${sockJsBaseUrl}/ws-radio`));

    // Enable auto-reconnect with 5 second delay
    stompClient.reconnect_delay = 5000;
    let isConnected = false;
    let pollingInterval = null;

    const token = getCookie('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    return new Promise((resolve) => {
      stompClient.connect(headers, (frame) => {
        logger.debug('Connected to WebSocket:', frame);
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
            if (pollingInterval) {
              clearInterval(pollingInterval);
              pollingInterval = null;
            }
            isConnected = false;
          },
          isConnected: () => isConnected
        });
      }, (error) => {
        logger.error('WebSocket connection error:', error);
        isConnected = false;

        // Fallback to polling if WebSocket connection fails
        logger.info('WebSocket connection failed. Falling back to polling.');
        pollingInterval = setInterval(async () => {
          try {
            const response = await notificationService.getUnread();
            if (response.data && response.data.length > 0) {
              response.data.forEach(notification => callback(notification));
            }
          } catch (pollError) {
            logger.error('Polling error:', pollError);
          }
        }, 30000); // Poll every 30 seconds as fallback

        resolve({
          disconnect: () => {
            if (pollingInterval) {
              clearInterval(pollingInterval);
              pollingInterval = null;
            }
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

  // Subscribe to real-time poll updates for a specific broadcast
  subscribeToPolls: (broadcastId, callback) => {
    // Use SockJS base URL for SockJS connections
    const sockJsBaseUrl = constructUrl('sockJsBaseUrl');

    // Use factory function for proper auto-reconnect support
    const stompClient = Stomp.over(() => new SockJS(`${sockJsBaseUrl}/ws-radio`));

    // Enable auto-reconnect with 5 second delay
    stompClient.reconnect_delay = 5000;

    const token = getCookie('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    return new Promise((resolve, reject) => {
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
  getPopularBroadcasts: () => api.get('/api/analytics/popular-broadcasts'),
  getAnalyticsSummary: () => api.get('/api/analytics/summary'),
  getHealthStatus: () => api.get('/api/analytics/health'),
};

export default api;
