import React, { useMemo, useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NotificationDTO } from '../../services/apiService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Format date to "May 28, 2024 at 8:30 AM"
const formatNotificationDate = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Unknown time';
    
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    };
    
    return date.toLocaleDateString('en-US', options).replace(' at ', ' at ');
  } catch {
    return 'Unknown time';
  }
};

// Tab data for notification categories
const TAB_DATA = [
  { key: 'all', label: 'All', icon: 'list-outline' },
  { key: 'unread', label: 'Unread', icon: 'notifications-outline' },
  { key: 'read', label: 'Read', icon: 'checkmark-done-outline' },
] as const;

type TabKey = typeof TAB_DATA[number]['key'];

// Memoized notification item component
const NotificationItem = React.memo(({ 
  notification, 
  onPress, 
  getNotificationIcon, 
  getNotificationTitle 
}: {
  notification: NotificationDTO;
  onPress: (id: number) => void;
  getNotificationIcon: (type: string) => string;
  getNotificationTitle: (type: string) => string;
}) => {
  // Memoize time formatting
  const formattedTime = useMemo(() => {
    return formatNotificationDate(notification.timestamp);
  }, [notification.timestamp]);

  const handlePress = useCallback(() => {
    onPress(notification.id);
  }, [notification.id, onPress]);

  return (
    <TouchableOpacity
      style={{
        backgroundColor: notification.read ? 'white' : '#FEF3C7',
        marginHorizontal: 16,
        marginVertical: 4,
        padding: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderLeftWidth: 4,
        borderLeftColor: notification.read ? '#E5E7EB' : '#F59E0B',
      }}
      activeOpacity={0.7}
      onPress={handlePress}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{
          backgroundColor: notification.read ? '#F3F4F6' : '#FBD38D',
          padding: 8,
          borderRadius: 20,
          marginRight: 12,
        }}>
          <Ionicons 
            name={getNotificationIcon(notification.type) as any} 
            size={20} 
            color={notification.read ? '#6B7280' : '#92400E'} 
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 4,
          }}>
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: '#1F2937',
              flex: 1,
            }}>
              {getNotificationTitle(notification.type)}
            </Text>
            {!notification.read && (
              <View style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#F59E0B',
                marginLeft: 8,
                marginTop: 4,
              }} />
            )}
          </View>
          <Text style={{
            fontSize: 14,
            color: '#6B7280',
            lineHeight: 20,
            marginBottom: 8,
          }}>
            {notification.message}
          </Text>
          <Text style={{
            fontSize: 12,
            color: '#9CA3AF',
            fontWeight: '500',
          }}>
            {formattedTime}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// Memoized Tab Bar Component
