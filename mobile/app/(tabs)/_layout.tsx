import React, { useState, createContext, useContext } from 'react';
import { Tabs } from 'expo-router';
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
    <Tabs
          tabBar={(props) => <CustomTabBar {...props} isNotificationOpen={isNotificationOpen} isBroadcastListening={isBroadcastListening} />}
      screenOptions={{
        headerShown: true,
            header: () => <CustomHeader onNotificationStateChange={handleNotificationStateChange} />,
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="list" />
      <Tabs.Screen name="broadcast" />
      <Tabs.Screen name="schedule" />
      <Tabs.Screen name="profile" />
    </Tabs>
      </BroadcastContext.Provider>
    </NotificationContext.Provider>
  );
}
