import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useNavigation } from 'expo-router';
import { getAuthToken } from '@/services/api';

export default function Index() {
  const navigation = useNavigation();
  
  useEffect(() => {
    // Check if user is already logged in
    async function checkAuthAndRedirect() {
      try {
        const token = await getAuthToken();
        
        if (token) {
          // User is logged in, go to main app
          // @ts-ignore - Ignoring TypeScript here as we know this is valid
          navigation.navigate('(tabs)');
        } else {
          // User is not logged in, go to login
          // @ts-ignore - Ignoring TypeScript here as we know this is valid
          navigation.navigate('login');
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        // Default to login on error
        // @ts-ignore - Ignoring TypeScript here as we know this is valid
        navigation.navigate('login');
      }
    }
    
    checkAuthAndRedirect();
  }, [navigation]);
  
  // Show a loading indicator while checking auth state
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#181a20' }}>
      <ActivityIndicator size="large" color="#6c5ce7" />
    </View>
  );
} 