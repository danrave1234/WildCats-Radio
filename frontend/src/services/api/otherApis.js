import { api, createWebSocketConnection, getCookie, logger, constructUrl } from './apiBase';

/**
 * Notifications API
 * Handles notification operations and real-time updates
 */
export const notificationApi = {
  getAll: () => api.get('/api/notifications'),
  getPage: (page = 0, size = 20) => api.get('/api/notifications', { params: { page, size } }),
  getUnread: () => api.get('/api/notifications/unread'),
  getUnreadCount: () => api.get('/api/notifications/count-unread'),
  markAsRead: (id) => api.put(`/api/notifications/${id}/read`),
  markAllAsRead: () => api.put('/api/notifications/read-all'),
  getByType: (type) => api.get(`/api/notifications/by-type/${type}`),
  getRecent: (since) => api.get(`/api/notifications/recent?since=${since}`),

  // Persist notification preferences to the user profile (partial update)
  updateUserPreferences: (prefs) => api.put('/api/auth/me/preferences', prefs),

  subscribeToNotifications: (callback) => {
    const stompClient = createWebSocketConnection('/ws-radio');
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

        // Do not start additional polling here; NotificationContext handles periodic refresh.
        resolve({
          disconnect: () => {
            // no-op since no WS or polling were started
          },
          isConnected: () => false
        });
      });
    });
  },

  // Send a system-wide notification (ADMIN/MODERATOR)
  sendBroadcast: (message, type = 'INFO') => api.post('/api/notifications/test/broadcast', undefined, { params: { message, type } }),

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

/**
 * Activity Logs API
 * Handles activity log operations
 */
export const activityLogApi = {
  getLogs: () => api.get('/api/activity-logs'),
  getUserLogs: (userId) => api.get(`/api/activity-logs/user/${userId}`),
};

/**
 * Song Requests API
 * Handles song request operations and real-time updates
 */
export const songRequestApi = {
  getStats: () => api.get('/api/song-requests/stats'),
  getAllRequests: () => api.get('/api/song-requests'),
  getRequestsByBroadcast: (broadcastId) => api.get(`/api/broadcasts/${broadcastId}/song-requests`),
  getRequests: (broadcastId) => api.get(`/api/broadcasts/${broadcastId}/song-requests`), // Alias for compatibility
  createRequest: (broadcastId, requestData) => api.post(`/api/broadcasts/${broadcastId}/song-requests`, requestData),
  deleteRequest: (broadcastId, requestId) => api.delete(`/api/broadcasts/${broadcastId}/song-requests/${requestId}`),

  // Subscribe to real-time song request updates for a specific broadcast
  subscribeToSongRequests: (broadcastId, callback) => {
    const stompClient = createWebSocketConnection('/ws-radio');

    const token = getCookie('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    return new Promise((resolve, reject) => {
      stompClient.connect(headers, () => {
        logger.debug('Connected to Song Requests WebSocket for broadcast:', broadcastId);

        // Subscribe to broadcast-specific song request updates
        const subscription = stompClient.subscribe(`/topic/broadcast/${broadcastId}/song-requests`, (message) => {
          try {
            const songRequestData = JSON.parse(message.body);
            callback(songRequestData);
          } catch (error) {
            logger.error('Error parsing song request data:', error);
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
  },
};

/**
 * Polls API
 * Handles poll operations
 */
export const pollApi = {
  createPoll: (pollData) => api.post('/api/polls', pollData),
  getPollsForBroadcast: (broadcastId) => api.get(`/api/polls/broadcast/${broadcastId}`),
  getActivePollsForBroadcast: (broadcastId) => api.get(`/api/polls/broadcast/${broadcastId}/active`),
  getPoll: (pollId) => api.get(`/api/polls/${pollId}`),
  vote: (pollId, voteData) => api.post(`/api/polls/${pollId}/vote`, voteData),
  getPollResults: (pollId) => api.get(`/api/polls/${pollId}/results`),
  endPoll: (pollId) => api.post(`/api/polls/${pollId}/end`),
  hasUserVoted: (pollId) => api.get(`/api/polls/${pollId}/has-voted`),
  getUserVote: (pollId) => api.get(`/api/polls/${pollId}/user-vote`),
  showPoll: (pollId) => api.post(`/api/polls/${pollId}/show`),
  deletePoll: (pollId) => api.delete(`/api/polls/${pollId}`),

  // WebSocket subscription for polls
  subscribeToPolls: (broadcastId, callback) => {
    return new Promise((resolve, reject) => {
      const stompClient = createWebSocketConnection('/ws-radio');

      const token = getCookie('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

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
  }
};

/**
 * Streaming API
 * Handles Icecast streaming operations
 */
export const streamApi = {
  start: () => api.post('/api/stream/start'),
  stop: () => api.post('/api/stream/stop'),
  // Keep status endpoint but callers should handle failures gracefully; no change to server security
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