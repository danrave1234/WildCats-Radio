import { api, createWebSocketConnection, getCookie, logger } from './apiBase';

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
    const stompClient = createWebSocketConnection('/ws-radio');

    const token = getCookie('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    return new Promise((resolve, reject) => {
      stompClient.connect(headers, () => {
        logger.debug('Connected to Chat WebSocket for broadcast:', broadcastId);

        // Subscribe to chat messages for this broadcast
        const subscription = stompClient.subscribe(`/topic/broadcast/${broadcastId}/chat`, (message) => {
          try {
            const chatMessage = JSON.parse(message.body);
            callback(chatMessage);
          } catch (error) {
            logger.error('Error parsing chat message:', error);
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
          isConnected: () => stompClient.connected,
          // Method to send messages to the chat
          sendMessage: (messageText) => {
            if (stompClient && stompClient.connected) {
              stompClient.publish({
                destination: `/app/broadcast/${broadcastId}/chat`,
                body: JSON.stringify({ message: messageText })
              });
            }
          }
        });
      }, (error) => {
        logger.error('Chat WebSocket connection error:', error);
        reject(error);
      });
    });
  }
};

export default chatApi;