import { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
// Announcement popups removed per new requirement
import { notificationService } from '../services/api/index.js';
import { getAllAnnouncements } from '../services/announcementService';
import { useAuth } from './AuthContext';
import { createLogger } from '../services/logger';

const logger = createLogger('NotificationContext');
const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [hasMore, setHasMore] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const { isAuthenticated } = useAuth();
  const wsConnection = useRef(null);
  const refreshInterval = useRef(null);
  // Popup state removed

  // Preferences with local persistence
  const defaultPreferences = {
    broadcastStart: true,
    broadcastReminders: true,
    newSchedule: false,
    systemUpdates: true,
  };

  const [preferences, setPreferences] = useState(() => {
    try {
      const saved = localStorage.getItem('notificationPreferences');
      return saved ? { ...defaultPreferences, ...JSON.parse(saved) } : defaultPreferences;
    } catch (e) {
      return defaultPreferences;
    }
  });

  const shouldDisplayNotification = (notification, prefs = preferences) => {
    const type = notification?.type;
    switch (type) {
      case 'BROADCAST_STARTED':
        return !!prefs.broadcastStart;
      case 'BROADCAST_STARTING_SOON':
        return !!prefs.broadcastReminders;
      case 'BROADCAST_SCHEDULED':
      case 'NEW_BROADCAST_POSTED':
        return !!prefs.newSchedule;
      case 'USER_REGISTERED':
      case 'GENERAL':
      case 'ALERT':
      case 'INFO':
      case 'REMINDER':
        return !!prefs.systemUpdates;
      default:
        return true;
    }
  };

  const updatePreferences = async (next) => {
    const merged = { ...preferences, ...next };
    setPreferences(merged);
    try {
      localStorage.setItem('notificationPreferences', JSON.stringify(merged));
    } catch (err) {
      logger.warn('Failed to persist notification preferences locally', err);
    }
    // Also persist to backend via profile update so it follows the user across devices
    try {
      // Backend UserDTO supports these optional fields
      await notificationService.updateUserPreferences({
        notifyBroadcastStart: merged.broadcastStart,
        notifyBroadcastReminders: merged.broadcastReminders,
        notifyNewSchedule: merged.newSchedule,
        notifySystemUpdates: merged.systemUpdates,
      });
    } catch (e) {
      logger.warn('Failed to persist notification preferences to server', e);
    }
    const filtered = notifications.filter((n) => shouldDisplayNotification(n, merged));
    setNotifications(filtered);
    setUnreadCount(filtered.filter((n) => !n.read).length);
  };

  // Fetch notifications on mount and when user logs in
  useEffect(() => {
    // Connect only for authenticated users now
    if (isAuthenticated) {
      connectToWebSocket();
      fetchNotifications();
      refreshAnnouncements();
      startPeriodicRefresh();
    } else {
      disconnectWebSocket();
      setNotifications([]);
      setUnreadCount(0);
      setAnnouncements([]);
      stopPeriodicRefresh();
    }

    return () => {
      disconnectWebSocket();
      stopPeriodicRefresh();
    };
  }, [isAuthenticated]);

  // Removed public polling fallback

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
    if (wsConnection.current) {
      return; // Already connected
    }

    try {
      logger.debug('Connecting to WebSocket for real-time notifications...');
      const connection = await notificationService.subscribeToNotifications((notification) => {
        logger.debug('Received real-time notification:', notification);
        // Add user-queue item to inbox
        if (notification && typeof notification.id !== 'undefined') {
          addNotification(notification);
        }
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
        notificationService.getPage(0, size),
        notificationService.getUnreadCount()
      ]);

      const content = notificationsResponse.data?.content || notificationsResponse.data || [];
      logger.debug('Fetched notifications:', content.length);
      logger.debug('Fetched unread count (raw):', unreadCountResponse.data);

      const filtered = (content || []).filter(shouldDisplayNotification);
      setNotifications(filtered);
      setPage(0);
      const last = notificationsResponse.data?.last;
      setHasMore(Boolean(last === false && filtered.length > 0));
      setUnreadCount(filtered.filter((n) => !n.read).length);
    } catch (error) {
      logger.error('Error fetching notifications:', error);
    }
  };

  const refreshAnnouncements = async () => {
    try {
      const resp = await getAllAnnouncements(0, 20);
      const content = resp?.content || resp?.data?.content || [];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const items = content
        .filter((a) => a?.publishedAt && new Date(a.publishedAt) >= sevenDaysAgo)
        .map((a) => ({
          id: `ann-${a.id}`,
          message: a.title,
          type: 'ANNOUNCEMENT',
          timestamp: a.publishedAt,
          read: true,
          link: '/announcements',
          isAnnouncement: true,
        }));
      setAnnouncements(items);
    } catch (error) {
      logger.warn('Failed to refresh announcements', error);
      setAnnouncements([]);
    }
  };

  const loadMoreNotifications = async () => {
    if (!isAuthenticated || !hasMore) return;
    try {
      const nextPage = page + 1;
      logger.debug('Loading more notifications, page:', nextPage);
      const resp = await notificationService.getPage(nextPage, size);
      const content = resp.data?.content || [];
      const filtered = content.filter(shouldDisplayNotification);
      setNotifications(prev => [...prev, ...filtered]);
      setPage(nextPage);
      const last = resp.data?.last;
      setHasMore(Boolean(last === false && filtered.length > 0));
    } catch (e) {
      logger.error('Failed to load more notifications', e);
      setHasMore(false);
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
      await notificationService.markAllAsRead();
      setNotifications(notifications.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      logger.debug('Marked all notifications as read');
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
    }
  };

  const addNotification = (notification) => {
    logger.debug('Adding new notification:', notification);
    if (!shouldDisplayNotification(notification)) {
      return;
    }
    setNotifications(prev => {
      // Frontend dedupe: avoid inserting when same id already present
      if (prev.some(n => n.id === notification.id)) {
        return prev;
      }
      return [notification, ...prev];
    });
    if (!notification.read) {
      setUnreadCount(prev => prev + 1);
    }
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
    logger.debug('Cleared all notifications');
  };

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort(
      (a, b) =>
        new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0)
    );
  }, [notifications]);

  const combinedNotifications = useMemo(() => {
    return [...sortedNotifications, ...announcements].sort(
      (a, b) =>
        new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0)
    );
  }, [sortedNotifications, announcements]);

  const getLatestUnreadNotifications = (limit = 10) => {
    return sortedNotifications.filter((n) => !n.read).slice(0, limit);
  };

  // No automatic refreshes to reduce console noise; use WebSocket pushes only

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      hasMore,
      loadMoreNotifications,
      isOpen,
      setIsOpen,
      markAsRead,
      markAllAsRead,
      addNotification,
      clearAllNotifications,
      fetchNotifications,
      refreshAnnouncements,
      isConnected,
      connectToWebSocket,
      disconnectWebSocket,
      preferences,
      updatePreferences,
      announcements,
      combinedNotifications,
      getLatestUnreadNotifications
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
