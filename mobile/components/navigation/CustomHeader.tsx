import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, TouchableOpacity, Platform, Animated, Easing, Image, Dimensions, Text, ScrollView, StatusBar, InteractionManager, ActivityIndicator, Alert, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import OptimizedNotificationScreen from './OptimizedNotificationScreen';

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

const CustomHeader = React.memo(({ 
  showBackButton = false, 
  onBackPress, 
  showNotification = true,
  onNotificationStateChange
}: CustomHeaderProps) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { authToken } = useAuth();
  const [showNotificationScreen, setShowNotificationScreen] = useState(false);
  const [isNotificationAnimating, setIsNotificationAnimating] = useState(false);
  
  const [selectedTab, setSelectedTab] = useState<NotificationTabKey>('all');

  // Mock data for UI display only
  const [unreadCount] = useState(0);
  const [isConnected] = useState(true);
  
  const anim = {
    opacity: useRef(new Animated.Value(0)).current,
    y: useRef(new Animated.Value(-20)).current
  };

  // Logo animation references
  const logoTranslateX = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(1)).current;
  
  // Optimized notification icon animation - reduced complexity
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const waveScale = useRef(new Animated.Value(0)).current;
  const waveOpacity = useRef(new Animated.Value(0)).current;
  
  // Track if we're in the middle of a back animation
  const isAnimatingBack = useRef(false);
  const animationTimer = useRef<NodeJS.Timeout | null>(null);

  // Optimized animation with throttling and reduced complexity
  const animateNotificationIcon = useCallback(() => {
    if (unreadCount <= 0) return;

    // Clear any existing animation timer
    if (animationTimer.current) {
      clearTimeout(animationTimer.current);
    }

    // Use InteractionManager to ensure animations don't block user interactions
    InteractionManager.runAfterInteractions(() => {
        // Reset animations
        shakeAnimation.setValue(0);
        waveScale.setValue(0);
      waveOpacity.setValue(0.3); // Reduced opacity for performance

      // Simplified animation sequence
        Animated.parallel([
        // Reduced shake animation complexity
          Animated.sequence([
          Animated.timing(shakeAnimation, { 
              toValue: 1,
            duration: 50, // Reduced duration
            useNativeDriver: true, 
            easing: Easing.linear 
          }),
          Animated.timing(shakeAnimation, { 
            toValue: -1, 
            duration: 50, 
            useNativeDriver: true, 
            easing: Easing.linear 
          }),
          Animated.timing(shakeAnimation, { 
            toValue: 0, 
            duration: 50, 
              useNativeDriver: true,
            easing: Easing.linear 
            }),
          ]),
        // Simplified wave animation
        Animated.timing(waveScale, {
          toValue: 1,
          duration: 300, // Reduced duration
              useNativeDriver: true,
              easing: Easing.out(Easing.quad),
            }),
        Animated.timing(waveOpacity, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        })
        ]).start();
    });

    // Set a longer interval to reduce frequency (every 5 seconds instead of 2)
    animationTimer.current = setTimeout(animateNotificationIcon, 5000) as unknown as NodeJS.Timeout;
  }, [unreadCount, shakeAnimation, waveScale, waveOpacity]);

  // Throttled effect for notification icon animation
  useEffect(() => {
    if (unreadCount > 0) {
      animateNotificationIcon();
    } else {
      // Clear animation timer when no unread notifications
      if (animationTimer.current) {
        clearTimeout(animationTimer.current);
        animationTimer.current = null;
      }
      // Reset animation values
      shakeAnimation.setValue(0); 
      waveScale.setValue(0);
      waveOpacity.setValue(0);
    }

    return () => {
      if (animationTimer.current) {
        clearTimeout(animationTimer.current);
        animationTimer.current = null;
      }
    };
  }, [unreadCount, animateNotificationIcon]);

  // Handle notification screen animation when state changes
  useEffect(() => {
    if (showNotificationScreen) {
      // The OptimizedNotificationScreen handles its own animations now
      console.log('📱 Notification screen is now visible');
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
        // Add a small delay to coordinate with broadcast screen transition
        setTimeout(() => {
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
        }, 100); // Small delay to coordinate with broadcast transition
      }
    }
  }, [showBackButton, anim, logoTranslateX, logoScale]);

  // Handle back press animation
  const handleBack = useCallback(() => {
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
      // Reset animating flag
        isAnimatingBack.current = false;
    }
  }, [onBackPress, anim, logoTranslateX, logoScale]);

  // Optimized notification handlers
  const handleNotificationPress = useCallback(() => {
    // Prevent rapid taps while screen is transitioning
    if (isNotificationAnimating) {
      console.log('🚫 Notification press ignored - animation in progress');
      return;
    }

    // Auth gate: require login to open notifications
    if (!authToken) {
      Alert.alert(
        'Login required',
        'Please log in to view your notifications.',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Login', style: 'default', onPress: () => router.push('/auth/login') },
        ],
      );
      // Ensure downstream consumers think notifications are closed
      if (onNotificationStateChange) onNotificationStateChange(false);
      return;
    }

    console.log('🔔 CustomHeader: Notification icon pressed');
    setIsNotificationAnimating(true);
    
    setShowNotificationScreen(prev => {
      const newState = !prev;
      console.log(`📱 Notification screen state changing: ${prev} → ${newState}`);
      
      if (onNotificationStateChange) {
        onNotificationStateChange(newState);
      }
      return newState;
    });
  }, [isNotificationAnimating, onNotificationStateChange]);

  const handleNotificationClose = useCallback(() => {
    console.log('🔔 CustomHeader: Notification screen closing');
    setShowNotificationScreen(false);
    if (onNotificationStateChange) {
      onNotificationStateChange(false);
    }
  }, [onNotificationStateChange]);

  const handleAnimationStart = useCallback(() => {
    console.log('🎬 CustomHeader: Animation started');
    setIsNotificationAnimating(true);
  }, []);

  const handleAnimationComplete = useCallback(() => {
    console.log('✅ CustomHeader: Animation completed');
    setIsNotificationAnimating(false);
  }, []);

  const conditionalShakeStyle = unreadCount > 0 ? {
    transform: [{
      rotate: shakeAnimation.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: ['-7deg', '0deg', '7deg']
      })
    }]
  } : {};

  // Keep provider consumers in sync with local state changes (extra safety)
  useEffect(() => {
    if (onNotificationStateChange) {
      onNotificationStateChange(showNotificationScreen);
    }
  }, [showNotificationScreen, onNotificationStateChange]);

  // Handle Android hardware back while notification overlay is open
  useEffect(() => {
    if (!showNotificationScreen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleNotificationClose();
      return true; // prevent default back behavior
    });
    return () => sub.remove();
  }, [showNotificationScreen, handleNotificationClose]);

  // Ensure tab bar visibility resets if header unmounts mid-notification
  useEffect(() => {
    return () => {
      if (onNotificationStateChange) onNotificationStateChange(false);
    };
  }, [onNotificationStateChange]);

  return (
    <>
    <View style={{
      paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + 10,
      paddingBottom: 12,
      paddingHorizontal: 20,
      backgroundColor: '#91403E', // Cordovan color - matching CustomTabBar
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 12,
      zIndex: 10,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 195, 11, 0.15)', // Subtle Mikado Yellow accent border
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
              style={{ 
                padding: 10,
                paddingBottom: 6,
                backgroundColor: 'rgba(255, 195, 11, 0.12)',
                borderRadius: 12,
              }} 
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={26} color="#FFC30B" />
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>            
            <TouchableOpacity 
              style={{ 
                padding: 8, 
                marginTop: 6, 
                position: 'relative',
              }} 
              activeOpacity={0.7}
              onPress={handleNotificationPress}
            >
              <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                {/* Connection Status Indicator */}
                <View style={{
                  position: 'absolute',
                  top: -4,
                  left: -4,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: isConnected ? '#10B981' : '#EF4444',
                  borderWidth: 1,
                  borderColor: 'white',
                  zIndex: 3,
                }} />
                
                {/* Wave Effect View */}
                {unreadCount > 0 && (
                  <Animated.View
                    style={{
                      position: 'absolute',
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: '#FFD600',
                      transform: [{ scale: waveScale }],
                      opacity: waveOpacity,
                      zIndex: 0,
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
                    size={24}
                    color={'white'}
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
                          top: -4,
                          right: -4,
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
                            paddingHorizontal: 1,
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
            {/* Login icon when user is not authenticated */}
            {!authToken && (
              <TouchableOpacity
                style={{ padding: 8, marginTop: 6, marginLeft: 6 }}
                activeOpacity={0.7}
                onPress={() => router.push('/auth/login')}
                accessibilityRole="button"
                accessibilityLabel="Login"
              >
                <Ionicons name="log-in-outline" size={24} color={'white'} />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={{ width: 48 }} />
        )}
      </View>
    </View>

      {/* Optimized Notification Screen */}
      <OptimizedNotificationScreen
        visible={showNotificationScreen}
        notifications={[]}
        unreadCount={unreadCount}
        isConnected={isConnected}
        selectedTab={selectedTab}
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        totalCount={0}
        onClose={handleNotificationClose}
        onMarkAsRead={() => {}}
        onMarkAllAsRead={() => {}}
        onTabChange={(tab: string) => setSelectedTab(tab as NotificationTabKey)}
        onLoadMore={() => {}}
        onAnimationStart={handleAnimationStart}
        onAnimationComplete={handleAnimationComplete}
        getNotificationIcon={() => 'notifications-outline'}
        getNotificationTitle={() => 'Notification'}
      />
    </>
  );
});

CustomHeader.displayName = 'CustomHeader';

export default CustomHeader;