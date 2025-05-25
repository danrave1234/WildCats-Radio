import React from 'react';
import { StyleSheet, View, Text, SafeAreaView, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { ColorPalette } from '@/constants/ColorPalette';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, formatDistance, parseISO } from 'date-fns';
import { useBroadcasts, useChat, useSongRequests, useNotifications, useShoutcast } from '@/services/api';
import { Broadcast } from '@/services/api/types';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // API data hooks using React Query
  const { useLiveBroadcasts, useUpcomingBroadcasts, useAllBroadcasts } = useBroadcasts();
  const { useUserNotifications } = useNotifications();
  const { useServerStatus } = useShoutcast();
  
  // Fetch data from API
  const { data: liveBroadcasts, isLoading: liveBroadcastsLoading } = useLiveBroadcasts();
  const { data: upcomingBroadcasts, isLoading: upcomingBroadcastsLoading } = useUpcomingBroadcasts();
  const { data: recentBroadcasts, isLoading: recentBroadcastsLoading } = useAllBroadcasts();
  const { data: notifications, isLoading: notificationsLoading } = useUserNotifications();
  const { data: serverStatus, isLoading: serverStatusLoading } = useServerStatus();
  
  // Check if any broadcast is currently live
  const isLive = liveBroadcasts && liveBroadcasts.length > 0;
  const currentBroadcast = isLive ? liveBroadcasts[0] : null;
  
  // Get the next upcoming broadcast
  const nextBroadcast = upcomingBroadcasts && upcomingBroadcasts.length > 0 ? upcomingBroadcasts[0] : null;
  
  // Calculate stats
  const upcomingShowsCount = upcomingBroadcasts?.length || 0;
  const unreadNotificationsCount = notifications?.filter(n => !n.read).length || 0;
  
  // Process recent broadcasts for display (limit to last 3)
  const processedRecentBroadcasts = recentBroadcasts?.slice(0, 3).map(broadcast => ({
    id: broadcast.id,
    title: broadcast.title,
    dj: broadcast.dj?.name || 'Unknown DJ',
    date: broadcast.actualStart 
      ? formatDistance(parseISO(broadcast.actualStart), new Date(), { addSuffix: true })
      : formatDistance(parseISO(broadcast.scheduledStart), new Date(), { addSuffix: true })
  })) || [];
  
  // Check if any data is still loading
  const isLoading = liveBroadcastsLoading || upcomingBroadcastsLoading || 
                    recentBroadcastsLoading || notificationsLoading ||
                    serverStatusLoading;
  
  // Calculate bottom padding to avoid tab bar overlap
  const bottomPadding = insets.bottom + 80;

  // Navigate to broadcast details
  const navigateToBroadcast = (broadcastId: number) => {
    // TODO: Create a broadcast details page
    // For now, navigate to schedule page and alert the broadcast ID
    alert(`Viewing broadcast details for ID: ${broadcastId}`);
    router.push('/schedule');
  };

  // Navigate to song request screen
  const navigateToSongRequest = () => {
    if (currentBroadcast) {
      // TODO: Create a song request page
      // For now, navigate to listen page and alert the intention
      alert(`Requesting a song for broadcast: ${currentBroadcast.title}`);
      router.push('/listen');
    } else {
      // Handle case where no broadcast is live
      alert('No broadcast is currently live to request songs for.');
    }
  };

  // Navigate to chat screen
  const navigateToChat = () => {
    if (currentBroadcast) {
      // TODO: Create a chat page
      // For now, navigate to listen page and alert the intention
      alert(`Joining chat for broadcast: ${currentBroadcast.title}`);
      router.push('/listen');
    } else {
      // Handle case where no broadcast is live
      alert('No broadcast is currently live to chat in.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Dashboard</Text>
        
        <View style={styles.headerRight}>
          {/* Empty space to match the schedule.tsx layout */}
        </View>
      </View>
      
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={ColorPalette.cordovan[500]} />
            <Text style={styles.loadingText}>Loading dashboard...</Text>
          </View>
        ) : (
          <>
            {/* Live Status Card */}
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <Text style={styles.statusTitle}>Broadcast Status</Text>
                <TouchableOpacity 
                  style={styles.listenButton}
                  onPress={() => router.push('/listen')}
                >
                  {isLive ? (
                    <View style={styles.liveIndicator}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveText}>LIVE</Text>
                    </View>
                  ) : null}
                  <Text style={styles.listenButtonText}>Listen Now</Text>
                  <Ionicons name="headset-outline" size={18} color={ColorPalette.white.DEFAULT} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.statusContent}>
                {isLive && currentBroadcast ? (
                  <View style={styles.liveStatusContainer}>
                    <Ionicons name="radio-outline" size={36} color={ColorPalette.cordovan[500]} />
                    <View style={styles.liveStatusText}>
                      <Text style={styles.liveBroadcastTitle}>{currentBroadcast.title}</Text>
                      <Text style={styles.liveBroadcastSubtitle}>
                        with {currentBroadcast.dj?.name || 'Unknown DJ'} • 
                        Started {currentBroadcast.actualStart ? 
                          formatDistance(parseISO(currentBroadcast.actualStart), new Date(), { addSuffix: false }) : 
                          'recently'}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.offairStatusContainer}>
                    <Ionicons name="radio-outline" size={36} color={ColorPalette.black[600]} />
                    <View style={styles.offairStatusText}>
                      <Text style={styles.offairTitle}>Currently Off Air</Text>
                      <Text style={styles.offairSubtitle}>
                        {nextBroadcast ? 
                          `Next broadcast: ${format(parseISO(nextBroadcast.scheduledStart), 'EEEE \'at\' h:mm a')}` : 
                          'No upcoming broadcasts scheduled'}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
            
            {/* Quick Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Ionicons name="calendar-outline" size={24} color={ColorPalette.cordovan[500]} />
                <Text style={styles.statNumber}>{upcomingShowsCount}</Text>
                <Text style={styles.statLabel}>Upcoming Shows</Text>
              </View>
              
              <View style={styles.statCard}>
                <Ionicons name="notifications-outline" size={24} color={ColorPalette.mikadoYellow[500]} />
                <Text style={styles.statNumber}>{unreadNotificationsCount}</Text>
                <Text style={styles.statLabel}>Notifications</Text>
              </View>
              
              <View style={styles.statCard}>
                <Ionicons name="wifi-outline" size={24} color={ColorPalette.cordovan[500]} />
                <Text style={styles.statNumber}>{serverStatus?.accessible ? 'Online' : 'Offline'}</Text>
                <Text style={styles.statLabel}>Server Status</Text>
              </View>
            </View>
            
            {/* Recent Broadcasts */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Broadcasts</Text>
                <TouchableOpacity onPress={() => router.push('/schedule')}>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.recentBroadcastsList}>
                {processedRecentBroadcasts.length > 0 ? (
                  processedRecentBroadcasts.map(broadcast => (
                    <TouchableOpacity 
                      key={broadcast.id} 
                      style={styles.broadcastItem}
                      onPress={() => navigateToBroadcast(broadcast.id)}
                    >
                      <View style={styles.broadcastIcon}>
                        <Ionicons name="disc" size={20} color={ColorPalette.white.DEFAULT} />
                      </View>
                      <View style={styles.broadcastInfo}>
                        <Text style={styles.broadcastTitle}>{broadcast.title}</Text>
                        <Text style={styles.broadcastSubtitle}>{broadcast.dj} • {broadcast.date}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={ColorPalette.black[600]} />
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No recent broadcasts</Text>
                  </View>
                )}
              </View>
            </View>
            
            {/* Quick Actions */}
            <View style={styles.quickActionsContainer}>
              <Text style={styles.quickActionsTitle}>Quick Actions</Text>
              
              <View style={styles.quickActionsGrid}>
                <TouchableOpacity 
                  style={styles.quickActionButton}
                  onPress={() => router.push('/schedule')}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: ColorPalette.cordovan[500] }]}>
                    <Ionicons name="calendar-outline" size={22} color={ColorPalette.white.DEFAULT} />
                  </View>
                  <Text style={styles.quickActionText}>View Schedule</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.quickActionButton}
                  onPress={() => router.push('/profile')}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: ColorPalette.mikadoYellow[500] }]}>
                    <Ionicons name="person-outline" size={22} color={ColorPalette.black[600]} />
                  </View>
                  <Text style={styles.quickActionText}>My Profile</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.quickActionButton}
                  onPress={navigateToSongRequest}
                  disabled={!isLive}
                >
                  <View style={[styles.quickActionIcon, { 
                    backgroundColor: isLive ? ColorPalette.cordovan[500] : ColorPalette.cordovan[300] 
                  }]}>
                    <Ionicons name="musical-notes-outline" size={22} color={ColorPalette.white.DEFAULT} />
                  </View>
                  <Text style={[styles.quickActionText, !isLive && { color: ColorPalette.black[400] }]}>Request Song</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.quickActionButton}
                  onPress={navigateToChat}
                  disabled={!isLive}
                >
                  <View style={[styles.quickActionIcon, { 
                    backgroundColor: isLive ? ColorPalette.mikadoYellow[500] : ColorPalette.mikadoYellow[300] 
                  }]}>
                    <Ionicons name="chatbubbles-outline" size={22} color={ColorPalette.black[600]} />
                  </View>
                  <Text style={[styles.quickActionText, !isLive && { color: ColorPalette.black[400] }]}>Join Chat</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ColorPalette.antiFlashWhite[700],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: ColorPalette.white.DEFAULT,
    borderBottomWidth: 1,
    borderBottomColor: ColorPalette.antiFlashWhite[400],
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: ColorPalette.cordovan[500],
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: ColorPalette.black[700],
    fontWeight: '500',
  },
  statusCard: {
    backgroundColor: ColorPalette.white.DEFAULT,
    borderRadius: 16,
    padding: 16,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 20,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: ColorPalette.black[600],
  },
  listenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ColorPalette.cordovan[500],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  listenButtonText: {
    color: ColorPalette.white.DEFAULT,
    fontWeight: 'bold',
    fontSize: 14,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
    backgroundColor: ColorPalette.mikadoYellow[500],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ColorPalette.black[600],
    marginRight: 3,
  },
  liveText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: ColorPalette.black[600],
  },
  statusContent: {
    paddingVertical: 10,
  },
  liveStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveStatusText: {
    marginLeft: 12,
    flex: 1,
  },
  liveBroadcastTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: ColorPalette.black[600],
    marginBottom: 4,
  },
  liveBroadcastSubtitle: {
    fontSize: 14,
    color: ColorPalette.cordovan[500],
  },
  offairStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offairStatusText: {
    marginLeft: 12,
    flex: 1,
  },
  offairTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: ColorPalette.black[600],
    marginBottom: 4,
  },
  offairSubtitle: {
    fontSize: 14,
    color: ColorPalette.black[700],
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: ColorPalette.white.DEFAULT,
    borderRadius: 16,
    padding: 16,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
    width: '31%',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: ColorPalette.black[600],
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: ColorPalette.black[700],
    textAlign: 'center',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: ColorPalette.cordovan[500],
  },
  seeAllText: {
    fontSize: 14,
    color: ColorPalette.cordovan[500],
    fontWeight: '600',
  },
  recentBroadcastsList: {
    backgroundColor: ColorPalette.white.DEFAULT,
    borderRadius: 16,
    padding: 8,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  broadcastItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: ColorPalette.antiFlashWhite[600],
  },
  broadcastIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ColorPalette.cordovan[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  broadcastInfo: {
    flex: 1,
  },
  broadcastTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: ColorPalette.black[600],
    marginBottom: 2,
  },
  broadcastSubtitle: {
    fontSize: 13,
    color: ColorPalette.black[700],
  },
  quickActionsContainer: {
    marginBottom: 24,
  },
  quickActionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: ColorPalette.cordovan[500],
    marginBottom: 12,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    backgroundColor: ColorPalette.white.DEFAULT,
    width: '48%',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: ColorPalette.black[600],
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: ColorPalette.black[700],
    fontWeight: '500',
  },
}); 