import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Platform, Text, View, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { broadcastService, authService, serverService } from '../../services/api';
import { useColorScheme } from '../../hooks/useColorScheme';

export default function DashboardScreen() {
  const { currentUser } = useAuth();
  const [userRole, setUserRole] = useState('LISTENER');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDJs: 0,
    totalListeners: 0,
    totalBroadcasts: 0,
    activeBroadcasts: 0,
    scheduledBroadcasts: 0,
    serverStatus: 'Offline'
  });
  const [liveBroadcasts, setLiveBroadcasts] = useState([]);
  const [upcomingBroadcasts, setUpcomingBroadcasts] = useState([]);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    if (currentUser) {
      setUserRole(currentUser.role);
      loadDashboardData();
    }
  }, [currentUser]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch live broadcasts
      const liveResponse = await broadcastService.getLive();
      const liveData = liveResponse?.data || [];
      setLiveBroadcasts(liveData);

      // Fetch upcoming broadcasts
      const upcomingResponse = await broadcastService.getUpcoming();
      const upcomingData = upcomingResponse?.data || [];
      setUpcomingBroadcasts(upcomingData);

      // Update stats based on user role
      if (userRole === 'ADMIN') {
        try {
          // Admin stats
          const usersResponse = await authService.getAllUsers();
          const users = usersResponse?.data || [];
          const djCount = users.filter(user => user?.role === 'DJ').length;
          const listenerCount = users.filter(user => user?.role === 'LISTENER').length;

          // Server status
          let serverRunning = false;
          try {
            const serverStatusResponse = await serverService.getStatus();
            serverRunning = !!serverStatusResponse?.data;
          } catch (serverError) {
            console.error('Error fetching server status:', serverError);
          }

          setStats({
            totalUsers: users.length,
            totalDJs: djCount,
            totalListeners: listenerCount,
            totalBroadcasts: liveData.length + upcomingData.length,
            activeBroadcasts: liveData.length,
            scheduledBroadcasts: upcomingData.length,
            serverStatus: serverRunning ? 'Online' : 'Offline'
          });
        } catch (adminError) {
          console.error('Error loading admin-specific data:', adminError);
          // Fallback to basic stats
          setStats({
            totalUsers: 0,
            totalDJs: 0,
            totalListeners: 0,
            totalBroadcasts: liveData.length + upcomingData.length,
            activeBroadcasts: liveData.length,
            scheduledBroadcasts: upcomingData.length,
            serverStatus: 'Unknown'
          });
        }
      } else {
        // DJ and Listener stats
        setStats({
          activeBroadcasts: liveData.length,
          scheduledBroadcasts: upcomingData.length
        });
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const renderAdminDashboard = () => (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <ThemedView style={styles.header}>
        <ThemedText type="title">Admin Dashboard</ThemedText>
      </ThemedView>

      <ThemedView style={styles.statsContainer}>
        <ThemedText type="subtitle">System Overview</ThemedText>

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: isDark ? '#1E3A8A' : '#EFF6FF' }]}>
            <ThemedText style={styles.statLabel}>Total Users</ThemedText>
            <ThemedText style={styles.statValue}>{stats.totalUsers}</ThemedText>
          </View>

          <View style={[styles.statCard, { backgroundColor: isDark ? '#5B21B6' : '#F5F3FF' }]}>
            <ThemedText style={styles.statLabel}>Total DJs</ThemedText>
            <ThemedText style={styles.statValue}>{stats.totalDJs}</ThemedText>
          </View>

          <View style={[styles.statCard, { backgroundColor: isDark ? '#065F46' : '#ECFDF5' }]}>
            <ThemedText style={styles.statLabel}>Total Broadcasts</ThemedText>
            <ThemedText style={styles.statValue}>{stats.totalBroadcasts}</ThemedText>
          </View>
        </View>

        <ThemedView style={styles.statusContainer}>
          <ThemedText type="subtitle">System Status</ThemedText>

          <View style={styles.statusRow}>
            <ThemedText>Active Broadcasts</ThemedText>
            <View style={[styles.badge, { backgroundColor: isDark ? '#064E3B' : '#D1FAE5' }]}>
              <Text style={{ color: isDark ? '#ECFDF5' : '#065F46' }}>{stats.activeBroadcasts} Active</Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            <ThemedText>Scheduled Broadcasts</ThemedText>
            <View style={[styles.badge, { backgroundColor: isDark ? '#1E3A8A' : '#DBEAFE' }]}>
              <Text style={{ color: isDark ? '#EFF6FF' : '#1E40AF' }}>{stats.scheduledBroadcasts} Scheduled</Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            <ThemedText>Server Status</ThemedText>
            <View style={[styles.badge, { 
              backgroundColor: stats.serverStatus === 'Online' 
                ? (isDark ? '#064E3B' : '#D1FAE5') 
                : (isDark ? '#7F1D1D' : '#FEE2E2') 
            }]}>
              <Text style={{ 
                color: stats.serverStatus === 'Online' 
                  ? (isDark ? '#ECFDF5' : '#065F46')
                  : (isDark ? '#FEE2E2' : '#7F1D1D')
              }}>{stats.serverStatus}</Text>
            </View>
          </View>
        </ThemedView>
      </ThemedView>

      {liveBroadcasts.length > 0 && (
        <ThemedView style={styles.broadcastsContainer}>
          <ThemedText type="subtitle">Live Broadcasts</ThemedText>
          {liveBroadcasts.map(broadcast => broadcast && (
            <View key={broadcast.id || `live-${Math.random()}`} style={styles.broadcastCard}>
              <View style={styles.broadcastHeader}>
                <ThemedText style={styles.broadcastTitle}>{broadcast.title || 'Untitled Broadcast'}</ThemedText>
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>LIVE</Text>
                </View>
              </View>
              <ThemedText>DJ: {broadcast.createdBy?.name || 'Unknown'}</ThemedText>
              {broadcast.description && (
                <ThemedText style={styles.broadcastDescription}>{broadcast.description}</ThemedText>
              )}
            </View>
          ))}
        </ThemedView>
      )}
    </ScrollView>
  );

  const renderDJDashboard = () => (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <ThemedView style={styles.header}>
        <ThemedText type="title">DJ Dashboard</ThemedText>
      </ThemedView>

      <ThemedView style={styles.broadcastsContainer}>
        <ThemedText type="subtitle">Your Broadcasts</ThemedText>

        {liveBroadcasts.length > 0 ? (
          liveBroadcasts.map(broadcast => broadcast && (
            <View key={broadcast.id || `dj-live-${Math.random()}`} style={styles.broadcastCard}>
              <View style={styles.broadcastHeader}>
                <ThemedText style={styles.broadcastTitle}>{broadcast.title || 'Untitled Broadcast'}</ThemedText>
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>LIVE</Text>
                </View>
              </View>
              {broadcast.description && (
                <ThemedText style={styles.broadcastDescription}>{broadcast.description}</ThemedText>
              )}
              <View style={styles.broadcastActions}>
                <TouchableOpacity 
                  style={[styles.button, styles.primaryButton]}
                  onPress={() => {/* Navigate to broadcast detail */}}
                >
                  <Text style={styles.buttonText}>Manage</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.button, styles.secondaryButton]}
                  onPress={() => {/* End broadcast */}}
                >
                  <Text style={styles.secondaryButtonText}>End</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <ThemedText>No active broadcasts</ThemedText>
            <TouchableOpacity 
              style={[styles.button, styles.primaryButton, styles.fullWidthButton]}
              onPress={() => {/* Navigate to create broadcast */}}
            >
              <Text style={styles.buttonText}>Start New Broadcast</Text>
            </TouchableOpacity>
          </View>
        )}
      </ThemedView>

      <ThemedView style={styles.broadcastsContainer}>
        <ThemedText type="subtitle">Upcoming Broadcasts</ThemedText>

        {upcomingBroadcasts.length > 0 ? (
          upcomingBroadcasts.map(broadcast => broadcast && (
            <View key={broadcast.id || `dj-upcoming-${Math.random()}`} style={styles.broadcastCard}>
              <ThemedText style={styles.broadcastTitle}>{broadcast.title || 'Untitled Broadcast'}</ThemedText>
              <ThemedText>
                {broadcast.scheduledStart ? 
                  `${new Date(broadcast.scheduledStart).toLocaleDateString()} at ${new Date(broadcast.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 
                  'Schedule not specified'}
              </ThemedText>
              {broadcast.description && (
                <ThemedText style={styles.broadcastDescription}>{broadcast.description}</ThemedText>
              )}
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <ThemedText>No upcoming broadcasts</ThemedText>
            <TouchableOpacity 
              style={[styles.button, styles.primaryButton, styles.fullWidthButton]}
              onPress={() => {/* Navigate to schedule broadcast */}}
            >
              <Text style={styles.buttonText}>Schedule Broadcast</Text>
            </TouchableOpacity>
          </View>
        )}
      </ThemedView>
    </ScrollView>
  );

  const renderListenerDashboard = () => (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <ThemedView style={styles.header}>
        <ThemedText type="title">Listener Dashboard</ThemedText>
      </ThemedView>

      <ThemedView style={styles.heroContainer}>
        {liveBroadcasts.length > 0 ? (
          <>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot}></View>
              <Text style={styles.liveText}>LIVE NOW</Text>
            </View>
            <ThemedText type="subtitle">WildCats Radio</ThemedText>
            <ThemedText>Tune in now to the live broadcast!</ThemedText>
            <TouchableOpacity 
              style={[styles.button, styles.primaryButton, styles.fullWidthButton, styles.marginTop]}
              onPress={() => {/* Navigate to live broadcast */}}
            >
              <Text style={styles.buttonText}>Listen Now</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.offlineIndicator}>
              <Text style={styles.offlineText}>OFF AIR</Text>
            </View>
            <ThemedText type="subtitle">WildCats Radio</ThemedText>
            <ThemedText>No broadcast currently active</ThemedText>
            {upcomingBroadcasts.length > 0 && upcomingBroadcasts[0] && (
              <ThemedText style={styles.upcomingText}>
                Next broadcast: {upcomingBroadcasts[0].title || 'Untitled Broadcast'}
                {upcomingBroadcasts[0].scheduledStart ? 
                  ` on ${new Date(upcomingBroadcasts[0].scheduledStart).toLocaleDateString()} at ${new Date(upcomingBroadcasts[0].scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 
                  ' (schedule not specified)'}
              </ThemedText>
            )}
          </>
        )}
      </ThemedView>

      <ThemedView style={styles.broadcastsContainer}>
        <ThemedText type="subtitle">Recent Broadcasts</ThemedText>

        {upcomingBroadcasts.length > 0 ? (
          upcomingBroadcasts.map(broadcast => broadcast && (
            <View key={broadcast.id || `listener-recent-${Math.random()}`} style={styles.broadcastCard}>
              <ThemedText style={styles.broadcastTitle}>{broadcast.title || 'Untitled Broadcast'}</ThemedText>
              <ThemedText>
                {broadcast.scheduledStart ? 
                  `${new Date(broadcast.scheduledStart).toLocaleDateString()} at ${new Date(broadcast.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 
                  'Schedule not specified'}
              </ThemedText>
              {broadcast.description && (
                <ThemedText style={styles.broadcastDescription}>{broadcast.description}</ThemedText>
              )}
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <ThemedText>No recent broadcasts</ThemedText>
          </View>
        )}
      </ThemedView>
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7F1D1D" />
        <ThemedText style={styles.loadingText}>Loading dashboard...</ThemedText>
      </View>
    );
  }

  // Render dashboard based on user role
  if (userRole === 'ADMIN') {
    return renderAdminDashboard();
  } else if (userRole === 'DJ') {
    return renderDJDashboard();
  } else {
    return renderListenerDashboard();
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 16,
  },
  statsContainer: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  statCard: {
    width: '31%',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statusContainer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  broadcastsContainer: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  broadcastCard: {
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  broadcastHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  broadcastTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  broadcastDescription: {
    marginTop: 8,
  },
  liveBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  broadcastActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  primaryButton: {
    backgroundColor: '#7F1D1D',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  secondaryButtonText: {
    color: '#7F1D1D',
    fontWeight: 'bold',
  },
  fullWidthButton: {
    marginLeft: 0,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
  },
  heroContainer: {
    padding: 24,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    marginRight: 6,
  },
  liveText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  offlineIndicator: {
    backgroundColor: '#6B7280',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
  },
  offlineText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  upcomingText: {
    marginTop: 8,
    fontSize: 12,
  },
  marginTop: {
    marginTop: 16,
  },
});
