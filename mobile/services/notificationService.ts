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

class NotificationService {
  private subscriptions: Map<string, NotificationConnection> = new Map();

  /**
   * Test method to debug notification connectivity
   */
  async testNotificationConnection(authToken: string): Promise<void> {
    console.log('🧪 NotificationService: Testing notification connection...');
    console.log('🔑 Auth token available:', !!authToken);
    console.log('🔌 WebSocket connected:', websocketService.isConnected());
    
    // Test basic API connectivity
    try {
      const unreadCountResult = await this.getUnreadCount(authToken);
      console.log('✅ API Test - Unread count result:', unreadCountResult);
    } catch (error) {
      console.error('❌ API Test failed:', error);
    }
    
    // Test WebSocket subscription
    try {
      const testConnection = await this.subscribeToNotifications(authToken, (notification) => {
        console.log('🧪 Test notification received:', notification);
      });
      console.log('✅ WebSocket Test - Subscription created:', !!testConnection);
      console.log('✅ WebSocket Test - Connection status:', testConnection.isConnected());
    } catch (error) {
      console.error('❌ WebSocket Test failed:', error);
    }
  }

  /**
   * Get all notifications for the user
   */
  async getAll(authToken: string): Promise<{ data: NotificationDTO[] } | { error: string }> {
    try {
      console.log('📢 NotificationService: Fetching all notifications');
      const result = await getAllNotifications(authToken);

      if ('error' in result) {
        console.error('❌ NotificationService: Error fetching notifications:', result.error);
        return { error: result.error || 'Failed to fetch notifications' };
      }
      
      console.log('✅ NotificationService: Fetched', result.length, 'notifications');
      return { data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ NotificationService: Exception fetching notifications:', errorMessage);
      return { error: errorMessage };
    }
  }

  /**
   * Get unread notifications for the user
   */
  async getUnread(authToken: string): Promise<{ data: NotificationDTO[] } | { error: string }> {
    try {
      console.log('📢 NotificationService: Fetching unread notifications');
      const result = await getUnreadNotifications(authToken);

      if ('error' in result) {
        console.error('❌ NotificationService: Error fetching unread notifications:', result.error);
        return { error: result.error || 'Failed to fetch unread notifications' };
      }
      
      console.log('✅ NotificationService: Fetched', result.length, 'unread notifications');
      return { data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ NotificationService: Exception fetching unread notifications:', errorMessage);
      return { error: errorMessage };
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(authToken: string): Promise<{ data: number } | { error: string }> {
    try {
      console.log('📢 NotificationService: Fetching unread count');
      const result = await getUnreadNotificationCount(authToken);

      if (typeof result === 'object' && 'error' in result) {
        console.error('❌ NotificationService: Error fetching unread count:', result.error);
        return { error: result.error || 'Failed to fetch unread count' };
      }
      
      console.log('✅ NotificationService: Unread count:', result);
      return { data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ NotificationService: Exception fetching unread count:', errorMessage);
      return { error: errorMessage };
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: number, authToken: string): Promise<{ success: boolean } | { error: string }> {
    try {
      console.log('📢 NotificationService: Marking notification as read:', notificationId);
      const result = await markNotificationAsRead(notificationId, authToken);

      if ('error' in result) {
        console.error('❌ NotificationService: Error marking notification as read:', result.error);
        return { error: result.error || 'Failed to mark notification as read' };
      }
      
      console.log('✅ NotificationService: Notification marked as read:', notificationId);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ NotificationService: Exception marking notification as read:', errorMessage);
      return { error: errorMessage };
    }
  }

  /**
   * Subscribe to real-time notifications via WebSocket
   */
  async subscribeToNotifications(
    authToken: string,
    onNewNotification: (notification: NotificationDTO) => void
  ): Promise<NotificationConnection> {
    const subscriptionKey = `notifications_${authToken.slice(-10)}`; // Use last 10 chars as key
    
    // Clean up existing subscription
    if (this.subscriptions.has(subscriptionKey)) {
      console.log('🧹 NotificationService: Cleaning up existing notification subscription');
      this.subscriptions.get(subscriptionKey)?.disconnect();
      this.subscriptions.delete(subscriptionKey);
    }

    return new Promise((resolve, reject) => {
      try {
        console.log('🔄 NotificationService: Setting up notification WebSocket');
        
        // Set up message handler for notifications
        const handleMessage = (message: any) => {
          console.log('📢 NotificationService: Received WebSocket message:', message);
          
          // Filter for notification messages (user-specific notifications)
          if (message.type === 'notification' && message.data) {
            console.log('📢 NotificationService: Processing notification:', message.data);
            if (typeof onNewNotification === 'function') {
              // Pass the notification data
              onNewNotification(message.data);
            }
          }
        };

        // Set up connection handlers
        const handleConnect = () => {
          console.log('✅ NotificationService: Notification WebSocket connected');
        };

        const handleDisconnect = () => {
          console.log('🔌 NotificationService: Notification WebSocket disconnected');
        };

        const handleError = (error: Event) => {
          console.error('❌ NotificationService: Notification WebSocket error:', error);
        };

        // For notifications, we connect to global WebSocket without a specific broadcast ID
        // The WebSocket service will handle the notification subscription
        websocketService.connect(-1, authToken); // Use -1 to indicate global/notification-only connection
        
        // Set up event handlers
        websocketService.onMessage(handleMessage);
        websocketService.onConnect(handleConnect);
        websocketService.onDisconnect(handleDisconnect);
        websocketService.onError(handleError);

        // Create connection object with disconnect method
        const connection: NotificationConnection = {
          disconnect: () => {
            console.log('🧹 NotificationService: Manually disconnecting notification WebSocket');
            
            // Remove from subscriptions map
            this.subscriptions.delete(subscriptionKey);
            
            // Note: websocketService.disconnect() is managed globally, not per-service
            console.log('✅ NotificationService: Notification subscription cleaned up');
          },
          isConnected: () => {
            // Check if websocketService is actually connected
            try {
              return websocketService && typeof websocketService.isConnected === 'function' 
                ? websocketService.isConnected() 
                : false;
            } catch (error) {
              console.error('❌ Error checking WebSocket connection status:', error);
              return false;
            }
          }
        };

        // Store subscription
        this.subscriptions.set(subscriptionKey, connection);
        
        resolve(connection);
        
      } catch (error) {
        console.error('❌ NotificationService: Failed to setup notification WebSocket:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect all notification subscriptions
   */
  disconnectAll(): void {
    console.log('🧹 NotificationService: Disconnecting all notification subscriptions');
    this.subscriptions.forEach((connection) => {
      connection.disconnect();
    });
    this.subscriptions.clear();
    console.log('✅ NotificationService: All notification subscriptions disconnected');
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
}

// Export a singleton instance
export const notificationService = new NotificationService();
export default notificationService; 