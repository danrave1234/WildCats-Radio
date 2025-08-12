// Import all APIs
import { authApi } from './authApi';
import { broadcastApi } from './broadcastApi';
import { chatApi } from './chatApi';
import { analyticsApi } from './analyticsApi';
import { 
  notificationApi, 
  activityLogApi, 
  songRequestApi, 
  pollApi, 
  streamApi 
} from './otherApis';

// Export all domain-specific API modules
export { authApi } from './authApi';
export { broadcastApi } from './broadcastApi';
export { chatApi } from './chatApi';
export { analyticsApi } from './analyticsApi';
export { 
  notificationApi, 
  activityLogApi, 
  songRequestApi, 
  pollApi, 
  streamApi 
} from './otherApis';

// Export base API functionality
export { 
  api, 
  apiProxy, 
  constructUrl, 
  getCookie, 
  createWebSocketConnection,
  logger 
} from './apiBase';

// Legacy service exports for backward compatibility
export const authService = authApi;
export const broadcastService = broadcastApi;
export const chatService = chatApi;
export const notificationService = notificationApi;
export const activityLogService = activityLogApi;
export const songRequestService = songRequestApi;
export const pollService = pollApi;
export const streamService = streamApi;
export const analyticsService = analyticsApi;

// Default export for backward compatibility
export { api as default } from './apiBase';
