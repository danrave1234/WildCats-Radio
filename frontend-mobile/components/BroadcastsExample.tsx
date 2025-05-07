import React from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useBroadcasts, Broadcast } from '@/services/api';

export default function BroadcastsExample() {
  const { useAllBroadcasts, useActiveBroadcast } = useBroadcasts();
  
  // Get all broadcasts
  const { 
    data: broadcasts, 
    isLoading, 
    isError, 
    error, 
    refetch 
  } = useAllBroadcasts();
  
  // Get active broadcast
  const { 
    data: activeBroadcast,
    isLoading: isLoadingActive
  } = useActiveBroadcast();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading broadcasts...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          Error: {(error as any)?.message || 'Failed to load broadcasts'}
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => refetch()}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {activeBroadcast && (
        <View style={styles.activeContainer}>
          <Text style={styles.activeTitle}>Now Live</Text>
          <Text style={styles.activeName}>{activeBroadcast.title}</Text>
          <Text style={styles.activeDescription}>{activeBroadcast.description}</Text>
          <Text style={styles.activeDj}>
            DJ: {activeBroadcast.dj?.name || 'Unknown'}
          </Text>
        </View>
      )}

      <Text style={styles.title}>Upcoming Broadcasts</Text>
      
      {broadcasts && broadcasts.length > 0 ? (
        <FlatList
          data={broadcasts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => <BroadcastItem broadcast={item} />}
        />
      ) : (
        <Text style={styles.emptyText}>No broadcasts scheduled</Text>
      )}
    </View>
  );
}

interface BroadcastItemProps {
  broadcast: Broadcast;
}

const BroadcastItem: React.FC<BroadcastItemProps> = ({ broadcast }) => {
  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <View style={styles.broadcastItem}>
      <Text style={styles.broadcastTitle}>{broadcast.title}</Text>
      <Text style={styles.broadcastDescription}>{broadcast.description}</Text>
      <View style={styles.broadcastDetails}>
        <Text style={styles.broadcastTime}>
          Start: {formatDate(broadcast.scheduledStart)}
        </Text>
        <Text style={styles.broadcastTime}>
          End: {formatDate(broadcast.scheduledEnd)}
        </Text>
        <Text style={styles.broadcastDj}>
          DJ: {broadcast.dj?.name || 'Not assigned'}
        </Text>
        <View style={[
          styles.statusBadge,
          { backgroundColor: getStatusColor(broadcast.status) }
        ]}>
          <Text style={styles.statusText}>{broadcast.status}</Text>
        </View>
      </View>
    </View>
  );
};

// Helper to get color based on status
const getStatusColor = (status: string): string => {
  switch (status.toUpperCase()) {
    case 'LIVE':
      return '#4CAF50'; // Green
    case 'UPCOMING':
      return '#2196F3'; // Blue
    case 'COMPLETED':
      return '#9E9E9E'; // Gray
    case 'CANCELLED':
      return '#F44336'; // Red
    default:
      return '#FF9800'; // Orange (default)
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  broadcastItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  broadcastTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  broadcastDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  broadcastDetails: {
    flexDirection: 'column',
    marginTop: 8,
  },
  broadcastTime: {
    fontSize: 14,
    color: '#444',
    marginBottom: 2,
  },
  broadcastDj: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginTop: 4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  activeContainer: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  activeTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    opacity: 0.9,
  },
  activeName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 4,
  },
  activeDescription: {
    color: '#fff',
    fontSize: 16,
    marginTop: 8,
    opacity: 0.9,
  },
  activeDj: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '600',
  },
}); 