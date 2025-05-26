import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { notificationService } from '../services/api';
import { useAuth } from './AuthContext';

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
      console.log('Connecting to WebSocket for real-time notifications...');
      const connection = await notificationService.subscribeToNotifications((notification) => {
        console.log('Received real-time notification:', notification);
        addNotification(notification);
      });
      
      wsConnection.current = connection;
      
      // Check if connection is actually established
      setIsConnected(connection.isConnected());
      console.log('WebSocket connection established:', connection.isConnected());
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      setIsConnected(false);
    }
  };

  const disconnectWebSocket = () => {
    if (wsConnection.current) {
      console.log('Disconnecting from WebSocket...');
      wsConnection.current.disconnect();
      wsConnection.current = null;
      setIsConnected(false);
    }
  };

  const fetchNotifications = async () => {
    if (!isAuthenticated) return;
    
    try {
      const response = await notificationService.getAll();
      setNotifications(response.data);
      setUnreadCount(response.data.filter(n => !n.read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
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
      console.error('Error marking notification as read:', error);
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
      console.error('Error marking all notifications as read:', error);
    }
  };

  const addNotification = (notification) => {
    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);
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