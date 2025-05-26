import React from 'react';
import { Stack, Tabs } from 'expo-router';

const AuthStackLayout: React.FC = () => {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={() => null}
    >
      <Tabs.Screen name="login" />
      <Tabs.Screen name="signup" />
      {/* <Stack.Screen name="forgot-password" /> */}
      {/* Add other auth screens here that are direct children of the 'auth' folder */}
    </Tabs>
  );
};

export default AuthStackLayout; 