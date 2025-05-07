import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import axios from 'axios';
import { format } from 'date-fns';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '../../hooks/useColorScheme';
import Colors from '../../constants/Colors';

export default function ScheduleScreen() {
  const [broadcasts, setBroadcasts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeDay, setActiveDay] = useState(new Date().getDay()); // 0 for Sunday, 1 for Monday, etc.
  const colorScheme = useColorScheme();

  const days = [
    { id: 0, name: 'Sun' },
    { id: 1, name: 'Mon' },
    { id: 2, name: 'Tue' },
    { id: 3, name: 'Wed' },
    { id: 4, name: 'Thu' },
    { id: 5, name: 'Fri' },
    { id: 6, name: 'Sat' },
  ];

  useEffect(() => {
    fetchBroadcasts();
  }, [activeDay]);

  const fetchBroadcasts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const today = new Date();
      
      // Set date to the selected day of the current week
      const targetDate = new Date(today);
      const diff = activeDay - today.getDay();
      targetDate.setDate(today.getDate() + diff);
      
      const formattedDate = format(targetDate, 'yyyy-MM-dd');
      
      const response = await axios.get(
        `https://wildcat-radio-f05d362144e6.herokuapp.com/api/broadcasts/date/${formattedDate}`
      );
      
      setBroadcasts(response.data);
    } catch (error) {
      console.error('Error fetching broadcasts:', error);
      setError('Failed to load broadcasts. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Format time function
  const formatTime = (dateString) => {
    try {
      return format(new Date(dateString), 'h:mm a');
    } catch (e) {
      return 'Unknown time';
    }
  };

  // Determine if a broadcast is currently live
  const isLive = (broadcast) => {
    const now = new Date();
    const start = new Date(broadcast.scheduledStart);
    const end = broadcast.scheduledEnd ? new Date(broadcast.scheduledEnd) : new Date(start.getTime() + 60 * 60 * 1000);
    return now >= start && now <= end;
  };

  // Render each broadcast item
  const renderBroadcast = ({ item }) => {
    const live = isLive(item);
    
    return (
      <ThemedView style={[styles.broadcastCard, live && styles.liveBroadcastCard]}>
        {live && (
          <ThemedView style={styles.liveTag}>
            <ThemedText style={styles.liveText}>LIVE</ThemedText>
          </ThemedView>
        )}
        <ThemedText style={styles.broadcastTitle}>{item.title}</ThemedText>
        <ThemedView style={styles.broadcastDetails}>
          <ThemedText style={styles.timeText}>
            {formatTime(item.scheduledStart)} - {item.scheduledEnd ? formatTime(item.scheduledEnd) : 'TBD'}
          </ThemedText>
          {item.createdBy && (
            <ThemedText style={styles.hostText}>
              Hosted by {item.createdBy.name}
            </ThemedText>
          )}
        </ThemedView>
        {item.description && (
          <ThemedText style={styles.descriptionText}>
            {item.description}
          </ThemedText>
        )}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      {/* Day selector */}
      <ThemedView style={styles.daySelector}>
        {days.map((day) => (
          <TouchableOpacity
            key={day.id}
            style={[
              styles.dayButton,
              activeDay === day.id && styles.activeDayButton,
              activeDay === day.id && { backgroundColor: '#8a2424' }, // maroon color for active
            ]}
            onPress={() => setActiveDay(day.id)}
          >
            <ThemedText
              style={[
                styles.dayButtonText,
                activeDay === day.id && styles.activeDayButtonText,
                activeDay === day.id && { color: 'white' },
              ]}
            >
              {day.name}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </ThemedView>

      {/* Show the selected date */}
      <ThemedText style={styles.selectedDateText}>
        {format(
          (() => {
            const today = new Date();
            const targetDate = new Date(today);
            const diff = activeDay - today.getDay();
            targetDate.setDate(today.getDate() + diff);
            return targetDate;
          })(), 
          'MMMM d, yyyy'
        )}
      </ThemedText>

      {/* Content area */}
      {isLoading ? (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8a2424" />
          <ThemedText style={styles.loadingText}>Loading broadcasts...</ThemedText>
        </ThemedView>
      ) : error ? (
        <ThemedView style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color={Colors[colorScheme].text} />
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <TouchableOpacity style={styles.retryButton} onPress={fetchBroadcasts}>
            <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      ) : broadcasts.length === 0 ? (
        <ThemedView style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={48} color={Colors[colorScheme].text} />
          <ThemedText style={styles.emptyText}>
            No broadcasts scheduled for this day
          </ThemedText>
          <ThemedText style={styles.emptySubText}>
            Check back later or try another day
          </ThemedText>
        </ThemedView>
      ) : (
        <FlatList
          data={broadcasts}
          renderItem={renderBroadcast}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  daySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderRadius: 10,
    overflow: 'hidden',
  },
  dayButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  activeDayButton: {
    backgroundColor: '#8a2424', // maroon color
  },
  activeDayButtonText: {
    color: 'white',
    fontWeight: '700',
  },
  selectedDateText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 24,
  },
  broadcastCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  liveBroadcastCard: {
    borderColor: '#8a2424', // maroon color
    borderWidth: 2,
  },
  liveTag: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#8a2424', // maroon color
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  liveText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 12,
  },
  broadcastTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  broadcastDetails: {
    marginBottom: 8,
  },
  timeText: {
    fontSize: 16,
    marginBottom: 4,
  },
  hostText: {
    fontSize: 14,
    opacity: 0.7,
  },
  descriptionText: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#8a2424', // maroon color
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.7,
  },
});
