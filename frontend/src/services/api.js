import axios from 'axios';
import { handleSecuritySoftwareErrors } from './errorHandler';
// WebSocket support libraries
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import { getCookie } from '../util/cookies';

// Create axios instance with base URL pointing to our backend
// const API_BASE_URL = 'https://wildcat-radio-f05d362144e6.herokuapp.com/api';
const API_BASE_URL = 'http://localhost:8080/api';

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
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  verify: (email, code) => api.post(`/auth/verify?email=${email}&code=${code}`),
  sendCode: (email) => api.post(`/auth/send-code?email=${email}`),
  getProfile: (id) => api.get(`/auth/${id}`),
  getCurrentUser: () => api.get('/auth/me'),
  updateProfile: (id, data) => api.put(`/auth/${id}`, data),
  changePassword: (id, data) => api.post(`/auth/${id}/change-password`, data),
  // Admin-specific methods
  getAllUsers: () => api.get('/auth/getAll'),
  getUsersByRole: (role) => api.get(`/auth/by-role/${role}`),
  updateUserRole: (id, newRole) => api.put(`/auth/${id}/role?newRole=${newRole}`),
};

// Services for broadcasts
export const broadcastService = {
  getAll: () => api.get('/broadcasts'),
  getById: (id) => api.get(`/broadcasts/${id}`),
  schedule: (broadcastData) => api.post('/broadcasts/schedule', broadcastData),
  update: (id, broadcastData) => api.put(`/broadcasts/${id}`, broadcastData),
  delete: (id) => api.delete(`/broadcasts/${id}`),
  start: (id) => api.post(`/broadcasts/${id}/start`),
  startTest: (id) => api.post(`/broadcasts/${id}/start-test`),
  end: (id) => api.post(`/broadcasts/${id}/end`),
  test: (id) => api.post(`/broadcasts/${id}/test`),
  getAnalytics: (id) => api.get(`/broadcasts/${id}/analytics`),
  getUpcoming: () => api.get('/broadcasts/upcoming'),
  getLive: () => api.get('/broadcasts/live'),
};

