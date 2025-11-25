import React, { useState, createContext, useContext } from 'react';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import CustomTabBar from '../../components/navigation/CustomTabBar';
import CustomHeader from '../../components/navigation/CustomHeader';

// Create context for broadcast listening state
interface BroadcastContextType {
  isBroadcastListening: boolean;
  setIsBroadcastListening: (isListening: boolean) => void;
}

// Create context for notification state
interface NotificationContextType {
  isNotificationOpen: boolean;
  setIsNotificationOpen: (isOpen: boolean) => void;
}

const BroadcastContext = createContext<BroadcastContextType | undefined>(undefined);
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useBroadcastContext = () => {
  const context = useContext(BroadcastContext);
  if (!context) {
    throw new Error('useBroadcastContext must be used within BroadcastProvider');
  }
  return context;
};

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider');
  }
  return context;
};

export default function TabLayout() {
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isBroadcastListening, setIsBroadcastListening] = useState(false);

  const handleNotificationStateChange = (isOpen: boolean) => {
    setIsNotificationOpen(isOpen);
  };

  return (
    <NotificationContext.Provider value={{ isNotificationOpen, setIsNotificationOpen }}>
      <BroadcastContext.Provider value={{ isBroadcastListening, setIsBroadcastListening }}>
        {/* Targeted background overlay to prevent content bleeding through system UI */}
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#F5F5F5',
          zIndex: -1, // Behind content but above system UI
        }} />
        <Tabs
          tabBar={(props) => <CustomTabBar {...props} isNotificationOpen={isNotificationOpen} isBroadcastListening={isBroadcastListening} />}
          screenOptions={{
            headerShown: true,
            header: () => <CustomHeader onNotificationStateChange={handleNotificationStateChange} />,
            // Ensure the tab bar never hides when the keyboard opens
            tabBarHideOnKeyboard: false,
            tabBarStyle: {
              backgroundColor: '#91403E', // Ensure tab bar has background
            },
          }}
          initialRouteName="broadcast"
        >
          <Tabs.Screen 
            name="home" 
            options={{
              title: 'News',
              tabBarLabel: 'News',
            }}
          />
          <Tabs.Screen 
            name="schedule" 
            options={{
              title: 'Schedule',
              tabBarLabel: 'Schedule',
            }}
          />
          <Tabs.Screen 
            name="broadcast" 
            options={{
              title: 'Listen',
              tabBarLabel: 'Listen',
            }}
          />
          <Tabs.Screen 
            name="list" 
            options={{
              title: 'History',
              tabBarLabel: 'History',
            }}
          />
          <Tabs.Screen 
            name="profile" 
            options={{
              title: 'Profile',
              tabBarLabel: 'Profile',
            }}
          />
        </Tabs>
      </BroadcastContext.Provider>
    </NotificationContext.Provider>
  );
}