import apiClient from '../apiClient';
import { ChatMessage, SendChatMessageRequest } from '../types';

export const chatService = {
  /**
   * Get all chat messages for a specific broadcast
   */
  getBroadcastMessages: async (broadcastId: number): Promise<ChatMessage[]> => {
    const response = await apiClient.get<ChatMessage[]>(`/chats/${broadcastId}`);
    return response.data;
  },

  /**
   * Send a new chat message in a broadcast
   */
  sendMessage: async (broadcastId: number, data: SendChatMessageRequest): Promise<ChatMessage> => {
    const response = await apiClient.post<ChatMessage>(`/chats/${broadcastId}`, data);
    return response.data;
  }
}; 