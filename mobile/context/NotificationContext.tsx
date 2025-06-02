import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationService } from '../services/notificationService';
import { NotificationDTO } from '../services/apiService';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  notifications: NotificationDTO[];
  unreadCount: number;
  isConnected: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  currentPage: number;
  totalCount: number;
  fetchNotifications: () => Promise<void>;
  loadMoreNotifications: () => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: NotificationDTO) => void;
  clearNotifications: () => void;
  refreshNotifications: () => Promise<void>;
  testConnection: () => Promise<boolean>;
  debugNotifications: () => Promise<void>;
  forceRefresh: () => Promise<void>;
  fetchNotificationsWithUnreadPriority: () => Promise<void>;
  manualTestFetch: () => Promise<void>;
  checkStoredData: () => Promise<any>;
  testNotificationReceive: () => Promise<void>;
  // NEW: Tab-specific pagination methods
  loadMoreNotificationsForTab: (tab: 'all' | 'unread' | 'read') => Promise<void>;
  getTabPaginationState: (tab: 'all' | 'unread' | 'read') => {
    currentPage: number;
    hasMore: boolean;
    isLoadingMore: boolean;
    totalCount: number;
  };
  refreshTabNotifications: (tab: 'all' | 'unread' | 'read') => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  
  // NEW: Tab-specific pagination states
  const [tabPaginationState, setTabPaginationState] = useState({
    all: {
      currentPage: 0,
      hasMore: true,
      isLoadingMore: false,
      totalCount: 0
    },
    unread: {
      currentPage: 0,
      hasMore: true,
      isLoadingMore: false,
      totalCount: 0
    },
    read: {
      currentPage: 0,
      hasMore: true,
      isLoadingMore: false,
      totalCount: 0
    }
  });
  
  // NEW: Track if we've finished loading from AsyncStorage
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState<boolean>(false);
  
  const { authToken } = useAuth();
  const isLoggedIn = !!authToken;
  const wsConnection = useRef<any>(null);
  const loadingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  // Keys for AsyncStorage
  const STORAGE_KEYS = {
    notifications: 'cached_notifications',
    unreadCount: 'cached_unread_count',
    totalCount: 'cached_total_count',
    lastSync: 'last_sync_timestamp'
  };

  // Save notification state to AsyncStorage
  const saveNotificationState = useCallback(async (
    notificationsData: NotificationDTO[], 
    unreadCountData: number, 
    totalCountData: number
  ) => {
    try {
      const stateToSave = {
        notifications: notificationsData,
        unreadCount: unreadCountData,
        totalCount: totalCountData,
        lastSync: new Date().toISOString(),
        authToken: authToken // Save with auth token to ensure it's for the right user
      };
      
      await AsyncStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify(stateToSave));
      console.log('💾 Notification state saved to storage:', {
        notificationsCount: notificationsData.length,
        unreadCount: unreadCountData,
        totalCount: totalCountData
      });
    } catch (error) {
      console.warn('⚠️ Failed to save notification state:', error);
    }
  }, [authToken]);

  // Load notification state from AsyncStorage
  const loadNotificationState = useCallback(async () => {
    if (!authToken) return null;
    
    try {
      const savedState = await AsyncStorage.getItem(STORAGE_KEYS.notifications);
      if (!savedState) return null;
      
      const parsedState = JSON.parse(savedState);
      
      // Check if saved state is for the current user
      if (parsedState.authToken !== authToken) {
        console.log('🔄 Saved state is for different user, ignoring');
        return null;
      }
      
      // Check if saved state is not too old (max 24 hours)
      const lastSync = new Date(parsedState.lastSync);
      const hoursSinceSync = (new Date().getTime() - lastSync.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceSync > 24) {
        console.log('🕐 Saved state is too old, ignoring');
        return null;
      }
      
      console.log('📱 Loaded notification state from storage:', {
        notificationsCount: parsedState.notifications?.length || 0,
        unreadCount: parsedState.unreadCount || 0,
        totalCount: parsedState.totalCount || 0,
        hoursSinceSync: hoursSinceSync.toFixed(1)
      });
      
      return {
        notifications: parsedState.notifications || [],
        unreadCount: parsedState.unreadCount || 0,
        totalCount: parsedState.totalCount || 0
      };
    } catch (error) {
      console.warn('⚠️ Failed to load notification state:', error);
      return null;
    }
  }, [authToken]);

  // Clear saved notification state
  const clearNotificationState = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.notifications);
      console.log('🧹 Notification state cleared from storage');
    } catch (error) {
      console.warn('⚠️ Failed to clear notification state:', error);
    }
  }, []);

  // Simple performance tracking without hooks
  const trackOperation = useCallback((operation: string) => {
    const startTime = performance.now();
    return {
      end: () => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        if (__DEV__) {
          console.log(`⏱️ NotificationContext.${operation}: ${duration.toFixed(2)}ms`);
        }
      }
    };
  }, []);

  // Auto-save state when notifications, unreadCount, or totalCount changes
  useEffect(() => {
    if (notifications.length > 0 || unreadCount > 0) {
      console.log('💾 AUTO-SAVE: Saving notification state to AsyncStorage:', {
        notificationCount: notifications.length,
        unreadCount,
        totalCount,
        trigger: 'notifications or counts changed'
      });
      saveNotificationState(notifications, unreadCount, totalCount);
    }
  }, [notifications, unreadCount, totalCount, saveNotificationState]);

  // DEBUG: Function to check what's stored in AsyncStorage
  const checkStoredData = useCallback(async () => {
    try {
      const storedData = await AsyncStorage.getItem(STORAGE_KEYS.notifications);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        console.log('🔍 STORED DATA CHECK:', {
          hasData: !!storedData,
          notificationCount: parsed.notifications?.length || 0,
          unreadCount: parsed.unreadCount || 0,
          totalCount: parsed.totalCount || 0,
          lastSync: parsed.lastSync,
          authToken: parsed.authToken ? `${parsed.authToken.substring(0, 10)}...` : 'None'
        });
        return parsed;
      } else {
        console.log('🔍 STORED DATA CHECK: No data found in AsyncStorage');
        return null;
      }
    } catch (error) {
      console.error('❌ Error checking stored data:', error);
      return null;
    }
  }, []);

  // Load saved state on initialization
  useEffect(() => {
    const initializeNotificationState = async () => {
      if (!authToken) {
        // Clear state when not logged in
        setNotifications([]);
        setUnreadCount(0);
        setTotalCount(0);
        setCurrentPage(0);
        setHasMore(true);
        setHasLoadedFromStorage(true); // Mark as loaded even when not logged in
        await clearNotificationState();
        return;
      }

      console.log('🚀 Initializing notification state...');
      const savedState = await loadNotificationState();
      
      if (savedState) {
        console.log('📱 Restoring notification state from storage');
        setNotifications(savedState.notifications);
        setUnreadCount(savedState.unreadCount);
        setTotalCount(savedState.totalCount);
        setCurrentPage(Math.floor(savedState.notifications.length / 25)); // Estimate current page
        setHasMore(savedState.notifications.length < savedState.totalCount);
      } else {
        console.log('📱 No saved notification state found');
      }
      
      // Mark that we've finished loading from storage (regardless of whether data was found)
      setHasLoadedFromStorage(true);
    };

    initializeNotificationState();
  }, [authToken, loadNotificationState, clearNotificationState]);

  // Optimized notification sorting with memoization - PRIORITIZE UNREAD FIRST
  const sortedNotifications = useMemo(() => {
    const timer = trackOperation('sortNotifications');
    
    const sorted = [...notifications].sort((a, b) => {
      // First priority: unread notifications come first
      if (a.read !== b.read) {
        return a.read ? 1 : -1; // Unread (false) comes before read (true)
      }
      
      // Second priority: within same read status, sort by timestamp (newest first)
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return dateB - dateA; // Most recent first
    });
    
    timer.end();
    console.log('📊 Sorted notifications:', {
      total: sorted.length,
      unreadFirst: sorted.filter(n => !n.read).length,
      readAfter: sorted.filter(n => n.read).length,
      firstItemIsUnread: sorted.length > 0 ? !sorted[0].read : false
    });
    
    return sorted;
  }, [notifications, trackOperation]);

  // Optimized unread count calculation
  const calculateUnreadCount = useCallback((notificationList: NotificationDTO[]) => {
    const timer = trackOperation('calculateUnreadCount');
    const count = notificationList.filter(n => !n.read).length;
    timer.end();
    return count;
  }, [trackOperation]);

  // Debounced unread count update
  const updateUnreadCount = useCallback((notificationList: NotificationDTO[]) => {
    if (loadingTimeout.current) {
      clearTimeout(loadingTimeout.current);
    }
    
    loadingTimeout.current = setTimeout(() => {
      if (isMounted.current) {
        setUnreadCount(calculateUnreadCount(notificationList));
      }
    }, 100);
  }, [calculateUnreadCount]);

  // Fetch initial notifications (paginated) - IMPROVED VERSION
  const fetchNotifications = useCallback(async () => {
    if (!authToken) {
      console.log('⚠️ No auth token for fetchNotifications');
      return;
    }

    console.log('📥 fetchNotifications called - starting fetch...');
    setIsLoading(true);

    try {
      // DON'T clear notifications immediately - keep existing data until we get new data
      console.log('📊 Current state before fetch:', {
        existingNotifications: notifications.length,
        currentUnreadCount: unreadCount
      });
      
      // Fetch first page WITHOUT clearing existing data first
      const result = await notificationService.getAllPaginated(authToken, 0, 25);
      
      if ('error' in result) {
        console.error('❌ Error in fetchNotifications:', result.error);
        // Don't clear existing data on error - keep what we have
        setIsLoading(false);
        return;
      }

      console.log(`✅ fetchNotifications success: ${result.data.length} notifications`);
      
      // Only NOW update state with new data (after successful fetch)
      setNotifications(result.data);
      setHasMore(result.hasMore);
      setCurrentPage(result.currentPage);
      setTotalCount(result.total);
      
      // Reset pagination state AFTER successful data load
      setCurrentPage(0);
      
      // Fetch accurate unread count from server FIRST (prioritize server count)
      try {
        console.log('📊 fetchNotifications: Getting server unread count...');
        const countResult = await notificationService.getUnreadCount(authToken);
        if (!('error' in countResult)) {
          console.log('📊 fetchNotifications: Server unread count:', countResult.data);
          setUnreadCount(countResult.data);
      } else {
          console.error('📊 fetchNotifications: Server unread count error:', countResult.error);
          // Fallback to local calculation only if server fails
          const localUnreadCount = result.data.filter(n => !n.read).length;
          setUnreadCount(localUnreadCount);
          console.log('📊 fetchNotifications: Using local unread count fallback:', localUnreadCount);
        }
      } catch (countError) {
        console.warn('⚠️ Failed to get server unread count in fetchNotifications:', countError);
        // Fallback to local calculation
        const localUnreadCount = result.data.filter(n => !n.read).length;
        setUnreadCount(localUnreadCount);
        console.log('📊 fetchNotifications: Using local unread count fallback:', localUnreadCount);
      }

      console.log('✅ fetchNotifications completed successfully');
      
    } catch (error) {
      console.error('❌ Error in fetchNotifications:', error);
      // On error, keep existing data - don't clear it
      console.log('⚠️ Keeping existing data due to fetch error');
    } finally {
      console.log('🔄 fetchNotifications: Setting isLoading to false');
      setIsLoading(false);
    }
  }, [authToken, notifications.length, unreadCount]); // Added current state to dependencies for logging

  // Load more notifications (pagination) - IMPROVED WITH DEBOUNCING
  const loadMoreNotifications = useCallback(async () => {
    if (!authToken || isLoadingMore || !hasMore) {
      console.log('⚠️ loadMoreNotifications: Cannot load more:', {
        hasAuthToken: !!authToken,
        isLoadingMore,
        hasMore
      });
      return;
    }

    // Additional safety check for rapid calls
    if (isLoading) {
      console.log('⚠️ loadMoreNotifications: Initial loading in progress, skipping');
      return;
    }

    console.log('📥 loadMoreNotifications: Starting load more...');
    setIsLoadingMore(true);

    try {
      const nextPage = currentPage + 1;
      console.log(`📥 Loading more notifications (page ${nextPage + 1})...`);
      
      const result = await notificationService.getAllPaginated(authToken, nextPage, 25);
      
      if ('error' in result) {
        console.error('❌ Error loading more notifications:', result.error);
        setIsLoadingMore(false);
        return;
      }

      console.log(`✅ Loaded ${result.data.length} more notifications`);
      
      // Merge new notifications, avoiding duplicates
      setNotifications(prev => {
        const existingIds = new Set(prev.map(n => n.id));
        const newNotifications = result.data.filter(n => !existingIds.has(n.id));
        
        if (newNotifications.length === 0) {
          console.log('⚠️ No new notifications to add (all duplicates)');
          return prev;
        }
        
        const merged = [...prev, ...newNotifications];
        
        console.log(`📊 Merged notifications: ${prev.length} + ${newNotifications.length} = ${merged.length}`);
        
        // Don't update unread count here - let other functions handle it
        // The server count is more accurate than local calculation
        
        return merged;
      });
      
      setHasMore(result.hasMore);
      setCurrentPage(result.currentPage);
      setTotalCount(result.total);
      
    } catch (error) {
      console.error('❌ Error in loadMoreNotifications:', error);
    } finally {
      console.log('🔄 loadMoreNotifications: Setting isLoadingMore to false');
      setIsLoadingMore(false);
    }
  }, [authToken, isLoadingMore, hasMore, currentPage, isLoading]); // Added isLoading to dependencies

  // Refresh notifications (reset to first page)
  const refreshNotifications = useCallback(async () => {
    console.log('🔄 Refreshing notifications...');
    
    // Direct implementation to avoid circular dependencies
    if (!authToken) {
      console.log('⚠️ No auth token for refresh');
      return;
    }

    if (isLoading) {
      console.log('⚠️ Already loading, skipping refresh');
      return;
    }

    const timer = trackOperation('refreshNotifications');
    setIsLoading(true);

    try {
      // Reset pagination state
      setCurrentPage(0);
      setNotifications([]);
      setHasMore(true);
      
      // Fetch first page
      const result = await notificationService.getAllPaginated(authToken, 0, 25);
      
      if ('error' in result) {
        console.error('❌ Error refreshing notifications:', result.error);
        setIsLoading(false);
        return;
      }

      console.log(`✅ Refreshed ${result.data.length} notifications`);
      
      if (isMounted.current) {
        setNotifications(result.data);
        setHasMore(result.hasMore);
        setCurrentPage(result.currentPage);
        setTotalCount(result.total);
      }

      // Get accurate unread count from server FIRST (prioritize server count)
      try {
        console.log('📊 Refresh: Getting server unread count...');
        const countResult = await notificationService.getUnreadCount(authToken);
        if (!('error' in countResult) && isMounted.current) {
          console.log('📊 Refresh: Server unread count:', countResult.data);
          setUnreadCount(countResult.data);
        } else {
          console.error('📊 Refresh: Server unread count error:', 'error' in countResult ? countResult.error : 'Unknown error');
          // Fallback to local calculation only if server fails
          const localUnreadCount = result.data.filter(n => !n.read).length;
          setUnreadCount(localUnreadCount);
          console.log('📊 Refresh: Using local unread count fallback:', localUnreadCount);
        }
      } catch (countError) {
        console.warn('⚠️ Failed to get server unread count in refresh:', countError);
        // Fallback to local calculation
        const localUnreadCount = result.data.filter(n => !n.read).length;
        setUnreadCount(localUnreadCount);
        console.log('📊 Refresh: Using local unread count fallback:', localUnreadCount);
      }

    } catch (error) {
      console.error('❌ Error in refreshNotifications:', error);
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
      timer.end();
    }
  }, [authToken, trackOperation]);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId: number) => {
    if (!authToken) return;

    const timer = trackOperation('markAsRead');

    try {
      console.log(`📖 Marking notification ${notificationId} as read...`);
      
      // Optimistic update
      setNotifications(prev => {
        const updated = prev.map(notification =>
          notification.id === notificationId 
            ? { ...notification, read: true } 
            : notification
        );
        updateUnreadCount(updated);
        return updated;
      });

      // API call
      const result = await notificationService.markAsRead(notificationId, authToken);
      
      if ('error' in result) {
        console.error('❌ Error marking notification as read:', result.error);
        // Revert optimistic update
        setNotifications(prev => {
          const reverted = prev.map(notification =>
            notification.id === notificationId
              ? { ...notification, read: false }
              : notification
          );
          updateUnreadCount(reverted);
          return reverted;
        });
        return;
      }

      console.log(`✅ Notification ${notificationId} marked as read`);

      // Update unread count from server
      const countResult = await notificationService.getUnreadCount(authToken);
      if (!('error' in countResult) && isMounted.current) {
        setUnreadCount(countResult.data);
      }
      
    } catch (error) {
      console.error('❌ Error in markAsRead:', error);
    } finally {
      timer.end();
    }
  }, [authToken, trackOperation, updateUnreadCount]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!authToken) return;

    const timer = trackOperation('markAllAsRead');

    try {
      console.log('📖 Marking all notifications as read...');
      
      const unreadNotifications = notifications.filter(n => !n.read);
      
      if (unreadNotifications.length === 0) {
        console.log('ℹ️ No unread notifications to mark');
        return;
      }

      console.log('📊 Before markAllAsRead:', {
        totalNotifications: notifications.length,
        unreadCount: unreadNotifications.length,
        unreadIds: unreadNotifications.map(n => n.id)
      });

      // Optimistic update
      setNotifications(prev => {
        const updated = prev.map(notification => ({ ...notification, read: true }));
        updateUnreadCount(updated);
        
        console.log('📊 After optimistic update:', {
          totalNotifications: updated.length,
          unreadCount: updated.filter(n => !n.read).length,
          readCount: updated.filter(n => n.read).length
        });
        
        return updated;
      });

      // Mark each unread notification
      const markPromises = unreadNotifications.map(notification =>
        notificationService.markAsRead(notification.id, authToken)
      );

      const results = await Promise.allSettled(markPromises);
      const failures = results.filter(result => result.status === 'rejected');

      if (failures.length > 0) {
        console.error(`❌ ${failures.length} notifications failed to mark as read`);
        // Refresh notifications to get correct state
        await refreshNotifications();
        return;
      }

      console.log(`✅ All ${unreadNotifications.length} notifications marked as read successfully`);
      setUnreadCount(0);
      
      console.log('📊 Final state after markAllAsRead:', {
        unreadCountSet: 0,
        previouslyUnreadCount: unreadNotifications.length
      });
      
    } catch (error) {
      console.error('❌ Error in markAllAsRead:', error);
      // Refresh on error to get correct state
      await refreshNotifications();
    } finally {
      timer.end();
    }
  }, [authToken, notifications, trackOperation, updateUnreadCount, refreshNotifications]);

  // Add new notification (from WebSocket)
  const addNotification = useCallback((notification: NotificationDTO) => {
    console.log('📨 AddNotification called with:', notification);
    const timer = trackOperation('addNotification');
    
    setNotifications(prev => {
      // Check for duplicates
      const exists = prev.some(n => n.id === notification.id);
      if (exists) {
        console.log('⚠️ Duplicate notification ignored:', notification.id);
        return prev;
      }
      
      console.log('✅ Adding new notification to state:', notification.id);
      console.log('📊 Previous notification count:', prev.length);
      const updated = [notification, ...prev];
      console.log('📊 New notification count:', updated.length);
      updateUnreadCount(updated);
      setTotalCount(prevTotal => {
        console.log('📊 Total count updated:', prevTotal, '→', prevTotal + 1);
        return prevTotal + 1;
      });
      return updated;
    });

    timer.end();
  }, [trackOperation, updateUnreadCount]);

  // Debug test function for manual testing
  const debugNotifications = useCallback(async () => {
    console.log('🧪 DEBUG: Starting notification debug test');
    console.log('🧪 DEBUG: Current state:', {
      authTokenExists: !!authToken,
      authTokenLength: authToken?.length || 0,
      isLoading,
      isLoggedIn,
      notificationCount: notifications.length,
      unreadCount
    });

    if (!authToken) {
      console.log('❌ DEBUG: No auth token available');
      return;
    }

    try {
      console.log('🧪 DEBUG: Testing API service directly...');
      const result = await notificationService.getAllPaginated(authToken, 0, 5);
      console.log('🧪 DEBUG: Direct API result:', result);
      
      if ('error' in result) {
        console.error('❌ DEBUG: API returned error:', result.error);
      } else {
        console.log('✅ DEBUG: API returned data:', {
          dataLength: result.data.length,
          hasMore: result.hasMore,
          total: result.total
        });
      }
    } catch (error) {
      console.error('❌ DEBUG: Error in test:', error);
    }
  }, [authToken, isLoading, isLoggedIn, notifications.length, unreadCount]);

  // Test connection and notification system
  const testConnection = useCallback(async (): Promise<boolean> => {
    if (!authToken) {
      console.log('⚠️ No auth token for connection test');
      return false;
    }
    
    try {
      console.log('🧪 Testing notification connection...');
      console.log('🔑 Auth token available:', !!authToken);
      console.log('🔗 WebSocket connected:', isConnected);
    
      // Test API connectivity first
      const result = await notificationService.testNotificationConnection(authToken);
      console.log('✅ API connection test passed');
      
      // Test WebSocket connection
        if (wsConnection.current) {
        const wsStatus = wsConnection.current.isConnected();
        console.log('🔗 WebSocket status:', wsStatus);
        setIsConnected(wsStatus);
        
        if (wsStatus) {
          console.log('✅ Notification system is fully operational!');
          return true;
        } else {
          console.log('⚠️ WebSocket not connected, attempting reconnection...');
          // Try to reconnect
          await setupWebSocket();
          return wsConnection.current?.isConnected() || false;
        }
      } else {
        console.log('⚠️ No WebSocket connection, setting up...');
        await setupWebSocket();
        return wsConnection.current?.isConnected() || false;
      }
      } catch (error) {
      console.error('❌ Connection test failed:', error);
        return false;
      }
  }, [authToken, isConnected]);

  // Add a manual test notification function for debugging
  const testNotificationReceive = useCallback(async () => {
    console.log('🧪 MANUAL TEST: Checking notification system...');
    console.log('📊 Current state:', {
      authToken: !!authToken,
      isConnected,
      notificationCount: notifications.length,
      unreadCount,
      wsConnectionExists: !!wsConnection.current
    });
    
    if (!authToken) {
      console.log('❌ No auth token - please log in first');
      return;
    }
    
    // Test API connectivity
    try {
      console.log('🔍 Testing API connectivity...');
      const unreadResult = await notificationService.getUnreadCount(authToken);
      if ('error' in unreadResult) {
        console.error('❌ API test failed:', unreadResult.error);
      } else {
        console.log('✅ API connectivity OK, unread count:', unreadResult.data);
      }
    } catch (error) {
      console.error('❌ API test error:', error);
    }
    
    // Test WebSocket connectivity
    if (wsConnection.current) {
      const wsStatus = wsConnection.current.isConnected();
      console.log('🔗 WebSocket status:', wsStatus);
      if (wsStatus) {
        console.log('✅ WebSocket is connected and ready for notifications!');
      } else {
        console.log('⚠️ WebSocket not connected - notifications will not work in real-time');
      }
    } else {
      console.log('❌ No WebSocket connection established');
    }
  }, [authToken, isConnected, notifications.length, unreadCount]);

  // Clear all notifications
  const clearNotifications = useCallback(() => {
    console.log('🧹 Clearing all notifications');
    setNotifications([]);
    setUnreadCount(0);
    setCurrentPage(0);
    setHasMore(true);
    setTotalCount(0);
  }, []);

  // WebSocket connection management
  useEffect(() => {
    if (!isLoggedIn || !authToken) {
      // Clean up WebSocket when not logged in
      if (wsConnection.current) {
        console.log('🔌 Disconnecting WebSocket (not logged in)');
        wsConnection.current.disconnect();
        wsConnection.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Set up WebSocket connection
    const setupWebSocket = async () => {
      try {
        console.log('🔄 Setting up notification WebSocket...');
        console.log('🔑 Auth token available:', !!authToken);
        
        if (wsConnection.current) {
          console.log('🧹 Cleaning up existing WebSocket connection');
          wsConnection.current.disconnect();
        }

        const connection = await notificationService.subscribeToNotifications(
          authToken,
          (newNotification: NotificationDTO) => {
            console.log('📨 Real-time notification received:', newNotification);
            if (isMounted.current) {
              addNotification(newNotification);
              // Force refresh unread count after adding notification
              setTimeout(async () => {
                try {
                  const countResult = await notificationService.getUnreadCount(authToken);
                  if (!('error' in countResult) && isMounted.current) {
                    console.log('🔄 Updated unread count from server:', countResult.data);
                    setUnreadCount(countResult.data);
                  }
                } catch (error) {
                  console.error('❌ Error refreshing unread count:', error);
                }
              }, 500);
            }
          }
        );

        wsConnection.current = connection;
        const connectionStatus = connection.isConnected();
        setIsConnected(connectionStatus);
        
        console.log('✅ Notification WebSocket setup complete');
        console.log('🔗 Connection status:', connectionStatus);

        // Test the connection after setup
        setTimeout(() => {
          if (wsConnection.current) {
            const testStatus = wsConnection.current.isConnected();
            console.log('🧪 WebSocket test status after 2s:', testStatus);
            setIsConnected(testStatus);
          }
        }, 2000);

      } catch (error) {
        console.error('❌ Failed to setup notification WebSocket:', error);
        setIsConnected(false);
      }
    };

    setupWebSocket();

    // Set up periodic connection health check
    const healthCheckInterval = setInterval(() => {
      if (wsConnection.current && isMounted.current) {
        const isConnected = wsConnection.current.isConnected();
        console.log('💓 WebSocket health check:', isConnected);
        setIsConnected(isConnected);
        
        // Reconnect if disconnected
        if (!isConnected && authToken) {
          console.log('🔄 WebSocket disconnected, attempting reconnection...');
          setupWebSocket();
        }
      }
    }, 30000); // Check every 30 seconds

    return () => {
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
      }
      if (wsConnection.current) {
        console.log('🧹 Cleaning up notification WebSocket');
        wsConnection.current.disconnect();
        wsConnection.current = null;
        setIsConnected(false);
      }
    };
  }, [isLoggedIn, authToken, addNotification]);

  // Emergency debug and force fetch function - IMPROVED VERSION
  const forceRefresh = useCallback(async () => {
    console.log('🚨 EMERGENCY: Force refresh called');
    console.log('🚨 EMERGENCY: Current state before force refresh:', {
      notificationsLength: notifications.length,
      isLoading,
      unreadCount,
      authTokenExists: !!authToken,
      isLoggedIn
    });
    
    if (!authToken) {
      console.log('🚨 EMERGENCY: No auth token, cannot refresh');
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('🚨 EMERGENCY: Calling getAllPaginated directly...');
      const result = await notificationService.getAllPaginated(authToken, 0, 25);
      
      console.log('🚨 EMERGENCY: API result:', {
        isError: 'error' in result,
        dataLength: 'error' in result ? 'N/A' : result.data.length,
        total: 'error' in result ? 'N/A' : result.total,
        error: 'error' in result ? result.error : 'None'
      });
      
      if ('error' in result) {
        console.error('🚨 EMERGENCY: API error:', result.error);
        // Keep existing data on error
        console.log('⚠️ EMERGENCY: Keeping existing data due to API error');
        setIsLoading(false);
        return;
      }

      console.log('🚨 EMERGENCY: Setting notifications state...');
      // Only update state after successful fetch
      setNotifications(result.data);
      setHasMore(result.hasMore);
      setCurrentPage(result.currentPage);
      setTotalCount(result.total);
      
      // Get accurate unread count from server FIRST (prioritize server count)
      try {
        console.log('🚨 EMERGENCY: Fetching unread count from server...');
        const countResult = await notificationService.getUnreadCount(authToken);
        if (!('error' in countResult)) {
          console.log('🚨 EMERGENCY: Server unread count:', countResult.data);
          setUnreadCount(countResult.data);
        } else {
          console.error('🚨 EMERGENCY: Server unread count error:', countResult.error);
          // Fallback to local calculation only if server fails
          const localUnreadCount = result.data.filter(n => !n.read).length;
          setUnreadCount(localUnreadCount);
          console.log('🚨 EMERGENCY: Using local unread count fallback:', localUnreadCount);
        }
      } catch (countError) {
        console.error('🚨 EMERGENCY: Error fetching server unread count:', countError);
        // Fallback to local calculation
        const localUnreadCount = result.data.filter(n => !n.read).length;
        setUnreadCount(localUnreadCount);
        console.log('🚨 EMERGENCY: Using local unread count fallback:', localUnreadCount);
      }
      
      console.log('🚨 EMERGENCY: State set successfully!', {
        notificationsLength: result.data.length,
        hasMore: result.hasMore,
        totalCount: result.total
      });
      
    } catch (error) {
      console.error('🚨 EMERGENCY: Error:', error);
      console.log('⚠️ EMERGENCY: Keeping existing data due to catch error');
    } finally {
      setIsLoading(false);
    }
  }, [authToken, notifications.length, isLoading, unreadCount, isLoggedIn]);

  // Fetch notifications with priority for unread items - PRESERVE EXISTING DATA + PERSISTENCE + SYNC READ STATUS
  const fetchNotificationsWithUnreadPriority = useCallback(async () => {
    if (!authToken) {
      console.log('⚠️ No auth token for fetchNotificationsWithUnreadPriority');
      return;
    }

    console.log('📥 SYNC: Priority refresh started - preserving existing data...');
    console.log('📊 SYNC: Current state before priority refresh:', {
      existingNotifications: notifications.length,
      currentUnreadCount: unreadCount,
      totalCount: totalCount
    });
    
    setIsLoading(true);

    try {
      console.log('🔥 SYNC: Step 1 - Fetching fresh unread notifications...');
      // First, get current unread notifications from server
      const unreadResult = await notificationService.getUnreadPaginated(authToken, 0, 50);
      
      if ('error' in unreadResult) {
        console.error('❌ SYNC: Error fetching unread notifications:', unreadResult.error);
        setIsLoading(false);
        return;
      }

      console.log(`✅ SYNC: Got ${unreadResult.data.length} unread notifications from server`);
      
      // Create a Set of current unread notification IDs from server for quick lookup
      const serverUnreadIds = new Set(unreadResult.data.map(n => n.id));
      
      // Get existing notification IDs to avoid duplicates
      const existingIds = new Set(notifications.map(n => n.id));
      
      // Filter out notifications we already have
      const newUnreadNotifications = unreadResult.data.filter(n => !existingIds.has(n.id));
      
      console.log(`📊 SYNC: New unread notifications to add: ${newUnreadNotifications.length}`);
      console.log(`📊 SYNC: Server unread IDs: [${Array.from(serverUnreadIds).join(', ')}]`);
      
      // Update existing notifications AND add new ones
        setNotifications(prev => {
        // Step 1: Update read status of existing notifications based on server state
        const updatedExisting = prev.map(notification => {
          // If notification exists on server as unread, keep it unread
          if (serverUnreadIds.has(notification.id)) {
            if (notification.read) {
              console.log(`📖 SYNC: Marking notification ${notification.id} as unread (exists on server unread list)`);
            }
            return { ...notification, read: false };
          } else {
            // If notification doesn't exist in server unread list, mark it as read
            if (!notification.read) {
              console.log(`✅ SYNC: Marking notification ${notification.id} as read (not in server unread list)`);
            }
            return { ...notification, read: true };
          }
        });
        
        // Step 2: Add any new unread notifications at the top
        const finalUpdated = [...newUnreadNotifications, ...updatedExisting];
        
        console.log(`📊 SYNC: Notifications updated:`, {
          previousCount: prev.length,
          newUnreadAdded: newUnreadNotifications.length,
          finalCount: finalUpdated.length,
          unreadAfterSync: finalUpdated.filter(n => !n.read).length,
          readAfterSync: finalUpdated.filter(n => n.read).length
        });
        
        return finalUpdated;
        });
        
      // Update total count if we added new notifications
      if (newUnreadNotifications.length > 0) {
        setTotalCount(prev => {
          const newTotal = prev + newUnreadNotifications.length;
          console.log(`📊 SYNC: Total count updated: ${prev} → ${newTotal}`);
          return newTotal;
        });
      }
      
      // Always update unread count from server (most accurate)
      try {
        console.log('📊 SYNC: Getting accurate unread count from server...');
        const countResult = await notificationService.getUnreadCount(authToken);
        if (!('error' in countResult)) {
          console.log('📊 SYNC: Server unread count:', countResult.data);
          setUnreadCount(countResult.data);
          console.log('✅ SYNC: Unread count updated from server');
        } else {
          console.error('📊 SYNC: Server unread count error:', countResult.error);
          // Fallback to counting unread from our updated notifications
          console.log('📊 SYNC: Using local count fallback after sync');
        }
      } catch (countError) {
        console.warn('⚠️ SYNC: Failed to get server unread count:', countError);
        console.log('📊 SYNC: Using local count fallback after sync');
      }

      console.log('🎉 SYNC: Priority refresh with read status sync completed successfully!');

      // Log final state for debugging persistence
      console.log('💾 SYNC: Final notification state that will be saved:', {
        totalNotifications: notifications.length,
        unreadCount: unreadCount,
        totalCount: totalCount,
        willTriggerAutoSave: notifications.length > 0 || unreadCount > 0
      });

    } catch (error) {
      console.error('❌ SYNC: Error in fetchNotificationsWithUnreadPriority:', error);
      console.log('⚠️ SYNC: Keeping existing data due to priority refresh error - DATA PRESERVED!');
      // Keep existing data - don't clear it
    } finally {
      console.log('🔄 SYNC: Setting isLoading to false');
      setIsLoading(false);
    }
  }, [authToken, notifications, unreadCount, totalCount]);

  // Initial fetch when logged in - SIMPLIFIED WEB-INSPIRED APPROACH
  useEffect(() => {
    console.log('🔧 DEBUG: Initial fetch useEffect triggered with:', {
      isLoggedIn,
      authTokenExists: !!authToken,
      authTokenLength: authToken?.length || 0,
      hasLoadedFromStorage,
      timestamp: new Date().toISOString()
    });

    // Simple direct implementation to avoid dependency issues
    if (!isLoggedIn || !authToken) {
      console.log('🧹 Not logged in, clearing notifications');
      setNotifications([]);
      setUnreadCount(0);
      setCurrentPage(0);
      setHasMore(true);
      setTotalCount(0);
      setIsLoading(false);
      setHasLoadedFromStorage(false); // Reset the flag when logging out
      return;
    }

    // CRITICAL: Wait for AsyncStorage loading to complete before deciding whether to fetch
    if (!hasLoadedFromStorage) {
      console.log('⏳ Waiting for AsyncStorage loading to complete...');
      return;
    }

    // SIMPLIFIED: Only check once after login and storage loading is complete
    // If we have data from storage, use it. If not, fetch fresh data.
    console.log('✅ Storage loading complete. Current notifications in state:', notifications.length);
    
    if (notifications.length === 0) {
      console.log('🚀 No cached data found, fetching fresh notifications...');
      
    setIsLoading(true);

    const fetchInitialData = async () => {
      try {
        console.log('🔍 Initial fetch: Getting first page of notifications...');
        const result = await notificationService.getAllPaginated(authToken, 0, 25);
        
        if ('error' in result) {
          console.error('❌ Initial fetch error:', result.error);
          setIsLoading(false);
          return;
        }

        console.log(`✅ Initial fetch: Got ${result.data.length} notifications`);
        
        if (isMounted.current) {
          setNotifications(result.data);
          setHasMore(result.hasMore);
          setCurrentPage(result.currentPage);
          setTotalCount(result.total);
        }

        // Get accurate unread count from server
        try {
          console.log('📊 Initial fetch: Getting server unread count...');
          const countResult = await notificationService.getUnreadCount(authToken);
          if (!('error' in countResult) && isMounted.current) {
            console.log('📊 Initial fetch: Server unread count:', countResult.data);
            setUnreadCount(countResult.data);
          } else {
            console.error('📊 Initial fetch: Server unread count error:', 'error' in countResult ? countResult.error : 'Unknown error');
            // Fallback to local calculation only if server fails
            const localUnreadCount = result.data.filter(n => !n.read).length;
            setUnreadCount(localUnreadCount);
            console.log('📊 Initial fetch: Using local unread count fallback:', localUnreadCount);
          }
        } catch (countError) {
          console.warn('⚠️ Initial fetch: Failed to get server unread count:', countError);
          // Fallback to local calculation
          const localUnreadCount = result.data.filter(n => !n.read).length;
          setUnreadCount(localUnreadCount);
          console.log('📊 Initial fetch: Using local unread count fallback:', localUnreadCount);
        }

        console.log('✅ Initial fetch completed successfully');
        
      } catch (error) {
        console.error('❌ Error in initial fetch:', error);
        console.log('⚠️ Keeping existing data due to initial fetch error');
      } finally {
        console.log('🔄 Initial fetch: Setting isLoading to false');
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    };

    fetchInitialData();
    } else {
      console.log('ℹ️ Using cached notification data from storage, skipping initial fetch');
    }
  }, [isLoggedIn, authToken, hasLoadedFromStorage]); // REMOVED notifications.length - this was causing the infinite loop!

  // Manual test fetch for debugging - SIMPLE VERSION
  const manualTestFetch = useCallback(async () => {
    console.log('🧪 MANUAL TEST: Starting manual notification fetch...');
    console.log('🧪 MANUAL TEST: Current auth state:', {
      isLoggedIn,
      authTokenExists: !!authToken,
      authTokenLength: authToken?.length || 0
    });

    if (!authToken) {
      console.log('❌ MANUAL TEST: No auth token available');
      return;
    }

    setIsLoading(true);

    try {
      console.log('🧪 MANUAL TEST: Calling API directly...');
      const result = await notificationService.getAllPaginated(authToken, 0, 25);
      
      console.log('🧪 MANUAL TEST: API response:', {
        isError: 'error' in result,
        dataLength: 'error' in result ? 'N/A' : result.data.length,
        total: 'error' in result ? 'N/A' : result.total,
        error: 'error' in result ? result.error : 'None'
      });
      
      if ('error' in result) {
        console.error('❌ MANUAL TEST: API error:', result.error);
        return;
      }

      // Update state
      setNotifications(result.data);
      setHasMore(result.hasMore);
      setCurrentPage(0);
      setTotalCount(result.total);

      // Get unread count
      const countResult = await notificationService.getUnreadCount(authToken);
      if (!('error' in countResult)) {
        setUnreadCount(countResult.data);
        console.log('🧪 MANUAL TEST: Unread count set to:', countResult.data);
      }

      console.log('✅ MANUAL TEST: Fetch completed successfully!');
      
    } catch (error) {
      console.error('❌ MANUAL TEST: Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [authToken, isLoggedIn]);

  // NEW: Tab-specific pagination methods
  const getTabPaginationState = useCallback((tab: 'all' | 'unread' | 'read') => {
    return tabPaginationState[tab];
  }, [tabPaginationState]);

  const loadMoreNotificationsForTab = useCallback(async (tab: 'all' | 'unread' | 'read') => {
    if (!authToken) {
      console.log('⚠️ No auth token for loadMoreNotificationsForTab');
      return;
    }

    const currentTabState = tabPaginationState[tab];
    
    if (currentTabState.isLoadingMore || !currentTabState.hasMore) {
      console.log(`⚠️ Cannot load more for ${tab} tab:`, {
        isLoadingMore: currentTabState.isLoadingMore,
        hasMore: currentTabState.hasMore
      });
      return;
    }

    console.log(`📥 Loading more notifications for ${tab} tab...`);
    
    // Set loading state for this specific tab
    setTabPaginationState(prev => ({
      ...prev,
      [tab]: { ...prev[tab], isLoadingMore: true }
    }));

    try {
      const nextPage = currentTabState.currentPage + 1;
      let result;

      // Call appropriate API based on tab
      switch (tab) {
        case 'all':
          result = await notificationService.getAllPaginated(authToken, nextPage, 25);
          break;
        case 'unread':
          result = await notificationService.getUnreadPaginated(authToken, nextPage, 25);
          break;
        case 'read':
          result = await notificationService.getReadPaginated(authToken, nextPage, 25);
          break;
        default:
          throw new Error(`Invalid tab: ${tab}`);
      }

      if ('error' in result) {
        console.error(`❌ Error loading more for ${tab} tab:`, result.error);
        return;
      }

      console.log(`✅ Loaded ${result.data.length} more notifications for ${tab} tab`);

      // Merge new notifications, avoiding duplicates
      setNotifications(prev => {
        const existingIds = new Set(prev.map(n => n.id));
        const newNotifications = result.data.filter(n => !existingIds.has(n.id));
        
        if (newNotifications.length === 0) {
          console.log(`⚠️ No new notifications to add for ${tab} tab (all duplicates)`);
          return prev;
        }
        
        const merged = [...prev, ...newNotifications];
        console.log(`📊 Merged notifications for ${tab}: ${prev.length} + ${newNotifications.length} = ${merged.length}`);
        return merged;
      });

      // Update tab-specific pagination state
      setTabPaginationState(prev => ({
        ...prev,
        [tab]: {
          ...prev[tab],
          currentPage: result.currentPage,
          hasMore: result.hasMore,
          totalCount: result.total,
          isLoadingMore: false
        }
      }));

      // Update global pagination state if this is the 'all' tab
      if (tab === 'all') {
        setHasMore(result.hasMore);
        setCurrentPage(result.currentPage);
        setTotalCount(result.total);
      }

    } catch (error) {
      console.error(`❌ Error in loadMoreNotificationsForTab (${tab}):`, error);
    } finally {
      // Always clear loading state for this tab
      setTabPaginationState(prev => ({
        ...prev,
        [tab]: { ...prev[tab], isLoadingMore: false }
      }));
    }
  }, [authToken, tabPaginationState]);

  const refreshTabNotifications = useCallback(async (tab: 'all' | 'unread' | 'read') => {
    if (!authToken) {
      console.log('⚠️ No auth token for refreshTabNotifications');
      return;
    }

    console.log(`🔄 Refreshing notifications for ${tab} tab...`);
    setIsLoading(true);

    try {
      let result;
      
      // Call appropriate API based on tab
      switch (tab) {
        case 'all':
          result = await notificationService.getAllPaginated(authToken, 0, 25);
          break;
        case 'unread':
          result = await notificationService.getUnreadPaginated(authToken, 0, 25);
          break;
        case 'read':
          result = await notificationService.getReadPaginated(authToken, 0, 25);
          break;
        default:
          throw new Error(`Invalid tab: ${tab}`);
      }

      if ('error' in result) {
        console.error(`❌ Error refreshing ${tab} tab:`, result.error);
        return;
      }

      console.log(`✅ Refreshed ${result.data.length} notifications for ${tab} tab`);

      // For 'all' tab, replace all notifications
      // For specific tabs, merge intelligently with existing data
      if (tab === 'all') {
        setNotifications(result.data);
        setHasMore(result.hasMore);
        setCurrentPage(result.currentPage);
        setTotalCount(result.total);
      } else {
        // For unread/read tabs, merge with existing notifications
        setNotifications(prev => {
          // Remove notifications of the same type (read/unread) and add new ones
          const filteredExisting = prev.filter(n => {
            if (tab === 'unread') return n.read; // Keep read notifications
            if (tab === 'read') return !n.read; // Keep unread notifications
            return true;
          });
          
          // Add new notifications from this tab
          const merged = [...result.data, ...filteredExisting];
          
          // Sort by timestamp (newest first)
          merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          
          return merged;
        });
      }

      // Update tab-specific pagination state
      setTabPaginationState(prev => ({
        ...prev,
        [tab]: {
          currentPage: result.currentPage,
          hasMore: result.hasMore,
          totalCount: result.total,
          isLoadingMore: false
        }
      }));

      // Update unread count if needed
      if (tab === 'all' || tab === 'unread') {
        try {
          const countResult = await notificationService.getUnreadCount(authToken);
          if (!('error' in countResult)) {
            setUnreadCount(countResult.data);
          }
        } catch (countError) {
          console.warn(`⚠️ Failed to get unread count after ${tab} refresh:`, countError);
        }
      }

    } catch (error) {
      console.error(`❌ Error in refreshTabNotifications (${tab}):`, error);
    } finally {
      setIsLoading(false);
    }
  }, [authToken]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (loadingTimeout.current) {
        clearTimeout(loadingTimeout.current);
      }
      if (wsConnection.current) {
        wsConnection.current.disconnect();
      }
    };
  }, []);

  const contextValue: NotificationContextType = {
    notifications: sortedNotifications,
    unreadCount,
    isConnected,
    isLoading,
    isLoadingMore,
    hasMore,
    currentPage,
    totalCount,
    fetchNotifications,
    loadMoreNotifications,
    markAsRead,
    markAllAsRead,
    addNotification,
    clearNotifications,
    refreshNotifications,
    testConnection,
    debugNotifications,
    forceRefresh,
    fetchNotificationsWithUnreadPriority,
    manualTestFetch,
    checkStoredData,
    testNotificationReceive,
    // NEW: Tab-specific pagination methods
    loadMoreNotificationsForTab,
    getTabPaginationState,
    refreshTabNotifications,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
} 