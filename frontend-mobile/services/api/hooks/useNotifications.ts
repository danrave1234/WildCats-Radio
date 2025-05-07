import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '../endpoints/notificationService';

export const useNotifications = () => {
  const queryClient = useQueryClient();

  // Get all notifications for the user
  const useUserNotifications = () => {
    return useQuery({
      queryKey: ['notifications'],
      queryFn: () => notificationService.getUserNotifications(),
      // Poll for new notifications every 30 seconds
      refetchInterval: 30000,
    });
  };

  // Get unread notifications for the user
  const useUnreadNotifications = () => {
    return useQuery({
      queryKey: ['notifications', 'unread'],
      queryFn: () => notificationService.getUnreadNotifications(),
      // Poll for new unread notifications every 15 seconds
      refetchInterval: 15000,
    });
  };

  // Mark a notification as read
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: number) => notificationService.markAsRead(notificationId),
    onSuccess: () => {
      // Invalidate notifications queries to refetch
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
    },
  });

  // Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      // Invalidate notifications queries to refetch
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
    },
  });

  return {
    useUserNotifications,
    useUnreadNotifications,
    markAsRead: markAsReadMutation,
    markAllAsRead: markAllAsReadMutation,
  };
}; 