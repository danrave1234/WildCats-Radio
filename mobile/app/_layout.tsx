import React, { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { NotificationProvider } from '../context/NotificationContext';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const InitialLayout = () => {
  const { authToken, isLoading } = useAuth();
  const segments = useSegments(); // e.g. [], ['welcome'], ['(auth)', 'login'], ['(tabs)', 'home']
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const currentRoute = segments.join('/') || '/'; // e.g. "/", "welcome", "auth/login", "(tabs)/home"

    // Check if the current route is an auth-related route
    const isAuthRoute = currentRoute === 'welcome' || 
                        currentRoute === 'auth/login' || 
                        currentRoute === 'auth/signup' ||
                        currentRoute === 'auth/forgot-password';

    if (authToken) {
      // User is authenticated
      if (isAuthRoute || currentRoute === '/') {
        // If on an auth route or the initial splash/loading, redirect to main app
        router.replace('/(tabs)/home'); 
      }
    } else {
      // User is not authenticated
      if (!isAuthRoute && currentRoute !== '/') {
        // If not on an auth route and not on i
        // nitial splash, redirect to welcome
        router.replace('/welcome');
      }
    }
  }, [authToken, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#8C1D18" /> 
      </View>
    );
  }

  return <Slot />;
};

const RootLayout = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <NotificationProvider>
          <InitialLayout />
        </NotificationProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
};

export default RootLayout;
