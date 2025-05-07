import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Dimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ColorPalette } from '@/constants/ColorPalette';

// Get screen width for responsive design
const screenWidth = Dimensions.get('window').width;

const hapticFeedback = () => {
  if (Platform.OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
};

export interface BottomNavigationViewProps {
  hideOnScreens?: string[];
}

export const BottomNavigationView: React.FC<BottomNavigationViewProps> = ({ 
  hideOnScreens = ['/login'] 
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  
  // Hide on specified screens
  if (hideOnScreens.some(screen => pathname === screen || pathname.startsWith(screen))) {
    return null;
  }

  const navItems = [
    { 
      name: 'Home', 
      icon: 'home-outline', 
      activeIcon: 'home',
      route: '/' 
    },
    { 
      name: 'List', 
      icon: 'list-outline', 
      activeIcon: 'list',
      route: '/list' 
    },
    { 
      name: 'Listen', 
      icon: 'radio-outline', 
      activeIcon: 'radio',
      route: '/listen',
      isLarge: true 
    },
    { 
      name: 'Schedule', 
      icon: 'calendar-outline', 
      activeIcon: 'calendar',
      route: '/schedule' 
    },
    { 
      name: 'Profile', 
      icon: 'person-outline', 
      activeIcon: 'person',
      route: '/profile' 
    }
  ];

  // Helper function to check if we're on the Home route
  const isHomeRoute = (path: string) => {
    // Check for all possible homepage routes
    return path === '/' || 
           path === '/homepage' ||
           path === '/(tabs)' || 
           path === '/(tabs)/homepage' ||
           path.startsWith('/(tabs)/homepage') ||
           path === 'homepage' ||
           path.includes('homepage');
  };

  const renderTab = (item: typeof navItems[0], index: number) => {
    // Determine if the current tab is active
    let isActive = false;
    
    if (item.name === 'Home') {
      isActive = isHomeRoute(pathname);
    } else {
      isActive = pathname === item.route || pathname.startsWith(item.route);
    }
    
    const iconName = isActive ? item.activeIcon : item.icon;
    
    // Define which tabs should use cordovan color when active
    const useCordovanWhenActive = ['Home', 'List', 'Schedule', 'Profile'].includes(item.name);
    
    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.tabItem,
          item.isLarge && styles.largeTabItem,
        ]}
        onPress={() => {
          hapticFeedback();
          // @ts-ignore - Temporarily ignore TypeScript errors for paths
          router.push(item.route);
        }}
        activeOpacity={0.7}
      >
        {item.isLarge ? (
          <View style={styles.largeTabButton}>
            <Ionicons 
              name={iconName as any}
              size={32} 
              color={ColorPalette.white.DEFAULT} 
            />
          </View>
        ) : (
          <>
            <Ionicons 
              name={iconName as any}
              size={24} 
              color={isActive && useCordovanWhenActive ? ColorPalette.cordovan.DEFAULT : ColorPalette.black[600]} 
            />
            <Text 
              style={[
                styles.tabText, 
                isActive && useCordovanWhenActive && styles.activeTabText
              ]}
            >
              {item.name}
            </Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  const Background = Platform.OS === 'ios' ? BlurView : View;
  const blurProps = Platform.OS === 'ios' 
    ? { intensity: 95, tint: 'light' as const } 
    : {};

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <Background style={styles.background} {...blurProps}>
        <View style={styles.contentContainer}>
          {navItems.map(renderTab)}
        </View>
      </Background>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    overflow: 'visible', // Allow content to overflow
  },
  background: {
    overflow: 'visible', // Allow content to overflow
    backgroundColor: Platform.OS === 'ios' 
      ? 'rgba(255, 255, 255, 0.8)' 
      : ColorPalette.antiFlashWhite.DEFAULT,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  contentContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 8,
    overflow: 'visible', // Allow content to overflow
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    overflow: 'visible', // Allow content to overflow
  },
  largeTabItem: {
    marginTop: -40, // Increase negative margin to move circle higher
    zIndex: 10, // Ensure the large button stays on top
    overflow: 'visible', // Allow content to overflow
  },
  largeTabButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: ColorPalette.cordovan.DEFAULT,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  tabText: {
    fontSize: 10,
    marginTop: 2,
    color: ColorPalette.black[600],
  },
  activeTabText: {
    color: ColorPalette.cordovan.DEFAULT,
    fontWeight: 'bold',
  },
});

export default BottomNavigationView; 