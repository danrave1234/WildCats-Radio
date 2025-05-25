import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 90 : 70;
const ICON_SIZE = 24;
const FOCUSED_ICON_CONTAINER_SIZE = 56;
const CORDOVAN_COLOR = '#91403E'; // From your tailwind config
const ANTI_FLASH_WHITE = '#E9ECEC';
const TEXT_COLOR = '#4b5563'; // gray-600
const FOCUSED_TEXT_COLOR = CORDOVAN_COLOR;

interface TabBarIconProps {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color: string;
}

const TabBarIcon: React.FC<TabBarIconProps> = ({ name, size = ICON_SIZE, color }) => {
  return <Ionicons name={name} size={size} color={color} />;
};

const CustomTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = typeof options.title === 'string' ? options.title : route.name;

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
            switch (routeName) {
              case 'home': return focused ? 'home' : 'home-outline';
              case 'list': return focused ? 'list' : 'list-outline';
              case 'broadcast': return focused ? 'radio' : 'radio-outline';
              case 'schedule': return focused ? 'calendar' : 'calendar-outline';
              case 'profile': return focused ? 'person-circle' : 'person-circle-outline';
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
                accessibilityLabel={options.tabBarAccessibilityLabel}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.centerTabButton}
              >
                <View style={styles.centerIconContainer}>
                    <TabBarIcon name={iconName} size={ICON_SIZE + 10} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabButton}
            >
              <TabBarIcon name={iconName} color={isFocused ? CORDOVAN_COLOR : TEXT_COLOR} />
              <Text style={[styles.tabLabel, { color: isFocused ? FOCUSED_TEXT_COLOR : TEXT_COLOR }]}>
                {label.charAt(0).toUpperCase() + label.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
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
    width: '92%', // Slightly wider
    backgroundColor: ANTI_FLASH_WHITE,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: Platform.OS === 'ios' ? 10 : 10, // Spacing from bottom edge
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10, // Increased elevation for more pronounced shadow
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: Platform.OS === 'ios' ? 2 : 0, // Ensure label is visible
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
    backgroundColor: CORDOVAN_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: CORDOVAN_COLOR, // Shadow color matching button
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  tabLabel: {
    fontSize: 11, // Slightly larger label
    marginTop: 3, // Space between icon and label
  },
});

export default CustomTabBar; 