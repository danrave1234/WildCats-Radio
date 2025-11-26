import React from 'react';
import { Stack } from 'expo-router';

const AuthStackLayout = () => (
  <Stack
    screenOptions={{
      headerShown: true,
      headerTitle: '',
      headerBackTitleVisible: false,
      headerShadowVisible: false,
      headerTintColor: '#91403E',
    }}
  >
    <Stack.Screen name="login" options={{ headerShown: false }} />
    <Stack.Screen name="signup" options={{ headerTitle: 'Sign Up' }} />
    <Stack.Screen name="forgot-password" options={{ headerTitle: 'Forgot Password' }} />
  </Stack>
);

export default AuthStackLayout;