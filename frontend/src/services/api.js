import axios from 'axios';
import { handleSecuritySoftwareErrors } from './errorHandler';
// WebSocket support libraries
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';

// Helper function to get the correct protocol for the current environment
const getProtocol = (forWebSocket = false, host = '') => {
  const isSecure = window.location.protocol === 'https:';
  if (forWebSocket) {
    return isSecure ? 'wss:' : 'wss:';
  }
  // Use HTTP for localhost, HTTPS for other hosts
  if (host.includes('localhost')) {
    return 'http:';
  }
  return isSecure ? 'https:' : 'http:';
};

// Simple function to construct URLs from environment variables
// Environment variables should NOT include protocols as specified in .env comments
const constructUrl = (envVar, fallbackHost, fallbackPath = '', forWebSocket = false) => {
  // Check if we should use localhost instead of the deployed backend
  // Force useLocalBackend to true to ensure we're using the local backend
  const useLocalBackend = true; // Override the environment variable
  console.log('Environment variable VITE_USE_LOCAL_BACKEND:', import.meta.env.VITE_USE_LOCAL_BACKEND);
  console.log('Using forced local backend setting');

  // If using local backend, override the host for API and WebSocket (but not Icecast)
  let host;
  if (useLocalBackend && !envVar.includes('ICECAST_URL')) {
    host = 'localhost:8080';
    // For API endpoints, add the path
    if (envVar.includes('API_BASE_URL')) {
      host += '/api';
    }
  } else {
    // Use the environment variable as normal
    host = envVar;
  }

  // Simple clean - just remove any protocol if present
  const cleanHost = host.replace(/^(https?:\/\/|wss?:\/\/)/, '');

  // Get the appropriate protocol based on the host
  const protocol = getProtocol(forWebSocket, cleanHost);

  return `${protocol}//${cleanHost}${fallbackPath}`;
};


// Create axios instance with base URL pointing to our backend
const API_BASE_URL = constructUrl(
  import.meta.env.VITE_API_BASE_URL,
  false
);

