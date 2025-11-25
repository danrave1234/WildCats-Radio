import React, { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ActivityIndicator, View, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '../components/ErrorBoundary';
import { websocketService } from '../services/websocketService';

const InitialLayout = () => {
  const { authToken, isLoading } = useAuth();
  const segments = useSegments(); // e.g. [], ['welcome'], ['(auth)', 'login'], ['(tabs)', 'broadcast']
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const currentRoute = segments.join('/') || '/'; // e.g. "/", "welcome", "auth/login", "(tabs)/broadcast"

    // Check if the current route is an auth-related route (exclude welcome)
    const isAuthRoute = currentRoute === 'auth/login' || 
                        currentRoute === 'auth/signup' ||
                        currentRoute === 'auth/forgot-password';

    // Check if the current route is a tab route
    const isTabRoute = currentRoute.startsWith('(tabs)');

    // If the user becomes authenticated while on an auth route, send them to Profile
    // This prevents staying on a blank/transitioning auth screen after login
    if (authToken && isAuthRoute) {
      router.replace('/(tabs)/profile');
      return;
    }

    // Default landing route: show Welcome screen on app start (for WS warm-up)
    if (currentRoute === '/' || (!isTabRoute && !isAuthRoute && currentRoute !== 'welcome')) {
      router.replace('/welcome');
      return;
    }

    // If user is on an auth route, allow them to stay there
    if (isAuthRoute || currentRoute === 'welcome') {
      return;
    }

    // For authenticated users on tab routes, they can access everything
    // For non-authenticated users on tab routes, they can still access but with limited features
    // No redirect needed - let them stay where they are
  }, [authToken, isLoading, segments, router]);

  // Connect a lightweight global WS for public announcements (no auth needed)
  useEffect(() => {
    websocketService.connect(0, '');
    return () => websocketService.disconnect();
  }, []);

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
    <SafeAreaProvider>
      <ErrorBoundary>
        <GestureHandlerRootView style={{ 
          flex: 1, 
          backgroundColor: '#F5F5F5',
          minHeight: '100%' // Ensure full height coverage
        }}>
          {/* Background overlay to prevent content bleeding through system UI */}
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#F5F5F5',
            zIndex: -1, // Behind content but above system UI
          }} />
          <AuthProvider>
              <InitialLayout />
          </AuthProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
};

export default RootLayout;