import apiClient from '../apiClient';
import { Notification } from '../types';

export const notificationService = {
  /**
   * Get all notifications for the authenticated user
   */
  getUserNotifications: async (): Promise<Notification[]> => {
    const response = await apiClient.get<Notification[]>('/notifications');
    return response.data;
  },

  /**
   * Get all unread notifications for the authenticated user
   */
  getUnreadNotifications: async (): Promise<Notification[]> => {
    const response = await apiClient.get<Notification[]>('/notifications/unread');
    return response.data;
  },

  /**
   * Mark a notification as read
   */
  markAsRead: async (notificationId: number): Promise<void> => {
    await apiClient.put(`/notifications/${notificationId}/read`);
  },

  /**
   * Mark all notifications as read
   */
  markAllAsRead: async (): Promise<void> => {
    await apiClient.put('/notifications/read-all');
  }
}; 