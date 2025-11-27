import { Tabs } from 'expo-router';
import React from 'react';

import CustomTabBar from '@/components/navigation/CustomTabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
        }}
      />
    </Tabs>
  );
}
