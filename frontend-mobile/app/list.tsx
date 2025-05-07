import React from 'react';
import { StyleSheet, View, Text, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ColorPalette } from '@/constants/ColorPalette';
import { StatusBar } from 'expo-status-bar';
import { useBroadcasts } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Broadcast } from '@/services/api/types';

export default function ListScreen() {
  const router = useRouter();
  const { useUpcomingBroadcasts } = useBroadcasts();
  const { data: upcomingBroadcasts, isLoading, isError } = useUpcomingBroadcasts();

  // Format the date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'MMM dd, yyyy • h:mm a');
  };

  // Calculate broadcast duration
  const calculateDuration = (startString: string, endString: string) => {
    const start = new Date(startString);
    const end = new Date(endString);
    const durationMs = end.getTime() - start.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`;
    }
    return `${minutes}m`;
  };

  const navigateToBroadcast = (broadcastId: number) => {
    // This will navigate to a future broadcast detail page when implemented
    // For now, just log the action
    console.log(`Navigate to broadcast ${broadcastId}`);
  };

  const renderBroadcastItem = ({ item }: { item: Broadcast }) => (
    <TouchableOpacity 
      style={styles.broadcastCard}
      onPress={() => navigateToBroadcast(item.id)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.broadcastTitle}>{item.title}</Text>
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>
            {calculateDuration(item.scheduledStart, item.scheduledEnd)}
          </Text>
        </View>
      </View>
      
      <View style={styles.timeContainer}>
        <Ionicons name="calendar-outline" size={18} color={ColorPalette.cordovan[400]} />
        <Text style={styles.timeText}>{formatDate(item.scheduledStart)}</Text>
      </View>
      
      <View style={styles.djContainer}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{item.dj?.name.charAt(0) || '?'}</Text>
        </View>
        <Text style={styles.djName}>DJ: {item.dj?.name || 'TBA'}</Text>
      </View>
      
      <Text 
        style={styles.description}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {item.description}
      </Text>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons 
        name="calendar-outline" 
        size={60} 
        color={ColorPalette.cordovan[300]} 
        style={{ marginBottom: 20 }} 
      />
      <Text style={styles.emptyText}>No Upcoming Broadcasts</Text>
      <Text style={styles.emptySubText}>
        Check back later for scheduled shows
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Upcoming Broadcasts</Text>
        
        <View style={styles.headerRight}>
          {/* Empty space for potential filters or search */}
        </View>
      </View>
      
      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={ColorPalette.cordovan.DEFAULT} />
            <Text style={styles.loadingText}>Loading broadcasts...</Text>
          </View>
        ) : isError ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={50} color={ColorPalette.cordovan.DEFAULT} />
            <Text style={styles.errorText}>Could not load broadcasts</Text>
            <Text style={styles.errorSubText}>Please try again later</Text>
          </View>
        ) : (
          <FlatList
            data={upcomingBroadcasts}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderBroadcastItem}
            ListEmptyComponent={renderEmptyState}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ColorPalette.antiFlashWhite.DEFAULT,
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
    color: ColorPalette.cordovan.DEFAULT,
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100, // Extra space for bottom navigation
  },
  broadcastCard: {
    backgroundColor: ColorPalette.white.DEFAULT,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: ColorPalette.mikadoYellow[200],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  broadcastTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: ColorPalette.black[600],
    flex: 1,
    marginRight: 10,
  },
  durationBadge: {
    backgroundColor: ColorPalette.mikadoYellow[100],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ColorPalette.mikadoYellow[300],
  },
  durationText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: ColorPalette.black[600],
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeText: {
    fontSize: 14,
    color: ColorPalette.black[700],
    marginLeft: 8,
  },
  djContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: ColorPalette.cordovan.DEFAULT,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: ColorPalette.white.DEFAULT,
    fontWeight: 'bold',
    fontSize: 14,
  },
  djName: {
    fontSize: 14,
    fontWeight: '500',
    color: ColorPalette.black[700],
  },
  description: {
    fontSize: 14,
    color: ColorPalette.black[600],
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: ColorPalette.black[600],
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: 'bold',
    color: ColorPalette.cordovan.DEFAULT,
  },
  errorSubText: {
    marginTop: 8,
    fontSize: 14,
    color: ColorPalette.black[600],
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ColorPalette.white.DEFAULT,
    margin: 20,
    borderRadius: 16,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: ColorPalette.mikadoYellow[400],
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: ColorPalette.black[600],
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: ColorPalette.black[500],
    textAlign: 'center',
  },
}); 