console.log('API_BASE_URL constructed:', API_BASE_URL);
console.log(`Using ${import.meta.env.VITE_USE_LOCAL_BACKEND === 'true' ? 'LOCAL' : 'DEPLOYED'} backend`);

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
    // Use the environment variable directly - no fallbacks needed
    const wsBaseUrl = constructUrl(
      import.meta.env.VITE_WS_BASE_URL,
      '',
      '',
      false // HTTP for SockJS
    );

    // Use factory function for proper auto-reconnect support
    const stompClient = Stomp.over(() => new SockJS(`${wsBaseUrl}/ws-radio`));

    // Enable auto-reconnect with 5 second delay
    stompClient.reconnect_delay = 5000;

    const token = getCookie('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    return new Promise((resolve, reject) => {
      stompClient.connect(headers, () => {
        console.log('Connected to Broadcast WebSocket for broadcast:', broadcastId);

        // Subscribe to broadcast-specific updates
        const subscription = stompClient.subscribe(`/topic/broadcast/${broadcastId}`, (message) => {
          try {
            const broadcastMessage = JSON.parse(message.body);
            callback(broadcastMessage);
          } catch (error) {
            console.error('Error parsing broadcast message:', error);
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
              console.error('Error sending leave message:', error);
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
        console.error('Broadcast WebSocket connection error:', error);
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
    // Use the environment variable directly - no fallbacks needed
    const wsBaseUrl = constructUrl(
      import.meta.env.VITE_WS_BASE_URL,
      '',
      '',
      false // HTTP for SockJS
    );

    // Use factory function for proper auto-reconnect support
    const stompClient = Stomp.over(() => new SockJS(`${wsBaseUrl}/ws-radio`));

    // Enable auto-reconnect with 5 second delay
    stompClient.reconnect_delay = 5000;

    const token = getCookie('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    return new Promise((resolve, reject) => {
      stompClient.connect(headers, () => {
        console.log('Connected to Chat WebSocket for broadcast:', broadcastId);

        // Subscribe to broadcast-specific chat messages
        const subscription = stompClient.subscribe(`/topic/broadcast/${broadcastId}/chat`, (message) => {
          try {
            const chatMessage = JSON.parse(message.body);
            callback(chatMessage);
          } catch (error) {
            console.error('Error parsing chat message:', error);
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
        console.error('Chat WebSocket connection error:', error);
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
    // Use the environment variable directly - no fallbacks needed
    const wsBaseUrl = constructUrl(
      import.meta.env.VITE_WS_BASE_URL,
      '',
      '',
      false // HTTP for SockJS
    );

    // Use factory function for proper auto-reconnect support
    const stompClient = Stomp.over(() => new SockJS(`${wsBaseUrl}/ws-radio`));

    // Enable auto-reconnect with 5 second delay
    stompClient.reconnect_delay = 5000;

    const token = getCookie('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    return new Promise((resolve, reject) => {
      stompClient.connect(headers, () => {
        console.log('Connected to Song Requests WebSocket for broadcast:', broadcastId);

        // Subscribe to broadcast-specific song requests
        const subscription = stompClient.subscribe(`/topic/broadcast/${broadcastId}/song-requests`, (message) => {
          try {
            const songRequest = JSON.parse(message.body);
            callback(songRequest);
          } catch (error) {
            console.error('Error parsing song request:', error);
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
        console.error('Song Requests WebSocket connection error:', error);
        reject(error);
      });
    });
  }
};

// Services for notifications
export const notificationService = {
  getAll: () => api.get('/api/notifications'),
  getUnread: () => api.get('/api/notifications/unread'),
  markAsRead: (id) => api.put(`/api/notifications/${id}/read`),
  getByType: (type) => api.get(`/api/notifications/by-type/${type}`),
  getRecent: (since) => api.get(`/api/notifications/recent?since=${since}`),
    subscribeToNotifications: (callback) => {
    // Use the environment variable directly - no fallbacks needed
    const wsBaseUrl = constructUrl(
      import.meta.env.VITE_WS_BASE_URL,
      '',
      '',
      false // HTTP for SockJS
    );

    // Use factory function for proper auto-reconnect support
    const stompClient = Stomp.over(() => new SockJS(`${wsBaseUrl}/ws-radio`));

    // Enable auto-reconnect with 5 second delay
    stompClient.reconnect_delay = 5000;
    let isConnected = false;
    let pollingInterval = null;

    const token = getCookie('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    return new Promise((resolve) => {
      stompClient.connect(headers, (frame) => {
        console.log('Connected to WebSocket:', frame);
        isConnected = true;

        stompClient.subscribe('/user/queue/notifications', (message) => {
          try {
            const notification = JSON.parse(message.body);
            callback(notification);
          } catch (error) {
            console.error('Error parsing notification:', error);
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
        console.error('WebSocket connection error:', error);
        isConnected = false;

        // Fallback to polling if WebSocket connection fails
        console.log('WebSocket connection failed. Falling back to polling.');
        pollingInterval = setInterval(async () => {
          try {
            const response = await notificationService.getUnread();
            if (response.data && response.data.length > 0) {
              response.data.forEach(notification => callback(notification));
            }
          } catch (pollError) {
            console.error('Polling error:', pollError);
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

// Services for server scheduling (not using actual server commands in local mode)
export const serverService = {
  getSchedules: () => api.get('/api/server-schedules'),
  createSchedule: (scheduleData) => api.post('/api/server-schedules', scheduleData),
  updateSchedule: (id, scheduleData) => api.put(`/api/server-schedules/${id}`, scheduleData),
  deleteSchedule: (id) => api.post(`/api/server-schedules/${id}/delete`),
  startNow: () => api.post('/api/server-schedules/manual-start'),
  stopNow: () => api.post('/api/server-schedules/manual-stop'),
  getStatus: () => api.get('/api/server-schedules/status'),
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
    // Use the environment variable directly - no fallbacks needed
    const wsBaseUrl = constructUrl(
      import.meta.env.VITE_WS_BASE_URL,
      '',
      '',
      false // HTTP for SockJS
    );

    // Use factory function for proper auto-reconnect support
    const stompClient = Stomp.over(() => new SockJS(`${wsBaseUrl}/ws-radio`));

    // Enable auto-reconnect with 5 second delay
    stompClient.reconnect_delay = 5000;

    const token = getCookie('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    return new Promise((resolve, reject) => {
      stompClient.connect(headers, () => {
        console.log('Connected to Polls WebSocket for broadcast:', broadcastId);

        // Subscribe to broadcast-specific poll updates
        const subscription = stompClient.subscribe(`/topic/broadcast/${broadcastId}/polls`, (message) => {
          try {
            const pollData = JSON.parse(message.body);
            callback(pollData);
          } catch (error) {
            console.error('Error parsing poll data:', error);
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
        console.error('Polls WebSocket connection error:', error);
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
    // Check if we should use localhost instead of the deployed backend
    // Force useLocalBackend to true to ensure we're using the local backend
    const useLocalBackend = true; // Override the environment variable
    
    let wsBaseUrl;
    if (useLocalBackend) {
      wsBaseUrl = 'localhost:8080';
    } else {
      wsBaseUrl = import.meta.env.VITE_WS_BASE_URL;
    }
    
    const cleanHost = wsBaseUrl.replace(/^(https?:\/\/|wss?:\/\/)/, '');
    // For deployed environments, always use secure WebSocket (wss)
    // For localhost development, use ws
    const protocol = window.location.hostname === 'localhost' ? 'ws' : 'wss';

    return Promise.resolve(`${protocol}://${cleanHost}/ws/live`);
  },

  // Stream URL for listeners to tune in to the broadcast
  getListenerStreamUrl: () => {
    // Use environment variable directly
    return Promise.resolve(
      constructUrl(
        import.meta.env.VITE_ICECAST_URL,
        '',
        '',
        false // HTTP for audio stream
      )
    );
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
        console.error('Error checking Icecast server:', error);
        return { isUp: false, error: error.message };
      });
  }
};

export default api;
