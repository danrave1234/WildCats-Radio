import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ColorPalette } from '@/constants/ColorPalette';
//pushing
export interface TopBarProps {
  hideOnScreens?: string[];
  onNotificationPress?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ 
  hideOnScreens = ['/login'],
  onNotificationPress
}) => {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  
  // Hide on specified screens
  if (hideOnScreens.some(screen => pathname === screen || pathname.startsWith(screen))) {
    return null;
  }

  return (
    <View style={[
      styles.container,
      { paddingTop: insets.top > 0 ? insets.top : 10 }
    ]}>
      <StatusBar
        barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
        backgroundColor={ColorPalette.cordovan.DEFAULT}
      />
      <View style={styles.content}>
        <View style={styles.spacer} />
        
        <TouchableOpacity 
          style={styles.notificationButton}
          onPress={onNotificationPress}
          activeOpacity={0.7}
        >
          <View style={styles.notificationDot} />
          <Ionicons name="notifications-outline" size={24} color={ColorPalette.white.DEFAULT} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: ColorPalette.cordovan.DEFAULT,
    width: '100%',
    zIndex: 100,
    elevation: 4,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  spacer: {
    flex: 1,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ColorPalette.cordovan[400],
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ColorPalette.mikadoYellow.DEFAULT,
    borderWidth: 1,
    borderColor: ColorPalette.cordovan.DEFAULT,
    zIndex: 1,
  }
});

export default TopBar; 