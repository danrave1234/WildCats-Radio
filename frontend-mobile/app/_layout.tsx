import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Slot, Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ApiProvider, getAuthToken } from '@/services/api';
import BottomNavigationView from '@/components/ui/BottomNavigationView';
import TopBar from '@/components/ui/TopBar';
import { View, Alert } from 'react-native';

// Authentication context
import { createContext, useContext } from 'react';
import React from 'react';

type AuthContextType = {
  isLoggedIn: boolean;
  setIsLoggedIn: (value: boolean) => void;
};

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  setIsLoggedIn: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// Root layout with auth protection
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Check for authentication token on startup
  useEffect(() => {
    async function checkAuth() {
      try {
        const token = await getAuthToken();
        setIsLoggedIn(!!token);
      } catch (error) {
        console.error('Error checking auth:', error);
        setIsLoggedIn(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, []);

  const handleNotificationPress = () => {
    Alert.alert('Notifications', 'You have new notifications!');
  };

  // We'll let the login and home screens handle their own navigation
  // This simplifies our routing logic and avoids TypeScript issues

  if (!loaded || isLoading) {
    // Async font loading or auth check in progress
    return null;
  }

  return (
    <AuthContext.Provider value={{ isLoggedIn, setIsLoggedIn }}>
      <ApiProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <View style={{ flex: 1 }}>
            <TopBar 
              hideOnScreens={['/login']} 
              onNotificationPress={handleNotificationPress} 
            />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="auto" />
            <BottomNavigationView hideOnScreens={['/login']} />
          </View>
        </ThemeProvider>
      </ApiProvider>
    </AuthContext.Provider>
  );
}
