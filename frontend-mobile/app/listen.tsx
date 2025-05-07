import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ColorPalette } from '@/constants/ColorPalette';
import { Ionicons } from '@expo/vector-icons';
import { useBroadcasts, useChat, useSongRequests, usePolls } from '@/services/api';
import { SendChatMessageRequest, CreateSongRequestRequest, VotePollRequest } from '@/services/api/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { broadcastService } from '@/services/api/endpoints/broadcastService';

export default function ListenScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'request', 'poll'
  const [isPlaying, setIsPlaying] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [artist, setArtist] = useState('');
  const scrollViewRef = useRef(null);

  // API data hooks
  const { useActiveBroadcast } = useBroadcasts();
  const { useBroadcastMessages, sendMessage } = useChat();
  const { useBroadcastSongRequests, createSongRequest } = useSongRequests();
  const { useActiveBroadcastPolls, votePoll } = usePolls();

  // Use a state flag to control if we should fetch the active broadcast
  const [shouldFetchBroadcast, setShouldFetchBroadcast] = useState(true);

  // Create a modified version of the useActiveBroadcast hook that includes our enabled flag
  const activeBroadcastQuery = useActiveBroadcast(shouldFetchBroadcast);
  
  // Handle 400 errors by disabling future polling
  useEffect(() => {
    if (activeBroadcastQuery.isError && activeBroadcastQuery.error) {
      const error = activeBroadcastQuery.error as any;
      if (error.status === 400) {
        console.log('No active broadcast available, stopping polling');
        setShouldFetchBroadcast(false);
      }
    }
  }, [activeBroadcastQuery.isError, activeBroadcastQuery.error]);

  // Recovery mechanism - periodically check if a broadcast has become active
  useEffect(() => {
    if (!shouldFetchBroadcast) {
      // Set up a timer to check every 60 seconds if a broadcast has become active
      const recoveryTimer = setInterval(async () => {
        try {
          console.log('Checking if broadcast has become active...');
          const broadcast = await broadcastService.getActiveBroadcast();
          if (broadcast) {
            console.log('Broadcast is now active, resuming polling');
            setShouldFetchBroadcast(true);
            clearInterval(recoveryTimer);
          }
        } catch (error) {
          // Ignore errors during recovery check
          console.log('Still no active broadcast');
        }
      }, 60000); // Check every 60 seconds
      
      // Clean up the timer when component unmounts
      return () => clearInterval(recoveryTimer);
    }
  }, [shouldFetchBroadcast]);

  const broadcastId = activeBroadcastQuery.data?.id;
  
  const { data: messages, isLoading: messagesLoading } = useBroadcastMessages(
    broadcastId || 0, 
    !!broadcastId
  );
  
  const { data: songRequests, isLoading: songRequestsLoading } = useBroadcastSongRequests(
    broadcastId || 0, 
    !!broadcastId
  );
  
  const { data: activePolls, isLoading: pollsLoading } = useActiveBroadcastPolls(
    broadcastId || 0, 
    !!broadcastId
  );

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages && messages.length > 0 && scrollViewRef.current) {
      setTimeout(() => {
        // @ts-ignore
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Toggle play/pause
  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
    // NOTE: Audio streaming functionality is currently disabled until streaming API is available
    Alert.alert('Streaming Disabled', 'Audio streaming is temporarily unavailable.');
  };

  // Send a chat message
  const handleSendMessage = () => {
    if (!chatMessage.trim() || !broadcastId) return;
    
    const messageData: SendChatMessageRequest = {
      content: chatMessage
    };
    
    sendMessage.mutate(
      { broadcastId, data: messageData },
      {
        onSuccess: () => {
          setChatMessage('');
        },
        onError: (error) => {
          Alert.alert('Error', 'Failed to send message');
          console.error('Send message error:', error);
        }
      }
    );
  };

  // Submit a song request
  const handleSubmitRequest = () => {
    if ((!songTitle.trim() || !artist.trim()) || !broadcastId) return;
    
    const requestData: CreateSongRequestRequest = {
      songTitle,
      artist
    };
    
    createSongRequest.mutate(
      { broadcastId, data: requestData },
      {
        onSuccess: () => {
          Alert.alert('Success', 'Your song request has been submitted!');
          setSongTitle('');
          setArtist('');
        },
        onError: (error) => {
          Alert.alert('Error', 'Failed to submit song request');
          console.error('Song request error:', error);
        }
      }
    );
  };

  // Vote on a poll
  const handleVotePoll = (pollId: number, optionId: number) => {
    if (!broadcastId) return;
    
    const voteData: VotePollRequest = {
      optionId
    };
    
    votePoll.mutate(
      { pollId, data: voteData },
      {
        onSuccess: () => {
          // The UI will update automatically through react-query
        },
        onError: (error) => {
          Alert.alert('Error', 'Failed to submit vote');
          console.error('Vote error:', error);
        }
      }
    );
  };

  // Determine if we should show a loading state
  const isLoading = activeBroadcastQuery.isLoading;
  const isOffAir = !isLoading && !activeBroadcastQuery.data;

  // Render the appropriate tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'chat':
        return (
          <View style={styles.tabContent}>
            {messagesLoading ? (
              <ActivityIndicator size="large" color={ColorPalette.cordovan.DEFAULT} />
            ) : messages && messages.length > 0 ? (
              <ScrollView 
                ref={scrollViewRef}
                style={styles.chatContainer}
                contentContainerStyle={styles.chatContentContainer}
              >
                {messages.map(message => (
                  <View key={message.id} style={styles.messageContainer}>
                    <Text style={styles.messageSender}>{message.sender.name}</Text>
                    <Text style={styles.messageContent}>{message.content}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={[styles.emptyContainer, isOffAir && styles.offAirEmptyContainer]}>
                <Ionicons 
                  name="chatbubble-ellipses-outline" 
                  size={40} 
                  color={isOffAir ? ColorPalette.cordovan[300] : ColorPalette.cordovan[400]} 
                  style={{ marginBottom: 12 }} 
                />
                <Text style={styles.emptyText}>No messages yet</Text>
                <Text style={styles.emptySubtext}>Messages will appear here when the conversation starts</Text>
              </View>
            )}
            
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.textInput, isOffAir && styles.disabledInput]}
                placeholder="Type a message..."
                value={chatMessage}
                onChangeText={setChatMessage}
                placeholderTextColor={ColorPalette.black[400]}
                editable={!isOffAir}
              />
              <TouchableOpacity 
                style={[styles.sendButton, (isOffAir || !chatMessage.trim()) && styles.disabledButton]}
                onPress={handleSendMessage}
                disabled={isOffAir || !chatMessage.trim() || !broadcastId}
              >
                <Ionicons 
                  name="send" 
                  size={22} 
                  color={isOffAir || !chatMessage.trim() ? ColorPalette.black[400] : ColorPalette.white.DEFAULT} 
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>
              {isOffAir ? 'Chat is only available during live broadcasts' : 'Send your message to the DJ'}
            </Text>
          </View>
        );

      case 'request':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Request a Song</Text>
            
            <View style={{ marginTop: 5 }}>
              <Text style={styles.inputLabel}>Song Title</Text>
              <TextInput
                style={[styles.fullWidthInput, isOffAir && styles.disabledInput]}
                placeholder="Enter song title"
                value={songTitle}
                onChangeText={setSongTitle}
                placeholderTextColor={ColorPalette.black[400]}
                editable={!isOffAir}
              />
              
              <Text style={styles.inputLabel}>Artist</Text>
              <TextInput
                style={[styles.fullWidthInput, isOffAir && styles.disabledInput]}
                placeholder="Enter artist name"
                value={artist}
                onChangeText={setArtist}
                placeholderTextColor={ColorPalette.black[400]}
                editable={!isOffAir}
              />
              
              <TouchableOpacity 
                style={[
                  styles.submitButton,
                  (isOffAir || !songTitle.trim() || !artist.trim() || !broadcastId) && styles.disabledButton
                ]}
                onPress={handleSubmitRequest}
                disabled={isOffAir || !songTitle.trim() || !artist.trim() || !broadcastId}
              >
                <Text style={styles.submitButtonText}>Submit Request</Text>
              </TouchableOpacity>
              
              <Text style={styles.helperText}>
                {isOffAir ? 'Song requests are only available during live broadcasts' : 'Request your favorite song to hear it on air'}
              </Text>
            </View>
          </View>
        );

      case 'poll':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>DJ Poll</Text>
            
            {pollsLoading ? (
              <ActivityIndicator size="large" color={ColorPalette.cordovan.DEFAULT} />
            ) : activePolls && activePolls.length > 0 ? (
              <ScrollView style={styles.pollContainer}>
                {activePolls.map(poll => (
                  <View key={poll.id} style={styles.pollCard}>
                    <Text style={styles.pollQuestion}>{poll.question}</Text>
                    
                    {poll.options.map(option => (
                      <TouchableOpacity 
                        key={option.id}
                        style={[styles.pollOption, isOffAir && styles.disabledPollOption]}
                        onPress={() => handleVotePoll(poll.id, option.id)}
                        disabled={isOffAir}
                      >
                        <Text style={styles.pollOptionText}>{option.text}</Text>
                        <Text style={styles.pollVoteCount}>{option.voteCount} votes</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={[styles.emptyContainer, isOffAir && styles.offAirEmptyContainer]}>
                <Ionicons 
                  name="bar-chart-outline" 
                  size={40} 
                  color={isOffAir ? ColorPalette.cordovan[300] : ColorPalette.cordovan[400]} 
                  style={{ marginBottom: 12 }} 
                />
                <Text style={styles.emptyText}>No active polls</Text>
                <Text style={styles.emptySubtext}>
                  {isOffAir ? 'Polls will appear during live broadcasts' : 'No polls have been created yet'}
                </Text>
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[
      styles.container,
      isOffAir && { backgroundColor: ColorPalette.antiFlashWhite.DEFAULT }
    ]}>
      <StatusBar style={isOffAir ? "dark" : "light"} />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 40}
      >
        {/* Header with status indicator */}
        <View style={[
          styles.statusContainer,
          isOffAir && { backgroundColor: ColorPalette.antiFlashWhite.DEFAULT }
        ]}>
          <View style={[
            styles.statusPill,
            isOffAir ? 
              { backgroundColor: ColorPalette.cordovan[300], borderWidth: 1, borderColor: ColorPalette.mikadoYellow.DEFAULT } : 
              { backgroundColor: ColorPalette.black[700] }
          ]}>
            <Text style={styles.statusText}>
              {isLoading ? 'CONNECTING...' : isOffAir ? 'OFF AIR' : 'ON AIR'}
            </Text>
          </View>
        </View>
        
        {/* Radio info */}
        <View style={[
          styles.radioInfoContainer,
          isOffAir ? { 
            backgroundColor: ColorPalette.white.DEFAULT,
            marginHorizontal: 20,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: ColorPalette.mikadoYellow[600],
            shadowColor: ColorPalette.black.DEFAULT,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
          } : null
        ]}>
          <Text style={[
            styles.radioTitle,
            isOffAir && { color: ColorPalette.cordovan.DEFAULT }
          ]}>WildCats Radio</Text>
          <Text style={[
            styles.broadcastInfo,
            isOffAir && { color: ColorPalette.black[600], opacity: 0.7 }
          ]}>
            {isLoading ? 'Loading...' : 
             isOffAir ? 'No broadcast currently active' : 
             `${activeBroadcastQuery.data?.title} with ${activeBroadcastQuery.data?.dj?.name || 'Unknown DJ'}`}
          </Text>
        </View>
        
        {/* Player controls */}
        <View style={[
          styles.playerContainer,
          isOffAir && { backgroundColor: ColorPalette.antiFlashWhite.DEFAULT }
        ]}>
          <TouchableOpacity 
            style={[
              styles.playButton, 
              isOffAir && { 
                backgroundColor: ColorPalette.cordovan[300],
                borderColor: ColorPalette.mikadoYellow.DEFAULT,
                borderWidth: 2,
                opacity: 0.85 
              }
            ]}
            onPress={togglePlayPause}
            disabled={isOffAir}
          >
            <Ionicons 
              name={isPlaying ? "pause" : "play"} 
              size={34} 
              color={ColorPalette.white.DEFAULT} 
            />
          </TouchableOpacity>
        </View>
        
        {/* Tab navigation */}
        <View style={[
          styles.tabBar,
          isOffAir && { 
            borderTopWidth: 1,
            borderTopColor: ColorPalette.antiFlashWhite[400]
          }
        ]}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'chat' && styles.activeTabButton]}
            onPress={() => setActiveTab('chat')}
          >
            <Ionicons 
              name="chatbubble-outline" 
              size={24} 
              color={activeTab === 'chat' ? ColorPalette.cordovan.DEFAULT : ColorPalette.black[600]} 
            />
            <Text style={[styles.tabText, activeTab === 'chat' && styles.activeTabText]}>Chat</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'request' && styles.activeTabButton]}
            onPress={() => setActiveTab('request')}
          >
            <Ionicons 
              name="musical-notes-outline" 
              size={24} 
              color={activeTab === 'request' ? ColorPalette.cordovan.DEFAULT : ColorPalette.black[600]} 
            />
            <Text style={[styles.tabText, activeTab === 'request' && styles.activeTabText]}>Request</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'poll' && styles.activeTabButton]}
            onPress={() => setActiveTab('poll')}
          >
            <Ionicons 
              name="stats-chart-outline" 
              size={24} 
              color={activeTab === 'poll' ? ColorPalette.cordovan.DEFAULT : ColorPalette.black[600]} 
            />
            <Text style={[styles.tabText, activeTab === 'poll' && styles.activeTabText]}>Poll</Text>
          </TouchableOpacity>
        </View>
        
        {/* Tab content */}
        {renderTabContent()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ColorPalette.cordovan.DEFAULT,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  statusContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  statusPill: {
    backgroundColor: ColorPalette.black[700],
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  statusText: {
    color: ColorPalette.white.DEFAULT,
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 1,
  },
  radioInfoContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    borderRadius: 4,
  },
  radioTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: ColorPalette.white.DEFAULT,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  broadcastInfo: {
    fontSize: 18,
    color: ColorPalette.white.DEFAULT,
    opacity: 0.9,
    maxWidth: '80%',
    textAlign: 'center',
  },
  playerContainer: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: ColorPalette.cordovan[700],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
    borderWidth: 3,
    borderColor: ColorPalette.cordovan[800],
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: ColorPalette.antiFlashWhite.DEFAULT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 4,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  activeTabButton: {
    borderBottomWidth: 3,
    borderBottomColor: ColorPalette.mikadoYellow.DEFAULT,
  },
  tabText: {
    fontSize: 15,
    marginLeft: 6,
    color: ColorPalette.black[600],
    fontWeight: '500',
  },
  activeTabText: {
    fontWeight: 'bold',
    color: ColorPalette.cordovan.DEFAULT,
  },
  tabContent: {
    flex: 1,
    backgroundColor: ColorPalette.antiFlashWhite[700],
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 90 : 70, // Add extra padding at the bottom to avoid overlap with the BottomNavigationView
  },
  tabTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: ColorPalette.black[600],
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  chatContainer: {
    flex: 1,
    marginBottom: 16,
  },
  chatContentContainer: {
    paddingVertical: 10,
  },
  messageContainer: {
    backgroundColor: ColorPalette.white.DEFAULT,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageSender: {
    fontWeight: 'bold',
    fontSize: 15,
    color: ColorPalette.cordovan.DEFAULT,
    marginBottom: 5,
  },
  messageContent: {
    fontSize: 15,
    color: ColorPalette.black[600],
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 6,
  },
  textInput: {
    flex: 1,
    backgroundColor: ColorPalette.white.DEFAULT,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginRight: 12,
    color: ColorPalette.black[600],
    fontSize: 15,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sendButton: {
    backgroundColor: ColorPalette.cordovan.DEFAULT,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    borderWidth: 1,
    borderColor: ColorPalette.mikadoYellow.DEFAULT,
  },
  helperText: {
    fontSize: 13,
    color: ColorPalette.black[600],
    textAlign: 'center',
    marginTop: 2,
    fontStyle: 'italic',
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: ColorPalette.black[600],
    marginBottom: 4,
    marginTop: 2,
  },
  fullWidthInput: {
    backgroundColor: ColorPalette.white.DEFAULT,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
    color: ColorPalette.black[600],
    fontSize: 15,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  submitButton: {
    backgroundColor: ColorPalette.cordovan.DEFAULT,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: ColorPalette.mikadoYellow.DEFAULT,
  },
  disabledButton: {
    backgroundColor: ColorPalette.cordovan[300],
    opacity: 0.7,
  },
  submitButtonText: {
    color: ColorPalette.white.DEFAULT,
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  pollContainer: {
    flex: 1,
  },
  pollCard: {
    backgroundColor: ColorPalette.white.DEFAULT,
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  pollQuestion: {
    fontSize: 17,
    fontWeight: 'bold',
    color: ColorPalette.black[600],
    marginBottom: 16,
    lineHeight: 22,
  },
  pollOption: {
    backgroundColor: ColorPalette.antiFlashWhite[600],
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ColorPalette.antiFlashWhite[400],
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  pollOptionText: {
    fontSize: 15,
    color: ColorPalette.black[600],
    flex: 1,
  },
  pollVoteCount: {
    fontSize: 13,
    color: ColorPalette.cordovan.DEFAULT,
    fontWeight: 'bold',
    backgroundColor: ColorPalette.mikadoYellow[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: ColorPalette.mikadoYellow[300],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  offAirEmptyContainer: {
    backgroundColor: ColorPalette.white.DEFAULT,
    borderRadius: 16,
    padding: 30,
    margin: 10,
    borderWidth: 1,
    borderColor: ColorPalette.mikadoYellow[400],
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  emptyText: {
    fontSize: 18,
    color: ColorPalette.black[600],
    fontWeight: '500',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 15,
    color: ColorPalette.black[500],
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: '80%',
  },
  offAirContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ColorPalette.white.DEFAULT,
    padding: 24,
    borderRadius: 16,
    margin: 16,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  offAirText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: ColorPalette.black[600],
    marginBottom: 10,
  },
  offAirSubtext: {
    fontSize: 15,
    color: ColorPalette.black[500],
    textAlign: 'center',
    lineHeight: 20,
  },
  disabledInput: {
    backgroundColor: ColorPalette.antiFlashWhite[500],
    opacity: 0.7,
  },
  disabledPollOption: {
    backgroundColor: ColorPalette.antiFlashWhite[500],
    opacity: 0.7,
  },
}); 