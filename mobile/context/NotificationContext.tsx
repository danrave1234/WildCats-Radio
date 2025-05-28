import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { notificationService } from '../services/notificationService';
import { NotificationDTO } from '../services/apiService';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  notifications: NotificationDTO[];
  unreadCount: number;
  isConnected: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: NotificationDTO) => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const { authToken } = useAuth();
  const isLoggedIn = !!authToken;
  const wsConnection = useRef<any>(null);

  // Helper function to sort notifications by timestamp (newest first)
  const sortNotificationsByTimestamp = (notifications: NotificationDTO[]): NotificationDTO[] => {
    return notifications.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      const result = dateB - dateA; // Newest first (descending order)
      
      // Debug logging for timestamp sorting
      if (process.env.NODE_ENV === 'development') {
        console.log(`🕐 Sorting: ${a.message.slice(0, 30)}... (${a.timestamp}) vs ${b.message.slice(0, 30)}... (${b.timestamp}) = ${result}`);
      }
      
      return result;
    });
  };

  // Fetch notifications from the server
  const fetchNotifications = useCallback(async () => {
    if (!authToken || !isLoggedIn) {
      console.log('🔒 NotificationContext: Not authenticated, skipping fetch');
      return;
    }

    try {
      console.log('📢 NotificationContext: Fetching notifications...');
      
      // Fetch both notifications and unread count
      const [notificationsResult, unreadCountResult] = await Promise.all([
        notificationService.getAll(authToken),
        notificationService.getUnreadCount(authToken)
      ]);

      // Handle notifications result
      if ('error' in notificationsResult) {
        console.error('❌ NotificationContext: Error fetching notifications:', notificationsResult.error);
      } else {
        console.log('✅ NotificationContext: Fetched', notificationsResult.data.length, 'notifications');
        // Sort notifications by timestamp - newest first
        const sortedNotifications = sortNotificationsByTimestamp(notificationsResult.data);
        console.log('📅 Notifications sorted by timestamp, latest:', sortedNotifications[0]?.timestamp);
        setNotifications(sortedNotifications);
      }

      // Handle unread count result
      if ('error' in unreadCountResult) {
        console.error('❌ NotificationContext: Error fetching unread count:', unreadCountResult.error);
      } else {
        console.log('✅ NotificationContext: Unread count:', unreadCountResult.data);
        setUnreadCount(unreadCountResult.data);
      }
      
    } catch (error) {
      console.error('❌ NotificationContext: Exception fetching notifications:', error);
    }
  }, [authToken, isLoggedIn]);

  // Set up WebSocket connection for real-time notifications
  const connectToWebSocket = useCallback(async () => {
    if (!authToken || !isLoggedIn || wsConnection.current) {
      console.log('🔒 NotificationContext: Cannot connect WebSocket - not authenticated or already connected');
      return;
    }

    try {
      console.log('🔄 NotificationContext: Connecting to notification WebSocket...');
      
      const connection = await notificationService.subscribeToNotifications(
        authToken,
        (newNotification: NotificationDTO) => {
          console.log('📢 NotificationContext: Received real-time notification:', newNotification);
          addNotification(newNotification);
        }
      );

      wsConnection.current = connection;
      setIsConnected(connection.isConnected());
      console.log('✅ NotificationContext: WebSocket connected:', connection.isConnected());
      
    } catch (error) {
      console.error('❌ NotificationContext: Failed to connect WebSocket:', error);
      setIsConnected(false);
    }
  }, [authToken, isLoggedIn]);

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (wsConnection.current) {
      console.log('🔌 NotificationContext: Disconnecting WebSocket...');
      wsConnection.current.disconnect();
      wsConnection.current = null;
      setIsConnected(false);
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: number) => {
    if (!authToken) {
      console.log('🔒 NotificationContext: Cannot mark as read - not authenticated');
      return;
    }

    try {
      console.log('📢 NotificationContext: Marking notification as read:', notificationId);
      
      const result = await notificationService.markAsRead(notificationId, authToken);
      
      if ('error' in result) {
        console.error('❌ NotificationContext: Error marking as read:', result.error);
        return;
      }

      // Update local state and maintain timestamp sorting
      setNotifications(prev => {
        const updatedNotifications = prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, read: true } 
            : notification
        );
        
        // Re-sort to ensure newest notifications stay at top
        return sortNotificationsByTimestamp(updatedNotifications);
      });
      
      // Decrease unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      console.log('✅ NotificationContext: Notification marked as read');
      
    } catch (error) {
      console.error('❌ NotificationContext: Exception marking notification as read:', error);
    }
  }, [authToken]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!authToken) {
      console.log('🔒 NotificationContext: Cannot mark all as read - not authenticated');
      return;
    }

    try {
      console.log('📢 NotificationContext: Marking all notifications as read');
      
      // Find all unread notifications
      const unreadNotifications = notifications.filter(n => !n.read);
      
      // Mark each as read (in parallel)
      await Promise.all(
        unreadNotifications.map(notification => 
          notificationService.markAsRead(notification.id, authToken)
        )
      );

      // Update local state and maintain timestamp sorting
      setNotifications(prev => {
        const updatedNotifications = prev.map(notification => ({ ...notification, read: true }));
        
        // Re-sort to ensure newest notifications stay at top
        return sortNotificationsByTimestamp(updatedNotifications);
      });
      
      setUnreadCount(0);
      
      console.log('✅ NotificationContext: All notifications marked as read');
      
    } catch (error) {
      console.error('❌ NotificationContext: Exception marking all notifications as read:', error);
    }
  }, [authToken, notifications]);

  // Add new notification (from real-time updates)
  const addNotification = useCallback((notification: NotificationDTO) => {
    console.log('📢 NotificationContext: Adding new notification:', notification.message);
    
    setNotifications(prev => {
      // Check if notification already exists (avoid duplicates)
      const exists = prev.some(n => n.id === notification.id);
      if (exists) {
        console.log('⚠️ NotificationContext: Notification already exists, skipping:', notification.id);
        return prev;
      }
      
      // Add new notification and sort by timestamp - newest first
      const updatedNotifications = sortNotificationsByTimestamp([notification, ...prev]);
      console.log('📅 New notification added at timestamp:', notification.timestamp, 'Total notifications:', updatedNotifications.length);
      
      return updatedNotifications;
    });
    
    // Increase unread count if notification is unread
    if (!notification.read) {
      setUnreadCount(prev => prev + 1);
    }
  }, [sortNotificationsByTimestamp]);

  // Clear all notifications (for logout)
  const clearNotifications = useCallback(() => {
    console.log('🧹 NotificationContext: Clearing all notifications');
    setNotifications([]);
    setUnreadCount(0);
    setIsConnected(false);
  }, []);

  // Effect to handle authentication state changes
  useEffect(() => {
    if (isLoggedIn && authToken) {
      console.log('👤 NotificationContext: User logged in, setting up notifications');
      
      // Test notification connectivity for debugging
      notificationService.testNotificationConnection(authToken);
      
      fetchNotifications();
      connectToWebSocket();
    } else {
      console.log('👤 NotificationContext: User logged out, cleaning up notifications');
      disconnectWebSocket();
      clearNotifications();
    }

    return () => {
      disconnectWebSocket();
    };
  }, [isLoggedIn, authToken, fetchNotifications, connectToWebSocket, disconnectWebSocket, clearNotifications]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectWebSocket();
    };
  }, [disconnectWebSocket]);

  const contextValue: NotificationContextType = {
    notifications,
    unreadCount,
    isConnected,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    addNotification,
    clearNotifications,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
} 