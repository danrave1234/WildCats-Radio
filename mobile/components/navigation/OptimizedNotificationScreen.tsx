import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
  FlatList,
  ActivityIndicator,
  PanResponder,
  AppState,
  AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Placeholder interface for design purposes only
interface NotificationDTO {
  id: number;
  message: string;
  type: string;
  timestamp: string;
  read: boolean;
  userId?: number;
  error?: string;
}

// Cordovan Color Palette
const COLORS = {
  // Primary Cordovan
  primary: '#91403E',           // Main cordovan
  primaryLight: '#A64D4A',      // Lighter cordovan
  primaryDark: '#7A3635',       // Darker cordovan
  primaryVeryLight: '#F4E8E7',  // Very light cordovan tint
  
  // Secondary Cordovan
  secondary: '#B85450',         // Accent cordovan
  secondaryLight: '#D4706C',    // Light accent
  
  // Backgrounds
  background: '#F8F5F4',        // Warm light background
  cardBackground: '#FFFFFF',    // White cards
  surface: '#FDF6F5',          // Slight cordovan tint
  
  // Text
  textPrimary: '#2D1B1A',      // Dark cordovan text
  textSecondary: '#5C3E3C',    // Medium cordovan text
  textTertiary: '#8B6B69',     // Light cordovan text
  textInverse: '#FFFFFF',      // White text
  
  // States
  success: '#7A5F3E',          // Cordovan-tinted success
  warning: '#B8704A',          // Cordovan-tinted warning
  unread: '#F4E8E7',          // Light cordovan for unread
  unreadBorder: '#A64D4A',     // Cordovan border for unread
};

// Dynamic screen dimensions that update on orientation changes
const getScreenDimensions = () => Dimensions.get('window');

// Format notification message content, especially for broadcast scheduled notifications
const formatNotificationMessage = (message: string, type: string): string => {
  // Handle broadcast scheduled notifications that contain raw timestamps
  if (type === 'BROADCAST_SCHEDULED' || type === 'BROADCAST_STARTING_SOON') {
    // Look for patterns like "at 2025-06-02T07:53:15.777" in the message
    const timestampPattern = / at (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?)/;
    const match = message.match(timestampPattern);
    
    if (match && match[1]) {
      try {
        const timestamp = match[1];
        const date = new Date(timestamp);
        
        if (!isNaN(date.getTime())) {
          // Format the date in a user-friendly way
          const options: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          };
          
          const formattedDate = date.toLocaleDateString('en-US', options);
          
          // Replace "at [timestamp]" with "\n@[formattedDate]"
          return message.replace(timestampPattern, `\n@${formattedDate}`);
        }
      } catch (error) {
        console.log('Error formatting broadcast timestamp:', error);
      }
    }
  }
  
  // For other notification types or if formatting fails, return original message
  return message;
};

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

// Get relative time
const formatRelativeTime = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return `${Math.floor(diffInSeconds / 604800)}w ago`;
  } catch {
    return 'Unknown';
  }
};

// Tab data for notification categories
const TAB_DATA = [
  { key: 'all', label: 'All', icon: 'list-outline' },
  { key: 'unread', label: 'Unread', icon: 'notifications-outline' },
  { key: 'read', label: 'Read', icon: 'checkmark-done-outline' },
] as const;

type TabKey = typeof TAB_DATA[number]['key'];

// Sort options
const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest First', icon: 'arrow-down-outline' },
  { key: 'oldest', label: 'Oldest First', icon: 'arrow-up-outline' },
  { key: 'unread', label: 'Unread First', icon: 'radio-button-off-outline' },
] as const;

// Notification type formatting
const formatNotificationType = (type: string): string => {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};

