import { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, Image, ScrollView } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import AudioPlayer from '../../components/AudioPlayer';
import BroadcastInteractionPanel from '../../components/BroadcastInteractionPanel';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Colors from '../../constants/Colors';
import { useColorScheme } from '../../hooks/useColorScheme';

export default function HomeScreen() {
  const { currentUser } = useAuth();
  const [activeBroadcast, setActiveBroadcast] = useState(null);
  const [upcomingBroadcasts, setUpcomingBroadcasts] = useState([]);
  const [showSocialPanel, setShowSocialPanel] = useState(false);
  const colorScheme = useColorScheme();

  useEffect(() => {
    loadBroadcasts();
    
    // Refresh data every minute
    const interval = setInterval(() => {
      loadBroadcasts();
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const loadBroadcasts = async () => {
    try {
      // Get active broadcast
      const activeResponse = await axios.get('https://wildcat-radio-f05d362144e6.herokuapp.com/api/broadcasts/live');
      if (activeResponse.data.length > 0) {
        setActiveBroadcast(activeResponse.data[0]);
      } else {
        setActiveBroadcast(null);
        // If no active broadcast, hide the social panel
        setShowSocialPanel(false);
      }

      // Get upcoming broadcasts
      const upcomingResponse = await axios.get('https://wildcat-radio-f05d362144e6.herokuapp.com/api/broadcasts/upcoming');
      setUpcomingBroadcasts(upcomingResponse.data.slice(0, 5)); // Get first 5 upcoming
    } catch (error) {
      console.error('Error loading broadcasts:', error);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: showSocialPanel ? 300 : 40 }}
      >
        <View style={styles.welcomeSection}>
          <ThemedText style={styles.welcomeText}>
            Welcome, {currentUser?.name || 'Wildcat'}
          </ThemedText>
          <ThemedText style={styles.subTitle}>
            Listen to your favorite campus broadcasts
          </ThemedText>
        </View>

        {/* Now Playing Section */}
        <ThemedView style={styles.nowPlayingCard}>
          <ThemedText style={styles.sectionTitle}>Now Playing</ThemedText>
          
          {activeBroadcast ? (
            <View>
              <View style={styles.broadcastContainer}>
                <Image 
                  source={{ uri: activeBroadcast.imageUrl || 'https://via.placeholder.com/100' }} 
                  style={styles.broadcastImage}
                />
                <View style={styles.broadcastInfo}>
                  <ThemedText style={styles.broadcastTitle}>{activeBroadcast.title}</ThemedText>
                  <ThemedText style={styles.broadcastHost}>
                    Hosted by {activeBroadcast.createdBy?.name || 'Unknown DJ'}
                  </ThemedText>
                  
                  {/* Social interaction toggle button */}
                  <TouchableOpacity
                    style={styles.socialButton}
                    onPress={() => setShowSocialPanel(!showSocialPanel)}
                  >
                    <Ionicons 
                      name={showSocialPanel ? "chatbubble" : "chatbubble-outline"} 
                      size={18} 
                      color="white" 
                      style={styles.socialIcon}
                    />
                    <ThemedText style={styles.socialButtonText}>
                      {showSocialPanel ? 'Hide Chat & Polls' : 'Show Chat & Polls'}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Audio Player */}
              <AudioPlayer 
                streamUrl="https://wildcat-radio-f05d362144e6.herokuapp.com/stream"
                title={activeBroadcast.title}
                artist={activeBroadcast.createdBy?.name}
                showControls={true}
              />
            </View>
          ) : (
            <ThemedView style={styles.noContentCard}>
              <Ionicons 
                name="radio-outline" 
                size={48} 
                color={Colors[colorScheme].text} 
              />
              <ThemedText style={styles.noContentText}>
                No active broadcasts right now
              </ThemedText>
              <ThemedText style={styles.noContentSubText}>
                Check back later or explore upcoming shows
              </ThemedText>
            </ThemedView>
          )}
        </ThemedView>

        {/* Upcoming Broadcasts Section */}
        <ThemedView style={styles.upcomingSection}>
          <ThemedText style={styles.sectionTitle}>Upcoming Broadcasts</ThemedText>
          
          {upcomingBroadcasts.length > 0 ? (
            upcomingBroadcasts.map((broadcast) => (
              <ThemedView key={broadcast.id} style={styles.upcomingCard}>
                <View style={styles.upcomingHeader}>
                  <ThemedText style={styles.upcomingTitle}>{broadcast.title}</ThemedText>
                  <ThemedText style={styles.upcomingTime}>
                    {new Date(broadcast.scheduledStart).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </ThemedText>
                </View>
                <ThemedText style={styles.upcomingHost}>
                  Hosted by {broadcast.createdBy?.name || 'Unknown DJ'}
                </ThemedText>
                {broadcast.description && (
                  <ThemedText style={styles.upcomingDesc} numberOfLines={2}>
                    {broadcast.description}
                  </ThemedText>
                )}
              </ThemedView>
            ))
          ) : (
            <ThemedView style={styles.noContentCard}>
              <MaterialIcons 
                name="event-busy" 
                size={48} 
                color={Colors[colorScheme].text} 
              />
              <ThemedText style={styles.noContentText}>
                No upcoming broadcasts
              </ThemedText>
              <ThemedText style={styles.noContentSubText}>
                Check back later for new shows
              </ThemedText>
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>
      
      {/* Social Panel - Show when there's an active broadcast and panel is toggled */}
      {activeBroadcast && showSocialPanel && (
        <View style={styles.socialPanelContainer}>
          <BroadcastInteractionPanel broadcastId={activeBroadcast.id} />
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  welcomeSection: {
    marginTop: 12,
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subTitle: {
    fontSize: 16,
    opacity: 0.7,
    marginTop: 4,
  },
  nowPlayingCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  broadcastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  broadcastImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  broadcastInfo: {
    flex: 1,
    marginLeft: 16,
  },
  broadcastTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  broadcastHost: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 12,
  },
  socialButton: {
    backgroundColor: '#8a2424', // maroon color
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
  },
  socialIcon: {
    marginRight: 8,
  },
  socialButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  socialPanelContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 300,
    backgroundColor: 'transparent',
    padding: 16,
    paddingBottom: 0,
    zIndex: 100,
  },
  upcomingSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  upcomingCard: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  upcomingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  upcomingTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  upcomingTime: {
    fontSize: 14,
    opacity: 0.8,
  },
  upcomingHost: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 4,
  },
  upcomingDesc: {
    fontSize: 14,
    opacity: 0.7,
  },
  noContentCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  noContentText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  noContentSubText: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
    textAlign: 'center',
  }
});
