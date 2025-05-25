import React from 'react';
import { View, Text, SafeAreaView, StyleSheet, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'; // For icons

// Dummy Data
const recentBroadcasts = [
  { id: '1', title: 'Morning Commute Mix', date: '2024-07-28', duration: '1:30:00' },
  { id: '2', title: 'Indie Vibes Only', date: '2024-07-27', duration: '2:00:00' },
  { id: '3', title: 'Late Night Chill Hop', date: '2024-07-26', duration: '1:45:00' },
];

const lastLogin = '2024-07-28, 10:00 AM';
const isRadioLive = true; // Can be toggled

const HomeScreen: React.FC = () => {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Dashboard', headerShown: false }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.headerTitle}>Wildcat Radio Dashboard</Text>

        {/* Live Broadcast Indicator */}
        <View style={[styles.card, styles.liveIndicatorCard]}>
          <Text style={styles.cardTitle}>Broadcast Status</Text>
          <View style={styles.liveStatusContainer}>
            <View style={[styles.liveDot, { backgroundColor: isRadioLive ? '#4ade80' : '#f87171' }]} />
            <Text style={styles.liveText}>{isRadioLive ? 'Currently LIVE' : 'Currently OFFLINE'}</Text>
          </View>
        </View>

        {/* Recent Broadcasts */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Broadcasts</Text>
          {recentBroadcasts.map((item) => (
            <View key={item.id} style={styles.broadcastItem}>
              <Ionicons name="musical-notes-outline" size={22} color="#91403E" />
              <View style={styles.broadcastDetails}>
                <Text style={styles.broadcastTitle}>{item.title}</Text>
                <Text style={styles.broadcastMeta}>Date: {item.date} | Duration: {item.duration}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Last Logged In */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Activity</Text>
          <View style={styles.activityItem}>
            <Ionicons name="time-outline" size={22} color="#4f46e5" />
            <Text style={styles.activityText}>Last login: {lastLogin}</Text>
          </View>
        </View>
        
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E9ECEC', // anti-flash_white
  },
  container: {
    padding: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937', // gray-800
    marginBottom: 25,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
  liveIndicatorCard: {
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151', // gray-700
    marginBottom: 15,
  },
  liveStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  liveText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  broadcastItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6', // gray-100
  },
  broadcastDetails: {
    marginLeft: 15,
    flex: 1,
  },
  broadcastTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827', // gray-900
  },
  broadcastMeta: {
    fontSize: 13,
    color: '#6b7280', // gray-500
    marginTop: 3,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityText: {
    fontSize: 15,
    color: '#374151', // gray-700
    marginLeft: 10,
  },
});

export default HomeScreen; 