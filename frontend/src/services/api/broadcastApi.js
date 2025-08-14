import { api, createWebSocketConnection, getCookie, logger } from './apiBase';

/**
 * Broadcast Management API
 * Handles broadcast operations, scheduling, and real-time updates
 */
export const broadcastApi = {
  // Basic CRUD operations
  getAll: () => api.get('/api/broadcasts'),
  getById: (id) => api.get(`/api/broadcasts/${id}`),
  create: (broadcastData) => api.post('/api/broadcasts', broadcastData),
  schedule: (broadcastData) => api.post('/api/broadcasts/schedule', broadcastData),
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
  // New history and chat export endpoints
  getHistory: (days = 30) => api.get(`/api/broadcasts/history?days=${days}`),
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

  // Global broadcast status WebSocket for real-time broadcast detection
  subscribeToGlobalBroadcastStatus: (callback) => {
    const stompClient = createWebSocketConnection('/ws-radio');

    const token = getCookie('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    return new Promise((resolve, reject) => {
      stompClient.connect(headers, () => {
        logger.debug('Connected to Global Broadcast Status WebSocket');

        // Subscribe to global broadcast status updates
        const subscription = stompClient.subscribe('/topic/broadcast/status', (message) => {
          try {
            const statusMessage = JSON.parse(message.body);
            callback(statusMessage);
          } catch (error) {
            logger.error('Error parsing broadcast status message:', error);
          }
        });

        const disconnectFunction = () => {
          if (subscription) {
            subscription.unsubscribe();
          }
          if (stompClient && stompClient.connected) {
            stompClient.disconnect();
          }
        };

        resolve({
          disconnect: disconnectFunction,
          isConnected: () => stompClient.connected
        });
      }, (error) => {
        logger.error('Global Broadcast Status WebSocket connection error:', error);
        reject(error);
      });
    });
  },

  // Live broadcast status WebSocket for real-time updates
  subscribeToLiveBroadcastStatus: (callback) => {
    const stompClient = createWebSocketConnection('/ws-radio');

    const token = getCookie('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    return new Promise((resolve, reject) => {
      stompClient.connect(headers, () => {
        logger.debug('Connected to Live Broadcast Status WebSocket');

        // Subscribe to live broadcast status updates
        const subscription = stompClient.subscribe('/topic/broadcast/live', (message) => {
          try {
            const liveStatusMessage = JSON.parse(message.body);
            callback(liveStatusMessage);
          } catch (error) {
            logger.error('Error parsing live broadcast status message:', error);
          }
        });

        const disconnectFunction = () => {
          if (subscription) {
            subscription.unsubscribe();
          }
          if (stompClient && stompClient.connected) {
            stompClient.disconnect();
          }
        };

        resolve({
          disconnect: disconnectFunction,
          isConnected: () => stompClient.connected
        });
      }, (error) => {
        logger.error('Live Broadcast Status WebSocket connection error:', error);
        reject(error);
      });
    });
  },
};

export default broadcastApi;