// Memoized notification item component
const NotificationItem = React.memo(({ 
  notification, 
  onPress, 
  getNotificationIcon, 
  getNotificationTitle,
  screenData,
}: {
  notification: NotificationDTO;
  onPress: (id: number) => void;
  getNotificationIcon: (type: string) => string;
  getNotificationTitle: (type: string) => string;
  screenData: { width: number; height: number };
}) => {
  // Animation values for swipe gesture
  const translateX = useRef(new Animated.Value(0)).current;
  const swipeOpacity = useRef(new Animated.Value(0)).current;
  const [isSwipeActive, setIsSwipeActive] = useState(false);

  // Memoize time formatting
  const formattedTime = useMemo(() => {
    return formatNotificationDate(notification.timestamp);
  }, [notification.timestamp]);

  const relativeTime = useMemo(() => {
    return formatRelativeTime(notification.timestamp);
  }, [notification.timestamp]);

  const handlePress = useCallback(() => {
    onPress(notification.id);
  }, [notification.id, onPress]);

  // Swipe gesture configuration
  const SWIPE_THRESHOLD = screenData.width * 0.25; // 25% of screen width
  const MAX_SWIPE = screenData.width * 0.6; // Maximum swipe distance

  // Pan responder for swipe gestures
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: (evt, gestureState) => {
      // Capture if it's a clear horizontal swipe for unread items
      const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5; // More lenient
      const hasEnoughMovement = Math.abs(gestureState.dx) > 5; // Reduced initial movement
      return !notification.read && isHorizontal && hasEnoughMovement;
    },
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Capture if it's a clear horizontal swipe for unread items
      const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5; // More lenient
      const hasEnoughMovement = Math.abs(gestureState.dx) > 7; // Reduced movement to capture
      return !notification.read && isHorizontal && hasEnoughMovement;
    },
    onPanResponderGrant: () => {
      setIsSwipeActive(true);
      // Start with current values
      translateX.setOffset(0);
      translateX.setValue(0);
      swipeOpacity.setValue(0);
    },
    onPanResponderMove: (evt, gestureState) => {
      if (notification.read) return;
      
      // Allow swipe in both directions, clamped to MAX_SWIPE
      const clampedDx = Math.min(Math.max(gestureState.dx, -MAX_SWIPE), MAX_SWIPE);
      translateX.setValue(clampedDx);
      
      // Calculate opacity based on swipe progress
      const progress = Math.abs(clampedDx) / SWIPE_THRESHOLD;
      swipeOpacity.setValue(Math.min(progress, 1));
    },
    onPanResponderRelease: (evt, gestureState) => {
      setIsSwipeActive(false);
      translateX.flattenOffset();
      
      if (notification.read) return;
      
      // Check if swipe threshold was met in either direction
      if (Math.abs(gestureState.dx) > SWIPE_THRESHOLD) {
        const swipeDirection = gestureState.dx > 0 ? 1 : -1; // 1 for right, -1 for left
        // Complete the swipe animation and mark as read
        Animated.parallel([
          Animated.timing(translateX, {
            toValue: swipeDirection * screenData.width, // Swipe off screen in the direction of swipe
            duration: 250, // Slightly faster animation
            useNativeDriver: true,
          }),
          Animated.timing(swipeOpacity, {
            toValue: 1,
            duration: 250, // Slightly faster animation
            useNativeDriver: true,
          })
        ]).start(() => {
          // Mark as read after animation
          onPress(notification.id);
          // Reset position for next time
          translateX.setValue(0);
          swipeOpacity.setValue(0);
        });
      } else {
        // Snap back to original position
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 150,
            friction: 8,
          }),
          Animated.timing(swipeOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          })
        ]).start();
      }
    },
    onPanResponderTerminate: () => {
      setIsSwipeActive(false);
      // Snap back to original position if gesture is terminated
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 150,
          friction: 8,
        }),
        Animated.timing(swipeOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    },
    onShouldBlockNativeResponder: () => false, // Don't block native responders
  }), [notification.read, notification.id, onPress, SWIPE_THRESHOLD, MAX_SWIPE, screenData.width]);

  // Responsive sizing calculations
  const itemMargin = Math.max(12, screenData.width * 0.04);
  const itemPadding = Math.max(12, screenData.width * 0.04);
  const iconContainerSize = Math.max(36, screenData.width * 0.10);
  const iconSize = Math.max(18, screenData.width * 0.05);
  const titleFontSize = Math.min(16, screenData.width * 0.042);
  const messageFontSize = Math.min(14, screenData.width * 0.037);
  const timeFontSize = Math.min(12, screenData.width * 0.032);
  const borderLeftWidth = Math.max(3, screenData.width * 0.01);
  
  // Fixed card height for consistency
  const cardHeight = Math.max(120, screenData.height * 0.14);

  return (
    <View style={{
      marginHorizontal: itemMargin,
      marginVertical: Math.max(3, screenData.height * 0.005),
      overflow: 'hidden',
      borderRadius: 12,
      height: cardHeight, // Fixed height for equal sizes
    }}>
      {/* Swipe background - shows when swiping */}
      {!notification.read && (
        <Animated.View style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          backgroundColor: COLORS.success,
          opacity: swipeOpacity,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: itemPadding * 2,
          borderRadius: 12,
        }}>
          <Ionicons name="checkmark-circle" size={Math.max(24, screenData.width * 0.06)} color={COLORS.textInverse} />
          <Text style={{
            color: COLORS.textInverse,
            fontSize: Math.min(14, screenData.width * 0.037),
            fontWeight: '600',
            marginLeft: 8,
          }}>
            Mark as Read
          </Text>
        </Animated.View>
      )}

      {/* Main notification content */}
      <Animated.View
        style={{
          transform: [{ translateX: notification.read ? 0 : translateX }],
          height: '100%', // Fill the entire card height
        }}
        {...(notification.read ? {} : panResponder.panHandlers)}
      >
        <TouchableOpacity
          style={{
            backgroundColor: notification.read ? COLORS.cardBackground : COLORS.unread,
            padding: itemPadding,
            borderRadius: 12,
            shadowColor: COLORS.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
            elevation: 3,
            borderLeftWidth: borderLeftWidth,
            borderLeftColor: notification.read ? COLORS.textTertiary : COLORS.unreadBorder,
            height: '100%', // Fill the entire container
            justifyContent: 'space-between', // Distribute content evenly
          }}
          activeOpacity={0.7}
          onPress={handlePress}
          disabled={isSwipeActive}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', flex: 1 }}>
            <View style={{
              backgroundColor: notification.read ? COLORS.surface : COLORS.primaryVeryLight,
              padding: Math.max(6, screenData.width * 0.02),
              borderRadius: iconContainerSize / 2,
              marginRight: Math.max(10, screenData.width * 0.03),
              width: iconContainerSize,
              height: iconContainerSize,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Ionicons 
                name={getNotificationIcon(notification.type) as any} 
                size={iconSize} 
                color={notification.read ? COLORS.textTertiary : COLORS.primary} 
              />
            </View>
            <View style={{ flex: 1, minWidth: 0, justifyContent: 'space-between', height: '100%', paddingLeft: 2 }}>
              {/* Top section - Type and Title */}
              <View style={{ marginBottom: 6 }}>
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                  marginBottom: 6,
              }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text 
                    style={{
                        fontSize: Math.min(11, screenData.width * 0.030),
                      fontWeight: '600',
                      color: COLORS.textTertiary,
                        marginBottom: 4,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        lineHeight: Math.min(11, screenData.width * 0.030) * 1.2,
                    }}
                    numberOfLines={1}
                  >
                    {formatNotificationType(notification.type)}
                  </Text>
                  <Text 
                    style={{
                      fontSize: titleFontSize,
                      fontWeight: '600',
                      color: COLORS.textPrimary,
                        lineHeight: titleFontSize * 1.3,
                        marginBottom: 0,
                    }}
                    numberOfLines={2}
                  >
                    {getNotificationTitle(notification.type)}
                  </Text>
                </View>
                {!notification.read && (
                  <View style={{
                      width: Math.max(8, screenData.width * 0.022),
                      height: Math.max(8, screenData.width * 0.022),
                      borderRadius: Math.max(4, screenData.width * 0.011),
                    backgroundColor: COLORS.unreadBorder,
                      marginTop: 4,
                      marginLeft: 12,
                    flexShrink: 0,
                  }} />
                )}
              </View>
                
                {/* Middle section - Message */}
              <Text 
                style={{
                  fontSize: messageFontSize,
                  color: COLORS.textSecondary,
                    lineHeight: messageFontSize * 1.5,
                    marginTop: 2,
                    paddingRight: 4,
                }}
                  numberOfLines={2} // Fixed to 2 lines for consistency
              >
                  {formatNotificationMessage(notification.message, notification.type)}
              </Text>
              </View>
              
              {/* Bottom section - Time and Action */}
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginTop: 4,
                paddingTop: 8,
                borderTopWidth: notification.read ? 0 : 0.5,
                borderTopColor: notification.read ? 'transparent' : COLORS.primaryVeryLight,
              }}>
                <Text style={{
                  fontSize: timeFontSize,
                  color: COLORS.textTertiary,
                  fontWeight: '500',
                  letterSpacing: 0.3,
                  lineHeight: timeFontSize * 1.2,
                }}>
                  {relativeTime}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
});

