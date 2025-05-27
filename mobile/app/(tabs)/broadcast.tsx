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
  AppStateStatus,
  Keyboard,
} from 'react-native';
import { Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import CustomHeader from '../../components/navigation/CustomHeader';
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
    // Skip animations for all messages (appear instantly)
    if (hasAnimated.current) return;
    
    slideAnim.setValue(0);
    opacityAnim.setValue(1);
    scaleAnim.setValue(1);
    hasAnimated.current = true;
  }, [slideAnim, opacityAnim, scaleAnim]);

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
      <View className={`${isOwnMessage ? 'max-w-[75%]' : 'max-w-[75%]'}`} style={{ alignSelf: isOwnMessage ? 'flex-end' : 'flex-start' }}>
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
            alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
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
        
        {/* Timestamp - positioned independently */}
        {isLastInGroup && (
          <Animated.Text 
            className={`text-xs text-gray-400 mt-1 ${
              isOwnMessage ? 'mr-1' : 'ml-1'
            }`}
            style={{
              opacity: opacityAnim,
              alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
            }}
          >
            {(() => {
              try {
                // Use the same timestamp handling logic as DJDashboard
                let messageDate;
                
                if (!message.createdAt || typeof message.createdAt !== 'string') {
                  return 'Just now';
                }
                
                // Handle timezone like DJDashboard - add Z if not present
                messageDate = message.createdAt.endsWith('Z') ? new Date(message.createdAt) : new Date(message.createdAt + 'Z');
                
                // Check if date is valid
                if (!messageDate || isNaN(messageDate.getTime())) {
                  return 'Just now';
                }
                
                // Use formatDistanceToNow like DJDashboard
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
      <View className="flex-1 justify-center items-center bg-anti-flash_white">
        <ActivityIndicator size="large" color="#91403E" />
        <Text className="mt-4 text-gray-600 text-lg">Loading authentication...</Text>
      </View>
    );
  }

  const authToken = authContext.authToken;
  const user = (authContext as any)?.user as UserAuthData | undefined;

  const params = useLocalSearchParams();
  const routeBroadcastId = params.broadcastId ? parseInt(params.broadcastId as string, 10) : null;

  const [activeTab, setActiveTab] = useState('chat');
  const [isLoading, setIsLoading] = useState(true);
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

  // Keyboard animation states
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const tabContentTranslateY = useRef(new Animated.Value(0)).current;

  // Poster to tune-in transition animation states
  const tuneInTranslateX = useRef(new Animated.Value(Dimensions.get('window').width)).current;
  
  // Tab bar animation state
  const tabBarTranslateY = useRef(new Animated.Value(0)).current;

  // Real-time update refs
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // WebSocket integration - for receiving real-time updates only
  const { isConnected: wsIsConnected } = useWebSocket({
    broadcastId: currentBroadcast?.id || null,
    authToken: authToken,
    onNewMessage: useCallback((message: ChatMessageDTO) => {
      console.log('📨 Received WebSocket message:', message);
      setChatMessages(prev => {
        // Prevent duplicates - check if message already exists by ID first (most reliable)
        const exists = prev.some(msg => msg.id === message.id);
        if (exists) {
          console.log('⚠️ Duplicate message ignored (ID already exists)');
          return prev;
        }
        
        // Secondary duplicate check by content and timing for edge cases
        const contentDuplicate = prev.some(msg => 
          msg.content === message.content && 
          msg.sender?.name === message.sender?.name &&
          Math.abs(new Date(msg.createdAt).getTime() - new Date(message.createdAt).getTime()) < 5000
        );
        if (contentDuplicate) {
          console.log('⚠️ Duplicate message ignored (content + timing match)');
          return prev;
        }
        
        // Add new message and sort by timestamp
        console.log('✅ Adding new WebSocket message to chat');
        const newMessages = [...prev, message];
        return newMessages.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
    }, []),
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
      console.log('💬 WebSocket disconnected');
      setIsWebSocketConnected(false);
    }, []),
    onError: useCallback((error: Event) => {
      console.error('WebSocket error:', error);
      setIsWebSocketConnected(false);
    }, []),
  });

  // Sync WebSocket connection state
  useEffect(() => {
    setIsWebSocketConnected(wsIsConnected);
  }, [wsIsConnected]);

  // Keyboard animation handling
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        console.log('📱 Keyboard showing, animating tab content up');
        setIsKeyboardVisible(true);
        
        // Calculate how much to move up to cover the Live card area
        // This moves the tabs up to where the Live card was positioned
        const moveUpDistance = 5; // More reasonable distance to cover the compact live card area
        
        Animated.timing(tabContentTranslateY, {
          toValue: -moveUpDistance,
          duration: Platform.OS === 'ios' ? (event.duration || 350) : 400,
          easing: Easing.bezier(0.25, 0.46, 0.45, 0.94), // Smooth ease-out curve
          useNativeDriver: true,
        }).start();
      }
    );

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (event) => {
        console.log('📱 Keyboard hiding, animating tab content down');
        setIsKeyboardVisible(false);
        
        Animated.timing(tabContentTranslateY, {
          toValue: 0,
          duration: Platform.OS === 'ios' ? (event.duration || 300) : 350,
          easing: Easing.bezier(0.25, 0.46, 0.45, 0.94), // Smooth ease-out curve
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      keyboardWillShowListener?.remove();
      keyboardWillHideListener?.remove();
    };
  }, [tabContentTranslateY]);

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

  // Animation function for poster to tune-in transition
  const animateToTuneIn = useCallback(() => {
    // Set listening state first so the interface renders
    setIsListening(true);
    
    // Start parallel animations for tune-in interface and tab bar
    Animated.parallel([
      // Slide tune-in interface from right
      Animated.timing(tuneInTranslateX, {
        toValue: 0,
        duration: 600, // Longer duration for smoother feel
        easing: Easing.out(Easing.cubic), // iOS-like easing curve
        useNativeDriver: true,
      }),
      // Hide tab bar by sliding it down
      Animated.timing(tabBarTranslateY, {
        toValue: 100, // Slide down by 100px (enough to hide it)
        duration: 400, // Slightly faster than tune-in animation
        easing: Easing.in(Easing.cubic), // Accelerate as it goes down
        useNativeDriver: true,
      }),
    ]).start();
  }, [tuneInTranslateX, tabBarTranslateY]);

  // Animation function for going back to poster
  const animateBackToPoster = useCallback(() => {
    // Start parallel animations for tune-in interface and tab bar
    Animated.parallel([
      // Slide tune-in interface back to the right
      Animated.timing(tuneInTranslateX, {
        toValue: Dimensions.get('window').width,
        duration: 500, // Slightly faster for back navigation
        easing: Easing.in(Easing.cubic), // iOS-like back navigation easing
        useNativeDriver: true,
      }),
      // Show tab bar by sliding it back up
      Animated.timing(tabBarTranslateY, {
        toValue: 0, // Slide back to original position
        duration: 400, // Slightly faster than tune-in animation
        easing: Easing.out(Easing.cubic), // Decelerate as it comes up
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Animation completed, update listening state
      setIsListening(false);
    });
  }, [tuneInTranslateX, tabBarTranslateY]);

  // Reset animations when going back to poster (without animation)
  useEffect(() => {
    if (!isListening) {
      // Reset animation values immediately when going back to poster
      tuneInTranslateX.setValue(Dimensions.get('window').width);
      tabBarTranslateY.setValue(0);
    }
  }, [isListening, tuneInTranslateX, tabBarTranslateY]);

  const loadInitialDataForBroadcastScreen = useCallback(async (isBackgroundUpdate = false) => {
    if (!authToken || !authContext) {
      setError("Authentication required.");
      setIsLoading(false);
      setCurrentBroadcast(null);
      setNowPlayingInfo(null); // Clear now playing info
      return;
    }
    if (!isBackgroundUpdate) {
      setIsLoading(true);
      setError(null);
      setChatMessages([]);
      setActivePolls([]);
      setSongRequests([]);
      setUserMessageIds(new Set());
      setNowPlayingInfo(null); // Clear now playing on new load
    }

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

        if (!('error' in messagesResult)) {
          // Use smart merge for initial load too, in case WebSocket messages arrived first
          setChatMessages(prevMessages => {
            if (prevMessages.length === 0) {
              // No previous messages, just use server messages
              return messagesResult;
            }
            
            // Merge with any existing messages (e.g., from WebSocket)
            const serverMessages = messagesResult;
            const mergedMessages = [...serverMessages, ...prevMessages];
            
                      // Remove duplicates and sort by timestamp
          const uniqueMessages = mergedMessages.filter((msg, index, array) => 
            array.findIndex(m => 
              m.id === msg.id || 
              (m.content === msg.content && 
               m.sender?.name === msg.sender?.name &&
               Math.abs(new Date(m.createdAt).getTime() - new Date(msg.createdAt).getTime()) < 5000)
            ) === index
          );
          
          return uniqueMessages.sort((a, b) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          });
        } else {
          console.error('Failed to fetch initial chat:', messagesResult.error);
        }

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

  // Start polling for broadcast status updates
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    // Poll every 30 seconds for broadcast status
    pollIntervalRef.current = setInterval(() => {
      loadInitialDataForBroadcastScreen(true); // Background update
    }, 30000);
  }, [loadInitialDataForBroadcastScreen]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Handle app state changes for polling
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground, refresh data and start polling
        loadInitialDataForBroadcastScreen(true);
        startPolling();
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background, stop polling to save battery
        stopPolling();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [loadInitialDataForBroadcastScreen, startPolling, stopPolling]);

  // Initial data fetch and start polling
  useEffect(() => {
    loadInitialDataForBroadcastScreen();
    startPolling();
    
    // Cleanup on unmount
    return () => {
      stopPolling();
    };
  }, [loadInitialDataForBroadcastScreen, startPolling, stopPolling]);



  useEffect(() => {
    if (chatMessages.length > 0) {
      setTimeout(() => chatScrollViewRef.current?.scrollToEnd({ animated: true }), 300);
    }
  }, [chatMessages]);

  // Control tab bar animation based on listening state
  useEffect(() => {
    // Pass the animation value to the tab bar through navigation options
    const tabBarStyle = {
      transform: [{ translateY: tabBarTranslateY }],
    };
    
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
    
    // Cleanup: reset tab bar when component unmounts
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
  }, [navigation, tabBarTranslateY]);

  // Handle WebSocket reconnection when app becomes active
  useEffect(() => {
    const handleWebSocketReconnection = (nextAppState: AppStateStatus) => {
      console.log('📱 App state changed to:', nextAppState);
      
      if (nextAppState === 'active' && !isWebSocketConnected) {
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

    const subscription = AppState.addEventListener('change', handleWebSocketReconnection);
    
    return () => {
      subscription?.remove();
    };
  }, [isWebSocketConnected, currentBroadcast?.id]);

  const handleSendChatMessage = async () => {
    if (!authToken || !currentBroadcast || !chatInput.trim()) return;
    
    const messageToSend = chatInput;
    setChatInput(''); // Clear input immediately
    setIsSubmitting(true);
    
    try {
      // Use HTTP POST for sending messages (like web frontend)
      console.log('🚀 Sending via HTTP API');
      const result = await sendChatMessage(currentBroadcast.id, { content: messageToSend }, authToken);
      
      if ('error' in result) {
        console.error('❌ Failed to send message:', result.error);
        // Show error message to user
        setChatInput(messageToSend); // Restore the message
        Alert.alert("Error", result.error || "Failed to send message. Please try again.");
      } else {
        console.log('✅ Message sent successfully via HTTP');
        // Message will appear via WebSocket when server broadcasts it
        // Don't add optimistic update since HTTP response gives us the real message
        
        // Add the sent message immediately since we got it back from server
        setChatMessages(prev => {
          // Check if message already exists (avoid duplicates)
          const exists = prev.some(msg => msg.id === result.id);
          if (exists) {
            return prev;
          }
          
          // Add new message and sort by timestamp
          const newMessages = [...prev, result];
          return newMessages.sort((a, b) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
        
        // Track this as our own message
        setUserMessageIds(prev => new Set([...prev, result.id]));
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      setChatInput(messageToSend); // Restore the message
      Alert.alert("Error", "Failed to send message. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
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
      // Refresh polls after voting
      getActivePollsForBroadcast(currentBroadcast.id, authToken)
        .then(pollsResult => {
            if (!('error' in pollsResult)) setActivePolls(pollsResult);
        })
        .catch(err => console.error("Error refreshing polls after vote:", err));
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
        // Smart merge: preserve recent local messages that might not be on server yet
        setChatMessages(prevMessages => {
          const serverMessages = messagesResult;
          const now = new Date().getTime();
          
          // Keep recent local messages (sent in last 30 seconds) that might not be on server
          const recentLocalMessages = prevMessages.filter(localMsg => {
            // Check if it's a recent message (last 30 seconds)
            const messageTime = new Date(localMsg.createdAt).getTime();
            const isRecent = (now - messageTime) < 30000;
            
            // Check if this message is NOT in the server response
            const existsOnServer = serverMessages.some(serverMsg => 
              serverMsg.id === localMsg.id || 
              (serverMsg.content === localMsg.content && 
               serverMsg.sender?.name === localMsg.sender?.name &&
               Math.abs(new Date(serverMsg.createdAt).getTime() - messageTime) < 10000)
            );
            
            // Keep if it's recent AND not on server (likely pending WebSocket message)
            return isRecent && !existsOnServer;
          });
          
          console.log(`🔄 Refresh: keeping ${recentLocalMessages.length} recent local messages, merging with ${serverMessages.length} server messages`);
          
          // Merge server messages with recent local messages
          const mergedMessages = [...serverMessages, ...recentLocalMessages];
          
          // Remove duplicates and sort by timestamp
          const uniqueMessages = mergedMessages.filter((msg, index, array) => 
            array.findIndex(m => 
              m.id === msg.id || 
              (m.content === msg.content && 
               m.sender?.name === msg.sender?.name &&
               Math.abs(new Date(m.createdAt).getTime() - new Date(msg.createdAt).getTime()) < 5000)
            ) === index
          );
          
          return uniqueMessages.sort((a, b) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
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
      await loadInitialDataForBroadcastScreen(false); // Explicit foreground update
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
              {isRefreshingChat && (
                <ActivityIndicator size="small" color="#3B82F6" className="mr-2" />
              )}
              <View className={`w-2 h-2 rounded-full mr-2 ${
                isWebSocketConnected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <Text className={`text-xs font-medium ${
                isWebSocketConnected ? 'text-green-600' : 'text-red-600'
              }`}>
                {isRefreshingChat ? 'Syncing...' : (isWebSocketConnected ? 'Live' : 'Offline')}
              </Text>
            </View>
        </View>
      </View>

      {/* Chat Messages with Modern Design */}
      <ScrollView
        ref={chatScrollViewRef}
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ 
          flexGrow: 1,
          justifyContent: chatMessages.length === 0 ? 'center' : 'flex-end',
          paddingTop: 20, 
          paddingBottom: 20, 
          paddingHorizontal: 16 
        }}
        showsVerticalScrollIndicator={false}
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
          <View className="flex-1 items-center justify-center py-20 px-8">
            <Ionicons name="chatbubbles-outline" size={48} color="#91403E" className="mb-4" />
            <Text className="text-2xl font-bold text-cordovan mb-3 text-center">
              Start the Conversation!
            </Text>
            <Text className="text-gray-600 text-center text-base leading-relaxed mb-6">
              Be the first to chat with the DJ and fellow listeners. Share your thoughts, make requests, or just say hello!
            </Text>
            
            {!isWebSocketConnected && (
              <View className="bg-red-50 p-4 rounded-xl border border-red-200">
                <Text className="text-red-600 text-center text-sm font-medium">
                  ⚠️ Chat is currently offline. Check your connection.
                </Text>
              </View>
            )}
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
          marginBottom: 10,
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
      <View className="flex-1 justify-center items-center bg-anti-flash_white">
        <ActivityIndicator size="large" color="#91403E" />
        <Text className="mt-4 text-gray-600 text-lg">Loading Live Broadcast...</Text>
      </View>
    );
  }

   if (error && !isLoading) { 
    return (
      <View className="flex-1 justify-center items-center bg-anti-flash_white p-6 text-center">
        <Ionicons name="cloud-offline-outline" size={64} color="#7F1D1D" />
        <Text className="text-2xl font-semibold text-gray-800 mt-6 mb-2">Broadcast Error</Text>
        <Text className="text-gray-600 mb-8 text-base leading-relaxed">{error || "An unexpected error occurred while loading broadcast data."}</Text>
                  <TouchableOpacity
            className="bg-cordovan py-3 px-8 rounded-lg shadow-md active:opacity-80"
            onPress={() => loadInitialDataForBroadcastScreen()}
          >
          <Text className="text-white font-semibold text-base">Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const screenTitle = currentBroadcast ? `${currentBroadcast.title}` : 'Live Broadcast';
  const screenSubtitle = currentBroadcast ? `DJ: ${currentBroadcast.dj?.name || 'Wildcat Radio'}` : 'Standby...';

  const renderNowPlayingCard = () => {
    if (!currentBroadcast || currentBroadcast.status !== 'LIVE' || !nowPlayingInfo) {
      return null; // Don't render if not live or no song info
    }
    return (
      <View className="mx-4 my-2 bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Live Badge */}
        <View className="absolute top-3 right-3 z-20">
          <View className="bg-red-500 px-2.5 py-1 rounded-full flex-row items-center">
            <View className="w-1.5 h-1.5 bg-white rounded-full mr-1.5" />
            <Text className="text-white text-xs font-bold tracking-wide">LIVE</Text>
          </View>
        </View>

        <View className="p-4">
          {/* Compact Header */}
          <View className="flex-row items-center mb-3">
            {/* Album Art */}
            <View className="w-10 h-10 rounded-lg mr-3 bg-cordovan items-center justify-center">
              <Ionicons name="musical-notes-outline" size={16} color="white" />
            </View>

            {/* Content */}
            <View className="flex-1">
              <Text className="text-gray-800 text-sm font-bold leading-tight" numberOfLines={1}>
                {currentBroadcast.title}
              </Text>
              <Text className="text-gray-600 text-xs font-medium">
                {currentBroadcast.dj?.name || 'Wildcat Radio'}
              </Text>
            </View>
          </View>

          {/* Now Playing Section */}
          <View className="bg-gray-50 rounded-xl p-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <View className="flex-row items-center mb-1">
                  <View className="w-2 h-2 bg-cordovan rounded-full mr-2" />
                  <Text className="text-gray-600 text-xs font-bold uppercase tracking-wide">
                    NOW PLAYING
                  </Text>
                </View>
                
                <Text className="text-gray-800 text-sm font-bold mb-0.5" numberOfLines={1}>
                  {nowPlayingInfo.songTitle}
                </Text>
                <Text className="text-gray-600 text-xs font-medium" numberOfLines={1}>
                  {nowPlayingInfo.artist}
                </Text>
              </View>
              
              {/* Audio Visualizer */}
              <View className="flex-row items-end space-x-1 ml-3">
                {[...Array(3)].map((_, i) => (
                  <View
                    key={i}
                    className={`bg-cordovan rounded-full w-1 ${
                      i % 2 === 0 ? 'h-3' : 'h-2'
                    }`}
                    style={{ opacity: 0.7 }}
                  />
                ))}
              </View>
            </View>
          </View>

          {/* Connection Status */}
          <View className="flex-row items-center justify-center mt-3">
            <View className={`w-2 h-2 rounded-full mr-2 ${
              isWebSocketConnected ? 'bg-green-500' : 'bg-orange-500'
            }`} />
            <Text className={`text-xs font-medium ${
              isWebSocketConnected ? 'text-green-600' : 'text-orange-600'
            }`}>
              {isWebSocketConnected ? 'Connected • Crystal Clear HD' : 'Connecting...'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} className="flex-1 bg-anti-flash_white">
      <Stack.Screen 
        options={{
            headerShown: false, // Always hide the default header
        }}
       />
      
      {/* Custom Header - Always visible */}
      <CustomHeader 
        title="Wildcat Radio"
        showBackButton={isListening}
        onBackPress={isListening ? animateBackToPoster : undefined}
        showNotification={true}
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
              onPress={() => loadInitialDataForBroadcastScreen()}
            >
            <Text className="text-white font-semibold text-base">Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : currentBroadcast && currentBroadcast.status === 'LIVE' ? (
        // Show exciting ON AIR poster-style interface with animation overlay
        <View className="flex-1 bg-gray-50">
          {/* Static Poster View */}
          <View
            style={{
              flex: 1,
            }}
          >
            <ScrollView
              contentContainerStyle={{ paddingBottom: 120, paddingTop: 20 }}
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
              className="px-6"
            >
            {/* Dynamic ON AIR Poster Header */}
            <View className="items-center mb-8 relative">
              {/* Background Glow Effect */}
              <View 
                className="absolute inset-0 rounded-3xl"
                style={{
                  backgroundColor: '#91403E',
                  opacity: 0.05,
                  transform: [{ scale: 1.2 }],
                  shadowColor: '#91403E',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.1,
                  shadowRadius: 20,
                  elevation: 10,
                }}
              />
              
              {/* Main ON AIR Banner */}
              <View 
                className="bg-cordovan px-8 py-4 rounded-2xl mb-4 relative overflow-hidden"
                style={{
                  shadowColor: '#91403E',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 12,
                  elevation: 8,
                }}
              >
                {/* Animated Background Pattern */}
                <View className="absolute inset-0 opacity-20">
                  <View className="absolute top-2 left-4 w-3 h-3 bg-white rounded-full" />
                  <View className="absolute bottom-3 right-6 w-2 h-2 bg-white rounded-full" />
                  <View className="absolute top-6 right-8 w-1 h-1 bg-white rounded-full" />
                </View>
                
                <View className="flex-row items-center justify-center">
                  <View className="w-4 h-4 bg-white rounded-full mr-3" style={{ opacity: 0.9 }} />
                  <Text className="text-white text-2xl font-black tracking-widest">
                    ON AIR
                  </Text>
                  <View className="w-4 h-4 bg-white rounded-full ml-3" style={{ opacity: 0.9 }} />
                </View>
              </View>

              {/* Station Branding */}
              <Text className="text-gray-900 text-4xl font-black mb-2 tracking-wide">
                WILDCAT RADIO
              </Text>
              <Text className="text-cordovan text-lg font-bold tracking-wider">
                LIVE BROADCAST
              </Text>
            </View>

            {/* Show Information Poster Card */}
            <View 
              className="bg-white rounded-3xl p-6 mb-6 relative overflow-hidden"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.25,
                shadowRadius: 25,
                elevation: 20,
              }}
            >
              {/* Decorative Corner Elements */}
              <View className="absolute top-0 right-0 w-16 h-16 bg-cordovan/10 rounded-bl-3xl" />
              <View className="absolute bottom-0 left-0 w-12 h-12 bg-mikado_yellow/10 rounded-tr-3xl" />
              
              {/* Show Title Section */}
              <View className="items-center mb-6">
                <View className="bg-cordovan w-16 h-16 rounded-full items-center justify-center mb-4">
                  <Ionicons name="radio" size={32} color="white" />
                </View>
                <Text className="text-2xl font-black text-gray-900 text-center leading-tight">
                  {currentBroadcast.title}
                </Text>
                                  <View className="flex-row items-center mt-2">
                    <View className="bg-mikado_yellow px-3 py-1 rounded-full mr-2">
                      <Text className="text-black text-xs font-bold">DJ</Text>
                    </View>
                    <Text className="text-cordovan font-semibold text-lg">
                      {currentBroadcast.dj?.name || 'Wildcat Radio'}
                    </Text>
                  </View>
              </View>

              {/* Now Playing Section */}
              {nowPlayingInfo && (
                <View 
                  className="bg-gray-100 rounded-2xl p-5 mb-6 border border-gray-200"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 6,
                    elevation: 4,
                  }}
                >
                  <View className="flex-row items-center mb-3">
                    <View className="w-3 h-3 bg-cordovan rounded-full mr-3" />
                    <Text className="text-gray-800 text-sm font-bold uppercase tracking-widest">
                      NOW PLAYING
                    </Text>
                    {/* Audio Visualizer */}
                    <View className="flex-row items-end space-x-1 ml-auto">
                      {[...Array(4)].map((_, i) => (
                        <View
                          key={i}
                          className={`bg-cordovan rounded-full w-1 ${
                            i % 2 === 0 ? 'h-4' : 'h-3'
                          }`}
                          style={{ opacity: 0.8 }}
                        />
                      ))}
                    </View>
                  </View>
                  
                  <Text className="text-gray-900 text-xl font-bold mb-1">
                    {nowPlayingInfo.songTitle}
                  </Text>
                  <Text className="text-gray-600 text-base font-medium">
                    {nowPlayingInfo.artist}
                  </Text>
                </View>
              )}

              {/* Call to Action */}
              <TouchableOpacity
                className="bg-cordovan py-4 px-6 rounded-2xl items-center active:scale-95"
                onPress={animateToTuneIn}
                style={{
                  shadowColor: '#91403E',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 10,
                }}
              >
                <View className="flex-row items-center">
                  <Ionicons name="headset" size={24} color="white" className="mr-3" />
                  <Text className="text-white font-black text-lg tracking-wide">
                    TUNE IN NOW
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Connection Status Banner */}
            <View 
              className={`rounded-2xl p-4 border ${
                isWebSocketConnected 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-gray-100 border-gray-300'
              }`}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <View className="flex-row items-center justify-center">
                <Ionicons 
                  name={isWebSocketConnected ? "wifi" : "wifi-outline"} 
                  size={20} 
                  color={isWebSocketConnected ? "#10B981" : "#6B7280"} 
                  className="mr-2" 
                />
                <Text className={`font-bold text-base ${
                  isWebSocketConnected ? 'text-green-600' : 'text-gray-600'
                }`}>
                  {isWebSocketConnected ? 'LIVE • CRYSTAL CLEAR HD' : 'CONNECTING...'}
                </Text>
              </View>
            </View>
          </ScrollView>
          </View>

          {/* Animated Tune-In Interface */}
          {isListening && (
            <Animated.View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                transform: [{ translateX: tuneInTranslateX }],
                backgroundColor: '#F9FAFB',
                zIndex: 10,
              }}
            >
              {/* This will contain the full tune-in interface */}
              <View style={{ flex: 1 }}>

                {/* Refreshable Now Playing Section - Hidden when keyboard is visible */}
                {!isKeyboardVisible && (
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
                )}

                {/* Animated Tab Section - moves up when keyboard appears */}
                <Animated.View
                  style={{
                    flex: 1,
                    transform: [{ translateY: tabContentTranslateY }],
                    backgroundColor: isKeyboardVisible ? '#F3F4F6' : 'transparent',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: isKeyboardVisible ? -4 : 0 },
                    shadowOpacity: isKeyboardVisible ? 0.1 : 0,
                    shadowRadius: isKeyboardVisible ? 8 : 0,
                    elevation: isKeyboardVisible ? 8 : 0,
                  }}
                >
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
                </Animated.View>
              </View>
            </Animated.View>
          )}
        </View>
              ) : null}
    </View>
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