import { api } from './apiBase';

/**
 * Analytics API
 * Handles analytics data retrieval and reporting
 */
export const analyticsApi = {
  // General analytics (optionally accept axios config)
  getBroadcastStats: (config) => api.get('/api/analytics/broadcasts', config),
  getUserStats: (config) => api.get('/api/analytics/users', config),
  getEngagementStats: (config) => api.get('/api/analytics/engagement', config),
  // Accept optional params/config; if a plain object is passed, treat as params
  getActivityStats: (paramsOrConfig, maybeConfig) => {
    let config = undefined;
    if (paramsOrConfig && (paramsOrConfig.params || paramsOrConfig.signal || paramsOrConfig.headers)) {
      config = paramsOrConfig;
    } else if (paramsOrConfig) {
      config = { params: paramsOrConfig };
    } else if (maybeConfig) {
      config = maybeConfig;
    }
    return api.get('/api/analytics/activity', config);
  },
  getRealtimeStats: (config) => api.get('/api/analytics/realtime', config),
  getPopularBroadcasts: (config) => api.get('/api/analytics/popular-broadcasts', config),
  getAnalyticsSummary: (config) => api.get('/api/analytics/summary', config),
  getHealthStatus: (config) => api.get('/api/analytics/health', config),
  getDemographicAnalytics: (config) => api.get('/api/analytics/demographics', config),
  
  // Individual broadcast analytics
  getBroadcastAnalytics: (broadcastId, config) => api.get(`/api/analytics/broadcast/${broadcastId}`, config),
  getAllBroadcastAnalytics: (config) => api.get('/api/analytics/broadcasts/detailed', config),
};

export default analyticsApi;