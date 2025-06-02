import { 
  NotificationDTO, 
  getAllNotifications, 
  getUnreadNotifications, 
  getUnreadNotificationCount, 
  markNotificationAsRead 
} from './apiService';
import { websocketService } from './websocketService';

interface NotificationConnection {
  disconnect: () => void;
  isConnected: () => boolean;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

interface PaginatedNotificationResponse {
  data: NotificationDTO[];
  hasMore: boolean;
  total: number;
  currentPage: number;
  totalPages: number;
}

class NotificationService {
  private subscriptions: Map<string, NotificationConnection> = new Map();
  private cache: Map<string, CacheEntry<any>> = new Map();
  private requestsInFlight: Map<string, Promise<any>> = new Map();
  private readonly CACHE_DURATION = 30000; // 30 seconds cache
  private readonly DEBOUNCE_DELAY = 1000; // 1 second debounce
  private readonly PAGE_SIZE = 25; // Optimal batch size

  /**
   * Get cached data or fetch if expired
   */
  private async getCachedOrFetch<T>(
    cacheKey: string,
    fetchFn: () => Promise<T>,
    cacheDuration: number = this.CACHE_DURATION
  ): Promise<T> {
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      console.log(`📦 Cache hit for ${cacheKey}`);
      return cached.data as T;
    }

    // Check if request is already in flight
    if (this.requestsInFlight.has(cacheKey)) {
      console.log(`⏳ Request in flight for ${cacheKey}, waiting...`);
      return this.requestsInFlight.get(cacheKey) as Promise<T>;
    }

    // Make new request
    console.log(`🌐 Cache miss for ${cacheKey}, fetching...`);
    const requestPromise = fetchFn().then(result => {
      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
        expiry: Date.now() + cacheDuration
      });
      
      // Remove from in-flight requests
      this.requestsInFlight.delete(cacheKey);
      
