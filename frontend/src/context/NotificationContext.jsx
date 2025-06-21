import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { notificationService } from '../services/api';
import { useAuth } from './AuthContext';
import { createLogger } from '../services/logger';

const logger = createLogger('NotificationContext');
const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const { isAuthenticated } = useAuth();
  const wsConnection = useRef(null);
  const refreshInterval = useRef(null);

  // Fetch notifications on mount and when user logs in
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      connectToWebSocket();
      startPeriodicRefresh();
    } else {
      // Clean up when user logs out
      disconnectWebSocket();
      stopPeriodicRefresh();
      setNotifications([]);
      setUnreadCount(0);
    }

    return () => {
      disconnectWebSocket();
      stopPeriodicRefresh();
    };
  }, [isAuthenticated]);

  const startPeriodicRefresh = () => {
    // Clear any existing interval
    if (refreshInterval.current) {
      clearInterval(refreshInterval.current);
    }

    // Refresh notifications every 30 seconds
    refreshInterval.current = setInterval(() => {
      if (isAuthenticated) {
        logger.debug('Periodic notification refresh...');
        fetchNotifications();
      }
    }, 30000); // 30 seconds
  };

  const stopPeriodicRefresh = () => {
    if (refreshInterval.current) {
      clearInterval(refreshInterval.current);
      refreshInterval.current = null;
    }
  };

  const connectToWebSocket = async () => {
    if (!isAuthenticated || wsConnection.current) {
      return; // Don't connect if not authenticated or already connected
    }

    try {
      logger.debug('Connecting to WebSocket for real-time notifications...');
      const connection = await notificationService.subscribeToNotifications((notification) => {
        logger.debug('Received real-time notification:', notification);
        addNotification(notification);
      });

      wsConnection.current = connection;

      // Check if connection is actually established
      setIsConnected(connection.isConnected());
      logger.debug('WebSocket connection established:', connection.isConnected());
    } catch (error) {
      logger.error('Failed to connect to WebSocket:', error);
      setIsConnected(false);
    }
  };

  const disconnectWebSocket = () => {
    if (wsConnection.current) {
      logger.debug('Disconnecting from WebSocket...');
      wsConnection.current.disconnect();
      wsConnection.current = null;
      setIsConnected(false);
    }
  };

  const fetchNotifications = async () => {
    if (!isAuthenticated) return;

    try {
      logger.debug('Fetching notifications and unread count...');
      const [notificationsResponse, unreadCountResponse] = await Promise.all([
        notificationService.getAll(),
        notificationService.getUnreadCount()
      ]);
      
      logger.debug('Fetched notifications:', notificationsResponse.data.length);
      logger.debug('Fetched unread count:', unreadCountResponse.data);
      
      setNotifications(notificationsResponse.data);
      setUnreadCount(unreadCountResponse.data);
    } catch (error) {
      logger.error('Error fetching notifications:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
      logger.debug('Marked notification as read:', notificationId);
    } catch (error) {
      logger.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      await Promise.all(
        unreadNotifications.map(n => 
          notificationService.markAsRead(n.id)
        )
      );
      setNotifications(notifications.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      logger.debug('Marked all notifications as read');
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
    }
  };

  const addNotification = (notification) => {
    logger.debug('Adding new notification:', notification);
    setNotifications(prev => [notification, ...prev]);
    if (!notification.read) {
      setUnreadCount(prev => prev + 1);
    }
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
    logger.debug('Cleared all notifications');
  };

  // Refresh notifications when the component becomes visible (user switches tabs)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isAuthenticated) {
        logger.debug('Page became visible, refreshing notifications...');
        fetchNotifications();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      isOpen,
      setIsOpen,
      markAsRead,
      markAllAsRead,
      addNotification,
      clearAllNotifications,
      fetchNotifications,
      isConnected,
      connectToWebSocket,
      disconnectWebSocket
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
} 