// Services for chat messages
export const chatService = {
  getMessages: (broadcastId) => api.get(`/chats/${broadcastId}`),
  sendMessage: (broadcastId, message) => api.post(`/chats/${broadcastId}`, message),
  
  // New method for the ListenerDashboard live chat
  getLiveMessages: () => api.get('/chats/live'),
  sendLiveMessage: (message) => api.post('/chats/live', message),
  
  // Subscribe to live chat via WebSocket
  subscribeToLiveChat: (callback) => {
    const socket = new SockJS(`${API_BASE_URL.replace('/api', '')}/ws-radio`);
    const stompClient = Stomp.over(socket);
    
    const token = getCookie('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    
    stompClient.connect(headers, () => {
      stompClient.subscribe('/topic/chat', (message) => {
        const chatMessage = JSON.parse(message.body);
        callback(chatMessage);
      });
    }, (error) => {
      console.error('WebSocket connection error:', error);
      // Fallback to polling
      const intervalId = setInterval(() => {
        chatService.getLiveMessages().then(response => {
          if (response.data && response.data.length > 0) {
            // Send only new messages to callback
            response.data.forEach(message => callback(message));
          }
        });
      }, 5000); // Poll every 5 seconds
      
      return {
        disconnect: () => clearInterval(intervalId)
      };
    });
    
    return {
      disconnect: () => {
        if (stompClient && stompClient.connected) {
          stompClient.disconnect();
        }
      },
      send: (message) => {
        if (stompClient && stompClient.connected) {
          stompClient.send('/app/chat', {}, JSON.stringify(message));
          return true;
        }
        return false;
      }
    };
  }
};

// Services for song requests
export const songRequestService = {
  getRequests: (broadcastId) => api.get(`/broadcasts/${broadcastId}/song-requests`),
  createRequest: (broadcastId, request) => api.post(`/broadcasts/${broadcastId}/song-requests`, request),
};

// Services for notifications
export const notificationService = {
  getAll: () => api.get('/notifications'),
  getUnread: () => api.get('/notifications/unread'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  getByType: (type) => api.get(`/notifications/by-type/${type}`),
  getRecent: (since) => api.get(`/notifications/recent?since=${since}`),
  subscribeToNotifications: (callback) => {
    // Using WebSocket for real-time notifications
    const socket = new SockJS(`${API_BASE_URL.replace('/api', '')}/ws-radio`);
    const stompClient = Stomp.over(socket);

    const token = getCookie('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    stompClient.connect(headers, () => {
      stompClient.subscribe('/user/queue/notifications', (message) => {
        const notification = JSON.parse(message.body);
        callback(notification);
      });
    }, (error) => {
      console.error('WebSocket connection error:', error);
      // Fallback to polling if WebSocket connection fails
      console.log('WebSocket connection failed. Falling back to polling.');
      const intervalId = setInterval(() => {
        notificationService.getUnread().then(response => {
          if (response.data && response.data.length > 0) {
            response.data.forEach(notification => callback(notification));
          }
        });
      }, 30000); // Poll every 30 seconds as fallback

      return {
        disconnect: () => clearInterval(intervalId)
      };
    });

    return {
      disconnect: () => {
        if (stompClient && stompClient.connected) {
          stompClient.disconnect();
        }
      }
    };
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
  getSchedules: () => api.get('/server-schedules'),
  createSchedule: (scheduleData) => api.post('/server-schedules', scheduleData),
  updateSchedule: (id, scheduleData) => api.put(`/server-schedules/${id}`, scheduleData),
  deleteSchedule: (id) => api.post(`/server-schedules/${id}/delete`),
  startNow: () => api.post('/server-schedules/manual-start'),
  stopNow: () => api.post('/server-schedules/manual-stop'),
  getStatus: () => api.get('/server-schedules/status'),
};

// Services for activity logs
export const activityLogService = {
  getLogs: () => api.get('/activity-logs'),
  getUserLogs: (userId) => api.get(`/activity-logs/user/${userId}`),
};

// Services for polls
export const pollService = {
  createPoll: (pollData) => api.post('/polls', pollData),
  getPollsForBroadcast: (broadcastId) => api.get(`/polls/broadcast/${broadcastId}`),
  getActivePollsForBroadcast: (broadcastId) => api.get(`/polls/broadcast/${broadcastId}/active`),
  getPoll: (pollId) => api.get(`/polls/${pollId}`),
  vote: (pollId, voteData) => api.post(`/polls/${pollId}/vote`, voteData),
  getPollResults: (pollId) => api.get(`/polls/${pollId}/results`),
  endPoll: (pollId) => api.post(`/polls/${pollId}/end`),
  hasUserVoted: (pollId) => api.get(`/polls/${pollId}/has-voted`),
  getUserVote: (pollId) => api.get(`/polls/${pollId}/user-vote`),
};

// Services for Shoutcast streaming
export const streamService = {
  // Start a stream (DJ-facing)
  startStream: async () => {
    return api.post('/stream/start');
  },
  
  // Alias for startStream to match function name used in DJDashboard
  start: async () => {
    return api.post('/stream/start');
  },
  
  // Stop a stream (DJ-facing)
  stopStream: async () => {
    return api.post('/stream/stop');
  },
  
  // Alias for stopStream to match function name used in DJDashboard
  stop: async () => {
    return api.post('/stream/stop');
  },
  
  // Get the status of the streaming service
  getStatus: async () => {
    return api.get('/stream/status');
  },
  
  // Get detailed track information
  getCurrentTrack: async () => {
    try {
      const response = await api.get('/stream/current-track');
      return response.data;
    } catch (error) {
      console.error("Error getting current track:", error);
      return { title: "Unknown Track", artist: "Unknown Artist" };
    }
  },
  
  // Get track history
  getTrackHistory: async (limit = 5) => {
    try {
      const response = await api.get(`/stream/history?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error("Error getting track history:", error);
      return [];
    }
  },
  
  // Get current listener count
  getListenerCount: async () => {
    try {
      const response = await api.get('/stream/listeners');
      return response.data.count || 0;
    } catch (error) {
      console.error("Error getting listener count:", error);
      return 0;
    }
  },
  
  // Get detailed diagnostics about the ShoutCast server
  getDiagnostics: async () => {
    return api.get('/stream/diagnostics');
  },
  
  // Launch the ShoutCast server (admin only)
  launchServer: async () => {
    return api.post('/stream/launch-server');
  },
  
  // Stream URL for listeners to tune in to the broadcast
  getListenerStreamUrl: async (format = 'mp3') => {
    try {
      // Use our proxy endpoint instead of direct connection to ShoutCast
      // This avoids CORS issues and removes the need for authentication in the frontend
      const baseApiUrl = API_BASE_URL; // e.g. http://localhost:8080/api
      
      // Construct URL with format parameter
      const streamUrl = `${baseApiUrl}/stream/proxy?format=${format}&_t=${Date.now()}`;
      
      console.log("Using proxy stream URL:", streamUrl);
      return streamUrl;
    } catch (error) {
      console.error("Error getting stream URL:", error);
      return null;
    }
  },
  
  // Check if a DJ broadcast is currently active
  isLiveBroadcastActive: async () => {
    try {
      const response = await api.get('/stream/status');
      return response.data && response.data.live === true;
    } catch (error) {
      console.error("Error checking broadcast status:", error);
      return false;
    }
  },
  
  // Get information about the ShoutCast server
  getServerInfo: async () => {
    try {
      const response = await api.get('/stream/diagnostics');
      return response.data;
    } catch (error) {
      console.error("Error getting ShoutCast server info:", error);
      return { status: "ERROR", error: error.message };
    }
  },

  // WebSocket URL for DJs to send audio to the server
  getStreamUrl: () => {
    try {
      // Get the base information from current window location
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const hostname = window.location.hostname;
      
      // Determine the appropriate port and path
      let port = ''; // Default to no explicit port in URL
      let path = '/stream';
      
      // Handle special cases for localhost development
      if (hostname === 'localhost') {
        // In development, explicitly use port 8080 for backend
        port = ':8080';
      } else {
        // In production:
        // If we're on a custom port that's not 80/443, use it
        if (window.location.port && window.location.port !== '80' && window.location.port !== '443') {
          port = `:${window.location.port}`;
        }
        // Otherwise no explicit port needed - browsers will use standard ports
      }
      
      // Combine all parts to form the WebSocket URL
      const wsUrl = `${protocol}://${hostname}${port}${path}`;
      
      console.log('Constructed WebSocket URL for DJ streaming:', wsUrl);
      return wsUrl;
    } catch (error) {
      console.error('Error constructing WebSocket URL:', error);
      // Fallback to a default localhost URL if there's an error
      const fallbackUrl = window.location.hostname === 'localhost' 
          ? 'ws://localhost:8080/stream'
          : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/stream`;
      console.log('Using fallback WebSocket URL:', fallbackUrl);
      return fallbackUrl;
    }
  },

  // Subscribe to streaming status updates via WebSocket
  subscribeToStreamStatus: (callback) => {
    const connectWebSocket = () => {
      console.log('Attempting to connect to WebSocket for stream status');
      
      try {
        // Use protocol and hostname from current window location
        const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
        const host = window.location.hostname === 'localhost' ? 
          'localhost:8080' : window.location.host;
          
        console.log(`Using STOMP WebSocket with ${protocol}//${host}/ws-radio`);
          
        const socket = new SockJS(`${protocol}//${host}/ws-radio`);
        const stompClient = Stomp.over(socket);
        
        // Disable console logging spam
        stompClient.debug = null;

        const token = getCookie('token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        
        let reconnectAttempt = 0;
        const maxReconnectAttempts = 5;
        const reconnectDelay = 2000; // 2 seconds initial delay
        let reconnectTimeout = null;
        
        // Function to handle reconnection with exponential backoff
        const reconnect = () => {
          if (reconnectAttempt < maxReconnectAttempts) {
            reconnectAttempt++;
            const timeoutMs = reconnectDelay * Math.pow(2, reconnectAttempt - 1);
            console.log(`WebSocket reconnect attempt ${reconnectAttempt}/${maxReconnectAttempts} in ${timeoutMs}ms`);
            
            // Clear any existing timeout
            if (reconnectTimeout) {
              clearTimeout(reconnectTimeout);
            }
            
            reconnectTimeout = setTimeout(() => {
              // Create new connection
              connectWebSocket();
            }, timeoutMs);
          } else {
            console.error('Max WebSocket reconnect attempts reached, falling back to REST API');
            
            // Set up polling fallback
            const pollInterval = setInterval(() => {
              streamService.getStatus()
                .then(response => {
                  if (response && response.data) {
                    callback(response.data);
                  }
                })
                .catch(err => console.error('Error in polling fallback:', err));
            }, 5000);
            
            // Return cleanup function
            return () => clearInterval(pollInterval);
          }
        };
        
        // Add more detailed error logging
        console.log('Connecting to STOMP with headers:', headers);
        
        stompClient.connect(headers, 
          // Success callback
          () => {
            console.log('WebSocket connected for streaming status');
            reconnectAttempt = 0; // Reset reconnect counter on successful connection
            
            // Subscribe to stream status topic
            stompClient.subscribe('/topic/stream-status', (message) => {
              try {
                const status = JSON.parse(message.body);
                callback(status);
              } catch (e) {
                console.error('Error parsing stream status message:', e);
              }
            });

            // Subscribe to audio levels topic
            stompClient.subscribe('/topic/audio-levels', (message) => {
              try {
                const levels = JSON.parse(message.body);
                callback(levels);
              } catch (e) {
                console.error('Error parsing audio levels message:', e);
              }
            });

            // Request initial audio levels - wrap in try/catch to prevent errors
            try {
              stompClient.send('/app/check-levels', {}, '');
            } catch (e) {
              console.error('Error sending initial levels request:', e);
            }
          },
          
          // Error callback
          (error) => {
            console.error('Error connecting to WebSocket for streaming status:', error);
            
            // Log more detailed error information if available
            if (error && error.headers) {
              console.error('Error headers:', error.headers);
            }
            
            // Try to reconnect
            reconnect();
          });
        
        // Handle manual reconnection when connection is lost
        socket.onclose = (event) => {
          console.warn(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
          
          // Log detailed information about closure codes
          let codeExplanation = "";
          switch (event.code) {
            case 1000: codeExplanation = "Normal closure"; break;
            case 1001: codeExplanation = "Going away"; break;
            case 1002: codeExplanation = "Protocol error"; break;
            case 1003: codeExplanation = "Unsupported data"; break;
            case 1005: codeExplanation = "No status received"; break;
            case 1006: codeExplanation = "Abnormal closure"; break;
            case 1007: codeExplanation = "Invalid frame payload data"; break;
            case 1008: codeExplanation = "Policy violation"; break;
            case 1009: codeExplanation = "Message too big"; break;
            case 1010: codeExplanation = "Missing extension"; break;
            case 1011: codeExplanation = "Internal error"; break;
            case 1012: codeExplanation = "Service restart"; break;
            case 1013: codeExplanation = "Try again later"; break;
            case 1014: codeExplanation = "Bad gateway"; break;
            case 1015: codeExplanation = "TLS handshake"; break;
            default: codeExplanation = "Unknown reason";
          }
          console.warn(`WebSocket close code ${event.code} means: ${codeExplanation}`);
          
          if (event.code !== 1000) { // 1000 is normal closure
            // Try to reconnect on abnormal closure
            reconnect();
          }
        };
        
        // Return cleanup function
        return {
          stompClient,
          reconnectTimeout,
          disconnect: () => {
            // Clear any pending reconnect
            if (reconnectTimeout) {
              clearTimeout(reconnectTimeout);
            }
            
            // Disconnect if client exists and is connected
            if (stompClient) {
              try {
                if (stompClient.connected) {
                  stompClient.disconnect();
                  console.log('WebSocket disconnected');
                }
              } catch (e) {
                console.error('Error disconnecting WebSocket:', e);
              }
            }
          }
        };
      } catch (error) {
        console.error('Error in WebSocket connection setup:', error);
        // Create a simple polling fallback
        const pollInterval = setInterval(() => {
          streamService.getStatus()
            .then(response => {
              if (response && response.data) {
                callback(response.data);
              }
            })
            .catch(err => console.error('Error in polling fallback:', err));
        }, 5000);
        
        return {
          disconnect: () => clearInterval(pollInterval)
        };
      }
    };
    
    // Start initial connection
    const connection = connectWebSocket();
    
    // Return object with disconnect method
    return {
      disconnect: () => {
        if (connection && typeof connection.disconnect === 'function') {
          connection.disconnect();
        }
      }
    };
  },
  
  // Subscribe to stream metadata updates via WebSocket
  subscribeToMetadata: (callback) => {
    const socket = new SockJS(`${API_BASE_URL.replace('/api', '')}/ws-radio`);
    const stompClient = Stomp.over(socket);
    
    const token = getCookie('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    
    stompClient.connect(headers, () => {
      stompClient.subscribe('/topic/metadata', (message) => {
        const metadata = JSON.parse(message.body);
        callback(metadata);
      });
    }, (error) => {
      console.error('WebSocket connection error:', error);
      // Fallback to polling
      const intervalId = setInterval(() => {
        streamService.getCurrentTrack().then(data => {
          callback(data);
        });
      }, 15000); // Poll every 15 seconds
      
      return {
        disconnect: () => clearInterval(intervalId)
      };
    });
    
    return {
      disconnect: () => {
        if (stompClient && stompClient.connected) {
          stompClient.disconnect();
        }
      }
    };
  }
};

export default api;