      return result;
    }).catch(error => {
      // Remove from in-flight requests on error
      this.requestsInFlight.delete(cacheKey);
      throw error;
    });

    // Store in-flight request
    this.requestsInFlight.set(cacheKey, requestPromise);
    
    return requestPromise;
  }

  /**
   * Clear cache for specific key or all
   */
  private clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
      this.requestsInFlight.delete(key);
    } else {
      this.cache.clear();
      this.requestsInFlight.clear();
    }
    console.log(`🧹 Cache cleared${key ? ` for ${key}` : ' completely'}`);
  }

  /**
   * Test method to debug notification connectivity
   */
  async testNotificationConnection(authToken: string): Promise<void> {
    try {
      console.log('🔔 Testing notification connection...');
      console.log('🔗 Testing API connectivity first...');
      const response = await this.getUnreadCount(authToken);
      if ('error' in response) {
        throw new Error(response.error);
      }
      console.log('✅ API connectivity successful, unread count:', response.data);
      console.log('✅ Notification connection test completed successfully');
    } catch (error) {
      console.error('❌ Notification connection failed:', error);
      throw error;
    }
  }

  /**
   * Comprehensive notification system test
   */
  async runNotificationSystemTest(authToken: string): Promise<{
    apiConnectivity: boolean;
    webSocketConnectivity: boolean;
    subscriptionActive: boolean;
    errors: string[];
  }> {
    const results = {
      apiConnectivity: false,
      webSocketConnectivity: false,
      subscriptionActive: false,
      errors: [] as string[]
    };

    console.log('🧪 Running comprehensive notification system test...');

    // Test 1: API Connectivity
    try {
      console.log('📡 Test 1: API Connectivity...');
      const unreadResult = await this.getUnreadCount(authToken);
      if ('error' in unreadResult) {
        results.errors.push(`API Error: ${unreadResult.error}`);
      } else {
        results.apiConnectivity = true;
        console.log('✅ API connectivity: PASS');
      }
    } catch (error) {
      results.errors.push(`API Exception: ${(error as Error).message}`);
      console.error('❌ API connectivity: FAIL', error);
    }

    // Test 2: WebSocket Connectivity
    try {
      console.log('🔗 Test 2: WebSocket Connectivity...');
      const hasActiveConnection = this.hasActiveSubscription();
      if (hasActiveConnection) {
        results.webSocketConnectivity = true;
        results.subscriptionActive = true;
        console.log('✅ WebSocket connectivity: PASS');
        console.log('✅ Subscription active: PASS');
      } else {
        results.errors.push('No active WebSocket subscription found');
        console.log('❌ WebSocket connectivity: FAIL - No active subscription');
      }
    } catch (error) {
      results.errors.push(`WebSocket Exception: ${(error as Error).message}`);
      console.error('❌ WebSocket connectivity: FAIL', error);
    }

    // Summary
    console.log('📊 Notification System Test Results:', {
      apiConnectivity: results.apiConnectivity ? '✅ PASS' : '❌ FAIL',
      webSocketConnectivity: results.webSocketConnectivity ? '✅ PASS' : '❌ FAIL',
      subscriptionActive: results.subscriptionActive ? '✅ PASS' : '❌ FAIL',
      errorCount: results.errors.length
    });

    if (results.errors.length > 0) {
      console.log('❌ Errors found:', results.errors);
    }

    return results;
  }

  /**
   * Paginated notification fetching
   */
  async getAllPaginated(
    authToken: string, 
    page: number = 0, 
    pageSize: number = this.PAGE_SIZE
  ): Promise<PaginatedNotificationResponse | { error: string }> {
    const cacheKey = `notifications_all_${page}_${pageSize}`;
    
    try {
      console.log(`🔍 NotificationService.getAllPaginated called with:`, {
        authTokenLength: authToken?.length || 0,
        page,
        pageSize,
        cacheKey
      });

      return await this.getCachedOrFetch(cacheKey, async () => {
        console.log(`📥 Fetching paginated notifications - Page ${page + 1}, Size ${pageSize}`);
        console.log(`🔑 Auth token for API call: ${authToken?.substring(0, 10)}...`);
        
        // For now, we'll fetch all and paginate client-side since the backend doesn't support pagination yet
        console.log('📡 Calling getAllNotifications API...');
        const allNotificationsResult = await getAllNotifications(authToken);
        console.log('📡 API call completed, result type:', typeof allNotificationsResult);
        
        if ('error' in allNotificationsResult) {
          console.error('❌ API returned error:', allNotificationsResult.error);
          return { error: allNotificationsResult.error };
        }

        console.log(`📊 Received ${allNotificationsResult?.length || 0} total notifications from API`);
        const allNotifications = allNotificationsResult;
        const startIndex = page * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedData = allNotifications.slice(startIndex, endIndex);
        const totalItems = allNotifications.length;
        const totalPages = Math.ceil(totalItems / pageSize);
        const hasMore = endIndex < totalItems;

        const response: PaginatedNotificationResponse = {
          data: paginatedData,
          hasMore,
          total: totalItems,
          currentPage: page,
          totalPages
        };

        console.log(`✅ Pagination complete:`, {
          paginatedDataLength: paginatedData.length,
          startIndex,
          endIndex,
          totalItems,
          totalPages,
          hasMore,
          currentPage: page
        });
        
        return response;
      });
    } catch (error) {
      console.error('❌ Error in getAllPaginated:', error);
      console.error('❌ Error stack:', (error as Error)?.stack);
      return { error: `Failed to fetch notifications: ${(error as Error)?.message || 'Unknown error'}` };
    }
  }

  async getUnreadPaginated(
    authToken: string, 
    page: number = 0, 
    pageSize: number = this.PAGE_SIZE
  ): Promise<PaginatedNotificationResponse | { error: string }> {
    const cacheKey = `notifications_unread_${page}_${pageSize}`;
    
    try {
      return await this.getCachedOrFetch(cacheKey, async () => {
        console.log(`📥 Fetching paginated unread notifications - Page ${page + 1}, Size ${pageSize}`);
        
        const unreadNotificationsResult = await getUnreadNotifications(authToken);
        
        if ('error' in unreadNotificationsResult) {
          return { error: unreadNotificationsResult.error };
        }

        const unreadNotifications = unreadNotificationsResult;
        const startIndex = page * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedData = unreadNotifications.slice(startIndex, endIndex);
        const totalItems = unreadNotifications.length;
        const totalPages = Math.ceil(totalItems / pageSize);
        const hasMore = endIndex < totalItems;

        const response: PaginatedNotificationResponse = {
          data: paginatedData,
          hasMore,
          total: totalItems,
          currentPage: page,
          totalPages
        };

        console.log(`✅ Fetched ${paginatedData.length} unread notifications (${startIndex + 1}-${Math.min(endIndex, totalItems)} of ${totalItems})`);
        return response;
      });
    } catch (error) {
      console.error('❌ Error fetching paginated unread notifications:', error);
      return { error: 'Failed to fetch unread notifications' };
    }
  }

  async getReadPaginated(
    authToken: string, 
    page: number = 0, 
    pageSize: number = this.PAGE_SIZE
  ): Promise<PaginatedNotificationResponse | { error: string }> {
    const cacheKey = `notifications_read_${page}_${pageSize}`;
    
    try {
      return await this.getCachedOrFetch(cacheKey, async () => {
        console.log(`📥 Fetching paginated read notifications - Page ${page + 1}, Size ${pageSize}`);
        
        // Get all notifications and filter for read ones
        const allNotificationsResult = await getAllNotifications(authToken);
        
        if ('error' in allNotificationsResult) {
          return { error: allNotificationsResult.error };
        }

        // Filter for read notifications only
        const readNotifications = allNotificationsResult.filter(notification => notification.read);
        
        // Sort by timestamp (newest first)
        readNotifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        const startIndex = page * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedData = readNotifications.slice(startIndex, endIndex);
        const totalItems = readNotifications.length;
        const totalPages = Math.ceil(totalItems / pageSize);
        const hasMore = endIndex < totalItems;

        const response: PaginatedNotificationResponse = {
          data: paginatedData,
          hasMore,
          total: totalItems,
          currentPage: page,
          totalPages
        };

        console.log(`✅ Fetched ${paginatedData.length} read notifications (${startIndex + 1}-${Math.min(endIndex, totalItems)} of ${totalItems})`);
        return response;
      });
    } catch (error) {
      console.error('❌ Error fetching paginated read notifications:', error);
      return { error: 'Failed to fetch read notifications' };
    }
  }

  /**
   * Legacy methods for backward compatibility
   */
  async getAll(authToken: string): Promise<{ data: NotificationDTO[] } | { error: string }> {
    try {
      const result = await this.getAllPaginated(authToken, 0, 1000); // Large page size for legacy support
      if ('error' in result) {
        return { error: result.error };
      }
      return { data: result.data };
    } catch (error) {
      console.error('❌ Error in legacy getAll:', error);
      return { error: 'Failed to fetch notifications' };
    }
  }

  async getUnread(authToken: string): Promise<{ data: NotificationDTO[] } | { error: string }> {
    try {
      const result = await this.getUnreadPaginated(authToken, 0, 1000); // Large page size for legacy support
      if ('error' in result) {
        return { error: result.error };
      }
      return { data: result.data };
    } catch (error) {
      console.error('❌ Error in legacy getUnread:', error);
      return { error: 'Failed to fetch unread notifications' };
    }
  }

  /**
   * Get unread notification count with aggressive caching
   */
  async getUnreadCount(authToken: string): Promise<{ data: number } | { error: string }> {
    const cacheKey = 'notifications_unread_count';
    
    try {
      return await this.getCachedOrFetch(cacheKey, async () => {
        console.log('📊 Fetching unread notification count');
        const result = await getUnreadNotificationCount(authToken);
        
        if (typeof result === 'object' && 'error' in result) {
          return { error: result.error };
        }

        console.log(`✅ Unread count: ${result}`);
        return { data: result as number };
      }, 10000); // Shorter cache for count (10 seconds)
    } catch (error) {
      console.error('❌ Error fetching unread count:', error);
      return { error: 'Failed to fetch unread count' };
    }
  }

  /**
   * Mark notification as read with cache invalidation
   */
  async markAsRead(notificationId: number, authToken: string): Promise<{ success: boolean } | { error: string }> {
    try {
      console.log(`📖 Marking notification ${notificationId} as read`);
      const result = await markNotificationAsRead(notificationId, authToken);
      
      if (result.error) {
        return { error: result.error };
      }

      // Clear related caches
      this.clearCache('notifications_unread_count');
      // Clear pagination caches
      const cacheKeys = Array.from(this.cache.keys()).filter(key => 
        key.startsWith('notifications_all_') || 
        key.startsWith('notifications_unread_') ||
        key.startsWith('notifications_read_')
      );
      cacheKeys.forEach(key => this.clearCache(key));

      console.log(`✅ Notification ${notificationId} marked as read`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      return { error: 'Failed to mark notification as read' };
    }
  }

  /**
   * Subscribe to real-time notifications via WebSocket with improved connection management
   */
  async subscribeToNotifications(
    authToken: string,
    onNewNotification: (notification: NotificationDTO) => void
  ): Promise<NotificationConnection> {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔔 Setting up notification WebSocket subscription');
        console.log('🔑 Auth token length:', authToken?.length || 0);
        
        // Clean up any existing subscriptions first
        if (this.subscriptions.has('notifications')) {
          console.log('🧹 Cleaning up existing subscription');
          const existingConnection = this.subscriptions.get('notifications');
          existingConnection?.disconnect();
          this.subscriptions.delete('notifications');
        }
        
        const connection = websocketService.connect(0, authToken); // Use 0 for global notifications
        console.log('🔗 WebSocket connection initiated');
        
        const handleMessage = (message: any) => {
          console.log('📨 Received notification WebSocket message:', JSON.stringify(message, null, 2));
          
          // Handle different message types
          if (message && typeof message === 'object') {
            // Check for notification-specific messages
            if (message.type === 'notification' && message.data) {
              console.log('✅ Processing notification message:', message.data);
              
              // Clear caches when new notification arrives
              this.clearCache('notifications_unread_count');
              const cacheKeys = Array.from(this.cache.keys()).filter(key => 
                key.startsWith('notifications_all_') || 
                key.startsWith('notifications_unread_') ||
                key.startsWith('notifications_read_')
              );
              cacheKeys.forEach(key => this.clearCache(key));
              
              onNewNotification(message.data);
              
            } else if (message.type === 'NEW_NOTIFICATION' && message.notification) {
              // Handle alternative message format
              console.log('✅ Processing NEW_NOTIFICATION message:', message.notification);
              this.clearCache('notifications_unread_count');
              onNewNotification(message.notification);
              
            } else if (message.message && message.message.includes('notification')) {
              // Handle string-based notification messages
              console.log('✅ Processing string notification message');
              // Try to parse if it's a JSON string
              try {
                const parsed = JSON.parse(message.message);
                if (parsed && parsed.id) {
                  onNewNotification(parsed);
                }
              } catch (e) {
                console.log('ℹ️ Could not parse notification message as JSON');
              }
            } else {
              console.log('ℹ️ Received non-notification message:', message.type || 'unknown type');
            }
          } else {
            console.log('⚠️ Received invalid message format:', typeof message);
          }
        };

        const handleConnect = () => {
          console.log('✅ Notification WebSocket connected successfully');
        };

        const handleDisconnect = () => {
          console.log('❌ Notification WebSocket disconnected');
        };

        const handleError = (error: Event) => {
          console.error('❌ Notification WebSocket error:', error);
        };

        // Set up event handlers
        websocketService.onMessage(handleMessage);
        websocketService.onConnect(handleConnect);
        websocketService.onDisconnect(handleDisconnect);
        websocketService.onError(handleError);

        const notificationConnection: NotificationConnection = {
          disconnect: () => {
            console.log('🔌 Disconnecting notification WebSocket');
            try {
              websocketService.disconnect();
            } catch (error) {
              console.error('❌ Error during WebSocket disconnect:', error);
            }
            this.subscriptions.delete('notifications');
          },
          isConnected: () => {
            try {
              const connected = websocketService.isConnected();
              console.log('🔍 WebSocket connection status check:', connected);
              return connected;
            } catch (error) {
              console.error('❌ Error checking WebSocket connection:', error);
              return false;
            }
          }
        };

        this.subscriptions.set('notifications', notificationConnection);
        
        // Resolve immediately, connection will be established asynchronously
        resolve(notificationConnection);
        
        // Test connection after a short delay
        setTimeout(() => {
          const testStatus = notificationConnection.isConnected();
          console.log('🧪 Post-setup connection test:', testStatus);
        }, 1000);

      } catch (error) {
        console.error('❌ Error setting up notification subscription:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect all notification subscriptions and clear caches
   */
  disconnectAll(): void {
    console.log('🔌 Disconnecting all notification subscriptions');
    this.subscriptions.forEach((connection, key) => {
      try {
        connection.disconnect();
      } catch (error) {
        console.warn(`⚠️ Error disconnecting ${key}:`, error);
      }
    });
    this.subscriptions.clear();
    this.clearCache();
  }

  /**
   * Check if there's an active subscription
   */
  hasActiveSubscription(): boolean {
    return this.subscriptions.size > 0;
  }

  /**
   * Get the number of active subscriptions
   */
  getActiveSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Clear cache manually (useful for testing or forced refresh)
   */
  clearNotificationCache(): void {
    const notificationCacheKeys = Array.from(this.cache.keys()).filter(key => 
      key.startsWith('notifications_')
    );
    notificationCacheKeys.forEach(key => this.clearCache(key));
  }
}

// Export a singleton instance
export const notificationService = new NotificationService();
export default notificationService; 