import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Dimensions, Platform, Animated, Easing } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 90 : 70;
const ICON_SIZE = 24;
const FOCUSED_ICON_CONTAINER_SIZE = 56;
const CORDOVAN_COLOR = '#91403E'; // From your tailwind config
const MIKADO_YELLOW = '#FFC30B'; // Yellow from logo
const TEXT_COLOR = '#E9ECEC'; // Light text for dark background
const FOCUSED_TEXT_COLOR = MIKADO_YELLOW;
const INDICATOR_COLOR = '#FFD700'; // Brighter yellow for the indicator

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
  isBroadcastListening?: boolean;
}

const CustomTabBar: React.FC<CustomTabBarProps> = ({ state, descriptors, navigation, isNotificationOpen = false, isBroadcastListening = false }) => {
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
  
  // Check if current tab is the broadcast tab
  const isBroadcastSelected = currentRoute && currentRoute.name === 'broadcast';
  
  // Hide tab bar if tabBarStyle has display: 'none'
  if (tabBarStyle && typeof tabBarStyle === 'object' && 'display' in tabBarStyle && tabBarStyle.display === 'none') {
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
    
    // Handle broadcast tab special case
    const isCurrentBroadcast = state.routes[state.index]?.name === 'broadcast';
    
    // Set opacity based on whether broadcast is selected (no animation)
    underlineOpacity.setValue(isCurrentBroadcast ? 0 : 1); // Hide when broadcast is selected
    
    // Only update position if it's not the broadcast tab
    if (!isCurrentBroadcast) {
      const currentTabLayout = tabLayouts[currentRouteKey];
      if (currentTabLayout && currentTabLayout.width > 0) {
        // Set position directly without animation
        underlinePosition.setValue(currentTabLayout.x);
        underlineWidth.setValue(currentTabLayout.width);
        if (!isInitialLayoutDone) {
          setIsInitialLayoutDone(true);
        }
      }
    }
  }, [state?.index, tabLayouts, underlinePosition, underlineWidth, underlineOpacity, isInitialLayoutDone]);

  // Effect to handle tab bar hide/show animation based on notification or broadcast state
  useEffect(() => {
    // Priority: notification takes precedence over broadcast listening
    if (isNotificationOpen) {
      // Hide tab bar by sliding down for notifications - faster to sync with notification opening
      Animated.timing(tabBarTranslateY, {
        toValue: TAB_BAR_HEIGHT + 20, // Move down by tab bar height plus some extra
        duration: 250, // Faster animation to sync with notification
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (isBroadcastListening) {
      // Hide tab bar by sliding down for broadcast tune-in - slower animation to match screen transition
      Animated.timing(tabBarTranslateY, {
        toValue: TAB_BAR_HEIGHT + 20, // Move down by tab bar height plus some extra
        duration: 500, // Slower animation to match broadcast screen transition
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      // Show tab bar by sliding up - use moderate speed that works well for both scenarios
      // Add a small delay when coming back from broadcast to coordinate with header animation
      const delay = isBroadcastSelected ? 200 : 0; // Delay only when coming back from broadcast
      
      setTimeout(() => {
        Animated.timing(tabBarTranslateY, {
          toValue: 0,
          duration: 350, // Balanced duration that works well for both notification and broadcast returns
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }, delay);
    }
  }, [isNotificationOpen, isBroadcastListening, tabBarTranslateY, isBroadcastSelected]);

  return (
    <Animated.View style={[styles.container, animatedStyle, {
      transform: [{ translateY: tabBarTranslateY }]
    }]}>
      <View style={styles.tabBar}>
        {/* Animated Line Indicator - Placed at top of container */}
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            height: 4,
            backgroundColor: INDICATOR_COLOR,
            left: underlinePosition,
            width: underlineWidth,
            borderBottomLeftRadius: 4,
            borderBottomRightRadius: 4,
            zIndex: 10, // Ensure it's above other elements
            shadowColor: INDICATOR_COLOR,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.4,
            shadowRadius: 2,
            elevation: 3,
            opacity: underlineOpacity, // Fade out when broadcast is selected
          }}
        />
        
        {state.routes.map((route, index) => {
          if (!route || !route.key) return null;
          
          const descriptor = descriptors[route.key];
          if (!descriptor) return null;
          
          const { options } = descriptor;
          const label = (typeof options?.title === 'string' ? options.title : route.name) || 'Tab';
          const tabAccessibilityLabel = options.tabBarAccessibilityLabel || `${label} tab`;

          const isFocused = state.index === index;

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
            
            // Always use outline versions for a consistent outline style
            switch (routeName) {
              case 'home': return 'home-outline';
              case 'list': return 'list-outline';
              case 'broadcast': return 'radio-outline';
              case 'schedule': return 'calendar-outline';
              case 'profile': return 'person-circle-outline';
              default: return 'alert-circle-outline';
            }
          };

          const iconName = getIconName(route.name, isFocused);

          if (route.name === 'broadcast') {
            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={tabAccessibilityLabel}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.centerTabButton}
              >
                <View style={styles.centerIconContainer}>
                  {/* Solid background overlay to prevent seeing through */}
                  <View style={styles.innerShadow} />
                  {/* Radio icon on top */}
                  <TabBarIcon name={iconName} size={ICON_SIZE + 10} color={MIKADO_YELLOW} />
                </View>
              </TouchableOpacity>
            );
          }

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
              <TabBarIcon name={iconName} color={isFocused ? MIKADO_YELLOW : TEXT_COLOR} />
              <Text style={[styles.tabLabel, { color: isFocused ? FOCUSED_TEXT_COLOR : TEXT_COLOR }]}>
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
    height: TAB_BAR_HEIGHT,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'flex-end', // Align tabBar to bottom of container
  },
  tabBar: {
    flexDirection: 'row',
    height: Platform.OS === 'ios' ? 70 : 60, 
    width: '100%', // Full width
    backgroundColor: CORDOVAN_COLOR, // Changed to cordovan background
    borderRadius: 0, // Remove rounded corners
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 0, // Remove bottom margin
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 10, // Increased elevation for more pronounced shadow
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    height: '100%',
  },
  centerTabButton: {
    width: FOCUSED_ICON_CONTAINER_SIZE + 14, 
    height: FOCUSED_ICON_CONTAINER_SIZE + 14,
    alignItems: 'center',
    justifyContent: 'center', 
    marginTop: Platform.OS === 'ios' ? -45 : -40, // Adjusted for better visual lift
  },
  centerIconContainer: {
    width: FOCUSED_ICON_CONTAINER_SIZE,
    height: FOCUSED_ICON_CONTAINER_SIZE,
    borderRadius: FOCUSED_ICON_CONTAINER_SIZE / 2,
    backgroundColor: CORDOVAN_COLOR, // Matching the tab bar background
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: MIKADO_YELLOW, // Yellow shadow outline
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 2,
    borderColor: MIKADO_YELLOW, // Yellow border for stronger outline
    // Inner shadow effect to make it look solid
    overflow: 'hidden', // Ensure the inner shadow doesn't leak outside
  },
  innerShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: FOCUSED_ICON_CONTAINER_SIZE / 2 - 2, // Account for the borderWidth
    backgroundColor: CORDOVAN_COLOR, // Match the background color
    opacity: 0.9, // Slightly see-through to allow icon to be visible
    // Add a shadow on the inside
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  tabLabel: {
    fontSize: 11, // Slightly larger label
    marginTop: 3, // Space between icon and label
    fontWeight: '500',
  },
});

export default CustomTabBar; 