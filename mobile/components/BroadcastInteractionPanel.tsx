import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, FlatList, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColorScheme } from '../hooks/useColorScheme';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import Colors from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const API_BASE_URL = 'https://wildcat-radio-f05d362144e6.herokuapp.com/api';

interface ChatMessage {
  id: string;
  content: string;
  sender: {
    id: string;
    name: string;
  };
  timestamp: string;
}

interface PollOption {
  id: string;
  text: string;
}

interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  active: boolean;
}

interface BroadcastInteractionPanelProps {
  broadcastId: string;
}

const BroadcastInteractionPanel = ({ broadcastId }: BroadcastInteractionPanelProps) => {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'request', 'poll'
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [songRequest, setSongRequest] = useState({ song: '', artist: '' });
  const [activePoll, setActivePoll] = useState<Poll | null>(null);
  const [userVote, setUserVote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const colorScheme = useColorScheme();
  const { currentUser } = useAuth();
  
  // Fetch chat messages when panel is opened or broadcast ID changes
  useEffect(() => {
    if (broadcastId) {
      fetchChatMessages();
      fetchActivePoll();
      
      // Set up interval to fetch new messages
      const chatInterval = setInterval(fetchChatMessages, 10000); // Every 10 seconds
      const pollInterval = setInterval(fetchActivePoll, 20000);   // Every 20 seconds
      
      return () => {
        clearInterval(chatInterval);
        clearInterval(pollInterval);
      };
    }
  }, [broadcastId]);
  
  // Fetch chat messages from the API
  const fetchChatMessages = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/chat/broadcast/${broadcastId}`);
      setChatMessages(response.data);
    } catch (error) {
      console.error('Error fetching chat messages:', error);
    }
  };
  
  // Fetch active poll for the broadcast
  const fetchActivePoll = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/polls/broadcast/${broadcastId}/active`);
      if (response.data && response.data.length > 0) {
        setActivePoll(response.data[0]);
      } else {
        setActivePoll(null);
      }
    } catch (error) {
      console.error('Error fetching active poll:', error);
    }
  };
  
  // Send a chat message
  const sendChatMessage = async () => {
    if (!chatMessage.trim() || !broadcastId || !currentUser) return;
    
    try {
      setLoading(true);
      await axios.post(`${API_BASE_URL}/chat/broadcast/${broadcastId}`, {
        content: chatMessage,
        senderId: currentUser.id
      });
      
      // Clear input and refresh messages
      setChatMessage('');
      fetchChatMessages();
    } catch (error) {
      console.error('Error sending chat message:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Send a song request
  const sendSongRequest = async () => {
    if (!songRequest.song.trim() || !broadcastId || !currentUser) return;
    
    try {
      setLoading(true);
      await axios.post(`${API_BASE_URL}/song-requests/broadcast/${broadcastId}`, {
        songTitle: songRequest.song,
        artist: songRequest.artist,
        requestedById: currentUser.id
      });
      
      // Clear input and switch back to chat tab
      setSongRequest({ song: '', artist: '' });
      setActiveTab('chat');
    } catch (error) {
      console.error('Error sending song request:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Submit a vote for a poll
  const submitPollVote = async (optionId: string) => {
    if (!activePoll || !currentUser) return;
    
    try {
      setLoading(true);
      await axios.post(`${API_BASE_URL}/polls/${activePoll.id}/vote`, {
        optionId: optionId,
        userId: currentUser.id
      });
      
      setUserVote(optionId);
      // Re-fetch poll to get updated results
      fetchActivePoll();
    } catch (error) {
      console.error('Error submitting poll vote:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Render chat messages
  const renderChatMessage = ({ item }: { item: ChatMessage }) => (
    <ThemedView 
      style={[
        styles.chatMessage,
        item.sender.id === currentUser?.id ? styles.outgoingMessage : styles.incomingMessage
      ]}
    >
      <ThemedText style={styles.messageAuthor}>{item.sender.name}</ThemedText>
      <ThemedText style={styles.messageContent}>{item.content}</ThemedText>
      <ThemedText style={styles.messageTime}>
        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </ThemedText>
    </ThemedView>
  );
  
  // Render the content for the current tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'chat':
        return (
          <View style={styles.tabContent}>
            <FlatList
              data={chatMessages}
              renderItem={renderChatMessage}
              keyExtractor={(item) => item.id}
              inverted
              style={styles.chatList}
              contentContainerStyle={styles.chatListContent}
            />
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: colorScheme === 'dark' ? '#374151' : '#f9f9f9',
                    color: colorScheme === 'dark' ? '#fff' : '#000'
                  }
                ]}
                placeholder="Type a message..."
                placeholderTextColor={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'}
                value={chatMessage}
                onChangeText={setChatMessage}
                multiline
              />
              <TouchableOpacity 
                style={[
                  styles.sendButton,
                  !chatMessage.trim() ? styles.disabledButton : {}
                ]} 
                onPress={sendChatMessage}
                disabled={loading || !chatMessage.trim()}
              >
                <Ionicons 
                  name="send" 
                  size={20} 
                  color={chatMessage.trim() ? '#ffffff' : '#cccccc'} 
                />
              </TouchableOpacity>
            </View>
          </View>
        );
        
      case 'request':
        return (
          <View style={styles.tabContent}>
            <ThemedText style={styles.tabTitle}>Request a Song</ThemedText>
            
            <ThemedText style={styles.label}>Song Title</ThemedText>
            <TextInput
              style={[
                styles.songInput,
                { 
                  backgroundColor: colorScheme === 'dark' ? '#374151' : '#f9f9f9',
                  color: colorScheme === 'dark' ? '#fff' : '#000'
                }
              ]}
              placeholder="Enter song title"
              placeholderTextColor={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'}
              value={songRequest.song}
              onChangeText={(text) => setSongRequest({ ...songRequest, song: text })}
            />
            
            <ThemedText style={styles.label}>Artist (optional)</ThemedText>
            <TextInput
              style={[
                styles.songInput,
                { 
                  backgroundColor: colorScheme === 'dark' ? '#374151' : '#f9f9f9',
                  color: colorScheme === 'dark' ? '#fff' : '#000'
                }
              ]}
              placeholder="Enter artist name"
              placeholderTextColor={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'}
              value={songRequest.artist}
              onChangeText={(text) => setSongRequest({ ...songRequest, artist: text })}
            />
            
            <TouchableOpacity 
              style={[
                styles.requestButton, 
                (!songRequest.song.trim() || loading) ? styles.disabledButton : {}
              ]} 
              onPress={sendSongRequest}
              disabled={!songRequest.song.trim() || loading}
            >
              <ThemedText style={styles.requestButtonText}>
                {loading ? 'Sending...' : 'Submit Request'}
              </ThemedText>
            </TouchableOpacity>
            
            <ThemedText style={styles.requestNote}>
              Your song request will be sent to the DJ. They'll try to play your request if possible.
            </ThemedText>
          </View>
        );
        
      case 'poll':
        return (
          <View style={styles.tabContent}>
            <ThemedText style={styles.tabTitle}>
              {activePoll ? 'Current Poll' : 'No Active Polls'}
            </ThemedText>
            
            {activePoll ? (
              <View style={styles.pollContainer}>
                <ThemedText style={styles.pollQuestion}>{activePoll.question}</ThemedText>
                
                {activePoll.options.map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.pollOption,
                      userVote === option.id && styles.selectedPollOption
                    ]}
                    onPress={() => submitPollVote(option.id)}
                    disabled={!!userVote || loading}
                  >
                    <View style={styles.pollOptionContent}>
                      <ThemedText style={[
                        styles.pollOptionText,
                        userVote === option.id && styles.selectedPollOptionText
                      ]}>
                        {option.text}
                      </ThemedText>
                      
                      {userVote === option.id && (
                        <Ionicons 
                          name="checkmark-circle" 
                          size={20} 
                          color="#ffffff" 
                          style={styles.pollCheckmark} 
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
                
                {userVote && (
                  <ThemedText style={styles.votedText}>
                    Thanks for voting! Results will be shared by the DJ.
                  </ThemedText>
                )}
              </View>
            ) : (
              <View style={styles.noPollContainer}>
                <MaterialCommunityIcons 
                  name="poll" 
                  size={48} 
                  color={Colors[colorScheme].text} 
                  opacity={0.5}
                />
                <ThemedText style={styles.noPollText}>
                  There are no active polls at the moment.
                </ThemedText>
                <ThemedText style={styles.noPollSubtext}>
                  Check back later during the broadcast.
                </ThemedText>
              </View>
            )}
          </View>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
      style={styles.container}
    >
      <ThemedView style={styles.panel}>
        {/* Tab Navigation */}
        <View style={styles.tabBar}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'chat' && styles.activeTab]} 
            onPress={() => setActiveTab('chat')}
          >
            <Ionicons 
              name="chatbubble" 
              size={20} 
              color={activeTab === 'chat' 
                ? (colorScheme === 'dark' ? '#ffffff' : '#8a2424') 
                : Colors[colorScheme].text} 
            />
            <ThemedText 
              style={[
                styles.tabText, 
                activeTab === 'chat' && styles.activeTabText
              ]}
            >
              Chat
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'request' && styles.activeTab]} 
            onPress={() => setActiveTab('request')}
          >
            <MaterialCommunityIcons 
              name="music-note" 
              size={20} 
              color={activeTab === 'request' 
                ? (colorScheme === 'dark' ? '#ffffff' : '#8a2424') 
                : Colors[colorScheme].text} 
            />
            <ThemedText 
              style={[
                styles.tabText, 
                activeTab === 'request' && styles.activeTabText
              ]}
            >
              Request
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'poll' && styles.activeTab]} 
            onPress={() => setActiveTab('poll')}
          >
            <MaterialCommunityIcons 
              name="poll" 
              size={20} 
              color={activeTab === 'poll' 
                ? (colorScheme === 'dark' ? '#ffffff' : '#8a2424') 
                : Colors[colorScheme].text} 
            />
            <ThemedText 
              style={[
                styles.tabText, 
                activeTab === 'poll' && styles.activeTabText
              ]}
            >
              Poll
            </ThemedText>
          </TouchableOpacity>
        </View>
        
        {/* Tab Content */}
        {renderTabContent()}
      </ThemedView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  panel: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderColor: '#8a2424',
  },
  tabText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#8a2424',
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  tabTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  chatList: {
    flex: 1,
  },
  chatListContent: {
    paddingTop: 10,
  },
  chatMessage: {
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    maxWidth: '80%',
  },
  incomingMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
    borderTopLeftRadius: 4,
  },
  outgoingMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#8a2424',
    borderTopRightRadius: 4,
  },
  messageAuthor: {
    fontWeight: '600',
    fontSize: 13,
    marginBottom: 2,
  },
  messageContent: {
    fontSize: 15,
  },
  messageTime: {
    fontSize: 11,
    alignSelf: 'flex-end',
    marginTop: 4,
    opacity: 0.7,
  },
  inputContainer: {
    flexDirection: 'row',
    marginTop: 16,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8a2424',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: '#cccccc',
    opacity: 0.7,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  songInput: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  requestButton: {
    backgroundColor: '#8a2424',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  requestButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  requestNote: {
    marginTop: 16,
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
  pollContainer: {
    marginTop: 8,
  },
  pollQuestion: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  pollOption: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  selectedPollOption: {
    backgroundColor: '#8a2424',
  },
  pollOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pollOptionText: {
    fontSize: 15,
  },
  selectedPollOptionText: {
    color: 'white',
    fontWeight: '500',
  },
  pollCheckmark: {
    marginLeft: 8,
  },
  votedText: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 14,
    fontStyle: 'italic',
  },
  noPollContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noPollText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  noPollSubtext: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
  },
});

export default BroadcastInteractionPanel;
