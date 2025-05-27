import React from 'react';
import { View, TouchableOpacity, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

interface CustomHeaderProps {
  title?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  showNotification?: boolean;
}

const CustomHeader: React.FC<CustomHeaderProps> = ({ 
  title = "Wildcat Radio", 
  showBackButton = false, 
  onBackPress, 
  showNotification = true 
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  const handleNotificationPress = () => {
    console.log('Notification icon pressed');
  };

  return (
    <View
      style={{
        paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + 10,
        paddingBottom: 12,
        paddingHorizontal: 16,
      }}
      className="bg-cordovan flex-row justify-between items-center border-b border-gray-700 shadow-sm"
    >
      {/* Left side - Back button */}
      {showBackButton && (
        <TouchableOpacity 
          onPress={handleBackPress} 
          className="p-2 active:opacity-70"
        >
          <Ionicons name="chevron-back" size={24} color="white" />
        </TouchableOpacity>
      )}
      
      {/* Center - Title */}
      <View className="flex-1 items-center justify-center">
        <Text className="text-white text-xl font-bold">
          {title}
        </Text>
      </View>
      
      {/* Right side spacer to balance layout when no notification */}
      {!showNotification && <View style={{ width: 48 }} />}

      {/* Right side - Notification button */}
      {showNotification && (
        <TouchableOpacity onPress={handleNotificationPress} className="p-2 active:opacity-70">
          <Ionicons name="notifications-outline" size={26} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
};

// StyleSheet.create removed as styles.logo is no longer used

export default CustomHeader; 