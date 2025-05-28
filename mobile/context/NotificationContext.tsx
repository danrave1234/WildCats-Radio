// @refresh reset
import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
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
  
  const { authToken } = useAuth();
  const isLoggedIn = !!authToken;
  const wsConnection = useRef<any>(null);
  const loadingTimeout = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);

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
          console.error('📊 Refresh: Server unread count error:', countResult.error);
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

  // Test WebSocket connection manually
  const testConnection = useCallback(async () => {
    console.log('🧪 Testing WebSocket connection manually...');
    
    if (!wsConnection.current) {
      console.log('❌ No WebSocket connection available');
      return false;
    }
    
    const isConnected = wsConnection.current.isConnected();
    console.log('🔍 Connection status:', isConnected);
    
    if (!isConnected && authToken) {
      console.log('🔄 Attempting to reconnect...');
      try {
        // Force a fresh connection
        if (wsConnection.current) {
          wsConnection.current.disconnect();
        }
        
        const connection = await notificationService.subscribeToNotifications(
          authToken,
          (newNotification: NotificationDTO) => {
            console.log('📨 Test connection - Real-time notification received:', newNotification);
            if (isMounted.current) {
              addNotification(newNotification);
            }
          }
        );
        
        wsConnection.current = connection;
        setIsConnected(connection.isConnected());
        console.log('✅ Reconnection successful');
        return true;
      } catch (error) {
        console.error('❌ Reconnection failed:', error);
        setIsConnected(false);
        return false;
      }
    }
    
    return isConnected;
  }, [authToken, addNotification]);

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

  // Fetch notifications with priority for unread items - PRESERVE EXISTING DATA
  const fetchNotificationsWithUnreadPriority = useCallback(async () => {
    if (!authToken) {
      console.log('⚠️ No auth token for fetchNotificationsWithUnreadPriority');
      return;
    }

    console.log('📥 fetchNotificationsWithUnreadPriority called - starting priority refresh...');
    console.log('📊 Current state before priority refresh:', {
      existingNotifications: notifications.length,
      currentUnreadCount: unreadCount
    });
    
    setIsLoading(true);

    try {
      console.log('🔥 Step 1: Fetching unread notifications first...');
      // First, get unread notifications
      const unreadResult = await notificationService.getUnreadPaginated(authToken, 0, 25);
      
      if ('error' in unreadResult) {
        console.error('❌ Error fetching unread notifications:', unreadResult.error);
        setIsLoading(false);
        return;
      }

      console.log(`✅ Got ${unreadResult.data.length} unread notifications from server`);
      
      // Get existing notification IDs to avoid duplicates
      const existingIds = new Set(notifications.map(n => n.id));
      
      // Filter out notifications we already have
      const newUnreadNotifications = unreadResult.data.filter(n => !existingIds.has(n.id));
      
      console.log(`📊 New unread notifications to add: ${newUnreadNotifications.length}`);
      
      if (newUnreadNotifications.length > 0) {
        // Merge new notifications with existing ones - put new unread at the top
        setNotifications(prev => {
          const updated = [...newUnreadNotifications, ...prev];
          console.log(`📊 Notifications updated: ${prev.length} + ${newUnreadNotifications.length} = ${updated.length}`);
          return updated;
        });
        
        setTotalCount(prev => prev + newUnreadNotifications.length);
        console.log('✅ Added new notifications to existing data');
      } else {
        console.log('ℹ️ No new notifications to add - all up to date!');
      }
      
      // Update unread count from server (most accurate)
      try {
        console.log('📊 Priority refresh: Getting server unread count...');
        const countResult = await notificationService.getUnreadCount(authToken);
        if (!('error' in countResult)) {
          console.log('📊 Priority refresh: Server unread count:', countResult.data);
          setUnreadCount(countResult.data);
        } else {
          console.error('📊 Priority refresh: Server unread count error:', countResult.error);
          // Keep existing unread count or calculate locally
          const localUnreadCount = notifications.filter(n => !n.read).length + newUnreadNotifications.length;
          setUnreadCount(localUnreadCount);
          console.log('📊 Priority refresh: Using calculated unread count:', localUnreadCount);
        }
      } catch (countError) {
        console.warn('⚠️ Failed to get server unread count in priority refresh:', countError);
        const localUnreadCount = notifications.filter(n => !n.read).length + newUnreadNotifications.length;
        setUnreadCount(localUnreadCount);
        console.log('📊 Priority refresh: Using calculated unread count:', localUnreadCount);
      }

    } catch (error) {
      console.error('❌ Error in fetchNotificationsWithUnreadPriority:', error);
      console.log('⚠️ Keeping existing data due to priority refresh error');
      // Keep existing data - don't clear it
    } finally {
      console.log('🔄 Priority refresh: Setting isLoading to false');
      setIsLoading(false);
    }
  }, [authToken, notifications, unreadCount]);

  // Initial fetch when logged in - SIMPLIFIED AND DEBUGGED
  useEffect(() => {
    console.log('🔧 DEBUG: Initial fetch useEffect triggered with:', {
      isLoggedIn,
      authTokenExists: !!authToken,
      authTokenLength: authToken?.length || 0,
      currentIsLoading: isLoading,
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
      return;
    }

    console.log('🚀 Starting initial notification fetch...');
    setIsLoading(true);

    // Direct API call without function dependencies
    const performDirectFetch = async () => {
      try {
        console.log('📡 Direct API call to getAllPaginated...');
        const result = await notificationService.getAllPaginated(authToken, 0, 25);
        
        if ('error' in result) {
          console.error('❌ Direct fetch error:', result.error);
          setIsLoading(false);
          return;
        }

        console.log(`✅ Direct fetch success: ${result.data.length} notifications`);
        
        // Update state with fetched data
        setNotifications(result.data);
        setHasMore(result.hasMore);
        setCurrentPage(0);
        setTotalCount(result.total);
        
        // Get unread count
        try {
          const countResult = await notificationService.getUnreadCount(authToken);
          if (!('error' in countResult)) {
            console.log('📊 Server unread count:', countResult.data);
            setUnreadCount(countResult.data);
          } else {
            const localCount = result.data.filter(n => !n.read).length;
            setUnreadCount(localCount);
            console.log('📊 Using local unread count:', localCount);
          }
        } catch (countError) {
          console.error('❌ Error getting unread count:', countError);
          const localCount = result.data.filter(n => !n.read).length;
          setUnreadCount(localCount);
        }
        
        console.log('✅ Initial fetch completed successfully');
        
      } catch (error) {
        console.error('❌ Direct fetch error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    performDirectFetch();
  }, [isLoggedIn, authToken]); // ONLY essential dependencies

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