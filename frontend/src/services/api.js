import axios from 'axios';

// Create axios instance with base URL pointing to our backend
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
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Services for user authentication
export const authService = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  verify: (email, code) => api.post(`/auth/verify?email=${email}&code=${code}`),
  sendCode: (email) => api.post(`/auth/send-code?email=${email}`),
  getProfile: (id) => api.get(`/auth/${id}`),
  updateProfile: (id, data) => api.put(`/auth/${id}`, data),
};

// Services for broadcasts
export const broadcastService = {
  getAll: () => api.get('/broadcasts'),
  getById: (id) => api.get(`/broadcasts/${id}`),
  schedule: (broadcastData) => api.post('/broadcasts/schedule', broadcastData),
  start: (id) => api.post(`/broadcasts/${id}/start`),
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
};

// Services for song requests
export const songRequestService = {
  getRequests: (broadcastId) => api.get(`/song-requests/${broadcastId}`),
  createRequest: (broadcastId, request) => api.post(`/song-requests/${broadcastId}`, request),
};

// Services for notifications
export const notificationService = {
  getAll: () => api.get('/notifications'),
  getUnread: () => api.get('/notifications/unread'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
};

// Services for server scheduling (not using actual server commands in local mode)
export const serverService = {
  getSchedules: () => api.get('/server-schedules'),
  createSchedule: (scheduleData) => api.post('/server-schedules', scheduleData),
  updateSchedule: (id, scheduleData) => api.put(`/server-schedules/${id}`, scheduleData),
  manualStart: () => api.post('/server-schedules/manual-start'),
  manualStop: () => api.post('/server-schedules/manual-stop'),
  getStatus: () => api.get('/server-schedules/status'),
};

// Services for activity logs
export const activityLogService = {
  getLogs: () => api.get('/activity-logs'),
  getUserLogs: (userId) => api.get(`/activity-logs/user/${userId}`),
};

export default api; 