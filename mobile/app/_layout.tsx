import React, { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ActivityIndicator, View, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '../components/ErrorBoundary';

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
        // If not on an auth route and not on initial splash, redirect to welcome
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