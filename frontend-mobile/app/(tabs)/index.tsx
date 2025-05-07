import React from 'react';
import { StyleSheet, View, Text, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { useNavigation } from 'expo-router';
import AuthExample from '@/components/AuthExample';
import BroadcastsExample from '@/components/BroadcastsExample';
import { useAuth as useAuthApi } from '@/services/api';
import { useAuth as useAppAuth } from '../_layout';

export default function HomeScreen() {
  const navigation = useNavigation();
  const { logout } = useAuthApi();
  const { setIsLoggedIn } = useAppAuth();

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
      setIsLoggedIn(false);
      // @ts-ignore - Ignoring TypeScript here as we know this is valid
      navigation.navigate('login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.container}>
          <Text style={styles.title}>WildCats Radio Mobile</Text>
          <Text style={styles.subtitle}>API Integration Examples</Text>
          
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Authentication</Text>
            <AuthExample />
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Broadcasts</Text>
            <BroadcastsExample />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#25292e',
  },
  scrollView: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#25292e',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#a0a0a0',
    marginBottom: 24,
    textAlign: 'center',
  },
  logoutButton: {
    backgroundColor: '#e74c3c',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 20,
    alignSelf: 'center',
    width: 120,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  section: {
    marginBottom: 30,
    backgroundColor: '#ffffff10',
    borderRadius: 12,
    padding: 16,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
});
