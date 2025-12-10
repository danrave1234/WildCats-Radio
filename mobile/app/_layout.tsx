import React, { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ActivityIndicator, View, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '../components/ErrorBoundary';
import { websocketService } from '../services/websocketService';
import { useFonts } from 'expo-font';
import { Manrope_200ExtraLight, Manrope_300Light, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { Poppins_100Thin, Poppins_200ExtraLight, Poppins_300Light, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold, Poppins_900Black, Poppins_100Thin_Italic, Poppins_200ExtraLight_Italic, Poppins_300Light_Italic, Poppins_400Regular_Italic, Poppins_500Medium_Italic, Poppins_600SemiBold_Italic, Poppins_700Bold_Italic, Poppins_800ExtraBold_Italic, Poppins_900Black_Italic } from '@expo-google-fonts/poppins';

const InitialLayout = () => {
  const { authToken, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const currentRoute = segments.length > 0 ? segments.join('/') : '/';

    // Check if the current route is an auth-related route
    const isAuthRoute = currentRoute === 'welcome' || 
                        currentRoute === 'auth/login' || 
                        currentRoute === 'auth/signup' ||
                        currentRoute === 'auth/forgot-password';

    // Check if the current route is a tab route
    const isTabRoute = currentRoute.startsWith('(tabs)');

    // If no auth token
    if (!authToken) {
      // Allow user to stay on auth routes (welcome, login, signup, etc.)
      if (isAuthRoute) {
        return;
      }
      // Redirect to welcome for root or tab routes
      if (currentRoute === '/' || isTabRoute) {
        router.replace('/welcome');
        return;
      }
      // For any other route, redirect to welcome
      router.replace('/welcome');
      return;
    }

    // If user is authenticated
    if (authToken) {
      // If on root or welcome, redirect to home tab
      if (currentRoute === '/' || currentRoute === 'welcome') {
        router.replace('/(tabs)/home');
        return;
      }
      // Allow authenticated users to stay on their current route
      return;
    }
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
  const [fontsLoaded] = useFonts({
    Manrope_200ExtraLight,
    Manrope_300Light,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Poppins_100Thin,
    Poppins_200ExtraLight,
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
    Poppins_100Thin_Italic,
    Poppins_200ExtraLight_Italic,
    Poppins_300Light_Italic,
    Poppins_400Regular_Italic,
    Poppins_500Medium_Italic,
    Poppins_600SemiBold_Italic,
    Poppins_700Bold_Italic,
    Poppins_800ExtraBold_Italic,
    Poppins_900Black_Italic,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' }}>
        <ActivityIndicator size="large" color="#8C1D18" />
      </View>
    );
  }

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