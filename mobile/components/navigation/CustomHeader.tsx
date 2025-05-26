import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

// Logo require removed as it's no longer used
// const logo = require('../../assets/images/wildcat_radio_logo_transparent.png');

interface CustomHeaderProps {
  // You can add props here if needed in the future, e.g., title, notificationCount
}

const CustomHeader: React.FC<CustomHeaderProps> = (props) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleNotificationPress = () => {
    // Navigate to a notifications screen or open a modal/drawer
    // router.push('/notifications');
    console.log('Notification icon pressed');
    // Alert.alert("Notifications", "Notification area pressed."); // Placeholder action
  };

  return (
    <View
      style={{
        paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + 10, // Add more padding for Android status bar
        paddingBottom: 12,
        paddingHorizontal: 16,
      }}
      className="bg-cordovan flex-row justify-end items-center border-b border-gray-700 shadow-sm"
    >
      {/* Image component removed */}
      <TouchableOpacity onPress={handleNotificationPress} className="p-2 active:opacity-70">
        <Ionicons name="notifications-outline" size={26} color="white" />
        {/* Optional: Add a badge for notification count here */}
        {/* <View className="absolute top-1 right-1 bg-red-500 w-2.5 h-2.5 rounded-full border-2 border-white" /> */}
      </TouchableOpacity>
    </View>
  );
};

// StyleSheet.create removed as styles.logo is no longer used

export default CustomHeader; 