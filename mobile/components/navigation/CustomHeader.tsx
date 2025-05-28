import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, Platform, Animated, Easing, Image, Dimensions, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useNotifications } from '../../context/NotificationContext';
import { NotificationDTO } from '../../services/apiService';
import { formatDistanceToNow } from 'date-fns';

interface CustomHeaderProps {
  showBackButton?: boolean;
  onBackPress?: () => void;
  showNotification?: boolean;
  onNotificationStateChange?: (isOpen: boolean) => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const notificationTabs = [
  { key: 'all', label: 'All', icon: 'list-outline' },
  { key: 'unread', label: 'Unread', icon: 'notifications-outline' },
  { key: 'read', label: 'Read', icon: 'checkmark-done-outline' },
] as const;
type NotificationTabKey = typeof notificationTabs[number]['key'];

const CustomHeader = ({ 
  showBackButton = false, 
  onBackPress, 
  showNotification = true,
  onNotificationStateChange
}: CustomHeaderProps) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showNotificationScreen, setShowNotificationScreen] = useState(false);
  
  // Use real notifications from context
  const { 
    notifications, 
    unreadCount, 
    isConnected, 
    markAsRead, 
    markAllAsRead: markAllAsReadContext, 
    fetchNotifications 
  } = useNotifications();
  
  const anim = {
    opacity: useRef(new Animated.Value(0)).current,
    y: useRef(new Animated.Value(-20)).current
  };

  // Logo animation references
  const logoTranslateX = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(1)).current;
  
  // Notification screen animation references
  const notificationTranslateY = useRef(new Animated.Value(-SCREEN_HEIGHT)).current;
  const notificationOpacity = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // Shaking animation for notification icon
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  // Wave effect for notification icon
  const waveScale = useRef(new Animated.Value(0)).current;
  const waveOpacity = useRef(new Animated.Value(0)).current;
  
  // Track if we're in the middle of a back animation
  const isAnimatingBack = useRef(false);

  const [selectedTab, setSelectedTab] = useState<NotificationTabKey>('all');

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    if (unreadCount > 0) {
      const animateShakeAndWave = () => {
        // Reset animations
        shakeAnimation.setValue(0);
        waveScale.setValue(0);
        waveOpacity.setValue(0.5); // Start with some opacity for the wave

        Animated.parallel([
          // Shaking animation
          Animated.sequence([
            Animated.timing(shakeAnimation, { toValue: 1, duration: 70, useNativeDriver: true, easing: Easing.linear }),
            Animated.timing(shakeAnimation, { toValue: -1, duration: 70, useNativeDriver: true, easing: Easing.linear }),
            Animated.timing(shakeAnimation, { toValue: 1, duration: 70, useNativeDriver: true, easing: Easing.linear }),
            Animated.timing(shakeAnimation, { toValue: 0, duration: 70, useNativeDriver: true, easing: Easing.linear }),
          ]),
          // Wave animation
          Animated.sequence([
            Animated.timing(waveScale, {
              toValue: 1,
              duration: 400, // Wave expands over a longer period
              useNativeDriver: true,
              easing: Easing.out(Easing.quad), // Ease out for a natural expansion
            }),
          ]),
          Animated.sequence([
            Animated.timing(waveOpacity, { // Fade out the wave
              toValue: 0,
              duration: 450, // Slightly longer to ensure it fades after full scale
              useNativeDriver: true,
              easing: Easing.out(Easing.quad),
            }),
          ])
        ]).start();
      };
      
      animateShakeAndWave(); // Initial animation
      intervalId = setInterval(animateShakeAndWave, 2000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      shakeAnimation.setValue(0); 
      waveScale.setValue(0);
      waveOpacity.setValue(0);
    };
  }, [unreadCount, shakeAnimation, waveScale, waveOpacity]);

  // Handle notification screen animation when state changes
  useEffect(() => {
    if (showNotificationScreen) {
      // Reset animation values to starting position
      notificationTranslateY.setValue(-SCREEN_HEIGHT);
      notificationOpacity.setValue(0);
      overlayOpacity.setValue(0);
      
      // Start animation after a small delay to ensure component is mounted
      setTimeout(() => {
        animateNotificationIn();
      }, 16); // One frame delay (16ms)
    }
  }, [showNotificationScreen]);

  useEffect(() => {
    if (showBackButton && !isAnimatingBack.current) {
      // Only show back button if we're NOT in the middle of animating back
      // This prevents the button from reappearing during transition and causing logo delay
      Animated.parallel([
        Animated.timing(anim.opacity, {
          toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true
        }),
        Animated.spring(anim.y, {
          toValue: 0, damping: 20, stiffness: 300, mass: 1, useNativeDriver: true
        }),
        // Logo animation - move to center using spring for natural movement
        Animated.spring(logoTranslateX, {
          toValue: (SCREEN_WIDTH / 2) - 50, // Center of screen minus half logo width
          damping: 25, // Match damping from main screen animation
          stiffness: 300, // Match stiffness from main screen animation
          mass: 1,
          useNativeDriver: true
        }),
        // Logo animation - scale slightly using spring
        Animated.spring(logoScale, {
          toValue: 1.1, 
          damping: 25, // Match damping from main screen animation
          stiffness: 300, // Match stiffness from main screen animation
          mass: 1,
          useNativeDriver: true
        })
      ]).start();
    } else {
      // INSTANTLY remove back button - no animation, no conditions
      anim.opacity.setValue(0);
      anim.y.setValue(-20);
      
      // Only animate logo if not already animating back
      if (!isAnimatingBack.current) {
        Animated.parallel([
          Animated.spring(logoTranslateX, {
            toValue: 0,
            tension: 65, // Match exactly with broadcast screen animation
            friction: 10, // Match exactly with broadcast screen animation
            useNativeDriver: true
          }),
          Animated.spring(logoScale, {
            toValue: 1,
            tension: 65, // Match exactly with broadcast screen animation
            friction: 10, // Match exactly with broadcast screen animation
            useNativeDriver: true
          })
        ]).start();
      }
    }
  }, [showBackButton, anim, logoTranslateX, logoScale]);

  const handleBack = () => {
    // When back is pressed, set animating flag to prevent conflicts
    isAnimatingBack.current = true;
    
    // INSTANTLY hide back button to prevent exit animation interference
    anim.opacity.setValue(0);
    anim.y.setValue(-20);
    
    if (onBackPress) {
      // Start animating the logo IMMEDIATELY after hiding back button
      // Match EXACT parameters with main screen animation for perfect sync
      Animated.parallel([
        Animated.spring(logoTranslateX, {
          toValue: 0, 
          tension: 65, // Match exactly with broadcast screen animation
          friction: 10, // Match exactly with broadcast screen animation
          useNativeDriver: true
        }),
        Animated.spring(logoScale, {
          toValue: 1, 
          tension: 65, // Match exactly with broadcast screen animation
          friction: 10, // Match exactly with broadcast screen animation
          useNativeDriver: true
        })
      ]).start(() => {
        // Reset animating flag when complete
        isAnimatingBack.current = false;
      });
      
      // Call onBackPress immediately
      onBackPress();
    } else {
      // Only animate if we're using the default back behavior
    Animated.parallel([
      Animated.timing(anim.opacity, {
        toValue: 0, duration: 300, easing: Easing.in(Easing.cubic), useNativeDriver: true
      }),
      Animated.timing(anim.y, {
        toValue: -20, duration: 300, easing: Easing.in(Easing.cubic), useNativeDriver: true
      })
      ]).start(() => {
        router.back();
        // Reset animating flag when complete
        isAnimatingBack.current = false;
      });
    }
  };

  const handleNotificationPress = () => {
    if (showNotificationScreen) {
      // Close notification screen
      animateNotificationOut();
      onNotificationStateChange?.(false);
    } else {
      // Open notification screen - animation will be handled by useEffect
      setShowNotificationScreen(true);
      onNotificationStateChange?.(true);
    }
  };

  const animateNotificationIn = () => {
    Animated.parallel([
      Animated.timing(notificationTranslateY, {
        toValue: 0,
        duration: 250, // Match tab bar hide duration exactly
        easing: Easing.out(Easing.cubic), // Same easing as tab bar
        useNativeDriver: true,
      }),
      Animated.timing(notificationOpacity, {
        toValue: 1,
        duration: 250, // Match the translateY duration
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0.5,
        duration: 250, // Match main animation for perfect sync
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateNotificationOut = () => {
    Animated.parallel([
      Animated.timing(notificationTranslateY, {
        toValue: -SCREEN_HEIGHT,
        duration: 350, // Match tab bar show duration exactly
        easing: Easing.out(Easing.cubic), // Same easing as tab bar for consistency
        useNativeDriver: true,
      }),
      Animated.timing(notificationOpacity, {
        toValue: 0,
        duration: 350, // Match the translateY duration
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 350, // Match main animation for perfect sync
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowNotificationScreen(false);
    });
  };

  const handleMarkAsRead = (notificationId: number) => {
    markAsRead(notificationId);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadContext();
  };

  const formatNotificationTime = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return 'Unknown time';
    }
  };

  // Filter notifications based on selected tab
  const filteredNotifications = notifications.filter((notification) => {
    if (selectedTab === 'all') return true;
    if (selectedTab === 'unread') return !notification.read;
    if (selectedTab === 'read') return notification.read;
    return true;
  });

  // Updated getNotificationIcon to use icons similar to @list.tsx
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'BROADCAST_SCHEDULED':
      case 'BROADCAST_STARTING_SOON':
      case 'BROADCAST_STARTED':
      case 'BROADCAST_ENDED':
      case 'NEW_BROADCAST_POSTED':
        return 'radio-outline';
      case 'SONG_REQUEST':
        return 'musical-notes-outline';
      case 'POLL_CREATED':
      case 'POLL_RESULTS':
        return 'stats-chart-outline';
      case 'USER_REGISTERED':
        return 'person-outline';
      case 'GENERAL':
      case 'WELCOME':
        return 'heart-outline';
      default:
        return 'notifications-outline';
    }
  };

  const getNotificationTitle = (type: string) => {
    switch (type) {
      case 'BROADCAST_SCHEDULED':
        return 'Broadcast Scheduled';
      case 'BROADCAST_STARTING_SOON':
        return 'Show Starting Soon!';
      case 'BROADCAST_STARTED':
        return 'Live Now!';
      case 'BROADCAST_ENDED':
        return 'Show Ended';
      case 'NEW_BROADCAST_POSTED':
        return 'New Show Posted';
      case 'SONG_REQUEST':
        return 'Song Request';
      case 'POLL_CREATED':
        return 'New Poll';
      case 'POLL_RESULTS':
        return 'Poll Results';
      case 'USER_REGISTERED':
        return 'Welcome!';
      case 'GENERAL':
        return 'Notification';
      default:
        return 'Update';
    }
  };

  const conditionalShakeStyle = unreadCount > 0 ? {
    transform: [{
      rotate: shakeAnimation.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: ['-7deg', '0deg', '7deg']
      })
    }]
  } : {};

  return (
    <>
    <View style={{
      paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + 10,
      paddingBottom: 8,
      paddingHorizontal: 16,
      backgroundColor: '#F5F5F7', // Light grayish white color
      borderBottomWidth: 3, // Increased border width for more emphasis
      borderBottomColor: '#91403E', // Cordovan color border
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 3,
        zIndex: 10,
    }}>
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 50,
        position: 'relative',
      }}>
        {/* Back button absolute positioned */}
        {showBackButton && (
          <Animated.View 
            style={{ 
              opacity: anim.opacity, 
              transform: [{ translateY: anim.y }],
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
              zIndex: 10,
            }}
          >
            <TouchableOpacity 
              onPress={handleBack} 
              style={{ padding: 8, paddingBottom: 4 }} 
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={26} color="#91403E" />
            </TouchableOpacity>
          </Animated.View>
        )}
        
        {/* Logo container takes entire left side */}
        <Animated.View
          style={{
            transform: [
              { translateX: logoTranslateX },
              { scale: logoScale }
            ],
            zIndex: 5,
          }}
        >
          <Image 
            source={require('../../assets/images/header_transparent_mobile_logo.png')}
            style={{
              width: 75,
              height: 50,
              resizeMode: 'contain',
              marginTop: -2,
            }}
          />
        </Animated.View>
        
        {/* Empty space to balance layout */}
        <View style={{ flex: 1 }} />
        
        {/* Notification icon on right */}
        {showNotification ? (
            <TouchableOpacity 
              style={{ padding: 8, marginTop: 6, position: 'relative' }} 
              activeOpacity={0.7}
              onPress={handleNotificationPress}
            >
              <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                {/* Wave Effect View */}
                {unreadCount > 0 && (
                  <Animated.View
                    style={{
                      position: 'absolute',
                      width: 40, // Initial size, same as icon container
                      height: 40, // Initial size, same as icon container
                      borderRadius: 20, // Make it a circle
                      backgroundColor: '#FFD600', // Mikado Yellow
                      transform: [{ scale: waveScale }],
                      opacity: waveOpacity,
                      zIndex: 0, // Behind the icon
                    }}
                  />
                )}
                {/* Icon Container View */}
                <Animated.View
                  style={[
                    { position: 'relative', alignItems: 'center', justifyContent: 'center' },
                    unreadCount > 0
                      ? {
                          transform: [
                            {
                      rotate: shakeAnimation.interpolate({
                        inputRange: [-1, 0, 1],
                                outputRange: ['-7deg', '0deg', '7deg'],
                              }),
                            },
                          ],
                        }
                      : {},
                  ]}
                >
                  <Ionicons
                    name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
                    size={24} // Icon size
                    color={'#91403E'} // Cordovan color
                  />
                  {unreadCount > 0 && (() => {
                    const badgeSize = 16;
                    const badgeBorderRadius = badgeSize / 2;
                    let badgeText = unreadCount > 99 ? '99+' : unreadCount.toString();
                    let textFontSize = unreadCount > 99 ? 7.5 : 8;
                    return (
                      <View
                        style={{
                          position: 'absolute',
                          top: -4, // Move badge above the bell
                          right: -4, // Move badge to the right of the bell
                          width: badgeSize,
                          height: badgeSize,
                          backgroundColor: '#EF4444', 
                          borderRadius: badgeBorderRadius, 
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 2,
                        }}
                      >
                        <Text
                          style={{
                            color: 'white',
                            fontSize: textFontSize,
                            fontWeight: 'bold',
                            textAlign: 'center',
                            includeFontPadding: false, 
                            paddingHorizontal: 1, // Small horizontal padding to help fit
                          }}
                          numberOfLines={1} 
                          adjustsFontSizeToFit
                          minimumFontScale={0.7}
                        >
                          {badgeText}
                        </Text>
                      </View>
                    );
                  })()}
                </Animated.View>
              </View>
            </TouchableOpacity>
        ) : (
          <View style={{ width: 48 }} />
        )}
      </View>
    </View>

      {/* Notification Screen Overlay */}
      {showNotificationScreen && (
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
              onPress={handleNotificationPress}
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
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 20,
            }}
          >
            {/* Notification Header */}
            <View style={{
              paddingTop: Platform.OS === 'ios' ? insets.top + 20 : insets.top + 30,
              paddingBottom: 16,
              paddingHorizontal: 20,
              backgroundColor: '#91403E',
              borderBottomWidth: 1,
              borderBottomColor: '#fff',
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
                  {/* Mark all as read button at top beside title */}
                  {unreadCount > 0 && (
                    <TouchableOpacity
                      onPress={handleMarkAllAsRead}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 16,
                        marginLeft: 2,
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
                  onPress={handleNotificationPress}
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

              {/* Tab-specific notification count below title */}
              <View style={{ marginTop: 2 }}>
                <Text style={{
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: 14,
                }}>
                  {selectedTab === 'all' && `${notifications.length} notifications, ${notifications.filter(n => !n.read).length} unread, ${notifications.filter(n => n.read).length} read`}
                  {selectedTab === 'unread' && `${notifications.filter(n => !n.read).length} unread notification${notifications.filter(n => !n.read).length !== 1 ? 's' : ''}`}
                  {selectedTab === 'read' && `${notifications.filter(n => n.read).length} read notification${notifications.filter(n => n.read).length !== 1 ? 's' : ''}`}
                </Text>
              </View>

              {/* Notification Tabs */}
              <View style={{ flexDirection: 'row', marginTop: 16, marginBottom: 4, gap: 8 }}>
                {notificationTabs.map(tab => (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => setSelectedTab(tab.key)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: selectedTab === tab.key ? '#fff' : 'rgba(255,255,255,0.12)',
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 16,
                      marginRight: 8,
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={tab.icon as any}
                      size={16}
                      color={selectedTab === tab.key ? '#91403E' : '#fff'}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={{
                      color: selectedTab === tab.key ? '#91403E' : '#fff',
                      fontWeight: selectedTab === tab.key ? 'bold' : '600',
                      fontSize: 13,
                    }}>{tab.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Action Buttons */}
              {notifications.length > 0 && (
                <View style={{
                  flexDirection: 'row',
                  marginTop: 12,
                  gap: 12,
                }}>
                  {unreadCount > 0 && (
                    <TouchableOpacity
                      onPress={handleMarkAllAsRead}
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
                  {isConnected && (
                    <View style={{
                      backgroundColor: 'rgba(0,255,0,0.2)',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}>
                      <View style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: '#22C55E',
                        marginRight: 6,
                      }} />
                      <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>
                        Live
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Notification List */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
            >
              {filteredNotifications.length === 0 ? (
                <View style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingVertical: 60,
                }}>
                  <Ionicons name="notifications-off-outline" size={64} color="#9CA3AF" />
                  <Text style={{
                    fontSize: 18,
                    fontWeight: '600',
                    color: '#6B7280',
                    marginTop: 16,
                  }}>
                    No notifications
                  </Text>
                  <Text style={{
                    fontSize: 14,
                    color: '#9CA3AF',
                    textAlign: 'center',
                    marginTop: 8,
                    paddingHorizontal: 40,
                  }}>
                    You're all caught up! New notifications will appear here.
                  </Text>
                </View>
              ) : (
                filteredNotifications.map((notification, index) => (
                  <TouchableOpacity
                    key={notification.id}
                    style={{
                      backgroundColor: notification.read ? 'white' : '#FEF3C7',
                      marginHorizontal: 16,
                      marginTop: index === 0 ? 16 : 8,
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
                    onPress={() => handleMarkAsRead(notification.id)}
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
                          {formatNotificationTime(notification.timestamp)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </Animated.View>
        </>
      )}
    </>
  );
};

export default CustomHeader;