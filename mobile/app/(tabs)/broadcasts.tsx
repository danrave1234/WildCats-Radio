import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Text, ActivityIndicator, RefreshControl, TextInput, Modal, Switch } from 'react-native';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { broadcastService } from '../../services/api';
import { useColorScheme } from '../../hooks/useColorScheme';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function BroadcastsScreen() {
  const { currentUser } = useAuth();
  const [userRole, setUserRole] = useState('LISTENER');
  const [broadcasts, setBroadcasts] = useState([]);
  const [liveBroadcasts, setLiveBroadcasts] = useState([]);
  const [upcomingBroadcasts, setUpcomingBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  // State for creating/editing broadcast
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState(null);
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    description: '',
    scheduledStart: new Date(),
    scheduledEnd: new Date(Date.now() + 3600000), // Default to 1 hour later
  });

  // Date picker state
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Check if user is DJ or admin
  useEffect(() => {
    if (currentUser) {
      setUserRole(currentUser.role);
      if (currentUser.role !== 'DJ' && currentUser.role !== 'ADMIN') {
        // Redirect non-DJ/admin users
        router.replace('/(tabs)');
      } else {
        fetchBroadcasts();
      }
    }
  }, [currentUser]);

  // Fetch broadcasts from the backend
  const fetchBroadcasts = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all broadcasts
      const response = await broadcastService.getAll();
      setBroadcasts(response.data);

      // Fetch live broadcasts
      const liveResponse = await broadcastService.getLive();
      setLiveBroadcasts(liveResponse.data);

      // Fetch upcoming broadcasts
      const upcomingResponse = await broadcastService.getUpcoming();
      setUpcomingBroadcasts(upcomingResponse.data);
    } catch (err) {
      console.error('Error fetching broadcasts:', err);
      setError('Failed to fetch broadcasts. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchBroadcasts();
  };

  // Handle broadcast form changes
  const handleBroadcastChange = (name, value) => {
    setBroadcastForm({
      ...broadcastForm,
      [name]: value
    });
  };

  // Handle date changes
  const handleDateChange = (event, selectedDate, type) => {
    if (type === 'start') {
      setShowStartDatePicker(false);
      if (selectedDate) {
        setBroadcastForm({
          ...broadcastForm,
          scheduledStart: selectedDate,
          // If end time is before new start time, adjust it
          scheduledEnd: selectedDate > broadcastForm.scheduledEnd 
            ? new Date(selectedDate.getTime() + 3600000) // 1 hour later
            : broadcastForm.scheduledEnd
        });
      }
    } else {
      setShowEndDatePicker(false);
      if (selectedDate) {
        setBroadcastForm({
          ...broadcastForm,
          scheduledEnd: selectedDate
        });
      }
    }
  };

  // Open broadcast modal for creating new broadcast
  const handleNewBroadcast = () => {
    setIsEditMode(false);
    setSelectedBroadcast(null);
    setBroadcastForm({
      title: '',
      description: '',
      scheduledStart: new Date(),
      scheduledEnd: new Date(Date.now() + 3600000), // Default to 1 hour later
    });
    setShowBroadcastModal(true);
  };

  // Open broadcast modal for editing existing broadcast
  const handleEditBroadcast = (broadcast) => {
    setIsEditMode(true);
    setSelectedBroadcast(broadcast);
    setBroadcastForm({
      title: broadcast.title,
      description: broadcast.description || '',
      scheduledStart: new Date(broadcast.scheduledStart),
      scheduledEnd: new Date(broadcast.scheduledEnd),
    });
    setShowBroadcastModal(true);
  };

  // Handle broadcast submission (create or update)
  const handleBroadcastSubmit = async () => {
    if (!broadcastForm.title) {
      setError('Title is required');
      return;
    }

    if (broadcastForm.scheduledEnd <= broadcastForm.scheduledStart) {
      setError('End time must be after start time');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isEditMode && selectedBroadcast) {
        // Update existing broadcast
        const updatedBroadcast = {
          ...selectedBroadcast,
          title: broadcastForm.title,
          description: broadcastForm.description,
          scheduledStart: broadcastForm.scheduledStart.toISOString(),
          scheduledEnd: broadcastForm.scheduledEnd.toISOString(),
        };

        await broadcastService.update(selectedBroadcast.id, updatedBroadcast);

        // Update local state
        setBroadcasts(broadcasts.map(b => 
          b.id === selectedBroadcast.id ? updatedBroadcast : b
        ));
      } else {
        // Create new broadcast
        const newBroadcast = {
          title: broadcastForm.title,
          description: broadcastForm.description,
          scheduledStart: broadcastForm.scheduledStart.toISOString(),
          scheduledEnd: broadcastForm.scheduledEnd.toISOString(),
        };

        const response = await broadcastService.schedule(newBroadcast);

        // Update local state
        setBroadcasts([...broadcasts, response.data]);
      }

      // Close modal and refresh broadcasts
      setShowBroadcastModal(false);
      fetchBroadcasts();
    } catch (err) {
      console.error('Error saving broadcast:', err);
      setError('Failed to save broadcast. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Start a broadcast
  const handleStartBroadcast = async (broadcastId) => {
    setLoading(true);
    try {
      await broadcastService.start(broadcastId);
      fetchBroadcasts();
    } catch (err) {
      console.error('Error starting broadcast:', err);
      setError('Failed to start broadcast. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // End a broadcast
  const handleEndBroadcast = async (broadcastId) => {
    setLoading(true);
    try {
      await broadcastService.end(broadcastId);
      fetchBroadcasts();
    } catch (err) {
      console.error('Error ending broadcast:', err);
      setError('Failed to end broadcast. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Delete a broadcast
  const handleDeleteBroadcast = async (broadcastId) => {
    if (confirm('Are you sure you want to delete this broadcast?')) {
      setLoading(true);
      try {
        await broadcastService.delete(broadcastId);
        // Update local state
        setBroadcasts(broadcasts.filter(b => b.id !== broadcastId));
        setUpcomingBroadcasts(upcomingBroadcasts.filter(b => b.id !== broadcastId));
      } catch (err) {
        console.error('Error deleting broadcast:', err);
        setError('Failed to delete broadcast. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7F1D1D" />
        <ThemedText style={styles.loadingText}>Loading broadcasts...</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Broadcast Management</ThemedText>
      </ThemedView>

      <TouchableOpacity 
        style={styles.addButton}
        onPress={handleNewBroadcast}
      >
        <Text style={styles.addButtonText}>+ Schedule New Broadcast</Text>
      </TouchableOpacity>

      {error && (
        <ThemedView style={[styles.errorContainer, { backgroundColor: isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEF2F2' }]}>
          <ThemedText style={{ color: isDark ? '#FECACA' : '#B91C1C' }}>{error}</ThemedText>
        </ThemedView>
      )}

      <ScrollView 
        style={styles.broadcastList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Live Broadcasts Section */}
        <ThemedView style={styles.sectionHeader}>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot}></View>
            <ThemedText style={styles.sectionTitle}>Live Broadcasts</ThemedText>
          </View>
        </ThemedView>

        {liveBroadcasts.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText>No live broadcasts</ThemedText>
          </ThemedView>
        ) : (
          liveBroadcasts.map((broadcast) => (
            <ThemedView key={broadcast.id} style={styles.broadcastCard}>
              <View style={styles.broadcastHeader}>
                <ThemedText style={styles.broadcastTitle}>{broadcast.title}</ThemedText>
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>LIVE</Text>
                </View>
              </View>

              {broadcast.description && (
                <ThemedText style={styles.broadcastDescription}>{broadcast.description}</ThemedText>
              )}

              <ThemedText style={styles.broadcastTime}>
                Started: {new Date(broadcast.actualStart).toLocaleString()}
              </ThemedText>

              <View style={styles.broadcastActions}>
                <TouchableOpacity 
                  style={[styles.button, styles.dangerButton]}
                  onPress={() => handleEndBroadcast(broadcast.id)}
                >
                  <Text style={styles.buttonText}>End Broadcast</Text>
                </TouchableOpacity>
              </View>
            </ThemedView>
          ))
        )}

        {/* Upcoming Broadcasts Section */}
        <ThemedView style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Upcoming Broadcasts</ThemedText>
        </ThemedView>

        {upcomingBroadcasts.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText>No upcoming broadcasts</ThemedText>
          </ThemedView>
        ) : (
          upcomingBroadcasts.map((broadcast) => (
            <ThemedView key={broadcast.id} style={styles.broadcastCard}>
              <ThemedText style={styles.broadcastTitle}>{broadcast.title}</ThemedText>

              {broadcast.description && (
                <ThemedText style={styles.broadcastDescription}>{broadcast.description}</ThemedText>
              )}

              <ThemedText style={styles.broadcastTime}>
                Scheduled: {new Date(broadcast.scheduledStart).toLocaleString()} - {new Date(broadcast.scheduledEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </ThemedText>

              <View style={styles.broadcastActions}>
                <TouchableOpacity 
                  style={[styles.button, styles.primaryButton]}
                  onPress={() => handleStartBroadcast(broadcast.id)}
                >
                  <Text style={styles.buttonText}>Start Now</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.button, styles.secondaryButton]}
                  onPress={() => handleEditBroadcast(broadcast)}
                >
                  <Text style={styles.secondaryButtonText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.button, styles.dangerOutlineButton]}
                  onPress={() => handleDeleteBroadcast(broadcast.id)}
                >
                  <Text style={styles.dangerButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </ThemedView>
          ))
        )}
      </ScrollView>

      {/* Broadcast Modal */}
      <Modal
        visible={showBroadcastModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowBroadcastModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              {isEditMode ? 'Edit Broadcast' : 'Schedule New Broadcast'}
            </ThemedText>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Title</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: isDark ? '#374151' : 'white',
                    borderColor: isDark ? '#4B5563' : '#D1D5DB',
                    color: isDark ? 'white' : 'black'
                  }
                ]}
                value={broadcastForm.title}
                onChangeText={(text) => handleBroadcastChange('title', text)}
                placeholder="Enter broadcast title"
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Description (optional)</ThemedText>
              <TextInput
                style={[
                  styles.textArea,
                  { 
                    backgroundColor: isDark ? '#374151' : 'white',
                    borderColor: isDark ? '#4B5563' : '#D1D5DB',
                    color: isDark ? 'white' : 'black'
                  }
                ]}
                value={broadcastForm.description}
                onChangeText={(text) => handleBroadcastChange('description', text)}
                placeholder="Enter broadcast description"
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Start Date & Time</ThemedText>
              <TouchableOpacity
                style={[
                  styles.dateInput,
                  { 
                    backgroundColor: isDark ? '#374151' : 'white',
                    borderColor: isDark ? '#4B5563' : '#D1D5DB',
                  }
                ]}
                onPress={() => setShowStartDatePicker(true)}
              >
                <ThemedText>
                  {broadcastForm.scheduledStart.toLocaleString()}
                </ThemedText>
              </TouchableOpacity>
              {showStartDatePicker && (
                <DateTimePicker
                  value={broadcastForm.scheduledStart}
                  mode="datetime"
                  display="default"
                  onChange={(event, date) => handleDateChange(event, date, 'start')}
                />
              )}
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>End Date & Time</ThemedText>
              <TouchableOpacity
                style={[
                  styles.dateInput,
                  { 
                    backgroundColor: isDark ? '#374151' : 'white',
                    borderColor: isDark ? '#4B5563' : '#D1D5DB',
                  }
                ]}
                onPress={() => setShowEndDatePicker(true)}
              >
                <ThemedText>
                  {broadcastForm.scheduledEnd.toLocaleString()}
                </ThemedText>
              </TouchableOpacity>
              {showEndDatePicker && (
                <DateTimePicker
                  value={broadcastForm.scheduledEnd}
                  mode="datetime"
                  display="default"
                  onChange={(event, date) => handleDateChange(event, date, 'end')}
                />
              )}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.button, styles.secondaryButton]}
                onPress={() => setShowBroadcastModal(false)}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.button, styles.primaryButton]}
                onPress={handleBroadcastSubmit}
              >
                <Text style={styles.buttonText}>
                  {isEditMode ? 'Update' : 'Schedule'}
                </Text>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  addButton: {
    backgroundColor: '#7F1D1D',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  broadcastList: {
    flex: 1,
  },
  sectionHeader: {
    paddingVertical: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
    marginRight: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
  },
  broadcastCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
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
    marginBottom: 8,
  },
  broadcastTime: {
    fontSize: 12,
    marginBottom: 12,
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
  dangerButton: {
    backgroundColor: '#DC2626',
  },
  dangerOutlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  secondaryButtonText: {
    color: '#7F1D1D',
    fontWeight: 'bold',
  },
  dangerButtonText: {
    color: '#DC2626',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 8,
    padding: 16,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  textArea: {
    height: 100,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
});
