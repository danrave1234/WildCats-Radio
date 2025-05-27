import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, Platform, Animated, Easing, Image, Dimensions, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

interface CustomHeaderProps {
  showBackButton?: boolean;
  onBackPress?: () => void;
  showNotification?: boolean;
  onNotificationStateChange?: (isOpen: boolean) => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Mock notification data - replace with actual data from your API
const mockNotifications = [
  {
    id: 1,
    title: 'New Show Starting Soon!',
    message: 'Wildcat Morning Show starts in 10 minutes. Don\'t miss it!',
    time: '2 min ago',
    type: 'broadcast',
    read: false,
  },
  {
    id: 2,
    title: 'Song Request Approved',
    message: 'Your request for "Bohemian Rhapsody" has been added to the playlist.',
    time: '1 hour ago',
    type: 'request',
    read: false,
  },
  {
    id: 3,
    title: 'Poll Results',
    message: 'The "Best Genre" poll results are now available!',
    time: '3 hours ago',
    type: 'poll',
    read: true,
  },
  {
    id: 4,
    title: 'Welcome to Wildcat Radio!',
    message: 'Thank you for joining our community. Enjoy the music!',
    time: '1 day ago',
    type: 'welcome',
    read: true,
  },
];

const CustomHeader = ({ 
  showBackButton = false, 
  onBackPress, 
  showNotification = true,
  onNotificationStateChange
}: CustomHeaderProps) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showNotificationScreen, setShowNotificationScreen] = useState(false);
  const [notifications, setNotifications] = useState(mockNotifications);
  
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
  
  // Track if we're in the middle of a back animation
  const isAnimatingBack = useRef(false);

  useEffect(() => {
    if (showBackButton) {
      // Back button animation - using springs for natural movement
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
    } else if (!isAnimatingBack.current) {
      // Reset animations when going back to normal state
      // Only do this if we're not in the middle of a back animation
      anim.opacity.setValue(0);
      anim.y.setValue(-20);
      
      // Use very fast animation to match the main transition
      Animated.parallel([
        Animated.spring(logoTranslateX, {
          toValue: 0,
          tension: 180, // Higher tension for quicker movement
          friction: 12, // Lower friction for faster initial movement
          useNativeDriver: true
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 180, // Higher tension for quicker movement
          friction: 12, // Lower friction for faster initial movement
          useNativeDriver: true
        })
      ]).start();
    }
  }, [showBackButton, anim, logoTranslateX, logoScale]);

  const handleBack = () => {
    // When back is pressed, set animating flag to prevent conflicts
    isAnimatingBack.current = true;
    
    if (onBackPress) {
      // Start animating the logo BEFORE triggering the screen transition
      // Slowed down animation for smoother feel
      Animated.parallel([
        Animated.spring(logoTranslateX, {
          toValue: 0,
          tension: 65, // Lower tension for slower movement
          friction: 10, // Balanced friction for smooth motion
          useNativeDriver: true
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 65, // Lower tension for slower movement
          friction: 10, // Balanced friction for smooth motion
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
      // Open notification screen
      setShowNotificationScreen(true);
      onNotificationStateChange?.(true);
      animateNotificationIn();
    }
  };

  const animateNotificationIn = () => {
    Animated.parallel([
      Animated.timing(notificationTranslateY, {
        toValue: 0,
        duration: 350, // Slightly faster for better sync with tab bar
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(notificationOpacity, {
        toValue: 1,
        duration: 350, // Match the translateY duration
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0.5,
        duration: 300, // Slightly faster for overlay
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateNotificationOut = () => {
    Animated.parallel([
      Animated.timing(notificationTranslateY, {
        toValue: -SCREEN_HEIGHT,
        duration: 300, // Faster exit animation
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(notificationOpacity, {
        toValue: 0,
        duration: 300, // Match the translateY duration
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250, // Faster overlay fade out
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowNotificationScreen(false);
    });
  };

  const markAsRead = (notificationId: number) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, read: true }))
    );
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'broadcast':
        return 'radio';
      case 'request':
        return 'musical-notes';
      case 'poll':
        return 'stats-chart';
      case 'welcome':
        return 'heart';
      default:
        return 'notifications';
    }
  };

  const unreadCount = notifications.filter(notif => !notif.read).length;

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
              <Ionicons name="notifications-outline" size={26} color="#91403E" />
              {unreadCount > 0 && (
                <View style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  backgroundColor: '#EF4444',
                  borderRadius: 10,
                  minWidth: 20,
                  height: 20,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 2,
                  borderColor: '#F5F5F7',
                }}>
                  <Text style={{
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 'bold',
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
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
                <View>
                  <Text style={{
                    color: 'white',
                    fontSize: 24,
                    fontWeight: 'bold',
                  }}>
                    Notifications
                  </Text>
                  <Text style={{
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: 14,
                  }}>
                    {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                  </Text>
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

              {/* Action Buttons */}
              {notifications.length > 0 && (
                <View style={{
                  flexDirection: 'row',
                  marginTop: 12,
                  gap: 12,
                }}>
                  {unreadCount > 0 && (
                    <TouchableOpacity
                      onPress={markAllAsRead}
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
                  <TouchableOpacity
                    onPress={clearAllNotifications}
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 16,
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>
                      Clear all
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Notification List */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
            >
              {notifications.length === 0 ? (
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
                notifications.map((notification, index) => (
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
                    onPress={() => markAsRead(notification.id)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <View style={{
                        backgroundColor: notification.read ? '#F3F4F6' : '#FBD38D',
                        padding: 8,
                        borderRadius: 20,
                        marginRight: 12,
                      }}>
                        <Ionicons 
                          name={getNotificationIcon(notification.type)} 
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
                            {notification.title}
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
                          {notification.time}
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