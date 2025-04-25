import { Tabs, useRouter, useSegments } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/context/AuthContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, loading, currentUser } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [userRole, setUserRole] = useState('LISTENER');

  useEffect(() => {
    // Check if the user is authenticated
    if (!loading && !isAuthenticated) {
      // Redirect to login if not authenticated
      router.replace('/login');
    } else if (currentUser) {
      // Set user role
      setUserRole(currentUser.role);
    }
  }, [isAuthenticated, loading, currentUser, segments]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
          },
          default: {},
        }),
      }}>
      {/* Dashboard screen based on user role */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />

      {/* Admin-only screens */}
      {userRole === 'ADMIN' && (
        <Tabs.Screen
          name="users"
          options={{
            title: 'Users',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.2.fill" color={color} />,
          }}
        />
      )}

      {/* DJ and Admin screens */}
      {(userRole === 'DJ' || userRole === 'ADMIN') && (
        <Tabs.Screen
          name="broadcasts"
          options={{
            title: 'Broadcasts',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="radio.fill" color={color} />,
          }}
        />
      )}

      {/* Common screens for all users */}
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
