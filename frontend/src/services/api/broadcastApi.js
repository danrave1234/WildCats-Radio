import { api, getCookie, logger } from './apiBase';
import stompClientManager from '../stompClientManager';

/**
 * Broadcast Management API
 * Handles broadcast operations, scheduling, and real-time updates
 */
export const broadcastApi = {
  // Basic CRUD operations
  getAll: () => api.get('/api/broadcasts'),
  getById: (id) => api.get(`/api/broadcasts/${id}`),
  create: (broadcastData) => api.post('/api/broadcasts', broadcastData),
  update: (id, broadcastData) => api.put(`/api/broadcasts/${id}`, broadcastData),
  delete: (id) => api.delete(`/api/broadcasts/${id}`),
  
  // Broadcast control operations
  start: (id) => api.post(`/api/broadcasts/${id}/start`),
  startTest: (id) => api.post(`/api/broadcasts/${id}/start-test`),
  end: (id) => api.post(`/api/broadcasts/${id}/end`),
  test: (id) => api.post(`/api/broadcasts/${id}/test`),
  
  // Slow mode settings
  updateSlowMode: (id, { enabled, seconds }) => api.put(`/api/broadcasts/${id}/slowmode`, { enabled, seconds }),
  
  // Query operations
  getAnalytics: (id) => api.get(`/api/broadcasts/${id}/analytics`),
  getUpcoming: () => api.get('/api/broadcasts/upcoming'),
  getLive: () => api.get('/api/broadcasts/live'),
  // Health snapshot endpoint (for recovery-first UI)
  getLiveHealth: () => api.get('/api/broadcasts/live/health'),
  // New history and chat export endpoints
  getHistory: (days = 30, page, size) => {
    const params = new URLSearchParams({ days: String(days) });
    if (page !== undefined) params.set('page', String(page));
    if (size !== undefined) params.set('size', String(size));
    return api.get(`/api/broadcasts/history?${params.toString()}`);
  },
  exportChat: (broadcastId) => api.get(`/api/broadcasts/${broadcastId}/chat/export`, { responseType: 'blob' }),
  getActiveBroadcast: () =>
    api
      .get('/api/broadcasts/live')
      .then((response) => {
        const broadcasts = Array.isArray(response.data) ? response.data : [];
        return broadcasts.length > 0 ? broadcasts[0] : null;
      })
      .catch(() => null),

  // Real-time WebSocket subscription for broadcast updates
  subscribeToBroadcastUpdates: (broadcastId, callback) => {
    return new Promise((resolve, reject) => {
      stompClientManager
        .subscribe(`/topic/broadcast/${broadcastId}`, (message) => {
          try {
            const broadcastMessage = JSON.parse(message.body);
            callback(broadcastMessage);
          } catch (error) {
            logger.error('Error parsing broadcast message:', error);
          }
        })
        .then((subscription) => {
          // Only send join/leave messages if broadcastId is valid (not null or "null")
          const shouldSendJoinLeave =
            broadcastId && broadcastId !== 'null' && broadcastId.toString().trim() !== '';

          if (shouldSendJoinLeave) {
            // Send join broadcast message to notify server that listener joined
            stompClientManager.publish(`/app/broadcast/${broadcastId}/join`, {});
          }

          const disconnectFunction = () => {
            // Send leave broadcast message before unsubscribing (only if valid broadcastId)
            if (shouldSendJoinLeave && stompClientManager.isConnected()) {
              try {
                stompClientManager.publish(`/app/broadcast/${broadcastId}/leave`, {});
              } catch (error) {
                logger.error('Error sending leave message:', error);
              }
            }

            if (subscription) {
              subscription.unsubscribe();
            }
          };

          resolve({
            disconnect: disconnectFunction,
            isConnected: () => stompClientManager.isConnected(),
            // Method to send messages to the broadcast channel
            sendMessage: (type, data) => {
              if (shouldSendJoinLeave && stompClientManager.isConnected()) {
                stompClientManager.publish(`/app/broadcast/${broadcastId}/message`, { type, data });
              }
            },
          });
        })
        .catch((error) => {
          logger.error('Broadcast WebSocket connection error:', error);
          reject(error);
        });
    });
  },

  // Global broadcast status WebSocket for real-time broadcast detection
  subscribeToGlobalBroadcastStatus: (callback) => {
    return new Promise((resolve, reject) => {
      stompClientManager
        .subscribe('/topic/broadcast/status', (message) => {
          try {
            const statusMessage = JSON.parse(message.body);
            callback(statusMessage);
          } catch (error) {
            logger.error('Error parsing broadcast status message:', error);
          }
        })
        .then((subscription) => {
          const disconnectFunction = () => {
            if (subscription) {
              subscription.unsubscribe();
            }
          };

          resolve({
            disconnect: disconnectFunction,
            isConnected: () => stompClientManager.isConnected(),
          });
        })
        .catch((error) => {
          logger.error('Global Broadcast Status WebSocket connection error:', error);
          reject(error);
        });
    });
  },

  // Live broadcast status WebSocket for real-time updates
  subscribeToLiveBroadcastStatus: (callback) => {
    return new Promise((resolve, reject) => {
      stompClientManager
        .subscribe('/topic/broadcast/live', (message) => {
          try {
            const liveStatusMessage = JSON.parse(message.body);
            callback(liveStatusMessage);
          } catch (error) {
            logger.error('Error parsing live broadcast status message:', error);
          }
        })
        .then((subscription) => {
          const disconnectFunction = () => {
            if (subscription) {
              subscription.unsubscribe();
            }
          };

          resolve({
            disconnect: disconnectFunction,
            isConnected: () => stompClientManager.isConnected(),
          });
        })
        .catch((error) => {
          logger.error('Live Broadcast Status WebSocket connection error:', error);
          reject(error);
        });
    });
  },
};

export default broadcastApi;