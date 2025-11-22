import { api, getCookie, logger } from './apiBase';
import stompClientManager from '../stompClientManager';

/**
 * Chat Messages API
 * Handles chat message operations and real-time messaging
 */
export const chatApi = {
  // Basic chat operations
  getMessages: (broadcastId) => api.get(`/api/chats/${broadcastId}`),
  sendMessage: (broadcastId, message) => api.post(`/api/chats/${broadcastId}`, message),

  // Export chat messages as an Excel file (blob response)
  exportMessages: (broadcastId) => api.get(`/api/chats/${broadcastId}/export`, { responseType: 'blob' }),

  // Real-time WebSocket subscription for chat messages
  subscribeToChatMessages: (broadcastId, callback) => {
    return new Promise((resolve, reject) => {
      stompClientManager
        .subscribe(`/topic/broadcast/${broadcastId}/chat`, (message) => {
          try {
            const chatMessage = JSON.parse(message.body);
            callback(chatMessage);
          } catch (error) {
            logger.error('Error parsing chat message:', error);
          }
        })
        .then((subscription) => {
          resolve({
            disconnect: () => {
              if (subscription) {
                subscription.unsubscribe();
              }
            },
            isConnected: () => stompClientManager.isConnected(),
            // Method to send messages to the chat: use REST to align with backend
            sendMessage: async (messageText) => {
              const payload = { content: messageText };
              return api.post(`/api/chats/${broadcastId}`, payload);
            },
          });
        })
        .catch((error) => {
          logger.error('Chat WebSocket connection error:', error);
          reject(error);
        });
    });
  }
  ,
  // Moderation: delete a specific chat message
  deleteMessage: (messageId) => api.delete(`/api/chats/messages/${messageId}`)
};

export default chatApi;