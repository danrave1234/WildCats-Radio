import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, Platform, Animated, Easing, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

interface CustomHeaderProps {
  showBackButton?: boolean;
  onBackPress?: () => void;
  showNotification?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CustomHeader = ({ 
  showBackButton = false, 
  onBackPress, 
  showNotification = true 
}: CustomHeaderProps) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const anim = {
    opacity: useRef(new Animated.Value(0)).current,
    y: useRef(new Animated.Value(-20)).current
  };

  // Logo animation references
  const logoTranslateX = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(1)).current;
  
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

  return (
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
          <TouchableOpacity style={{ padding: 8, marginTop: 6 }} activeOpacity={0.7}>
            <Ionicons name="notifications-outline" size={26} color="#91403E" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 48 }} />
        )}
      </View>
    </View>
  );
};

export default CustomHeader; 