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

  // Fetch notifications on mount and when user logs in
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      connectToWebSocket();
    } else {
      // Clean up when user logs out
      disconnectWebSocket();
      setNotifications([]);
      setUnreadCount(0);
    }

    return () => {
      disconnectWebSocket();
    };
  }, [isAuthenticated]);

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
      const [notificationsResponse, unreadCountResponse] = await Promise.all([
        notificationService.getAll(),
        notificationService.getUnreadCount()
      ]);
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
    } catch (error) {
      logger.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await Promise.all(
        notifications.filter(n => !n.read).map(n => 
          notificationService.markAsRead(n.id)
        )
      );
      setNotifications(notifications.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
    }
  };

  const addNotification = (notification) => {
    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

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
