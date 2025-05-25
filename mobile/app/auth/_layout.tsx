import React from 'react';
import { Stack } from 'expo-router';

const AuthStackLayout: React.FC = () => {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 250,
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      {/* <Stack.Screen name="forgot-password" /> */}
      {/* Add other auth screens here that are direct children of the 'auth' folder */}
    </Stack>
  );
};

export default AuthStackLayout; 