import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const BASE_TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 70 : 60;
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
  // Safe area insets
  const insets = useSafeAreaInsets();
  
  const [tabLayouts, setTabLayouts] = useState<Record<string, { x: number; width: number } | undefined>>({});
  const [underlinePosition, setUnderlinePosition] = useState(0);
  const [underlineWidth, setUnderlineWidth] = useState(0);
  const [underlineVisible, setUnderlineVisible] = useState(true);

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

    const isCurrentBroadcast = state.routes[state.index]?.name === 'broadcast';
    setUnderlineVisible(!isCurrentBroadcast);

    if (!isCurrentBroadcast) {
      const currentTabLayout = tabLayouts[currentRouteKey];
      if (currentTabLayout && currentTabLayout.width > 0) {
        setUnderlinePosition(currentTabLayout.x);
        setUnderlineWidth(currentTabLayout.width);
      }
    }
  }, [state, tabLayouts]);

  // Keep the tab bar always visible. Previously, when `isBroadcastListening` was true,
  // we translated the bar down by its own height which effectively hid it off‑screen.
  // That caused the navbar to disappear while listening live. We now keep offset at 0.
  const tabBarOffset = 0;

  return (
    <View style={[styles.container, animatedStyle, {
      transform: [{ translateY: tabBarOffset }],
      paddingBottom: insets.bottom,
    }]}> 
      {/* Solid background behind the tab bar area */}
      <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: CORDOVAN_COLOR,
        zIndex: -1,
      }} />
      <View style={styles.tabBar}>
        
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
              case 'home': return 'megaphone-outline'; // Announcements icon
              case 'broadcast': return 'radio-outline'; // Listen icon
              case 'schedule': return 'calendar-outline';
              case 'profile': return 'person-circle-outline';
              case 'list': return 'time-outline'; // History icon for past broadcasts
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
        {underlineVisible && (
          <View
            style={[
              styles.indicator,
              {
                left: underlinePosition,
                width: underlineWidth,
                opacity: underlineVisible ? 1 : 0,
              },
            ]}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative', // participate in layout so content never sits under the navbar
    width: '100%',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  tabBar: {
    flexDirection: 'row',
    height: BASE_TAB_BAR_HEIGHT, 
    width: '100%', // Full width
    backgroundColor: CORDOVAN_COLOR, // Changed to cordovan background
    borderRadius: 0, // Remove rounded corners
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 0, // Remove bottom margin
    shadowColor: 'transparent', // Remove shadow for seamless blend
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0, // Remove elevation for seamless blend
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
    marginTop: Platform.OS === 'ios' ? -25 : -20, // Further reduced lift to move tab bar down more
  },
  centerIconContainer: {
    width: FOCUSED_ICON_CONTAINER_SIZE,
    height: FOCUSED_ICON_CONTAINER_SIZE,
    borderRadius: FOCUSED_ICON_CONTAINER_SIZE / 2,
    backgroundColor: CORDOVAN_COLOR, // Matching the tab bar background
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    borderWidth: 2,
    borderColor: MIKADO_YELLOW, // Yellow border for stronger outline
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
  indicator: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    backgroundColor: INDICATOR_COLOR,
    borderRadius: 2,
  },
});

export default CustomTabBar; 