const NotificationTabBar = React.memo(({
  selectedTab,
  onTabChange,
  notificationCounts,
}: {
  selectedTab: string;
  onTabChange: (tab: string) => void;
  notificationCounts: { total: number; unread: number; read: number };
}) => {
  const getTabCount = useCallback((tabKey: string) => {
    switch (tabKey) {
      case 'all':
        return notificationCounts.unread;
      case 'unread':
        return notificationCounts.unread;
      case 'read':
        return 0;
      default:
        return 0;
    }
  }, [notificationCounts]);

  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: 'white',
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 8,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      overflow: 'hidden',
    }}>
      {TAB_DATA.map((tab, index) => {
        const isSelected = selectedTab === tab.key;
        const count = getTabCount(tab.key);
        
        return (
          <TouchableOpacity
            key={tab.key}
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 8,
              backgroundColor: isSelected ? '#91403E' : 'transparent',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              borderRightWidth: index < TAB_DATA.length - 1 ? 1 : 0,
              borderRightColor: '#E5E7EB',
            }}
            onPress={() => onTabChange(tab.key)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={tab.icon as any}
              size={16}
              color={isSelected ? 'white' : '#6B7280'}
              style={{ marginRight: 6 }}
            />
            <Text style={{
              fontSize: 14,
              fontWeight: isSelected ? '600' : '500',
              color: isSelected ? 'white' : '#6B7280',
              marginRight: count > 0 ? 4 : 0,
            }}>
              {tab.label}
            </Text>
            {count > 0 && (
              <View style={{
                backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : '#EF4444',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 10,
                minWidth: 20,
                alignItems: 'center',
              }}>
                <Text style={{
                  color: isSelected ? 'white' : 'white',
                  fontSize: 10,
                  fontWeight: 'bold',
                }}>
                  {count > 99 ? '99+' : count.toString()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

// Optimized notification screen component
interface OptimizedNotificationScreenProps {
  visible: boolean;
  notifications: NotificationDTO[];
  unreadCount: number;
  isConnected: boolean;
  selectedTab: string;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  totalCount: number;
  onClose: () => void;
  onMarkAsRead: (id: number) => void;
  onMarkAllAsRead: () => void;
  onTabChange: (tab: string) => void;
  onLoadMore: () => void;
  onAnimationStart?: () => void;
  onAnimationComplete?: () => void;
  getNotificationIcon: (type: string) => string;
  getNotificationTitle: (type: string) => string;
}

const OptimizedNotificationScreen: React.FC<OptimizedNotificationScreenProps> = ({
  visible,
  notifications,
  unreadCount,
  isConnected,
  selectedTab,
  isLoading,
  isLoadingMore,
  hasMore,
  totalCount,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  onTabChange,
  onLoadMore,
  onAnimationStart,
  onAnimationComplete,
  getNotificationIcon,
  getNotificationTitle,
}) => {
  const insets = useSafeAreaInsets();
  const [isAnimating, setIsAnimating] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  
  // Animation values
  const notificationTranslateY = useRef(new Animated.Value(-SCREEN_HEIGHT)).current;
  const notificationOpacity = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const listOpacity = useRef(new Animated.Value(1)).current; // For tab switching animation

  // Memoize filtered notifications to prevent unnecessary re-computations
  const filteredNotifications = useMemo(() => {
    console.log('🔍 OptimizedNotificationScreen: Filtering notifications', {
      totalNotifications: notifications.length,
      selectedTab,
      isLoading
    });
    
    switch (selectedTab) {
      case 'unread':
        const unreadFiltered = notifications.filter(n => !n.read);
        console.log('🔍 Unread filtered:', {
          count: unreadFiltered.length,
          ids: unreadFiltered.map(n => n.id)
        });
        return unreadFiltered;
      case 'read':
        const readFiltered = notifications.filter(n => n.read);
        console.log('🔍 Read filtered:', {
          count: readFiltered.length,
          ids: readFiltered.map(n => n.id).slice(0, 5) // Show first 5 IDs
        });
        return readFiltered;
      default:
        console.log('🔍 All notifications:', {
          total: notifications.length,
          unreadCount: notifications.filter(n => !n.read).length,
          readCount: notifications.filter(n => n.read).length
        });
        return notifications;
    }
  }, [notifications, selectedTab, isLoading]);

  // Memoize notification counts to prevent recalculation
  const notificationCounts = useMemo(() => {
    const total = notifications.length;
    const unread = notifications.filter(n => !n.read).length;
    const read = notifications.filter(n => n.read).length;
    
    return { total, unread, read };
  }, [notifications]);

  // Memoize tab content string
  const tabContentString = useMemo(() => {
    const { total, unread, read } = notificationCounts;
    const filteredCount = filteredNotifications.length;
    
    switch (selectedTab) {
      case 'all':
        return `Showing ${filteredCount} of ${totalCount} total notifications`;
      case 'unread':
        return filteredCount === 0 
          ? 'No unread notifications' 
          : `${filteredCount} unread notification${filteredCount !== 1 ? 's' : ''}`;
      case 'read':
        return filteredCount === 0 
          ? 'No read notifications' 
          : `${filteredCount} read notification${filteredCount !== 1 ? 's' : ''}`;
      default:
        return `${filteredCount} notifications`;
    }
  }, [selectedTab, notificationCounts, filteredNotifications.length, totalCount]);

  // Get current tab display name
  const currentTabName = useMemo(() => {
    const tab = TAB_DATA.find(t => t.key === selectedTab);
    return tab ? tab.label : 'All';
  }, [selectedTab]);

  // Trigger animations based on visibility - with better control
  React.useEffect(() => {
    if (visible && !isAnimating) {
      // Small delay to ensure DOM is ready
      const timeoutId = setTimeout(() => {
        // Call animateIn directly to avoid dependency issues
        console.log('🎬 Starting notification screen animation IN');
        setIsAnimating(true);
        
        if (onAnimationStart) {
          onAnimationStart();
        }
        
        // Reset values
        notificationTranslateY.setValue(-SCREEN_HEIGHT);
        notificationOpacity.setValue(0);
        overlayOpacity.setValue(0);
        
        // Use parallel animations with reduced complexity
        Animated.parallel([
          Animated.timing(overlayOpacity, {
            toValue: 0.5,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(notificationTranslateY, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(notificationOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          })
        ]).start((finished) => {
          if (finished) {
            console.log('✅ Notification screen animation IN completed');
            setIsAnimating(false);
            if (onAnimationComplete) {
              onAnimationComplete();
            }
          }
        });
      }, 50);
      
      return () => clearTimeout(timeoutId);
    }
  }, [visible, onAnimationStart, onAnimationComplete]); // Keep only necessary dependencies

  const animateOut = useCallback(() => {
    if (isAnimating) return;
    
    console.log('🎬 Starting notification screen animation OUT');
    setIsAnimating(true);
    
    if (onAnimationStart) {
      onAnimationStart();
    }
    
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(notificationTranslateY, {
        toValue: -SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(notificationOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      })
    ]).start((finished) => {
      if (finished) {
        console.log('✅ Notification screen animation OUT completed');
        setIsAnimating(false);
        if (onAnimationComplete) {
          onAnimationComplete();
        }
        onClose();
      }
    });
  }, [onClose, onAnimationStart, onAnimationComplete]); // Add callbacks to dependencies

  // Optimized render item for FlatList
  const renderNotificationItem = useCallback(({ item }: { item: NotificationDTO }) => (
    <NotificationItem
      notification={item}
      onPress={onMarkAsRead}
      getNotificationIcon={getNotificationIcon}
      getNotificationTitle={getNotificationTitle}
    />
  ), [onMarkAsRead, getNotificationIcon, getNotificationTitle]);

  // Optimized keyExtractor
  const keyExtractor = useCallback((item: NotificationDTO) => item.id.toString(), []);

  // Empty state component with tab-specific messaging
  const EmptyComponent = useMemo(() => {
    const getEmptyStateConfig = () => {
      switch (selectedTab) {
        case 'unread':
          return {
            icon: 'checkmark-circle-outline',
            title: 'All caught up!',
            message: 'You have no unread notifications. Great job staying on top of things!',
          };
        case 'read':
          return {
            icon: 'archive-outline',
            title: 'No read notifications',
            message: 'Notifications you\'ve read will appear here. Only recent read notifications are kept for easy reference.',
          };
        default:
          return {
            icon: 'notifications-off-outline',
            title: 'No notifications yet',
            message: 'You\'re all caught up! New notifications will appear here when they arrive.',
          };
      }
    };

    const config = getEmptyStateConfig();

    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 40,
      }}>
        <View style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: '#F3F4F6',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}>
          <Ionicons name={config.icon as any} size={40} color="#6B7280" />
        </View>
        <Text style={{
          fontSize: 20,
          fontWeight: '600',
          color: '#1F2937',
          marginBottom: 8,
          textAlign: 'center',
        }}>
          {config.title}
        </Text>
        <Text style={{
          fontSize: 16,
          color: '#6B7280',
          textAlign: 'center',
          lineHeight: 24,
        }}>
          {config.message}
        </Text>
        {selectedTab === 'all' && (
          <TouchableOpacity
            style={{
              marginTop: 20,
              paddingHorizontal: 20,
              paddingVertical: 10,
              backgroundColor: '#91403E',
              borderRadius: 20,
            }}
            onPress={() => {
              // Could add a refresh functionality here
              console.log('Refresh notifications');
            }}
            activeOpacity={0.7}
          >
            <Text style={{
              color: 'white',
              fontSize: 14,
              fontWeight: '600',
            }}>
              Refresh
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [selectedTab]);

  // Loading component for initial load
  const LoadingComponent = useMemo(() => {
    console.log('🔍 OptimizedNotificationScreen: LoadingComponent rendered', {
      isLoading,
      notificationsLength: filteredNotifications.length,
      selectedTab
    });
    
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
      }}>
        <ActivityIndicator size="large" color="#91403E" />
        <Text style={{
          fontSize: 16,
          fontWeight: '600',
          color: '#6B7280',
          marginTop: 16,
        }}>
          Loading notifications...
        </Text>
        <Text style={{
          fontSize: 12,
          color: '#9CA3AF',
          marginTop: 8,
        }}>
          Debug: {filteredNotifications.length} notifications, isLoading: {isLoading.toString()}
        </Text>
      </View>
    );
  }, [isLoading, filteredNotifications.length, selectedTab]);

  // Footer component - CONSISTENT FOR ALL TABS WITH SMOOTH ANIMATIONS
  const FooterComponent = useMemo(() => {
    if (isLoading && filteredNotifications.length === 0) {
      return null; // Don't show footer during initial load
    }

    if (filteredNotifications.length === 0) {
      return null; // Don't show footer when empty
    }

    // Show loading indicator when loading more - WITH SMOOTH FADE
    if (isLoadingMore) {
      return (
        <Animated.View style={{
          padding: 20,
          alignItems: 'center',
          opacity: 1,
        }}>
          <ActivityIndicator size="small" color="#91403E" />
          <Text style={{
            fontSize: 14,
            color: '#6B7280',
            fontWeight: '500',
            marginTop: 8,
          }}>
            Loading more notifications...
          </Text>
          <Text style={{
            fontSize: 11,
            color: '#9CA3AF',
            marginTop: 4,
          }}>
            {selectedTab === 'read' ? 'Finding more read notifications...' : 
             selectedTab === 'unread' ? 'Finding more unread notifications...' : 
             'Loading more...'}
          </Text>
        </Animated.View>
      );
    }

    // Show "all loaded" message when no more data
    if (!hasMore) {
      return (
        <Animated.View style={{
          padding: 20,
          alignItems: 'center',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          marginTop: 8,
          opacity: 1,
        }}>
          <Ionicons name="checkmark-circle-outline" size={24} color="#6B7280" />
          <Text style={{
            fontSize: 14,
            color: '#6B7280',
            fontWeight: '500',
            marginTop: 4,
          }}>
            {selectedTab === 'read' ? 'All read notifications loaded' :
             selectedTab === 'unread' ? 'All unread notifications loaded' :
             'All notifications loaded'}
          </Text>
          <Text style={{
            fontSize: 12,
            color: '#9CA3AF',
            marginTop: 2,
          }}>
            {filteredNotifications.length} {selectedTab === 'all' ? 'total' : selectedTab} notifications
          </Text>
        </Animated.View>
      );
    }

    // Return null when there are more items (let infinite scroll handle it)
    return null;
  }, [isLoading, isLoadingMore, hasMore, totalCount, filteredNotifications.length, selectedTab]);

  // Handle end reached for infinite scroll - SMART LOADING FOR FILTERED TABS
  const handleEndReached = useCallback(() => {
    // Add multiple safety checks to prevent duplicate calls
    if (isLoadingMore) {
      console.log('⚠️ Already loading more, ignoring onEndReached');
      return;
    }
    
    if (!hasMore) {
      console.log('⚠️ No more data available, ignoring onEndReached');
      return;
    }
    
    if (filteredNotifications.length === 0) {
      console.log('⚠️ No notifications loaded yet, ignoring onEndReached');
      return;
    }

    // Smart loading: For filtered tabs (read/unread), be more aggressive with loading
    // to ensure we have enough filtered items for smooth scrolling
    const isFilteredTab = selectedTab !== 'all';
    const loadThreshold = isFilteredTab ? 5 : 10; // Lower threshold for filtered tabs
    
    // Calculate how many items we need to ensure smooth scrolling
    const itemsFromEnd = filteredNotifications.length % 25; // How many items in current page
    const shouldLoadEarly = isFilteredTab && itemsFromEnd < loadThreshold;
    
    if (shouldLoadEarly) {
      console.log(`📱 Smart loading triggered for ${selectedTab} tab:`, {
        currentCount: filteredNotifications.length,
        itemsFromEnd,
        threshold: loadThreshold
      });
    }
    
    console.log('📱 End reached, loading more notifications...', {
      currentCount: filteredNotifications.length,
      hasMore,
      isLoadingMore,
      selectedTab,
      isFilteredTab,
      shouldLoadEarly
    });
    
    onLoadMore();
  }, [isLoadingMore, hasMore, filteredNotifications.length, onLoadMore, selectedTab]);

  // Animate tab changes
  const handleTabChange = useCallback((newTab: string) => {
    if (newTab === selectedTab) return;
    
    // Scroll to top when changing tabs to prevent scroll position issues
    if (flatListRef.current) {
      try {
        flatListRef.current.scrollToOffset({ offset: 0, animated: false });
      } catch (error) {
        console.log('⚠️ Could not scroll to top:', error);
      }
    }
    
    // Fade out current list
    Animated.timing(listOpacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      // Change tab
      onTabChange(newTab);
      // Fade in new list
      Animated.timing(listOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  }, [selectedTab, onTabChange, listOpacity]);

  if (!visible) return null;

  return (
    <>
      {/* Background Overlay */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'black',
          opacity: overlayOpacity,
          zIndex: 15,
        }}
        pointerEvents="auto"
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={animateOut}
        />
      </Animated.View>

      {/* Notification Screen */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: SCREEN_HEIGHT,
          backgroundColor: '#F5F5F7',
          transform: [{ translateY: notificationTranslateY }],
          opacity: notificationOpacity,
          zIndex: 20,
        }}
      >
        {/* Header */}
        <View style={{
          paddingTop: Platform.OS === 'ios' ? insets.top + 20 : insets.top + 30,
          paddingBottom: 16,
          paddingHorizontal: 20,
          backgroundColor: '#91403E',
        }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{
                color: 'white',
                fontSize: 24,
                fontWeight: 'bold',
                marginRight: 12,
              }}>
                Notifications
              </Text>
              {unreadCount > 0 && selectedTab !== 'read' && (
                <TouchableOpacity
                  onPress={onMarkAllAsRead}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>
                    Mark all as read
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              onPress={animateOut}
              style={{
                padding: 8,
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: 20,
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Memoized count display */}
          <Text style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: 14,
            marginTop: 2,
          }}>
            {tabContentString}
          </Text>
        </View>

        {/* Notification Tab Bar */}
        <NotificationTabBar
          selectedTab={selectedTab}
          onTabChange={handleTabChange}
          notificationCounts={notificationCounts}
        />

        {/* Virtualized Notification List - OPTIMIZED FOR SMOOTHER SCROLLING */}
        <Animated.View 
          style={{ 
            flex: 1,
            opacity: listOpacity 
          }}
        >
          <FlatList
            ref={flatListRef}
            data={filteredNotifications}
            renderItem={renderNotificationItem}
            keyExtractor={keyExtractor}
            ListEmptyComponent={isLoading && filteredNotifications.length === 0 ? LoadingComponent : EmptyComponent}
            ListFooterComponent={FooterComponent}
            contentContainerStyle={{ 
              paddingBottom: 20,
              flexGrow: filteredNotifications.length === 0 ? 1 : 0
            }}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            maxToRenderPerBatch={8}
            windowSize={12}
            initialNumToRender={12}
            updateCellsBatchingPeriod={100}
            scrollEventThrottle={16}
            onEndReached={handleEndReached}
            onEndReachedThreshold={selectedTab === 'read' ? 0.2 : 0.3}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
              autoscrollToTopThreshold: 100,
            }}
            overScrollMode="never"
            bounces={true}
            bouncesZoom={false}
            decelerationRate={selectedTab === 'read' ? 0.985 : "normal"}
            disableIntervalMomentum={false}
            snapToAlignment="start"
            snapToStart={false}
            snapToEnd={false}
          />
        </Animated.View>
      </Animated.View>
    </>
  );
};

export default OptimizedNotificationScreen; 