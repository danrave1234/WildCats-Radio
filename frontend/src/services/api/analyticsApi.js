import { api } from './apiBase';

/**
 * Analytics API
 * Handles analytics data retrieval and reporting
 */
export const analyticsApi = {
  // General analytics
  getBroadcastStats: () => api.get('/api/analytics/broadcasts'),
  getUserStats: () => api.get('/api/analytics/users'),
  getEngagementStats: () => api.get('/api/analytics/engagement'),
  getActivityStats: () => api.get('/api/analytics/activity'),
  getRealtimeStats: () => api.get('/api/analytics/realtime'),
  getPopularBroadcasts: () => api.get('/api/analytics/popular-broadcasts'),
  getAnalyticsSummary: () => api.get('/api/analytics/summary'),
  getHealthStatus: () => api.get('/api/analytics/health'),
  
  // Individual broadcast analytics
  getBroadcastAnalytics: (broadcastId) => api.get(`/api/analytics/broadcast/${broadcastId}`),
  getAllBroadcastAnalytics: () => api.get('/api/analytics/broadcasts/detailed'),
};

export default analyticsApi;