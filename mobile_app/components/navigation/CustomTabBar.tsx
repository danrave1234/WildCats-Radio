import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Dimensions, Platform, Animated, Easing } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';

const { width, height } = Dimensions.get('window');
const BASE_TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 70 : 60;
const ICON_SIZE = 24;
const FOCUSED_ICON_CONTAINER_SIZE = 56;
const CORDOVAN_COLOR = '#91403E'; // From your tailwind config
const MIKADO_YELLOW = '#FFC30B'; // Yellow from logo
const TEXT_COLOR = '#E9ECEC'; // Light text for dark background
const FOCUSED_TEXT_COLOR = MIKADO_YELLOW;

interface TabBarIconProps {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color: string;
}

const TabBarIcon: React.FC<TabBarIconProps> = ({ name, size = ICON_SIZE, color }) => {
  return <Ionicons name={name} size={size} color={color} />;
};

interface CustomTabBarProps extends BottomTabBarProps {
  isNotificationOpen?: boolean;
}

const CustomTabBar: React.FC<CustomTabBarProps> = ({ state, descriptors, navigation, isNotificationOpen = false }) => {
  // Safe area insets
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  
  // Animation values for the indicator line
  const [tabLayouts, setTabLayouts] = useState<Record<string, { x: number; width: number } | undefined>>({});
  const underlinePosition = useRef(new Animated.Value(0)).current;
  const underlineWidth = useRef(new Animated.Value(0)).current;
  const underlineOpacity = useRef(new Animated.Value(1)).current;
  const [isInitialLayoutDone, setIsInitialLayoutDone] = useState(false);
  
  // Tab bar hide animation
  const tabBarTranslateY = useRef(new Animated.Value(0)).current;

  // Safety check for required props
  if (!state || !state.routes || !descriptors || !navigation) {
    return (
      <View style={styles.container}>
        <View style={styles.tabBar} />
      </View>
    );
  }

  // Check if tab bar should be hidden
  const currentRoute = state.routes[state.index];
  const currentDescriptor = descriptors[currentRoute?.key];
  const tabBarStyle = currentDescriptor?.options?.tabBarStyle;
  
  // Hide tab bar if tabBarStyle has display: 'none'
  if (tabBarStyle && typeof tabBarStyle === 'object' && 'display' in tabBarStyle && tabBarStyle.display === 'none') {
    return null;
  }

  // Only show tab bar on home screen
  const isHomeScreen = currentRoute?.name === 'home';
  if (!isHomeScreen) {
    return null;
  }

  // Extract animation style if present
  const animatedStyle = tabBarStyle && typeof tabBarStyle === 'object' && 'transform' in tabBarStyle 
    ? { transform: tabBarStyle.transform } 
    : {};

  // Effect to position underline based on current tab without animation
  useEffect(() => {
    if (!state || state.index === undefined || !state.routes) return;
    
    const currentRouteKey = state.routes[state.index]?.key;
    if (!currentRouteKey) return;
    
    const currentTabLayout = tabLayouts[currentRouteKey];
    if (currentTabLayout && currentTabLayout.width > 0) {
      // Set position directly without animation
      underlinePosition.setValue(currentTabLayout.x);
      underlineWidth.setValue(currentTabLayout.width);
      if (!isInitialLayoutDone) {
        setIsInitialLayoutDone(true);
      }
    }
  }, [state?.index, tabLayouts, underlinePosition, underlineWidth, isInitialLayoutDone]);

  // Calculate total tab bar height including safe area
  const totalTabBarHeight = BASE_TAB_BAR_HEIGHT + insets.bottom;

  // Effect to handle tab bar hide/show animation based on notification state
  useEffect(() => {
    if (isNotificationOpen) {
      // Hide tab bar by sliding down for notifications
      Animated.timing(tabBarTranslateY, {
        toValue: totalTabBarHeight + 20,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      // Show tab bar by sliding up
      Animated.timing(tabBarTranslateY, {
        toValue: 0,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [isNotificationOpen, tabBarTranslateY, totalTabBarHeight]);

  return (
    <Animated.View style={[styles.container, animatedStyle, {
      transform: [{ translateY: tabBarTranslateY }],
      paddingBottom: insets.bottom,
    }]}>
      {/* Base dark background */}
      <View style={styles.backgroundBase} />
      
      {/* Radial gradient overlay - top center */}
      <LinearGradient
        colors={['rgba(15,23,42,0.95)', 'rgba(2,6,23,0.95)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.gradientOverlay1}
      />
      
      {/* Maroon gradient - bottom left */}
      <LinearGradient
        colors={['rgba(127,29,29,0.35)', 'transparent']}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientMaroon1}
      />
      
      {/* Yellow gradient - top right */}
      <LinearGradient
        colors={['rgba(251,191,36,0.18)', 'transparent']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradientYellow1}
      />
      
      {/* Large maroon/yellow gradient blur - top right */}
      <LinearGradient
        colors={['rgba(251,191,36,0.50)', 'rgba(127,29,29,0.45)', 'transparent']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradientBlur1}
      />
      
      {/* Large maroon/rose gradient blur - bottom left */}
      <LinearGradient
        colors={['rgba(127,29,29,0.60)', 'rgba(225,29,72,0.45)', 'transparent']}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientBlur2}
      />
      
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
          if (!route || !route.key) return null;
          
          const descriptor = descriptors[route.key];
          if (!descriptor) return null;
          
          const { options } = descriptor;
          let label = (typeof options?.title === 'string' ? options.title : route.name) || 'Tab';
          const tabAccessibilityLabel = options.tabBarAccessibilityLabel || `${label} tab`;

          // Check if this route is focused
          const isFocused = state.routes[state.index]?.key === route.key;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const getIconName = (routeName: string, focused: boolean): keyof typeof Ionicons.glyphMap => {
            if (!routeName || typeof routeName !== 'string') return 'alert-circle-outline';
            
            // Use filled versions when focused, outline when not focused
            if (focused) {
              switch (routeName) {
                case 'home': return 'home';
                default: return 'alert-circle';
              }
            } else {
              switch (routeName) {
                case 'home': return 'home-outline';
                default: return 'alert-circle-outline';
              }
            }
          };

          const iconName = getIconName(route.name, isFocused);

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={tabAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabButton}
              onLayout={(event) => {
                // Store the layout of each tab for the animated indicator
                const { x, width } = event.nativeEvent.layout;
                setTabLayouts((prev) => ({ ...prev, [route.key]: { x, width } }));
              }}
            >
              <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
                <TabBarIcon 
                  name={iconName} 
                  color={isFocused ? MIKADO_YELLOW : TEXT_COLOR}
                  size={isFocused ? ICON_SIZE + 3 : ICON_SIZE}
                />
              </View>
              <Text style={[
                styles.tabLabel, 
                { 
                  color: isFocused ? FOCUSED_TEXT_COLOR : TEXT_COLOR,
                  fontWeight: isFocused ? '800' : '500',
                  fontSize: isFocused ? 12 : 11,
                  opacity: isFocused ? 1 : 0.7,
                }
              ]}>
                {typeof label === 'string' ? label.charAt(0).toUpperCase() + label.slice(1) : 'Tab'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  backgroundBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#020617', // slate-950
  },
  gradientOverlay1: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.7,
  },
  gradientMaroon1: {
    position: 'absolute',
    bottom: -height * 0.3,
    left: -width * 0.2,
    width: width * 0.8,
    height: height * 0.8,
    opacity: 0.7,
  },
  gradientYellow1: {
    position: 'absolute',
    top: -height * 0.2,
    right: -width * 0.15,
    width: width * 0.7,
    height: height * 0.7,
    opacity: 0.7,
  },
  gradientBlur1: {
    position: 'absolute',
    top: -height * 0.3,
    right: -width * 0.15,
    width: width * 1.2,
    height: height * 0.8,
    opacity: 0.8,
  },
  gradientBlur2: {
    position: 'absolute',
    bottom: -height * 0.4,
    left: -width * 0.2,
    width: width * 1.2,
    height: height * 1.0,
    opacity: 0.7,
  },
  tabBar: {
    flexDirection: 'row',
    height: BASE_TAB_BAR_HEIGHT, 
    width: '100%',
    backgroundColor: 'transparent', // Changed to transparent to show gradients
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    zIndex: 10, // Ensure tab bar content is above gradients
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    height: '100%',
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 3,
    fontWeight: '500',
  },
});

export default CustomTabBar;

