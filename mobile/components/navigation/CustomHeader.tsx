import React, { useEffect, useRef, useCallback } from 'react';
import { View, TouchableOpacity, Platform, Animated, Easing, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CustomHeaderProps {
  showBackButton?: boolean;
  onBackPress?: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CustomHeader = React.memo(({ 
  showBackButton = false, 
  onBackPress
}: CustomHeaderProps) => {
  const insets = useSafeAreaInsets();
  
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
        
      </View>
    </View>
    </>
  );
});

CustomHeader.displayName = 'CustomHeader';

export default CustomHeader;