// Memoized Tab Bar Component
const NotificationTabBar = React.memo(({
  selectedTab,
  onTabChange,
  notificationCounts,
  screenData,
}: {
  selectedTab: string;
  onTabChange: (tab: string) => void;
  notificationCounts: { total: number; unread: number; read: number };
  screenData: { width: number; height: number };
}) => {
  // Animated line position
  const linePosition = useRef(new Animated.Value(0)).current;
  const [tabWidth, setTabWidth] = useState(0);
  const isInitialSetup = useRef(true);
  
  // Get current tab index
  const getCurrentTabIndex = useCallback((tabKey: string) => {
    return TAB_DATA.findIndex(tab => tab.key === tabKey);
  }, []);

  // Animate line to new position
  const animateLineToTab = useCallback((newTabKey: string) => {
    const newIndex = getCurrentTabIndex(newTabKey);
    const targetPosition = newIndex * tabWidth;
    
    console.log(`🎬 Animating line to ${newTabKey} (index: ${newIndex}, position: ${targetPosition}, tabWidth: ${tabWidth})`);
    
    if (tabWidth > 0) {
      Animated.spring(linePosition, {
        toValue: targetPosition,
        useNativeDriver: true,
        tension: 120,
        friction: 8,
        velocity: 0,
      }).start((finished) => {
        if (finished) {
          console.log(`✅ Animation completed for ${newTabKey}`);
        }
      });
    }
  }, [linePosition, tabWidth, getCurrentTabIndex]);

  // Initialize line position and handle tab changes
  React.useEffect(() => {
    console.log(`📍 Tab changed to: ${selectedTab}, tabWidth: ${tabWidth}, isInitial: ${isInitialSetup.current}`);
    
    if (tabWidth > 0) {
      const currentIndex = getCurrentTabIndex(selectedTab);
      const targetPosition = currentIndex * tabWidth;
      
      if (isInitialSetup.current) {
        // Set initial position immediately
        linePosition.setValue(targetPosition);
        isInitialSetup.current = false;
        console.log(`🎯 Initial position set to ${targetPosition} for ${selectedTab}`);
      } else {
        // Animate to new position
        animateLineToTab(selectedTab);
      }
    }
  }, [selectedTab, tabWidth, animateLineToTab, getCurrentTabIndex]);

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

  // Responsive sizing calculations
  const tabBarMargin = Math.max(12, screenData.width * 0.04);
  const iconSize = Math.min(16, screenData.width * 0.042);
  const fontSize = Math.min(14, screenData.width * 0.037);
  const countFontSize = Math.min(10, screenData.width * 0.027);
  const verticalPadding = Math.max(10, screenData.height * 0.015);

  return (
    <View 
      style={{
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: tabBarMargin,
        marginTop: tabBarMargin,
        marginBottom: tabBarMargin * 0.5,
        borderRadius: 12,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
        overflow: 'hidden',
        minHeight: Math.max(44, screenData.height * 0.06),
      }}
      onLayout={(event) => {
        const { width } = event.nativeEvent.layout;
        const calculatedTabWidth = width / TAB_DATA.length;
        setTabWidth(calculatedTabWidth);
      }}
    >
      {/* Tab buttons container */}
      <View style={{ flexDirection: 'row', flex: 1 }}>
        {TAB_DATA.map((tab, index) => {
          const isSelected = selectedTab === tab.key;
          const count = getTabCount(tab.key);
          
          return (
            <TouchableOpacity
              key={tab.key}
              style={{
                flex: 1,
                paddingVertical: verticalPadding,
                paddingHorizontal: Math.max(8, screenData.width * 0.025),
                backgroundColor: 'transparent',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                borderRightWidth: index < TAB_DATA.length - 1 ? 1 : 0,
                borderRightColor: COLORS.surface,
                minHeight: Math.max(44, screenData.height * 0.06),
              }}
              onPress={() => onTabChange(tab.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon as any}
                size={iconSize}
                color={isSelected ? COLORS.primary : COLORS.textSecondary}
                style={{ 
                  marginRight: Math.max(6, screenData.width * 0.018),
                  alignSelf: 'center',
                }}
              />
              <Text style={{
                fontSize: fontSize,
                fontWeight: isSelected ? '600' : '500',
                color: isSelected ? COLORS.primary : COLORS.textSecondary,
                marginRight: count > 0 ? 6 : 0,
                flexShrink: 1,
                textAlign: 'center',
                lineHeight: fontSize * 1.2,
                letterSpacing: 0.3,
              }}>
                {tab.label}
              </Text>
              {count > 0 && (
                <View style={{
                  backgroundColor: isSelected ? COLORS.primary : COLORS.secondary,
                  paddingHorizontal: Math.max(6, screenData.width * 0.018),
                  paddingVertical: 3,
                  borderRadius: 12,
                  minWidth: Math.max(20, screenData.width * 0.055),
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 2,
                  shadowColor: isSelected ? COLORS.primary : COLORS.secondary,
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.2,
                  shadowRadius: 2,
                  elevation: 2,
                }}>
                  <Text style={{
                    color: COLORS.textInverse,
                    fontSize: countFontSize,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    lineHeight: countFontSize * 1.1,
                    letterSpacing: 0.2,
                  }}>
                    {count > 99 ? '99+' : count.toString()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      
      {/* Animated bottom line indicator */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0,
          height: 3,
          width: tabWidth > 0 ? tabWidth : 0,
          backgroundColor: COLORS.primary,
          transform: [{ translateX: linePosition }],
          zIndex: 10,
        }}
        onLayout={() => {
          console.log(`📏 Line rendered with width: ${tabWidth}, color: ${COLORS.primary}`);
        }}
      />
    </View>
  );
});

// WebSocket connection states
enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}

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
  const [screenData, setScreenData] = useState(getScreenDimensions());
  const flatListRef = useRef<FlatList>(null);

  // Animation values with dynamic screen height - use refs that don't change
  const notificationTranslateY = useRef(new Animated.Value(-screenData.height)).current;
  const notificationOpacity = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const listOpacity = useRef(new Animated.Value(1)).current;

  // Track animation state with refs to prevent dependency loops
  const isAnimatingRef = useRef(false);
  const hasAnimatedInRef = useRef(false);

  // Dynamic screen dimensions - responsive to orientation changes
  React.useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenData(window);
    });
    
    return () => subscription?.remove();
  }, []);

  // Update animation values when screen dimensions change
  React.useEffect(() => {
    if (!visible) {
      notificationTranslateY.setValue(-screenData.height);
      hasAnimatedInRef.current = false;
    }
  }, [screenData.height, visible]);

  // Enhanced filtered and sorted notifications
  const filteredAndSortedNotifications = useMemo(() => {
    let filtered = notifications;

    // Apply tab filter first
    switch (selectedTab) {
      case 'unread':
        filtered = filtered.filter(n => !n.read);
        break;
      case 'read':
        filtered = filtered.filter(n => n.read);
        break;
      default:
        // 'all' - no additional filtering
        break;
    }

    // Apply default sorting (newest first with unread priority)
    filtered.sort((a, b) => {
      // First priority: unread notifications come first
      if (a.read !== b.read) {
        return a.read ? 1 : -1; // Unread (false) comes before read (true)
      }
      
      // Second priority: within same read status, sort by timestamp (newest first)
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    console.log('🔍 Filtered and sorted notifications:', {
      originalCount: notifications.length,
      filteredCount: filtered.length,
      selectedTab
    });

    return filtered;
  }, [notifications, selectedTab]);

  // Animate in function - no dependencies that change
  const animateIn = () => {
    if (isAnimatingRef.current || hasAnimatedInRef.current) return;
    
    console.log('🎬 Starting notification screen animation IN');
    isAnimatingRef.current = true;
    setIsAnimating(true);
    
    if (onAnimationStart) {
      onAnimationStart();
    }
    
    // Reset animation values
    notificationTranslateY.setValue(-screenData.height);
    notificationOpacity.setValue(0);
    overlayOpacity.setValue(0);
    
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0.5,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(notificationTranslateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(notificationOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      })
    ]).start((finished) => {
      if (finished) {
        console.log('✅ Notification screen animation IN completed');
        isAnimatingRef.current = false;
        hasAnimatedInRef.current = true;
        setIsAnimating(false);
        if (onAnimationComplete) {
          onAnimationComplete();
        }
      }
    });
  };

  const animateOut = () => {
    if (isAnimatingRef.current) return;
    
    console.log('🎬 Starting notification screen animation OUT');
    isAnimatingRef.current = true;
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
        toValue: -screenData.height,
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
        isAnimatingRef.current = false;
        hasAnimatedInRef.current = false;
        setIsAnimating(false);
        if (onAnimationComplete) {
          onAnimationComplete();
        }
        onClose();
      }
    });
  };

  // Simple animation trigger - no dependency loops
  React.useEffect(() => {
    if (visible && !hasAnimatedInRef.current && !isAnimatingRef.current) {
      const timeoutId = setTimeout(() => {
        animateIn();
      }, 50);
      
      return () => clearTimeout(timeoutId);
    }
  }, [visible]); // Only depend on visible prop

  // Block background scrolling when notification is visible
  React.useEffect(() => {
    if (visible) {
      // Disable background scrolling
      return () => {
        // Re-enable when component unmounts or becomes invisible
      };
    }
  }, [visible]);

  // Memoize notification counts to prevent recalculation
  const notificationCounts = useMemo(() => {
    const total = notifications.length;
    const unread = notifications.filter(n => !n.read).length;
    const read = notifications.filter(n => n.read).length;
    
    return { total, unread, read };
  }, [notifications]);

  // Memoize tab content string with connection status
  const tabContentString = useMemo(() => {
    const { total, unread, read } = notificationCounts;
    const filteredCount = filteredAndSortedNotifications.length;
    
    let baseString = '';
    switch (selectedTab) {
      case 'all':
        baseString = `Showing ${filteredCount} of ${totalCount} total notifications`;
        break;
      case 'unread':
        baseString = filteredCount === 0 
          ? 'No unread notifications' 
          : `${filteredCount} unread notification${filteredCount !== 1 ? 's' : ''}`;
        break;
      case 'read':
        baseString = filteredCount === 0 
          ? 'No read notifications' 
          : `${filteredCount} read notification${filteredCount !== 1 ? 's' : ''}`;
        break;
      default:
        baseString = `${filteredCount} notifications`;
    }
    
    // Add connection status indicator
    if (isAnimating) {
      return `${baseString} • Updating...`;
    } else if (isConnected) {
      return `${baseString} • Live`;
    } else if (!isConnected) {
      return `${baseString} • Offline`;
    }
    
    return baseString;
  }, [
    selectedTab, 
    notificationCounts, 
    filteredAndSortedNotifications.length, 
    totalCount, 
    isAnimating,
    isConnected
  ]);

  // Get connection status icon
  const getConnectionStatusIcon = useCallback(() => {
    if (isConnected) {
      return { name: "flash-outline", color: "#4CAF50" }; // Green flash for WebSocket
    } else {
      return { name: "cloud-offline-outline", color: "#F44336" }; // Red cloud offline for errors
    }
  }, [isConnected]);

  // Optimized render item for FlatList
  const renderNotificationItem = useCallback(({ item }: { item: NotificationDTO }) => (
    <NotificationItem
      notification={item}
      onPress={onMarkAsRead}
      getNotificationIcon={getNotificationIcon}
      getNotificationTitle={getNotificationTitle}
      screenData={screenData}
    />
  ), [onMarkAsRead, getNotificationIcon, getNotificationTitle, screenData]);

  // Optimized keyExtractor
  const keyExtractor = useCallback((item: NotificationDTO) => item.id.toString(), []);

  // Empty state component with tab-specific messaging and responsive design
  const EmptyComponent = useMemo(() => {
    const getEmptyStateConfig = () => {
      // Handle filtered results
      if (selectedTab === 'unread') {
          return {
            icon: 'checkmark-circle-outline',
            title: 'You\'re all caught up!',
            message: 'No unread notifications at the moment. When new notifications arrive, they\'ll appear here for you to review.',
          };
      } else if (selectedTab === 'read') {
          return {
            icon: 'archive-outline',
            title: 'No read notifications yet',
            message: 'Once you read notifications, they\'ll be moved here. This helps you keep track of what you\'ve already seen.',
          };
      }

      // Default all tab
          return {
            icon: 'notifications-off-outline',
            title: 'No notifications',
            message: 'You don\'t have any notifications right now. We\'ll notify you when something important happens.',
          };
    };

    const config = getEmptyStateConfig();

    // Responsive sizing for empty state
    const emptyPadding = Math.max(40, screenData.width * 0.1);

    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: Math.max(40, screenData.height * 0.08),
        paddingHorizontal: emptyPadding,
      }}>
        <Ionicons 
          name={config.icon as any} 
          size={64} 
          color="#A0A0A0" 
          style={{ marginBottom: 16 }}
        />
        <Text style={{
          fontSize: Math.min(24, screenData.width * 0.06),
          fontWeight: 'bold',
          color: '#374151',
          marginBottom: 8,
          textAlign: 'center',
        }}>
          {config.title}
        </Text>
        <Text style={{
          fontSize: Math.min(16, screenData.width * 0.04),
          color: '#6B7280',
          textAlign: 'center',
          lineHeight: Math.min(16, screenData.width * 0.04) * 1.5,
          paddingHorizontal: 16,
        }}>
          {config.message}
        </Text>
      </View>
    );
  }, [
    selectedTab, 
    screenData
  ]);

  // Footer component - CONSISTENT FOR ALL TABS WITH SMOOTH ANIMATIONS
  const FooterComponent = useMemo(() => {
    // Get tab-specific pagination state
    const tabState = { isLoadingMore, hasMore };
    
    if (isLoading && filteredAndSortedNotifications.length === 0) {
      return null; // Don't show footer during initial load
    }

    if (filteredAndSortedNotifications.length === 0) {
      return null; // Don't show footer when empty
    }

    // Show loading indicator when loading more - WITH SMOOTH FADE
    if (tabState.isLoadingMore) {
      return (
        <Animated.View style={{
          padding: 20,
          alignItems: 'center',
          opacity: 1,
        }}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={{
            fontSize: 14,
            color: COLORS.textSecondary,
            fontWeight: '500',
            marginTop: 8,
            textAlign: 'center',
            letterSpacing: 0.3,
            lineHeight: 14 * 1.3,
          }}>
            Loading more notifications...
          </Text>
          <Text style={{
            fontSize: 11,
            color: COLORS.textTertiary,
            marginTop: 4,
            textAlign: 'center',
            letterSpacing: 0.2,
            lineHeight: 11 * 1.2,
          }}>
            {selectedTab === 'read' ? 'Finding more read notifications...' : 
             selectedTab === 'unread' ? 'Finding more unread notifications...' : 
             'Loading more...'}
          </Text>
        </Animated.View>
      );
    }

    // Show "all loaded" message when no more data
    if (!tabState.hasMore) {
      return (
        <Animated.View style={{
          padding: 20,
          alignItems: 'center',
          borderTopWidth: 1,
          borderTopColor: COLORS.surface,
          marginTop: 8,
          opacity: 1,
        }}>
          <Ionicons name="checkmark-circle-outline" size={24} color={COLORS.textSecondary} />
          <Text style={{
            fontSize: 14,
            color: COLORS.textSecondary,
            fontWeight: '500',
            marginTop: 6,
            textAlign: 'center',
            letterSpacing: 0.3,
            lineHeight: 14 * 1.3,
          }}>
            {selectedTab === 'read' ? 'All read notifications loaded' :
             selectedTab === 'unread' ? 'All unread notifications loaded' :
             'All notifications loaded'}
          </Text>
          <Text style={{
            fontSize: 12,
            color: COLORS.textTertiary,
            marginTop: 4,
            textAlign: 'center',
            letterSpacing: 0.2,
            lineHeight: 12 * 1.2,
          }}>
            <Text>{filteredAndSortedNotifications.length}</Text> {selectedTab === 'all' ? 'total' : selectedTab} notifications
          </Text>
        </Animated.View>
      );
    }

    // Return null when there are more items (let infinite scroll handle it)
    return null;
  }, [isLoading, filteredAndSortedNotifications.length, selectedTab, isLoadingMore, hasMore]);

  // Handle end reached for infinite scroll - TAB-SPECIFIC SMART LOADING
  const handleEndReached = useCallback(() => {
    // Add multiple safety checks to prevent duplicate calls
    if (isLoadingMore) {
      console.log(`⚠️ Already loading more for ${selectedTab} tab, ignoring onEndReached`);
      return;
    }
    
    if (!hasMore) {
      console.log(`⚠️ No more data available for ${selectedTab} tab, ignoring onEndReached`);
      return;
    }
    
    if (filteredAndSortedNotifications.length === 0) {
      console.log('⚠️ No notifications loaded yet, ignoring onEndReached');
      return;
    }

    // Smart loading: For filtered tabs (read/unread), be more aggressive with loading
    // to ensure we have enough filtered items for smooth scrolling
    const isFilteredTab = selectedTab !== 'all';
    const loadThreshold = isFilteredTab ? 5 : 10; // Lower threshold for filtered tabs
    
    // Calculate how many items we need to ensure smooth scrolling
    const itemsFromEnd = filteredAndSortedNotifications.length % 25; // How many items in current page
    const shouldLoadEarly = isFilteredTab && itemsFromEnd < loadThreshold;
    
    if (shouldLoadEarly) {
      console.log(`📱 Smart loading triggered for ${selectedTab} tab:`, {
        currentCount: filteredAndSortedNotifications.length,
        itemsFromEnd,
        threshold: loadThreshold
      });
    }
    
    console.log(`📱 End reached for ${selectedTab} tab, loading more notifications...`, {
      currentCount: filteredAndSortedNotifications.length,
      hasMore: hasMore,
      isLoadingMore: isLoadingMore,
      selectedTab,
      isFilteredTab,
      shouldLoadEarly,
    });
    
    // Use tab-specific loading function
    onLoadMore();
  }, [filteredAndSortedNotifications.length, onLoadMore, selectedTab, isLoadingMore, hasMore]);

  // Animate tab changes - simplified without problematic dependencies
  const handleTabChange = (newTab: string) => {
    if (newTab === selectedTab) return;
    
    console.log(`🔄 Tab change requested: ${selectedTab} → ${newTab}`);
    
    // Change tab immediately so line animation can trigger
    onTabChange(newTab);
    
    // Scroll to top when changing tabs to prevent scroll position issues
    if (flatListRef.current) {
      try {
        flatListRef.current.scrollToOffset({ offset: 0, animated: false });
      } catch (error) {
        console.log('⚠️ Could not scroll to top:', error);
      }
    }
    
    // Fade out and in the list content
    Animated.timing(listOpacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      // Fade in new list
      Animated.timing(listOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  if (!visible) return null;

  // Responsive layout calculations
  const headerPaddingTop = Platform.OS === 'ios' ? insets.top + 20 : insets.top + 30;
  const headerFontSize = Math.min(24, screenData.width * 0.06);
  const containerPadding = Math.max(16, screenData.width * 0.04);

  // Calculate total screen dimensions including any system bars
  const totalScreenHeight = screenData.height + (Platform.OS === 'android' ? 50 : 0); // Add extra for Android status/nav bars
  const totalScreenWidth = screenData.width;

  return (
    <>
      {/* Background Overlay - Full screen coverage with extra buffer */}
      <Animated.View
        style={{
          position: 'absolute',
          top: -100, // Start above screen
          left: -50,  // Start left of screen
          right: -50, // Extend right of screen
          bottom: -100, // Extend below screen
          width: totalScreenWidth + 100,
          height: totalScreenHeight + 200,
          backgroundColor: 'rgba(0, 0, 0, 0.8)', // Solid background
          opacity: overlayOpacity,
          zIndex: 15,
        }}
        pointerEvents="auto" // Capture all touch events
      >
        <TouchableOpacity
          style={{ 
            flex: 1, 
            width: '100%', 
            height: '100%',
            minHeight: totalScreenHeight + 200, // Ensure full coverage
          }}
          activeOpacity={1}
          onPress={animateOut}
        />
      </Animated.View>

      {/* Notification Screen - Full coverage container */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: totalScreenWidth,
          height: totalScreenHeight,
          backgroundColor: COLORS.background,
          transform: [{ translateY: notificationTranslateY }],
          opacity: notificationOpacity,
          zIndex: 20,
          minHeight: totalScreenHeight, // Ensure minimum coverage
        }}
        pointerEvents="auto" // Ensure this captures all touch events
      >
        {/* Header - Responsive sizing with connection status */}
        <View style={{
          paddingTop: headerPaddingTop,
          paddingBottom: 16,
          paddingHorizontal: containerPadding,
          backgroundColor: COLORS.primary,
          minHeight: headerPaddingTop + 60,
        }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center',
              flex: 1,
              marginRight: 12,
            }}>
              <Text style={{
                color: COLORS.textInverse,
                fontSize: headerFontSize,
                fontWeight: 'bold',
                marginRight: 12,
                flexShrink: 1,
              }}>
                Notifications
              </Text>
              {unreadCount > 0 && selectedTab !== 'read' && (
                <TouchableOpacity
                  onPress={onMarkAllAsRead}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    paddingHorizontal: Math.max(8, screenData.width * 0.03),
                    paddingVertical: 6,
                    borderRadius: 16,
                    marginRight: 8,
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ 
                    color: COLORS.textInverse, 
                    fontSize: Math.min(12, screenData.width * 0.03), 
                    fontWeight: '600' 
                  }}>
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
                minWidth: 40,
                minHeight: 40,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={Math.min(24, screenData.width * 0.06)} color={COLORS.textInverse} />
            </TouchableOpacity>
          </View>

          {/* Memoized count display with connection status */}
          <Text style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: Math.min(14, screenData.width * 0.035),
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
          screenData={screenData}
        />

        {/* Virtualized Notification List - Full height container with scroll blocking */}
        <Animated.View 
          style={{ 
            flex: 1,
            opacity: listOpacity,
            minHeight: 0,
            backgroundColor: COLORS.background,
          }}
          pointerEvents="auto"
        >
          <FlatList
            ref={flatListRef}
            data={filteredAndSortedNotifications}
            renderItem={renderNotificationItem}
            keyExtractor={keyExtractor}
            ListEmptyComponent={EmptyComponent}
            ListFooterComponent={FooterComponent}
            contentContainerStyle={{ 
              paddingBottom: Math.max(30, insets.bottom + 30),
              flexGrow: filteredAndSortedNotifications.length === 0 ? 1 : 0,
              minHeight: filteredAndSortedNotifications.length === 0 ? screenData.height * 0.4 : undefined,
            }}
            style={{
              flex: 1,
              backgroundColor: COLORS.background,
            }}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={Platform.OS === 'android'}
            maxToRenderPerBatch={Platform.OS === 'android' ? 10 : 8}
            windowSize={Platform.OS === 'android' ? 10 : 12}
            initialNumToRender={Platform.OS === 'android' ? 10 : 12}
            updateCellsBatchingPeriod={Platform.OS === 'android' ? 50 : 100}
            scrollEventThrottle={Platform.OS === 'android' ? 1 : 16}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.3}
            maintainVisibleContentPosition={Platform.OS === 'ios' ? {
              minIndexForVisible: 0,
              autoscrollToTopThreshold: 100,
            } : undefined}
            overScrollMode={Platform.OS === 'android' ? "auto" : "never"}
            bounces={Platform.OS === 'ios'}
            bouncesZoom={false}
            decelerationRate={Platform.OS === 'android' ? "fast" : "normal"}
            disableIntervalMomentum={Platform.OS === 'android' ? true : false}
            snapToAlignment="start"
            snapToStart={false}
            snapToEnd={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            scrollEnabled={true}
            nestedScrollEnabled={true}
            directionalLockEnabled={false}
            alwaysBounceVertical={Platform.OS === 'ios'}
            contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? "automatic" : undefined}
          />
        </Animated.View>

        {/* Bottom safety area to ensure full coverage - also blocks events */}
        <View style={{
          height: Math.max(20, insets.bottom),
          backgroundColor: COLORS.background,
        }} />
      </Animated.View>
    </>
  );
};

export default OptimizedNotificationScreen; 