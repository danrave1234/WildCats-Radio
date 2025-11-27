import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  RefreshControl,
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { broadcastService, Broadcast, ChatMessage } from '../../services/broadcastService';
import { chatService } from '../../services/chatService';
import { pollService, Poll } from '../../services/pollService';
import { songRequestService, SongRequest } from '../../services/songRequestService';
import { useAudioStreaming } from '../../hooks/useAudioStreaming';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { getUpcomingBroadcasts } from '../../services/userService';

// Types
interface StreamStatus {
  isLive: boolean;
  listenerCount: number;
  streamUrl: string;
}

interface TabDefinition {
  key: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const BroadcastScreen: React.FC = () => {
  const router = useRouter();
  const { currentUser, isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const [streamingState, streamingActions] = useAudioStreaming();
  const [currentBroadcast, setCurrentBroadcast] = useState<Broadcast | null>(null);
  const [upcomingBroadcasts, setUpcomingBroadcasts] = useState<Broadcast[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [songRequests, setSongRequests] = useState<SongRequest[]>([]);
  const [activePolls, setActivePolls] = useState<Poll[]>([]);
  const [activeTab, setActiveTab] = useState('chat');
  const [chatInput, setChatInput] = useState('');
  const [songTitleInput, setSongTitleInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingChat, setIsRefreshingChat] = useState(false);
  const [isRefreshingRequests, setIsRefreshingRequests] = useState(false);
  const [isRefreshingPolls, setIsRefreshingPolls] = useState(false);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>({
    isLive: false,
    listenerCount: 0,
    streamUrl: 'https://icecast.software/live.mp3',
  });
  const [isStreamReady, setIsStreamReady] = useState(false);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [recoveryNotification, setRecoveryNotification] = useState<{ message: string; timestamp: number } | null>(null);
  
  const chatScrollViewRef = useRef<ScrollView>(null);
  const chatConnectionRef = useRef<any>(null);
  const pollConnectionRef = useRef<any>(null);
  const hasAttemptedAutoPlayRef = useRef(false);
  const currentBroadcastRef = useRef<Broadcast | null>(null);
  
  const [tabLayouts, setTabLayouts] = useState<Record<string, { x: number; width: number } | undefined>>({});
  const underlinePosition = useRef(new Animated.Value(0)).current;
  const underlineWidth = useRef(new Animated.Value(0)).current;
  const [isInitialLayoutDone, setIsInitialLayoutDone] = useState(false);

  const tabDefinitions: TabDefinition[] = useMemo(() => [
    { name: 'Chat', icon: 'chatbubbles-outline', key: 'chat' },
    { name: 'Requests', icon: 'musical-notes-outline', key: 'requests' },
    { name: 'Polls', icon: 'stats-chart-outline', key: 'polls' },
  ], []);

  // Keep ref updated
  useEffect(() => {
    currentBroadcastRef.current = currentBroadcast;
  }, [currentBroadcast]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatMessages.length > 0 && activeTab === 'chat') {
      setTimeout(() => {
        chatScrollViewRef.current?.scrollToEnd({ animated: true });
      }, 200);
    }
  }, [chatMessages.length, activeTab]);

  // Tab underline animation
  useEffect(() => {
    const currentTabLayout = tabLayouts[activeTab];
    if (currentTabLayout && currentTabLayout.width > 0) {
      if (!isInitialLayoutDone && activeTab === tabDefinitions[0].key) {
        underlinePosition.setValue(currentTabLayout.x);
        underlineWidth.setValue(currentTabLayout.width);
        setIsInitialLayoutDone(true);
      } else if (isInitialLayoutDone) {
        Animated.parallel([
          Animated.timing(underlinePosition, {
            toValue: currentTabLayout.x,
            duration: 250,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(underlineWidth, {
            toValue: currentTabLayout.width,
            duration: 250,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false,
          }),
        ]).start();
      }
    }
  }, [activeTab, tabLayouts, isInitialLayoutDone, tabDefinitions, underlinePosition, underlineWidth]);

  // Fetch current broadcast
  const fetchBroadcast = useCallback(async () => {
    try {
      const broadcasts = await broadcastService.getLiveBroadcasts();
      if (broadcasts && broadcasts.length > 0) {
        const broadcast = broadcasts[0];
        setCurrentBroadcast(broadcast);
        const isLive = broadcast.status === 'LIVE';
        setStreamStatus(prev => ({ ...prev, isLive }));
        
        const streamConfig = await broadcastService.getStreamConfig();
        setStreamStatus(prev => ({
          ...prev,
          listenerCount: streamConfig.listenerCount,
          streamUrl: streamConfig.streamUrl,
        }));

        await streamingActions.updateStreamConfig({
          streamUrl: streamConfig.streamUrl,
          listenerCount: streamConfig.listenerCount,
          isLive,
        });

        if (isLive && streamConfig.streamUrl) {
          try {
            await streamingActions.loadStream(streamConfig.streamUrl);
            setIsStreamReady(true);
          } catch (error) {
            console.error('Failed to load stream:', error);
          }
        }
      } else {
        setCurrentBroadcast(null);
        setStreamStatus(prev => ({ ...prev, isLive: false }));
        if (streamingState.isPlaying) {
          await streamingActions.stop();
        }
        // Fetch upcoming broadcasts
        try {
          const upcoming = await getUpcomingBroadcasts();
          if (!('error' in upcoming)) {
            // Map to Broadcast type from broadcastService
            setUpcomingBroadcasts(upcoming.slice(0, 3).map(b => ({
              id: b.id,
              title: b.title,
              description: b.description,
              status: (b.status === 'SCHEDULED' || b.status === 'LIVE' || b.status === 'ENDED') ? b.status : undefined,
              dj: b.dj,
              scheduledStart: b.scheduledStart,
              actualStart: b.actualStart,
            })));
          }
        } catch (e) {
          console.error('Failed to fetch upcoming broadcasts:', e);
        }
      }
    } catch (error) {
      console.error('Failed to fetch broadcast:', error);
    }
  }, [streamingActions, streamingState.isPlaying]);

  // Fetch chat messages
  const fetchChatMessages = useCallback(async () => {
    if (!currentBroadcast?.id) {
      setChatMessages([]);
      return;
    }
    
    const requestBroadcastId = currentBroadcast.id;
    try {
      const messages = await broadcastService.getChatMessages(requestBroadcastId);
      
      // Only update if still the same broadcast
      if (currentBroadcast?.id === requestBroadcastId) {
        // Filter messages to ensure they're for the current broadcast
        const filteredMessages = Array.isArray(messages) 
          ? messages.filter((msg: ChatMessage) => msg.broadcastId === requestBroadcastId)
          : [];
        setChatMessages(filteredMessages);
      }
    } catch (error: any) {
      console.error('Failed to fetch chat messages:', error);
      // Don't clear messages on error, just log it
      // The WebSocket will handle real-time updates anyway
    }
  }, [currentBroadcast?.id]);

  // Fetch song requests
  const fetchSongRequests = useCallback(async () => {
    if (!currentBroadcast?.id || !isAuthenticated) return;
    try {
      // Note: Need auth token - for now using placeholder
      // const result = await songRequestService.getSongRequests(currentBroadcast.id, authToken);
      // if (!('error' in result)) {
      //   setSongRequests(result.data || []);
      // }
    } catch (error) {
      console.error('Failed to fetch song requests:', error);
    }
  }, [currentBroadcast?.id, isAuthenticated]);

  // Fetch polls
  const fetchPolls = useCallback(async () => {
    if (!currentBroadcast?.id || !isAuthenticated) return;
    try {
      // Note: Need auth token - for now using placeholder
      // const result = await pollService.getActivePolls(currentBroadcast.id, authToken);
      // if (!('error' in result)) {
      //   setActivePolls(result.data || []);
      // }
    } catch (error) {
      console.error('Failed to fetch polls:', error);
    }
  }, [currentBroadcast?.id, isAuthenticated]);

  // Setup WebSocket for chat
  useEffect(() => {
    if (!currentBroadcast?.id) {
      if (chatConnectionRef.current) {
        chatConnectionRef.current.disconnect();
        chatConnectionRef.current = null;
        setIsWebSocketConnected(false);
      }
      return;
    }

    let isMounted = true;

    const setupChatWebSocket = async () => {
      try {
        if (chatConnectionRef.current) {
          try {
            chatConnectionRef.current.disconnect();
          } catch (e) {
            console.warn('Error disconnecting chat:', e);
          }
          chatConnectionRef.current = null;
        }
        
        if (!isMounted) return;
        
        const connection = await chatService.subscribeToChatMessages(
          currentBroadcast.id,
          undefined, // authToken - TODO: get from auth context
          (newMessage: ChatMessage) => {
            if (newMessage.broadcastId === currentBroadcast.id) {
              setChatMessages(prev => {
                const exists = prev.some(msg => msg.id === newMessage.id);
                if (exists) return prev;
                
                const newMessages = [...prev, newMessage];
                return newMessages.sort((a, b) => 
                  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );
              });
            }
          },
          {
            onConnectionChange: (connected: boolean) => {
              setIsWebSocketConnected(connected);
            },
            onError: (error: any) => {
              console.error('❌ Chat WebSocket error:', error);
              setIsWebSocketConnected(false);
            }
          }
        );
        
        if (isMounted) {
          chatConnectionRef.current = connection;
        } else {
          connection.disconnect();
        }
      } catch (error) {
        console.error('❌ Failed to setup chat WebSocket:', error);
        if (isMounted) {
          setIsWebSocketConnected(false);
        }
      }
    };

    setupChatWebSocket();

    return () => {
      isMounted = false;
      if (chatConnectionRef.current) {
        try {
          chatConnectionRef.current.disconnect();
        } catch (e) {
          console.warn('Error cleaning up chat connection:', e);
        }
        chatConnectionRef.current = null;
        setIsWebSocketConnected(false);
      }
    };
  }, [currentBroadcast?.id, isAuthenticated]);

  // Fallback polling for chat
  useEffect(() => {
    if (currentBroadcast?.id && !isWebSocketConnected) {
      fetchChatMessages();
      const interval = setInterval(fetchChatMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [currentBroadcast?.id, isWebSocketConnected, fetchChatMessages]);

  // Auto-play when broadcast goes live
  useEffect(() => {
    if (!currentBroadcast || currentBroadcast.status !== 'LIVE') {
      return;
    }

    if (hasAttemptedAutoPlayRef.current) {
      return;
    }

    if (!streamingState.isPlaying && !streamingState.isLoading && isStreamReady) {
      hasAttemptedAutoPlayRef.current = true;
      handleInstantTuneIn();
    }
  }, [currentBroadcast?.id, currentBroadcast?.status, isStreamReady, streamingState.isPlaying, streamingState.isLoading]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchBroadcast();
      if (currentBroadcast?.id) {
        await Promise.all([
          fetchChatMessages(),
          fetchSongRequests(),
          fetchPolls(),
        ]);
      }
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Refresh when broadcast changes
  useEffect(() => {
    if (currentBroadcast?.id) {
      fetchChatMessages();
      if (isAuthenticated) {
        fetchSongRequests();
        fetchPolls();
      }
    }
  }, [currentBroadcast?.id, isAuthenticated]);

  // Handle play/pause
  const handlePlayPause = useCallback(async () => {
    if (!currentBroadcast || currentBroadcast.status !== 'LIVE') {
      Alert.alert('Stream Unavailable', 'The broadcast is not currently live.');
      return;
    }

    if (streamingState.isLoading) {
      return;
    }

    try {
      if (isStreamReady || streamingState.isPlaying) {
        await streamingActions.togglePlayPause();
        return;
      }
        
      const mp3StreamUrl = 'https://icecast.software/live.mp3';
      try {
        await streamingActions.loadStream(mp3StreamUrl);
        setIsStreamReady(true);
        await streamingActions.togglePlayPause();
      } catch (error) {
        Alert.alert('Connection Error', 'Unable to connect to the audio stream.');
      }
    } catch (error: any) {
      Alert.alert('Playback Error', error.message || 'Failed to control audio playback.');
    }
  }, [isStreamReady, streamingState.isPlaying, streamingState.isLoading, streamingActions, currentBroadcast]);

  const handleInstantTuneIn = useCallback(async () => {
    if (streamingState.isLoading) return;
    await handlePlayPause();
  }, [handlePlayPause, streamingState.isLoading]);

  // Send chat message
  const handleSendMessage = useCallback(async () => {
    if (!chatInput.trim() || !currentBroadcast || !isAuthenticated) return;
    
    setIsSubmitting(true);
    try {
      await broadcastService.sendChatMessage(currentBroadcast.id, chatInput.trim());
      setChatInput('');
      await fetchChatMessages();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send message.');
      setChatInput(chatInput);
    } finally {
      setIsSubmitting(false);
    }
  }, [chatInput, currentBroadcast, isAuthenticated, fetchChatMessages]);

  // Create song request
  const handleCreateSongRequest = useCallback(async () => {
    if (!songTitleInput.trim() || !currentBroadcast || !isAuthenticated) {
      Alert.alert('Missing Info', 'Please enter a song title.');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await songRequestService.createSongRequest(
        currentBroadcast.id,
        { songTitle: songTitleInput.trim() }
      );
      
      if ('error' in result) {
        Alert.alert('Error', result.error || 'Failed to request song.');
        return;
      }
      
      Alert.alert('Success', 'Song requested successfully!');
      setSongTitleInput('');
      // Refresh song requests list
      await fetchSongRequests();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to request song.');
    } finally {
      setIsSubmitting(false);
    }
  }, [songTitleInput, currentBroadcast, isAuthenticated, fetchSongRequests]);

  // Vote on poll
  const handleVoteOnPoll = useCallback(async (pollId: number, optionId: number) => {
    if (!currentBroadcast || !isAuthenticated) return;
    setIsSubmitting(true);
    try {
      // TODO: Implement with auth token
      // const result = await pollService.voteOnPoll(pollId, { optionId }, authToken);
      await fetchPolls();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit vote.');
    } finally {
      setIsSubmitting(false);
    }
  }, [currentBroadcast, isAuthenticated, fetchPolls]);

  // Refresh handlers
  const refreshChatData = useCallback(async () => {
    if (!currentBroadcast?.id) return;
    setIsRefreshingChat(true);
    await fetchChatMessages();
    setIsRefreshingChat(false);
  }, [currentBroadcast?.id, fetchChatMessages]);

  const refreshRequestsData = useCallback(async () => {
    if (!currentBroadcast?.id || !isAuthenticated) return;
    setIsRefreshingRequests(true);
    await fetchSongRequests();
    setIsRefreshingRequests(false);
  }, [currentBroadcast?.id, isAuthenticated, fetchSongRequests]);

  const refreshPollsData = useCallback(async () => {
    if (!currentBroadcast?.id || !isAuthenticated) return;
    setIsRefreshingPolls(true);
    await fetchPolls();
    setIsRefreshingPolls(false);
  }, [currentBroadcast?.id, isAuthenticated, fetchPolls]);

  const refreshBroadcastData = useCallback(async () => {
    setIsRefreshing(true);
    await fetchBroadcast();
    setIsRefreshing(false);
  }, [fetchBroadcast]);

  // Render hero card
  const renderListenHero = () => {
    if (!currentBroadcast) {
      // Off Air Hero Card
  return (
        <View style={styles.listenHeroWrapper}>
      <LinearGradient
            colors={['#641B1F', '#2B0D13']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.listenHeroCard}
          >
            <View style={styles.heroHeaderRow}>
              <View style={[styles.liveStatusPill, { backgroundColor: '#4B5563' }]}>
                <View style={styles.liveStatusDot} />
                <Text style={styles.liveStatusText}>OFF AIR</Text>
              </View>
              <TouchableOpacity
                onPress={refreshBroadcastData}
                activeOpacity={0.8}
                style={styles.offAirRefreshButton}
              >
                <Ionicons name="refresh" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.instantListenButton}>
              <View style={[styles.instantListenIcon, { backgroundColor: '#4B5563' }]}>
                <Ionicons name="musical-notes-outline" size={26} color="#FFFFFF" />
              </View>
              <View style={styles.instantListenCopy}>
                <Text style={styles.instantListenLabel}>No Broadcast Active</Text>
                <Text style={styles.instantListenTitle}>Wildcat Radio</Text>
                {nextShowStart ? (
                  <Text style={styles.instantListenSubtitle}>
                    Next show: {nextShowStart}
                  </Text>
                ) : (
                  <Text style={styles.instantListenSubtitle}>
                    Check back soon for live broadcasts
                  </Text>
                )}
              </View>
              <View style={styles.instantListenRightIcon}>
                <Ionicons name="radio" size={22} color="#FFFFFF" />
              </View>
            </View>
          </LinearGradient>
        </View>
      );
    }

    const listenerDisplay = streamStatus.listenerCount || streamingState.listenerCount || 0;
    const heroHeadline = streamingState.isPlaying
      ? 'Listening Live'
      : streamingState.isLoading
        ? 'Connecting...'
        : 'Tap to Listen';

    const heroSubtitle = currentBroadcast.title;
    const heroMeta = currentBroadcast.dj?.name || 'Wildcat Radio';
    const isBroadcastLive = currentBroadcast.status === 'LIVE';

    return (
      <View style={styles.listenHeroWrapper}>
      <LinearGradient
          colors={['#120c1c', '#2b0f1d', '#441626']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.listenHeroCard}
        >
          <View style={styles.heroHeaderRow}>
            <View
              style={[
                styles.liveStatusPill,
                { backgroundColor: isBroadcastLive ? '#DC2626' : '#4B5563' },
              ]}
            >
              <View style={styles.liveStatusDot} />
              <Text style={styles.liveStatusText}>
                {isBroadcastLive ? 'LIVE RADIO' : 'STANDBY'}
              </Text>
            </View>
            <Text style={styles.listenerTicker}>
              {listenerDisplay.toLocaleString()} listening
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleInstantTuneIn}
            activeOpacity={0.9}
            disabled={!isBroadcastLive || streamingState.isLoading}
            style={[
              styles.instantListenButton,
              (!isBroadcastLive || streamingState.isLoading) && styles.instantListenButtonDisabled,
            ]}
          >
            <View style={styles.instantListenIcon}>
              {streamingState.isLoading ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <Ionicons
                  name={streamingState.isPlaying ? 'pause' : 'play'}
                  size={26}
                  color="#111827"
                />
              )}
            </View>
            <View style={styles.instantListenCopy}>
              <Text style={styles.instantListenLabel}>{heroHeadline}</Text>
              <Text style={styles.instantListenTitle}>{heroSubtitle}</Text>
              <Text style={styles.instantListenSubtitle}>with {heroMeta}</Text>
            </View>
            <View style={styles.instantListenRightIcon}>
              <Ionicons name="radio" size={22} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  };

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'chat':
        return (
          <View style={{ flex: 1, backgroundColor: '#0E0E10' }}>
            <ScrollView
              ref={chatScrollViewRef}
              style={{ flex: 1, backgroundColor: '#0E0E10' }}
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: chatMessages.length === 0 ? 'center' : 'flex-end',
                paddingTop: 12,
                paddingBottom: 12,
                paddingHorizontal: 0,
              }}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshingChat}
                  onRefresh={refreshChatData}
                  colors={['#91403E']}
                  tintColor="#91403E"
                />
              }
            >
              {chatMessages.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 }}>
                  <Ionicons name="chatbubbles-outline" size={48} color="#91403E" />
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#91403E', marginTop: 16, marginBottom: 8 }}>
                    Start the Conversation!
                  </Text>
                  <Text style={{ fontSize: 14, color: '#ADADB8', textAlign: 'center' }}>
                    Be the first to chat with the DJ and fellow listeners.
                  </Text>
                </View>
              ) : (
                chatMessages.map((message) => {
                  const isOwnMessage =
                    isAuthenticated &&
                    currentUser &&
                    (message.sender.id === currentUser.id ||
                      message.sender.name === `${currentUser.firstname} ${currentUser.lastname}`);
                  
                  return (
                    <View
                      key={message.id}
                      style={[
                        styles.chatMessage,
                        isOwnMessage && styles.chatMessageOwn,
                      ]}
                    >
                      <View style={styles.chatMessageHeader}>
                        <Text style={styles.chatMessageAuthor}>
                          {message.sender.name ||
                            `${message.sender.firstname || ''} ${message.sender.lastname || ''}`.trim() ||
                            'Anonymous'}
                        </Text>
                        <Text style={styles.chatMessageTime}>
                          {format(parseISO(message.createdAt), 'HH:mm')}
                        </Text>
                      </View>
                      <Text style={styles.chatMessageContent}>{message.content}</Text>
                    </View>
                  );
                })
              )}
            </ScrollView>

            {isAuthenticated && currentBroadcast && currentBroadcast.status === 'LIVE' ? (
              <View style={styles.chatInputContainer}>
                <TextInput
                  style={styles.chatInput}
                  placeholder="Send a message..."
                  placeholderTextColor="#ADADB8"
                  value={chatInput}
                  onChangeText={setChatInput}
                  onSubmitEditing={handleSendMessage}
                  multiline={false}
                  editable={!isSubmitting}
                />
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (!chatInput.trim() || isSubmitting) && styles.sendButtonDisabled,
                  ]}
                  onPress={handleSendMessage}
                  disabled={!chatInput.trim() || isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="send" size={20} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </View>
            ) : !isAuthenticated ? (
              <View style={styles.chatLoginPrompt}>
                <Text style={styles.chatLoginText}>Sign in to join the chat</Text>
              </View>
            ) : !currentBroadcast ? (
              <View style={styles.chatLoginPrompt}>
                <Text style={styles.chatLoginText}>Chat will be available when a broadcast goes LIVE</Text>
              </View>
            ) : (
              <View style={styles.chatLoginPrompt}>
                <Text style={styles.chatLoginText}>Chat is only available during live broadcasts</Text>
              </View>
            )}
          </View>
        );

      case 'requests':
        return (
          <View style={{ flex: 1, backgroundColor: '#0E0E10' }}>
            <ScrollView
              style={{ flex: 1, backgroundColor: '#0E0E10' }}
              contentContainerStyle={{ paddingBottom: 30, paddingHorizontal: 20, paddingTop: 16 }}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshingRequests}
                  onRefresh={refreshRequestsData}
                  colors={['#91403E']}
                  tintColor="#91403E"
                />
              }
            >
              {!isAuthenticated ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                  <Ionicons name="musical-notes-outline" size={48} color="#91403E" />
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#91403E', marginTop: 16, marginBottom: 8 }}>
                    Login to Request Songs
                  </Text>
                  <Text style={{ fontSize: 14, color: '#ADADB8', textAlign: 'center' }}>
                    Sign in to request your favorite songs.
                  </Text>
                </View>
              ) : !currentBroadcast ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                  <Ionicons name="musical-notes-outline" size={48} color="#91403E" />
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#91403E', marginTop: 16, marginBottom: 8 }}>
                    No Broadcast Active
                  </Text>
                  <Text style={{ fontSize: 14, color: '#ADADB8', textAlign: 'center' }}>
                    Song requests will be available when a broadcast goes LIVE.
                  </Text>
                </View>
              ) : currentBroadcast.status !== 'LIVE' ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                  <Ionicons name="musical-notes-outline" size={48} color="#91403E" />
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#91403E', marginTop: 16, marginBottom: 8 }}>
                    Broadcast Not Live
                  </Text>
                  <Text style={{ fontSize: 14, color: '#ADADB8', textAlign: 'center' }}>
                    Song requests are only available during live broadcasts.
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.requestInputContainer}>
                    <TextInput
                      style={styles.requestInput}
                      placeholder="Enter song title..."
                      placeholderTextColor="#ADADB8"
                      value={songTitleInput}
                      onChangeText={setSongTitleInput}
                      editable={!isSubmitting}
                    />
                    <TouchableOpacity
                      style={[styles.requestButton, (!songTitleInput.trim() || isSubmitting) && styles.requestButtonDisabled]}
                      onPress={handleCreateSongRequest}
                      disabled={!songTitleInput.trim() || isSubmitting}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Ionicons name="add" size={20} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  </View>

                  {songRequests.length === 0 ? (
                    <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                      <Text style={{ fontSize: 14, color: '#ADADB8' }}>No song requests yet</Text>
                    </View>
                  ) : (
                    songRequests.map((request) => (
                      <View key={request.id} style={styles.requestItem}>
                        <Ionicons name="musical-note" size={20} color="#91403E" style={{ marginRight: 12 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>{request.songTitle}</Text>
                          {request.artist && (
                            <Text style={{ fontSize: 12, color: '#ADADB8', marginTop: 2 }}>{request.artist}</Text>
                          )}
                        </View>
                      </View>
                    ))
                  )}
                </>
              )}
            </ScrollView>
          </View>
        );

      case 'polls':
        return (
          <View style={{ flex: 1, backgroundColor: '#0E0E10' }}>
            <ScrollView
              style={{ flex: 1, backgroundColor: '#0E0E10' }}
              contentContainerStyle={{ paddingBottom: 30, paddingHorizontal: 20, paddingTop: 16 }}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshingPolls}
                  onRefresh={refreshPollsData}
                  colors={['#91403E']}
                  tintColor="#91403E"
                />
              }
            >
              {!isAuthenticated ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                  <Ionicons name="stats-chart-outline" size={48} color="#91403E" />
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#91403E', marginTop: 16, marginBottom: 8 }}>
                    Login to Vote on Polls
                  </Text>
                  <Text style={{ fontSize: 14, color: '#ADADB8', textAlign: 'center' }}>
                    Sign in to participate in polls.
                  </Text>
                </View>
              ) : !currentBroadcast ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                  <Ionicons name="stats-chart-outline" size={48} color="#91403E" />
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#91403E', marginTop: 16, marginBottom: 8 }}>
                    No Broadcast Active
                  </Text>
                  <Text style={{ fontSize: 14, color: '#ADADB8', textAlign: 'center' }}>
                    Polls will be available when a broadcast goes LIVE.
                  </Text>
                </View>
              ) : currentBroadcast.status !== 'LIVE' ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                  <Ionicons name="stats-chart-outline" size={48} color="#91403E" />
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#91403E', marginTop: 16, marginBottom: 8 }}>
                    Broadcast Not Live
                  </Text>
                  <Text style={{ fontSize: 14, color: '#ADADB8', textAlign: 'center' }}>
                    Polls are only available during live broadcasts.
            </Text>
                </View>
              ) : activePolls.length === 0 ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, color: '#ADADB8' }}>No active polls</Text>
                </View>
              ) : (
                activePolls.map((poll) => {
                  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.voteCount, 0);
                  return (
                    <View key={poll.id} style={styles.pollCard}>
                      <Text style={styles.pollQuestion}>{poll.question}</Text>
                      {poll.options.map((option) => {
                        const percentage = totalVotes > 0 ? (option.voteCount / totalVotes) * 100 : 0;
                        return (
                          <TouchableOpacity
                            key={option.id}
                            style={styles.pollOption}
                            onPress={() => handleVoteOnPoll(poll.id, option.id)}
                            disabled={isSubmitting}
                          >
                            <View style={styles.pollOptionContent}>
                              <Text style={styles.pollOptionText}>{option.text}</Text>
                              <Text style={styles.pollOptionCount}>{option.voteCount} votes</Text>
                            </View>
                            <View style={styles.pollBarContainer}>
                              <View style={[styles.pollBar, { width: `${percentage}%` }]} />
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        );

      default:
        return null;
    }
  };

  const nextShow = upcomingBroadcasts.length > 0 ? upcomingBroadcasts[0] : null;
  const nextShowStart = useMemo(() => {
    if (!nextShow?.scheduledStart) return null;
    try {
      return format(parseISO(nextShow.scheduledStart), "EEEE, MMM d • h:mm a");
    } catch {
      return null;
    }
  }, [nextShow?.scheduledStart]);

  const nextShowHost = useMemo(() => {
    if (!nextShow) return null;
    return nextShow.dj?.name || null;
  }, [nextShow]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#91403E" />
          <Text style={styles.loadingText}>Loading broadcast...</Text>
        </View>
    </SafeAreaView>
    );
  }

  const isBroadcastLive = currentBroadcast?.status === 'LIVE';

  const handleBackPress = () => {
    router.push('/(tabs)/home' as any);
  };

  return (
    <View style={styles.container}>
      {/* Back Button - Top left corner */}
      <TouchableOpacity
        onPress={handleBackPress}
        style={[styles.backButton, { top: insets.top + (Platform.OS === 'ios' ? 8 : 12) }]}
        activeOpacity={0.8}
      >
        <Ionicons name="chevron-back" size={24} color="#FFC30B" />
      </TouchableOpacity>

      {/* Recovery Notification */}
      {recoveryNotification && (
        <View style={styles.recoveryNotification}>
          <Ionicons name="information-circle" size={20} color="#2563EB" style={{ marginRight: 8 }} />
          <Text style={styles.recoveryText}>{recoveryNotification.message}</Text>
        </View>
      )}

      {/* Always show tabs, even when no broadcast */}
      <View style={{ flex: 1, backgroundColor: '#0E0E10', paddingTop: 4 }}>
        {renderListenHero()}
        <View style={styles.tabContainer}>
          {!currentBroadcast && (
            <View style={styles.notLiveNotice}>
              <Text style={styles.notLiveText}>No broadcast currently active. Interactive features will be available when a broadcast goes LIVE.</Text>
            </View>
          )}
          {currentBroadcast && !isBroadcastLive && (
            <View style={styles.notLiveNotice}>
              <Text style={styles.notLiveText}>Interactive features unlock when the broadcast goes LIVE.</Text>
            </View>
          )}

          <View style={styles.tabBar}>
            {tabDefinitions.map(tab => (
              <Pressable
                key={tab.key}
                onLayout={(event) => {
                  const { x, width } = event.nativeEvent.layout;
                  setTabLayouts((prev) => ({ ...prev, [tab.key]: { x, width } }));
                }}
                style={({ pressed }) => [
                  { opacity: pressed && Platform.OS === 'ios' ? 0.7 : 1 },
                  styles.tabButton,
                ]}
                onPress={() => setActiveTab(tab.key)}
                disabled={isLoading}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={20}
                  color={isLoading ? '#4B5563' : (activeTab === tab.key ? '#91403E' : '#ADADB8')}
                />
                <Text
                  style={[
                    styles.tabText,
                    isLoading && styles.tabTextDisabled,
                    activeTab === tab.key && styles.tabTextActive,
                  ]}
                >
                  {tab.name}
                </Text>
              </Pressable>
            ))}
            <Animated.View
              style={{
                position: 'absolute',
                bottom: 0,
                height: 3,
                backgroundColor: '#B5830F',
                transform: [{ translateX: underlinePosition }],
                width: underlineWidth,
              }}
            />
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? (insets.bottom + 56) : 0}
          >
            {renderTabContent()}
          </KeyboardAvoidingView>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E0E10',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    padding: 8,
    zIndex: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0E0E10',
  },
  loadingText: {
    color: '#ADADB8',
    marginTop: 16,
    fontSize: 16,
  },
  recoveryNotification: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E3A5F',
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  recoveryText: {
    color: '#93C5FD',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  listenHeroWrapper: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  listenHeroCard: {
    borderRadius: 28,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  liveStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  liveStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginRight: 6,
  },
  liveStatusText: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 1,
    fontSize: 11,
  },
  listenerTicker: {
    color: '#FDE68A',
    fontSize: 13,
    fontWeight: '600',
  },
  instantListenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F23',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  instantListenButtonDisabled: {
    opacity: 0.6,
  },
  instantListenIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#91403E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instantListenCopy: {
    flex: 1,
    marginHorizontal: 16,
  },
  instantListenLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#ADADB8',
    fontWeight: '700',
    marginBottom: 4,
  },
  instantListenTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
    flexShrink: 1,
    flexWrap: 'wrap',
    lineHeight: 22,
  },
  instantListenSubtitle: {
    fontSize: 14,
    color: '#ADADB8',
    fontWeight: '600',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  instantListenRightIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    backgroundColor: '#18181B',
    flex: 1,
    minHeight: 300,
  },
  notLiveNotice: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#2A1F0F',
    borderBottomWidth: 1,
    borderBottomColor: '#91403E',
  },
  notLiveText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#18181B',
    borderBottomWidth: 1,
    borderBottomColor: '#26262C',
    position: 'relative',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  tabText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#ADADB8',
  },
  tabTextActive: {
    fontWeight: '600',
    color: '#91403E',
  },
  tabTextDisabled: {
    color: '#4B5563',
  },
  // Chat Styles
  chatMessage: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#1F1F23',
    borderRadius: 8,
    marginHorizontal: 16,
  },
  chatMessageOwn: {
    backgroundColor: '#26262C',
    borderLeftWidth: 3,
    borderLeftColor: '#91403E',
  },
  chatMessageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatMessageAuthor: {
    color: '#91403E',
    fontSize: 14,
    fontWeight: '700',
  },
  chatMessageTime: {
    color: '#ADADB8',
    fontSize: 12,
  },
  chatMessageContent: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#26262C',
    backgroundColor: '#18181B',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#1F1F23',
    color: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#26262C',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#91403E',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#3F3F46',
    opacity: 0.5,
  },
  chatLoginPrompt: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1F1F23',
    borderTopWidth: 1,
    borderTopColor: '#26262C',
  },
  chatLoginText: {
    color: '#ADADB8',
    fontSize: 14,
    textAlign: 'center',
  },
  // Requests Styles
  requestInputContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  requestInput: {
    flex: 1,
    backgroundColor: '#1F1F23',
    borderWidth: 1,
    borderColor: '#26262C',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#FFFFFF',
  },
  requestButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#91403E',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  requestButtonDisabled: {
    backgroundColor: '#3F3F46',
    opacity: 0.5,
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F23',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#26262C',
  },
  // Polls Styles
  pollCard: {
    backgroundColor: '#1F1F23',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#26262C',
  },
  pollQuestion: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  pollOption: {
    marginBottom: 12,
  },
  pollOptionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pollOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  pollOptionCount: {
    fontSize: 12,
    color: '#ADADB8',
  },
  pollBarContainer: {
    height: 8,
    backgroundColor: '#26262C',
    borderRadius: 4,
    overflow: 'hidden',
  },
  pollBar: {
    height: '100%',
    backgroundColor: '#91403E',
    borderRadius: 4,
  },
  // Off Air Styles
  offAirCard: {
    borderRadius: 28,
    padding: 24,
    width: '100%',
    marginBottom: 28,
  },
  offAirHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  offAirIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  offAirHeading: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  offAirSubheading: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FECACA',
    marginBottom: 12,
  },
  offAirDescription: {
    fontSize: 14,
    color: '#FFE4E6',
    lineHeight: 20,
  },
  offAirRefreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  nextShowCard: {
    backgroundColor: '#1F1F23',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#26262C',
  },
  nextShowIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#91403E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  nextShowTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  nextShowName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  nextShowHost: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#26262C',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  nextShowHostText: {
    fontSize: 15,
    color: '#91403E',
    fontWeight: '700',
  },
  nextShowTime: {
    fontSize: 15,
    color: '#ADADB8',
    fontWeight: '600',
  },
  nextShowBadge: {
    backgroundColor: '#91403E',
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
  },
  nextShowBadgeText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});

export default BroadcastScreen;
