import axios from 'axios';
import { handleSecuritySoftwareErrors } from './errorHandler';
// WebSocket support libraries
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';

// Create axios instance with base URL pointing to our backend
// const API_BASE_URL = 'https://wildcat-radio-f05d362144e6.herokuapp.com/api';
const API_BASE_URL = 'http://localhost:8080/api';

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
  create: (broadcastData) => api.post('/broadcasts', broadcastData),
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
  getActiveBroadcast: () => api.get('/broadcasts/live').then(response => response.data[0] || null),
};

// Services for chat messages
export const chatService = {
  getMessages: (broadcastId) => api.get(`/chats/${broadcastId}`),
  sendMessage: (broadcastId, message) => api.post(`/chats/${broadcastId}`, message),
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

// Services for Icecast streaming
export const streamService = {
  start: () => api.post('/stream/start'),
  stop: () => api.post('/stream/stop'),
  getStatus: () => api.get('/stream/status'),
  getConfig: () => api.get('/stream/config'),
  getHealth: () => api.get('/stream/health'),
  
  // WebSocket URL for DJs to send audio to the server
  getStreamUrl: () => {
    // Get WebSocket URL from backend config if available
    return api.get('/stream/config')
      .then(response => {
        if (response.data.success && response.data.data.webSocketUrl) {
          return response.data.data.webSocketUrl;
        }
        throw new Error('WebSocket URL not found in config');
      })
      .catch(() => {
        // Fallback to constructing URL if API call fails
        const apiUrl = new URL(API_BASE_URL);
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        return `${protocol}://${apiUrl.host}/ws/live`;
      });
  },
  
  // Stream URL for listeners to tune in to the broadcast
  getListenerStreamUrl: () => {
    // First try to get the URL from the backend config
    return api.get('/stream/config')
      .then(response => {
        if (response.data.success && response.data.data.streamUrl) {
          return response.data.data.streamUrl;
        }
        throw new Error('Stream URL not found in config');
      })
      .catch(() => {
        // Fallback to default Icecast URL structure
        return 'http://localhost:8000/live.ogg';
      });
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
