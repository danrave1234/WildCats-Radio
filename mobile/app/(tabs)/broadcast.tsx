import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  AppState,
} from 'react-native';
import { Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import {
  Broadcast,
  ChatMessageDTO,
  SongRequestDTO,
  PollDTO,
  getLiveBroadcasts,
  getBroadcastDetails,
  getChatMessages,
  sendChatMessage,
  getSongRequestsForBroadcast,
  createSongRequest,
  getActivePollsForBroadcast,
  voteOnPoll,
} from '../../services/apiService';
import { useWebSocket } from '../../services/websocketHook';
import '../../global.css';
import { format, parseISO, formatDistanceToNow } from 'date-fns';

// AnimatedMessage Component for grouping animations
interface AnimatedMessageProps {
  message: ChatMessageDTO;
  index: number;
  isOwnMessage: boolean;
  showAvatar: boolean;
  isLastInGroup: boolean;
  isFirstInGroup: boolean;
  listenerName: string;
}

const AnimatedMessage: React.FC<AnimatedMessageProps> = React.memo(({
  message,
  index,
  isOwnMessage,
  showAvatar,
  isLastInGroup,
  isFirstInGroup,
  listenerName,
}) => {
  const slideAnim = useRef(new Animated.Value(50)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const hasAnimated = useRef(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Only animate once per message to prevent double animation on optimistic updates
    if (hasAnimated.current) return;
    
    // Skip animation for own messages (they appear instantly)
    if (isOwnMessage) {
      slideAnim.setValue(0);
      opacityAnim.setValue(1);
      scaleAnim.setValue(1);
      hasAnimated.current = true;
      return;
    }
    
    // Much faster stagger for responsive feel - only 15ms delay between messages
    const animationDelay = index * 15;
    
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200, // Reduced from 400ms to 200ms
        delay: animationDelay,
        easing: Easing.out(Easing.ease), // Simpler, faster easing
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 150, // Reduced from 300ms to 150ms
        delay: animationDelay,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 180, // Reduced from 350ms to 180ms
        delay: animationDelay,
        easing: Easing.out(Easing.ease), // Simpler easing for faster feel
        useNativeDriver: true,
      }),
    ]).start();
    
    hasAnimated.current = true;
  }, [slideAnim, opacityAnim, scaleAnim, index, isOwnMessage]);

  // Update timestamps every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  return (
    <Animated.View 
      style={{
        transform: [
          { translateY: slideAnim },
          { scale: scaleAnim }
        ],
        opacity: opacityAnim,
      }}
      className={`${isFirstInGroup ? 'mb-2' : 'mb-1'} ${isOwnMessage ? 'items-end pr-4' : 'flex-row items-end pl-4'}`}
    >
      {/* Avatar for other users only */}
      {!isOwnMessage && (
        <Animated.View 
          className="mr-2 mb-0"
          style={{
            opacity: showAvatar ? 1 : 0,
            transform: [{ scale: showAvatar ? 1 : 0.5 }],
          }}
        >
          {showAvatar ? (
            <View 
              className="w-8 h-8 rounded-full bg-cordovan items-center justify-center"
              style={{
                shadowColor: '#91403E',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.2,
                shadowRadius: 2,
                elevation: 3,
              }}
            >
              <Text className="text-white text-xs font-bold">
                {(message.sender?.name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          ) : (
            <View className="w-8 h-8" />
          )}
        </Animated.View>
      )}

      {/* Message Bubble Container */}
      <View className={`${isOwnMessage ? 'max-w-[75%]' : 'max-w-[75%]'}`}>
        {/* Sender name for other users */}
        {!isOwnMessage && isFirstInGroup && (
          <Animated.Text 
            className="text-xs font-medium text-gray-500 mb-1 ml-1"
            style={{
              opacity: opacityAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            {message.sender?.name || 'User'}
          </Animated.Text>
        )}
        
        <Animated.View 
          className={`px-3 py-2 ${
            isOwnMessage 
              ? 'bg-cordovan rounded-2xl' 
              : 'bg-gray-200 rounded-2xl'
          }`}
          style={{
            transform: [{ scale: scaleAnim }],
          }}
        >
          <Text 
            className={`text-base leading-relaxed ${
              isOwnMessage ? 'text-white' : 'text-gray-900'
            }`}
          >
            {message.content || ''}
          </Text>
        </Animated.View>
        
        {/* Timestamp */}
        {isLastInGroup && (
          <Animated.Text 
            className={`text-xs text-gray-400 mt-1 ${
              isOwnMessage ? 'text-right mr-1' : 'text-left ml-1'
            }`}
            style={{
              opacity: opacityAnim,
            }}
          >
            {(() => {
              try {
                if (!message.timestamp || typeof message.timestamp !== 'string') {
                  return 'Just now';
                }
                const messageDate = parseISO(message.timestamp);
                const diffInMinutes = (currentTime.getTime() - messageDate.getTime()) / (1000 * 60);
                
                // Show "Just now" for messages less than 1 minute old
                if (diffInMinutes < 1) {
                  return 'Just now';
                }
                
                // Use relative time for messages with current time reference
                return formatDistanceToNow(messageDate, { addSuffix: true });
              } catch (error) {
                console.warn('Error parsing message timestamp:', error);
                return 'Just now';
              }
            })()}
          </Animated.Text>
        )}
      </View>
    </Animated.View>
  );
});

interface UserAuthData {
  name?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
}

interface TabDefinition {
  key: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
}

// Placeholder for current song - replace with actual data structure from API
interface NowPlayingInfo {
  songTitle: string;
  artist: string;
}

const BroadcastScreen: React.FC = () => {
  const authContext = useAuth();
  const navigation = useNavigation();
  
  // Early safety check for auth context
  if (!authContext) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-anti-flash_white">
        <ActivityIndicator size="large" color="#91403E" />
        <Text className="mt-4 text-gray-600 text-lg">Loading authentication...</Text>
      </SafeAreaView>
    );
  }

  const authToken = authContext.authToken;
  const user = (authContext as any)?.user as UserAuthData | undefined;

  const params = useLocalSearchParams();
  const routeBroadcastId = params.broadcastId ? parseInt(params.broadcastId as string, 10) : null;

  const [activeTab, setActiveTab] = useState('chat');
  const [isLoading, setIsLoading] = useState(true);
  const [isPollingData, setIsPollingData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refresh states for each tab
  const [isRefreshingChat, setIsRefreshingChat] = useState(false);
  const [isRefreshingRequests, setIsRefreshingRequests] = useState(false);
  const [isRefreshingPolls, setIsRefreshingPolls] = useState(false);
  
  // Main screen refresh state
  const [isRefreshingBroadcast, setIsRefreshingBroadcast] = useState(false);

  const [currentBroadcast, setCurrentBroadcast] = useState<Broadcast | null>(null);
  // Mock Now Playing Data - replace with API call
  const [nowPlayingInfo, setNowPlayingInfo] = useState<NowPlayingInfo | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessageDTO[]>([]);
  const [songRequests, setSongRequests] = useState<SongRequestDTO[]>([]);
  const [activePolls, setActivePolls] = useState<PollDTO[]>([]);
  const [userMessageIds, setUserMessageIds] = useState<Set<number>>(new Set());
  const [isListening, setIsListening] = useState(false);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [useWebSocketMode, setUseWebSocketMode] = useState(true); // Toggle between WS and polling

  const [chatInput, setChatInput] = useState('');
  const [songTitleInput, setSongTitleInput] = useState('');
  const [artistInput, setArtistInput] = useState('');
  const [dedicationInput, setDedicationInput] = useState('');

  const chatScrollViewRef = useRef<ScrollView>(null);

  const listenerName = useMemo(() => {
    if (!user || typeof user !== 'object') return 'Listener';
    
    try {
      // Safely construct name from available fields with strict type checking
      if (user.name && typeof user.name === 'string' && user.name.trim()) {
        return user.name.trim();
      }
      if (user.fullName && typeof user.fullName === 'string' && user.fullName.trim()) {
        return user.fullName.trim();
      }
      if (user.firstName && typeof user.firstName === 'string' && user.firstName.trim()) {
        const lastName = user.lastName && typeof user.lastName === 'string' ? user.lastName.trim() : '';
        return `${user.firstName.trim()} ${lastName}`.trim();
      }
    } catch (error) {
      console.warn('Error processing user name:', error);
    }
    
    return 'Listener';
  }, [user]);

  const [tabLayouts, setTabLayouts] = useState<Record<string, { x: number; width: number } | undefined>>({});
  const underlinePosition = useRef(new Animated.Value(0)).current;
  const underlineWidth = useRef(new Animated.Value(0)).current;
  const [isInitialLayoutDone, setIsInitialLayoutDone] = useState(false);

  // WebSocket integration
  const { sendChatMessage: wsSendChatMessage } = useWebSocket({
    broadcastId: useWebSocketMode ? currentBroadcast?.id || null : null,
    authToken: useWebSocketMode ? authToken : null,
    onNewMessage: useCallback((message: ChatMessageDTO) => {
      console.log('📨 Received WebSocket message:', message);
      setChatMessages(prev => {
        // Check if this is our own message coming back (replace optimistic)
        const isOwnMessage = message.sender?.name === listenerName;
        if (isOwnMessage) {
          // Find and replace any optimistic message with same content and recent timestamp
          const optimisticIndex = prev.findIndex(msg => 
            userMessageIds.has(msg.id) && 
            msg.content === message.content &&
            Math.abs(new Date(msg.timestamp).getTime() - new Date(message.timestamp).getTime()) < 30000
          );
          
          if (optimisticIndex >= 0) {
            console.log('🔄 Replacing optimistic message with real one');
            const newMessages = [...prev];
            newMessages[optimisticIndex] = message;
            // Update user message IDs
            setUserMessageIds(prevIds => {
              const newIds = new Set(prevIds);
              newIds.delete(prev[optimisticIndex].id);
              newIds.add(message.id);
              return newIds;
            });
            return newMessages.sort((a, b) => 
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
          }
        }
        
        // Prevent duplicates - check if message already exists
        const exists = prev.some(msg => 
          msg.id === message.id || 
          (msg.content === message.content && 
           msg.sender?.name === message.sender?.name &&
           Math.abs(new Date(msg.timestamp).getTime() - new Date(message.timestamp).getTime()) < 5000)
        );
        if (exists) {
          console.log('⚠️ Duplicate message ignored');
          return prev;
        }
        
        // Add new message and sort by timestamp
        console.log('✅ Adding new message to chat');
        const newMessages = [...prev, message];
        return newMessages.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      });
    }, [listenerName, userMessageIds]),
    onPollUpdate: useCallback((poll: PollDTO) => {
      setActivePolls(prev => {
        const exists = prev.findIndex(p => p.id === poll.id);
        if (exists >= 0) {
          return prev.map(p => p.id === poll.id ? poll : p);
        }
        return [...prev, poll];
      });
    }, []),
    onConnect: useCallback(() => {
      console.log('💬 WebSocket connected for real-time chat!');
      setIsWebSocketConnected(true);
    }, []),
    onDisconnect: useCallback(() => {
      console.log('💬 WebSocket disconnected, falling back to polling...');
      setIsWebSocketConnected(false);
      // Auto fallback to polling mode
      setUseWebSocketMode(false);
    }, []),
    onError: useCallback((error: Event) => {
      console.error('WebSocket error:', error);
      setIsWebSocketConnected(false);
    }, []),
  });

  const tabDefinitions: TabDefinition[] = useMemo(() => [
    { name: 'Chat', icon: 'chatbubbles-outline', key: 'chat' },
    { name: 'Requests', icon: 'musical-notes-outline', key: 'requests' },
    { name: 'Polls', icon: 'stats-chart-outline', key: 'polls' },
  ], []);

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

  const loadInitialDataForBroadcastScreen = useCallback(async () => {
    if (!authToken || !authContext) {
      setError("Authentication required.");
      setIsLoading(false);
      setCurrentBroadcast(null);
      setNowPlayingInfo(null); // Clear now playing info
      return;
    }
    setIsLoading(true);
    setError(null);
    setChatMessages([]);
    setActivePolls([]);
    setSongRequests([]);
    setUserMessageIds(new Set());
    setNowPlayingInfo(null); // Clear now playing on new load

    try {
      let broadcastToUse: Broadcast | null = null;
      if (routeBroadcastId) {
        const detailsResult = await getBroadcastDetails(routeBroadcastId, authToken);
        if ('error' in detailsResult) throw new Error(detailsResult.error);
        broadcastToUse = detailsResult;
      } else {
        const liveBroadcastsResult = await getLiveBroadcasts(authToken);
        if ('error' in liveBroadcastsResult) throw new Error(liveBroadcastsResult.error);
        if (liveBroadcastsResult.length > 0) {
          broadcastToUse = liveBroadcastsResult[0];
        } else {
          setCurrentBroadcast(null);
          setNowPlayingInfo(null);
          setIsLoading(false);
          return;
        }
      }
      setCurrentBroadcast(broadcastToUse);

      // MOCK: Set Now Playing Info - Replace with actual API call for current song
      if (broadcastToUse && broadcastToUse.status === 'LIVE') {
        setNowPlayingInfo({ songTitle: 'Wildcat\'s Choice', artist: 'Wildcat Radio' });
        // Example: const songInfo = await getCurrentSongForBroadcast(broadcastToUse.id, authToken);
        // if (!('error' in songInfo)) setNowPlayingInfo(songInfo);
      }

      if (broadcastToUse) {
        const [messagesResult, pollsResult, songRequestsResult] = await Promise.all([
          getChatMessages(broadcastToUse.id, authToken),
          getActivePollsForBroadcast(broadcastToUse.id, authToken),
          getSongRequestsForBroadcast(broadcastToUse.id, authToken),
        ]);

        if (!('error' in messagesResult)) setChatMessages(messagesResult);
        else console.error('Failed to fetch initial chat:', messagesResult.error);

        if (!('error' in pollsResult)) setActivePolls(pollsResult);
        else console.error('Failed to fetch initial polls:', pollsResult.error);

        if (!('error' in songRequestsResult)) setSongRequests(songRequestsResult);
        else console.error('Failed to fetch initial song requests:', songRequestsResult.error);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load broadcast data.");
      setCurrentBroadcast(null);
      setNowPlayingInfo(null);
    } finally {
      setIsLoading(false);
    }
  }, [authToken, routeBroadcastId, authContext]);

  useEffect(() => {
    loadInitialDataForBroadcastScreen();
  }, [loadInitialDataForBroadcastScreen]);

  // Fallback polling - only when WebSocket is not connected
  useEffect(() => {
    if (!currentBroadcast?.id || !authToken || (useWebSocketMode && isWebSocketConnected)) {
      return; // Skip polling if WebSocket is working
    }

    console.log('📡 Using HTTP polling mode (WebSocket unavailable)');
    
    const pollData = async () => {
      if (!currentBroadcast?.id || !authToken) return;
      setIsPollingData(true);
      try {
        const messagesResult = await getChatMessages(currentBroadcast.id, authToken);
        if (!('error' in messagesResult)) {
          // Smart merge: keep optimistic messages, merge with server messages
          setChatMessages(prevMessages => {
            const serverMessages = messagesResult;
            const optimisticMessages = prevMessages.filter(msg => 
              userMessageIds.has(msg.id) && msg.id > 1000000000000 // Temp IDs are timestamps
            );
            
            // Merge without duplicates, preserving optimistic messages
            const mergedMessages = [...serverMessages];
            optimisticMessages.forEach(optimisticMsg => {
              const existsOnServer = serverMessages.some(serverMsg => 
                serverMsg.content === optimisticMsg.content && 
                serverMsg.sender?.name === optimisticMsg.sender?.name &&
                Math.abs(new Date(serverMsg.timestamp).getTime() - new Date(optimisticMsg.timestamp).getTime()) < 30000 // Within 30 seconds
              );
              if (!existsOnServer) {
                mergedMessages.push(optimisticMsg);
              }
            });
            
            // Sort by timestamp
            return mergedMessages.sort((a, b) => 
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
          });
        } else {
          console.warn('Polling chat error:', messagesResult.error);
        }

        const pollsResult = await getActivePollsForBroadcast(currentBroadcast.id, authToken);
        if (!('error' in pollsResult)) {
          setActivePolls(pollsResult);
        } else {
          console.warn('Polling polls error:', pollsResult.error);
        }
      } catch (err) {
        console.warn("Exception during polling data:", err);
      }
      setIsPollingData(false);
    };

    const intervalId = setInterval(pollData, 10000); // Faster polling when WS is down
    return () => clearInterval(intervalId);
  }, [currentBroadcast?.id, authToken, useWebSocketMode, isWebSocketConnected, userMessageIds]);

  useEffect(() => {
    if (chatMessages.length > 0) {
      setTimeout(() => chatScrollViewRef.current?.scrollToEnd({ animated: true }), 300);
    }
  }, [chatMessages]);

  // Control tab bar visibility based on listening state
  useEffect(() => {
    // Set tab bar visibility options
    const tabBarStyle = isListening ? { display: 'none' } : undefined;
    
    // Set options on current navigation
    navigation.setOptions({
      tabBarStyle,
    });
    
    // Also set on parent navigation for redundancy
    const parent = navigation.getParent();
    if (parent) {
      parent.setOptions({
        tabBarStyle,
      });
    }
    
    // Cleanup: show tab bar when component unmounts
    return () => {
      navigation.setOptions({
        tabBarStyle: undefined,
      });
      if (parent) {
        parent.setOptions({
          tabBarStyle: undefined,
        });
      }
    };
  }, [isListening, navigation]);

  // Handle app state changes to maintain WebSocket connection
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      console.log('📱 App state changed to:', nextAppState);
      
      if (nextAppState === 'active' && !isWebSocketConnected && useWebSocketMode) {
        console.log('📱 App became active, checking WebSocket connection...');
        // App came to foreground and WebSocket is disconnected, try to reconnect
        setTimeout(() => {
          if (!isWebSocketConnected && currentBroadcast?.id) {
            console.log('🔄 Attempting to restore WebSocket connection...');
            // The WebSocket hook will handle reconnection automatically
          }
        }, 1000);
      } else if (nextAppState === 'background') {
        console.log('📱 App went to background, WebSocket may disconnect soon...');
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, [isWebSocketConnected, useWebSocketMode, currentBroadcast?.id]);

    const handleSendChatMessage = async () => {
    if (!authToken || !currentBroadcast || !chatInput.trim()) return;
    
    const messageToSend = chatInput;
    setChatInput(''); // Clear input immediately
    
    // Try WebSocket first, fallback to HTTP
    if (useWebSocketMode && isWebSocketConnected && wsSendChatMessage) {
      console.log('🚀 Sending via WebSocket (real-time)');
      try {
        // Add optimistic update for immediate feedback, WebSocket will confirm/replace
        const tempMessageId = Date.now();
        const optimisticMessage: ChatMessageDTO = {
          id: tempMessageId,
          content: messageToSend,
          timestamp: new Date().toISOString(),
          sender: { name: listenerName },
          broadcastId: currentBroadcast.id
        };
        setChatMessages(prev => [...prev, optimisticMessage]);
        setUserMessageIds(prev => new Set([...prev, tempMessageId]));
        
        // Send via WebSocket
        wsSendChatMessage(messageToSend);
        console.log('✅ Message sent via WebSocket');
        return;
      } catch (error) {
        console.warn('WebSocket send failed, falling back to HTTP:', error);
        setUseWebSocketMode(false);
        // Continue to HTTP fallback below
      }
    }
    
    // HTTP fallback with optimistic updates
    console.log('📡 Sending via HTTP (polling mode)');
    const tempMessageId = Date.now();
    const optimisticMessage: ChatMessageDTO = {
        id: tempMessageId,
        content: messageToSend,
        timestamp: new Date().toISOString(),
        sender: { name: listenerName },
        broadcastId: currentBroadcast.id
    };
    setChatMessages(prev => [...prev, optimisticMessage]);
    setUserMessageIds(prev => new Set([...prev, tempMessageId]));

    // Send in background without blocking UI
    sendChatMessage(currentBroadcast.id, { content: messageToSend }, authToken).then(result => {
      if ('error' in result) {
        // Silently remove failed message and show subtle feedback
        setChatMessages(prev => prev.filter(msg => msg.id !== tempMessageId));
        setUserMessageIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(tempMessageId);
          return newSet;
        });
        // Could add a toast notification here instead of alert
      } else {
        // Replace optimistic message with real one
        setChatMessages(prev => prev.map(msg => msg.id === tempMessageId ? result : msg));
        setUserMessageIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(tempMessageId);
          newSet.add(result.id);
          return newSet;
        });
      }
    });
  };

  const handleCreateSongRequest = async () => {
    if (!authToken || !currentBroadcast || !songTitleInput.trim() || !artistInput.trim()) {
        Alert.alert("Missing Info", "Please enter both song title and artist.");
        return;
    }
    setIsSubmitting(true);
    const payload = {
      songTitle: songTitleInput,
      artist: artistInput,
      dedication: dedicationInput.trim() || undefined,
    };
    const result = await createSongRequest(currentBroadcast.id, payload, authToken);
    if ('error' in result) {
      Alert.alert("Error", result.error || "Failed to request song.");
    } else {
      Alert.alert("Success", "Song requested successfully!");
      setSongTitleInput('');
      setArtistInput('');
      setDedicationInput('');
    }
    setIsSubmitting(false);
  };

  const handleVoteOnPoll = async (pollId: number, optionId: number) => {
    if (!authToken || !currentBroadcast) return;
    setIsSubmitting(true);
    const result = await voteOnPoll(pollId, { optionId }, authToken);
    if ('error' in result) {
      Alert.alert("Error", result.error || "Failed to submit vote.");
    } else {
      Alert.alert("Success", "Vote submitted!");
      setIsPollingData(true);
      getActivePollsForBroadcast(currentBroadcast.id, authToken)
        .then(pollsResult => {
            if (!('error' in pollsResult)) setActivePolls(pollsResult);
        })
        .catch(err => console.error("Error refreshing polls after vote:", err))
        .finally(() => setIsPollingData(false));
    }
    setIsSubmitting(false);
  };

  // Refresh functions for each tab
  const refreshChatData = useCallback(async () => {
    if (!authToken || !currentBroadcast?.id) return;
    setIsRefreshingChat(true);
    try {
      const messagesResult = await getChatMessages(currentBroadcast.id, authToken);
      if (!('error' in messagesResult)) {
        setChatMessages(messagesResult);
      }
    } catch (err) {
      console.warn('Error refreshing chat:', err);
    } finally {
      setIsRefreshingChat(false);
    }
  }, [authToken, currentBroadcast?.id]);

  const refreshRequestsData = useCallback(async () => {
    if (!authToken || !currentBroadcast?.id) return;
    setIsRefreshingRequests(true);
    try {
      const songRequestsResult = await getSongRequestsForBroadcast(currentBroadcast.id, authToken);
      if (!('error' in songRequestsResult)) {
        setSongRequests(songRequestsResult);
      }
    } catch (err) {
      console.warn('Error refreshing song requests:', err);
    } finally {
      setIsRefreshingRequests(false);
    }
  }, [authToken, currentBroadcast?.id]);

  const refreshPollsData = useCallback(async () => {
    if (!authToken || !currentBroadcast?.id) return;
    setIsRefreshingPolls(true);
    try {
      const pollsResult = await getActivePollsForBroadcast(currentBroadcast.id, authToken);
      if (!('error' in pollsResult)) {
        setActivePolls(pollsResult);
      }
    } catch (err) {
      console.warn('Error refreshing polls:', err);
    } finally {
      setIsRefreshingPolls(false);
    }
  }, [authToken, currentBroadcast?.id]);

  // Main broadcast refresh function
  const refreshBroadcastData = useCallback(async () => {
    setIsRefreshingBroadcast(true);
    try {
      await loadInitialDataForBroadcastScreen();
    } catch (err) {
      console.warn('Error refreshing broadcast data:', err);
    } finally {
      setIsRefreshingBroadcast(false);
    }
  }, [loadInitialDataForBroadcastScreen]);

  const renderChatTab = () => (
    <View style={styles.tabContentContainer} className="flex-1 bg-gray-50">
      {/* Enhanced Chat Header */}
      <View className="px-5 pt-6 pb-4 bg-gradient-to-r from-white to-gray-50 border-b border-gray-100">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <View className="bg-blue-500/10 p-3 rounded-full mr-3">
              <Ionicons name="chatbubbles-outline" size={26} color="#3B82F6" />
            </View>
            <View>
              <Text className="text-xl font-bold text-gray-800">Live Chat</Text>
              <Text className="text-sm text-gray-600">Chat with the DJ and other listeners</Text>
            </View>
          </View>
          
          {/* Connection Status */}
          <View className="flex-row items-center">
            <View className={`w-2 h-2 rounded-full mr-2 ${
              isWebSocketConnected ? 'bg-green-500' : 'bg-orange-500'
            }`} />
            <Text className={`text-xs font-medium ${
              isWebSocketConnected ? 'text-green-600' : 'text-orange-600'
            }`}>
              {isWebSocketConnected ? 'Live' : 'Sync'}
            </Text>
          </View>
        </View>
      </View>

      {/* Chat Messages with Modern Design */}
      <ScrollView
        ref={chatScrollViewRef}
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ 
          paddingTop: 20, 
          paddingBottom: 20, 
          paddingHorizontal: 16 
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshingChat}
            onRefresh={refreshChatData}
            colors={['#91403E']}
            tintColor="#91403E"
            title="Pull to refresh chat"
            titleColor="#91403E"
          />
        }
      >
        {(isLoading && chatMessages.length === 0) && (
          <View className="flex-1 items-center justify-center py-20">
            <View className="bg-white rounded-2xl p-8 shadow-xl items-center">
              <ActivityIndicator size="large" color="#91403E" className="mb-4" />
              <Text className="text-cordovan font-semibold text-lg">Loading chat...</Text>
            </View>
          </View>
        )}
        
        {!isLoading && chatMessages.length === 0 && (
          <View className="flex-1 items-center justify-center py-20">
            <View 
              className="bg-white rounded-3xl p-12 shadow-xl items-center relative overflow-hidden"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.12,
                shadowRadius: 20,
                elevation: 10,
              }}
            >
              {/* Background Pattern */}
              <View className="absolute inset-0 opacity-5">
                <View className="absolute top-8 left-8 w-16 h-16 bg-cordovan rounded-full" />
                <View className="absolute bottom-12 right-12 w-12 h-12 bg-mikado_yellow rounded-full" />
                <View className="absolute top-20 right-20 w-8 h-8 bg-cordovan rounded-full" />
          </View>
              
              <View className="bg-cordovan/10 p-6 rounded-full mb-6">
                <Ionicons name="chatbubbles-outline" size={48} color="#91403E" />
              </View>
              <Text className="text-2xl font-bold text-cordovan mb-3 text-center">
                Start the Conversation! 💬
              </Text>
              <Text className="text-gray-600 text-center px-4 text-base leading-relaxed">
                Be the first to chat with the DJ and fellow listeners. Share your thoughts, make requests, or just say hello!
              </Text>
            </View>
          </View>
        )}

        {/* Enhanced Chat Messages with Animations */}
        {chatMessages.filter(msg => msg && msg.id).map((msg, index) => {
          // More robust check for own messages
          const isOwnMessage = userMessageIds.has(msg.id) || 
                               msg.sender?.name === listenerName || 
                               msg.sender?.name?.toLowerCase().trim() === listenerName.toLowerCase().trim();
          const showAvatar = index === chatMessages.length - 1 || chatMessages[index + 1]?.sender?.name !== msg.sender?.name;
          const isLastInGroup = index === chatMessages.length - 1 || chatMessages[index + 1]?.sender?.name !== msg.sender?.name;
          const isFirstInGroup = index === 0 || chatMessages[index - 1]?.sender?.name !== msg.sender?.name;
          
          return (
            <AnimatedMessage
              key={msg.id}
              message={msg}
              index={index}
              isOwnMessage={isOwnMessage}
              showAvatar={showAvatar}
              isLastInGroup={isLastInGroup}
              isFirstInGroup={isFirstInGroup}
              listenerName={listenerName}
            />
          );
        })}
      </ScrollView>
      
      {/* Messenger-style Chat Input */}
      <View 
        className="bg-white border-t border-gray-200 px-4 py-3"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 8,
        }}
      >
        <View className="flex-row items-end">
          <View 
            className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 mr-3"
            style={{
              minHeight: 40,
              maxHeight: 100,
            }}
          >
          <TextInput
            placeholder="Type your message..."
              placeholderTextColor="#9CA3AF"
            value={chatInput}
            onChangeText={setChatInput}
            editable={!isSubmitting && !!currentBroadcast}
              className="text-gray-800 text-base py-1"
              multiline
              textAlignVertical="top"
              style={{
                fontSize: 16,
                lineHeight: 20,
                minHeight: 24,
              }}
              onContentSizeChange={(event) => {
                // Auto-scroll to bottom when typing
                setTimeout(() => {
                  chatScrollViewRef.current?.scrollToEnd({ animated: true });
                }, 100);
              }}
              onFocus={() => {
                // Scroll to bottom when input gains focus
                setTimeout(() => {
                  chatScrollViewRef.current?.scrollToEnd({ animated: true });
                }, 200);
              }}
            />
          </View>
          
          <TouchableOpacity
            onPress={handleSendChatMessage}
            disabled={!currentBroadcast || !chatInput.trim()}
            className={`w-10 h-10 rounded-full items-center justify-center ${
              currentBroadcast && chatInput.trim()
                ? 'bg-cordovan active:bg-cordovan/90' 
                : 'bg-gray-300'
            }`}
            style={{
              shadowColor: currentBroadcast && chatInput.trim() ? '#91403E' : '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: currentBroadcast && chatInput.trim() ? 0.25 : 0.1,
              shadowRadius: 3,
              elevation: currentBroadcast && chatInput.trim() ? 4 : 2,
            }}
          >
            <Ionicons 
              name="send" 
              size={18} 
              color={currentBroadcast && chatInput.trim() ? "white" : "#6B7280"} 
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderRequestsTab = () => (
    <ScrollView 
      style={styles.tabContentContainer} 
      className="flex-1 bg-gray-50" 
      contentContainerStyle={{ paddingBottom: 30}}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshingRequests}
          onRefresh={refreshRequestsData}
          colors={['#91403E']}
          tintColor="#91403E"
          title="Pull to refresh requests"
          titleColor="#91403E"
        />
      }
    >
      <View className="px-5 pt-6 pb-5">
        <View className="flex-row items-center mb-3">
          <View className="bg-red-500/10 p-3 rounded-full mr-3">
            <MaterialCommunityIcons name="music-note-plus" size={26} color="#EF4444" /> 
          </View>
          <View>
            <Text className="text-xl font-bold text-gray-800">Request a Song</Text>
            <Text className="text-sm text-gray-600">Let us know what you'd like to hear next</Text>
          </View>
        </View>

        <View className="mt-5">
          <Text className="text-sm font-medium text-gray-700 mb-1.5 ml-1">Song Title</Text>
          <TextInput
            placeholder="Enter song title"
            value={songTitleInput}
            onChangeText={setSongTitleInput}
            editable={!isSubmitting && !!currentBroadcast}
            className="bg-white border border-gray-300 rounded-lg p-3.5 text-base shadow-sm text-gray-800 placeholder-gray-400 focus:border-mikado_yellow focus:ring-1 focus:ring-mikado_yellow"
          />
        </View>

        <View className="mt-5">
          <Text className="text-sm font-medium text-gray-700 mb-1.5 ml-1">Artist</Text>
          <TextInput
            placeholder="Enter artist name"
            value={artistInput}
            onChangeText={setArtistInput}
            editable={!isSubmitting && !!currentBroadcast}
            className="bg-white border border-gray-300 rounded-lg p-3.5 text-base shadow-sm text-gray-800 placeholder-gray-400 focus:border-mikado_yellow focus:ring-1 focus:ring-mikado_yellow"
          />
        </View>

        <View className="mt-5">
          <Text className="text-sm font-medium text-gray-700 mb-1.5 ml-1">Dedication (Optional)</Text>
          <TextInput
            placeholder="Add a message or dedication"
            value={dedicationInput}
            onChangeText={setDedicationInput}
            editable={!isSubmitting && !!currentBroadcast}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className="bg-white border border-gray-300 rounded-lg p-3.5 text-base shadow-sm h-28 text-gray-800 placeholder-gray-400 focus:border-mikado_yellow focus:ring-1 focus:ring-mikado_yellow"
            style={{ height: 112 }}
          />
        </View>

        <TouchableOpacity
          className={`py-3.5 px-5 rounded-lg shadow-md items-center mt-8 ${currentBroadcast && songTitleInput.trim() && artistInput.trim() && !isSubmitting ? 'bg-mikado_yellow active:bg-mikado_yellow/90' : 'bg-gray-300'}`}
          onPress={handleCreateSongRequest}
          disabled={isSubmitting || !currentBroadcast || !songTitleInput.trim() || !artistInput.trim()}
        >
          {isSubmitting ? <ActivityIndicator color="#27272a" size="small"/> : <Text className="text-zinc-900 font-semibold text-base">Submit Request</Text>}
        </TouchableOpacity>

        <Text className="text-xs text-gray-500 text-center mt-8 px-4">
          Song requests are subject to availability and DJ's playlist.
        </Text>
      </View>
    </ScrollView>
  );

 const renderPollsTab = () => (
    <ScrollView 
      style={styles.tabContentContainer} 
      className="flex-1 bg-gray-50" 
      contentContainerStyle={{ paddingBottom: 30}}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshingPolls}
          onRefresh={refreshPollsData}
          colors={['#91403E']}
          tintColor="#91403E"
          title="Pull to refresh polls"
          titleColor="#91403E"
        />
      }
    >
      <View className="px-5 pt-6 pb-3">
        <View className="flex-row items-center mb-3">
          <View className="bg-green-500/10 p-3 rounded-full mr-3">
            <Ionicons name="stats-chart-outline" size={26} color="#22C55E" /> 
          </View>
          <View>
            <Text className="text-xl font-bold text-gray-800">Active Polls</Text>
            <Text className="text-sm text-gray-600">Voice your opinion on current topics</Text>
          </View>
        </View>
      </View>

      <View className="px-5">
        {(isLoading && activePolls.length === 0) && <ActivityIndicator color="#91403E" className="my-5"/>}
        {!isLoading && activePolls.length === 0 && (
          <View className="items-center justify-center py-10 flex-1">
            <Ionicons name="stats-chart-outline" size={40} color="#A0A0A0" />
            <Text className="text-gray-500 mt-2">No active polls right now.</Text>
          </View>
        )}
        {activePolls.length > 0 && (
          <View className="flex-1">
            {activePolls.map(poll => (
              <View key={poll.id} className="bg-white p-4 rounded-lg shadow mb-3">
                <Text className="text-base font-semibold text-gray-800 mb-2">{poll.question}</Text>
                {poll.options.map(opt => (
                  <TouchableOpacity
                    key={opt.id} 
                    className={`bg-gray-100 p-3 rounded-md my-1 active:bg-gray-200 hover:bg-gray-200 border border-gray-200 ${isSubmitting ? 'opacity-70' : ''}`}
                    onPress={() => !isSubmitting && currentBroadcast && handleVoteOnPoll(poll.id, opt.id)}
                    disabled={isSubmitting || !currentBroadcast || !poll.isActive}
                  >
                    <View className="flex-row justify-between items-center">
                      <Text className={`text-sm ${!poll.isActive ? 'text-gray-400' : 'text-gray-700'}`}>{opt.text}</Text>
                      {(poll.isEnded) && <Text className="text-xs text-cordovan font-medium">{opt.voteCount} votes</Text>}
                    </View>
                  </TouchableOpacity>
                ))}
                {!poll.isActive && poll.isEnded && (
                    <Text className="text-xs text-gray-500 font-semibold mt-2 text-right">Poll Ended</Text>
                )}
                {!poll.isActive && !poll.isEnded && (
                    <Text className="text-xs text-gray-400 font-semibold mt-2 text-right">Poll Not Yet Active</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'chat':
        return renderChatTab();
      case 'requests':
        return renderRequestsTab();
      case 'polls':
        return renderPollsTab();
      default:
        return null;
    }
  };

  if (isLoading && !currentBroadcast && !nowPlayingInfo) { // Adjusted loading condition slightly for initial card appearance
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-anti-flash_white">
        <ActivityIndicator size="large" color="#91403E" />
        <Text className="mt-4 text-gray-600 text-lg">Loading Live Broadcast...</Text>
      </SafeAreaView>
    );
  }

   if (error && !isLoading) { 
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-anti-flash_white p-6 text-center">
        <Ionicons name="cloud-offline-outline" size={64} color="#7F1D1D" />
        <Text className="text-2xl font-semibold text-gray-800 mt-6 mb-2">Broadcast Error</Text>
        <Text className="text-gray-600 mb-8 text-base leading-relaxed">{error || "An unexpected error occurred while loading broadcast data."}</Text>
        <TouchableOpacity
          className="bg-cordovan py-3 px-8 rounded-lg shadow-md active:opacity-80"
          onPress={loadInitialDataForBroadcastScreen} 
        >
          <Text className="text-white font-semibold text-base">Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const screenTitle = currentBroadcast ? `${currentBroadcast.title}` : 'Live Broadcast';
  const screenSubtitle = currentBroadcast ? `DJ: ${currentBroadcast.dj?.name || 'Wildcat Radio'}` : 'Standby...';

  const renderNowPlayingCard = () => {
    if (!currentBroadcast || currentBroadcast.status !== 'LIVE' || !nowPlayingInfo) {
      return null; // Don't render if not live or no song info
    }
    return (
      <View className="bg-cordovan/90 p-4 mx-4 my-3 rounded-lg shadow-lg">
        <View className="absolute top-3 right-3 bg-red-600 px-2.5 py-1 rounded-full flex-row items-center z-10">
            <View className="w-1.5 h-1.5 bg-white rounded-full mr-1.5" />
            <Text className="text-white text-xs font-bold">LIVE</Text>
        </View>
        <View className="flex-row items-center">
          <View className="w-24 h-24 bg-black/20 rounded-md items-center justify-center mr-4 shadow">
            <Ionicons name="musical-notes-outline" size={48} color="rgba(255,255,255,0.4)" />
          </View>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-white mb-0.5" numberOfLines={2}>{currentBroadcast.title}</Text>
            <Text className="text-sm text-gray-200 mb-2.5">Hosted by {currentBroadcast.dj?.name || 'Wildcat Radio'}</Text>
            
            <Text className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-0.5">Now Playing</Text>
            <Text className="text-lg font-semibold text-white" numberOfLines={1}>{nowPlayingInfo.songTitle}</Text>
            <Text className="text-sm text-gray-200">{nowPlayingInfo.artist}</Text>
            
            {/* Listen Now Button - only show when not in listening mode */}
            {!isListening && (
              <TouchableOpacity
                className="bg-mikado_yellow px-6 py-3 rounded-full mt-4 shadow-lg active:bg-mikado_yellow/90"
                onPress={() => setIsListening(true)}
                style={{
                  shadowColor: '#B5830F',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                  elevation: 6,
                }}
              >
                <View className="flex-row items-center justify-center">
                  <Ionicons name="play-circle" size={20} color="#27272a" />
                  <Text className="text-zinc-900 font-bold text-base ml-2">Listen Now</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} className="flex-1 bg-anti-flash_white">
      <Stack.Screen 
        options={{
            headerTitle: () => (
                <View style={{ marginLeft: Platform.OS === 'android' ? -10 : 0}}>
                    <Text className="text-lg font-bold text-gray-800" numberOfLines={1}>{screenTitle}</Text>
                    <Text className="text-xs text-gray-500" numberOfLines={1}>{screenSubtitle}</Text>
                </View>
            ),
            headerShown: isListening ? false : true, // Hide header when in listening mode
        }}
       />
      
      {!currentBroadcast && !isLoading ? (
        // Show off-air message without tabs
        <View className="flex-1 justify-center items-center p-5 bg-anti-flash_white">
          <Ionicons name="radio-outline" size={64} color="#A0A0A0" className="mb-4"/>
          <Text className="text-2xl font-bold text-gray-700 mb-2">Currently Off Air</Text>
          <Text className="text-gray-500 text-center text-base leading-relaxed px-4">
            There is no live broadcast at the moment. Please check the schedule or try again later.
          </Text>
          <TouchableOpacity
            className="bg-cordovan py-3 px-8 rounded-lg shadow-md mt-8 active:opacity-80"
            onPress={loadInitialDataForBroadcastScreen}
          >
            <Text className="text-white font-semibold text-base">Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : currentBroadcast && currentBroadcast.status === 'LIVE' && !isListening ? (
        // Show only Live card with Listen Now button when live and not listening
        <View className="flex-1 justify-center items-center p-4 bg-anti-flash_white">
          <ScrollView
            contentContainerStyle={{ flex: 1, justifyContent: 'center' }}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshingBroadcast}
                onRefresh={refreshBroadcastData}
                colors={['#91403E']}
                tintColor="#91403E"
                title="Pull to refresh broadcast"
                titleColor="#91403E"
              />
            }
            showsVerticalScrollIndicator={false}
          >
            <View className="justify-center items-center flex-1">
              <View className="w-full max-w-sm">
                {renderNowPlayingCard()}
              </View>
              
              {/* Additional info about the stream */}
              <View className="mt-8 px-6">
                <Text className="text-center text-gray-600 text-base leading-relaxed">
                  🎵 Tune in to live music, chat with the DJ, make song requests, and participate in polls!
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      ) : (
        // Show full interface with tabs when listening or not live
        <View style={{ flex: 1 }}>
          {/* Back button when in listening mode */}
          {isListening && (
            <View className="bg-white px-4 py-3 border-b border-gray-200">
              <TouchableOpacity
                className="flex-row items-center"
                onPress={() => setIsListening(false)}
              >
                <Ionicons name="chevron-back" size={24} color="#91403E" />
                <Text className="text-cordovan font-semibold text-base ml-2">Back to Live Card</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Refreshable Now Playing Section */}
          <ScrollView
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ flexGrow: 0 }}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshingBroadcast}
                onRefresh={refreshBroadcastData}
                colors={['#91403E']}
                tintColor="#91403E"
                title="Pull to refresh broadcast"
                titleColor="#91403E"
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {renderNowPlayingCard()}
          </ScrollView>

        <View style={styles.tabBar} className="flex-row bg-white border-b border-gray-200 relative">
          {tabDefinitions.map(tab => (
            <Pressable 
              key={tab.key}
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                setTabLayouts((prev) => ({ ...prev, [tab.key]: { x, width } }));
              }}
              style={({ pressed }) => [
                { opacity: pressed && Platform.OS === 'ios' ? 0.7 : 1 }, 
              ]}
              className="flex-1 items-center py-3 justify-center flex-row" 
              onPress={() => setActiveTab(tab.key)}
                disabled={isLoading} 
              android_ripple={{ color: 'rgba(0,0,0,0.05)' }} 
            >
              <Ionicons
                name={tab.icon as any}
                size={20}
                  color={isLoading ? '#CBD5E0' : (activeTab === tab.key ? '#91403E' : (Platform.OS === 'ios' ? '#6b7280' : '#4B5563'))}
              />
              <Text
                  className={`ml-1.5 text-sm ${isLoading ? 'text-gray-400' : (activeTab === tab.key ? 'font-semibold text-cordovan' : 'text-gray-600')}`}
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
              className="flex-1"
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
          {renderTabContent()}
      </KeyboardAvoidingView>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6', 
  },
  tabBar: {
  },
  tabContentContainer: {
    flex: 1,
  },
});

export default BroadcastScreen; 