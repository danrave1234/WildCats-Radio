import React from 'react';
import { Tabs } from 'expo-router';
import CustomTabBar from '../../components/navigation/CustomTabBar';
import CustomHeader from '../../components/navigation/CustomHeader';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: true,
        header: (props) => <CustomHeader {...props} />,
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="list" />
      <Tabs.Screen name="broadcast" />
      <Tabs.Screen name="schedule" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
