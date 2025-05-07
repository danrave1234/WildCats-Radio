import { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_BASE_URL = 'https://wildcat-radio-f05d362144e6.herokuapp.com/api';

type Notification = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
};

type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: Notification) => void;
  fetchNotifications: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      // Try to get from local storage first
      const storedNotifs = await AsyncStorage.getItem('notifications');
      if (storedNotifs) {
        const parsed = JSON.parse(storedNotifs);
        setNotifications(parsed);
        setUnreadCount(parsed.filter((n: Notification) => !n.read).length);
      }

      // Then try to get from API
      const response = await axios.get(`${API_BASE_URL}/notifications`);
      const apiNotifs = response.data;
      
      // Update state with API data
      setNotifications(apiNotifs);
      setUnreadCount(apiNotifs.filter((n: Notification) => !n.read).length);
      
      // Save to local storage
      await AsyncStorage.setItem('notifications', JSON.stringify(apiNotifs));
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      // Mark as read on the API
      await axios.post(`${API_BASE_URL}/notifications/${notificationId}/read`);
      
      // Update local state
      const updatedNotifications = notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      );
      
      setNotifications(updatedNotifications);
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Update local storage
      await AsyncStorage.setItem('notifications', JSON.stringify(updatedNotifications));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      // Mark all as read on the API
      await axios.post(`${API_BASE_URL}/notifications/read-all`);
      
      // Update local state
      const updatedNotifications = notifications.map(n => ({ ...n, read: true }));
      setNotifications(updatedNotifications);
      setUnreadCount(0);
      
      // Update local storage
      await AsyncStorage.setItem('notifications', JSON.stringify(updatedNotifications));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const addNotification = (notification: Notification) => {
    const newNotifications = [notification, ...notifications];
    setNotifications(newNotifications);
    setUnreadCount(prev => prev + 1);
    
    // Save to local storage
    AsyncStorage.setItem('notifications', JSON.stringify(newNotifications))
      .catch(err => console.error('Error saving notifications to storage:', err));
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
      fetchNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
