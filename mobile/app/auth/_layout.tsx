import { Stack } from 'expo-router';
import React from 'react';

export default function AuthLayout() {
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
      {/* You can add a screen for forgot-password here too if needed */}
      {/* <Stack.Screen name="forgot-password" options={{ headerShown: false }} /> */}
    </Stack>
  );
} 