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
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  AppState,
  AppStateStatus,
  Keyboard,
} from 'react-native';
import { Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import CustomHeader from '../../components/navigation/CustomHeader';
import { useAuth } from '../../context/AuthContext';
import { useBroadcastContext } from './_layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BroadcastSkeleton from '../../components/BroadcastSkeleton';
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
  getMe,
  getUpcomingBroadcasts,
  getCurrentActiveDJ,
} from '../../services/apiService';
import { chatService } from '../../services/chatService';
import { pollService } from '../../services/pollService';
import { songRequestService } from '../../services/songRequestService';
import { broadcastService } from '../../services/broadcastService';
import streamService from '../../services/streamService';
import audioStreamingService from '../../services/audioStreamingService';
import { useAudioStreaming } from '../../hooks/useAudioStreaming';
import { websocketService } from '../../services/websocketService';
import CacheService from '../../services/cacheService';
import '../../global.css';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import ChatTab from '../../components/broadcast/ChatTab';
import RequestsTab from '../../components/broadcast/RequestsTab';
import PollsTab from '../../components/broadcast/PollsTab';

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

interface NowPlayingInfo {
  songTitle: string;
  artist: string;
}

const BroadcastScreen: React.FC = () => {
  // ALL HOOKS MUST BE CALLED FIRST - BEFORE ANY CONDITIONAL LOGIC
  const authContext = useAuth();
  const navigation = useNavigation();
  const { setIsBroadcastListening } = useBroadcastContext();
  const insets = useSafeAreaInsets();
  
  const params = useLocalSearchParams();
  const routeBroadcastId = params.broadcastId ? parseInt(params.broadcastId as string, 10) : null;

  // Audio streaming hook
  const [streamingState, streamingActions] = useAudioStreaming();

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
  const [upcomingBroadcasts, setUpcomingBroadcasts] = useState<Broadcast[]>([]);
  // Mock Now Playing Data - replace with actual data structure from API
  const [nowPlayingInfo, setNowPlayingInfo] = useState<NowPlayingInfo | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessageDTO[]>([]);
  const [songRequests, setSongRequests] = useState<SongRequestDTO[]>([]);
  const [activePolls, setActivePolls] = useState<PollDTO[]>([]);
  const [userMessageIds, setUserMessageIds] = useState<Set<number>>(new Set());
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  
  // Recovery notification state (aligned with website)
  const [recoveryNotification, setRecoveryNotification] = useState<{ message: string; timestamp: number } | null>(null);
  
  // Current active DJ state (aligned with website)
  const [currentActiveDJ, setCurrentActiveDJ] = useState<any>(null);

  // Stream status state
  const [streamStatus, setStreamStatus] = useState<{
    isLive: boolean;
    listenerCount: number;
    streamUrl: string;
  }>({
    isLive: false,
    listenerCount: 0,
    streamUrl: 'https://icecast.software/live.ogg',
  });

  // Stream loading state
  const [isStreamReady, setIsStreamReady] = useState(false);

  const [chatInput, setChatInput] = useState('');
  const [songTitleInput, setSongTitleInput] = useState('');

  const chatScrollViewRef = useRef<ScrollView>(null);
  const currentBroadcastRef = useRef<Broadcast | null>(null);
  // One-time autoplay guard to avoid multiple automatic play attempts
  const hasAttemptedAutoPlayRef = useRef(false);

  const [tabLayouts, setTabLayouts] = useState<Record<string, { x: number; width: number } | undefined>>({});
  const underlinePosition = useRef(new Animated.Value(0)).current;
  const underlineWidth = useRef(new Animated.Value(0)).current;
  const [isInitialLayoutDone, setIsInitialLayoutDone] = useState(false);

  // Keyboard animation states
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const tabContentTranslateY = useRef(new Animated.Value(0)).current;

  // Keep a live ref of the current broadcast for WebSocket callbacks
  useEffect(() => {
    currentBroadcastRef.current = currentBroadcast;
  }, [currentBroadcast]);

  // Auto-scroll to bottom when chat messages change (ensures we're always at the most recent message)
  useEffect(() => {
    if (chatMessages.length > 0 && activeTab === 'chat') {
      // Small delay to ensure layout is complete
      const scrollTimer = setTimeout(() => {
        chatScrollViewRef.current?.scrollToEnd({ animated: true });
      }, 200);
      return () => clearTimeout(scrollTimer);
    }
  }, [chatMessages.length, activeTab]);

  // Poster to tune-in transition animation states
  
  // Real-time update refs
  // Chat WebSocket connection ref
  const chatConnectionRef = useRef<any>(null);
  
  // Broadcast specific WebSocket connection ref
  const broadcastConnectionRef = useRef<any>(null);
  
  // Poll WebSocket connection ref
  const pollConnectionRef = useRef<any>(null);

  // Add user data state
  const [userData, setUserData] = useState<UserAuthData | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  // Slow mode state (matching website implementation)
  const [slowModeEnabled, setSlowModeEnabled] = useState(false);
  const [slowModeSeconds, setSlowModeSeconds] = useState(0);
  const [slowModeWaitSeconds, setSlowModeWaitSeconds] = useState<number | null>(null);
  const [lastMessageTime, setLastMessageTime] = useState<number>(0);

  // Ban detection state
  const [isBanned, setIsBanned] = useState(false);
  const [banMessage, setBanMessage] = useState<string | null>(null);

  // Auth is optional - allow public access
  const authToken = authContext?.authToken || null;

  // Sync slow mode settings from broadcast (matching website)
  useEffect(() => {
    if (currentBroadcast) {
      setSlowModeEnabled(!!currentBroadcast.slowModeEnabled);
      setSlowModeSeconds(typeof currentBroadcast.slowModeSeconds === 'number' ? currentBroadcast.slowModeSeconds : 0);
    }
  }, [currentBroadcast]);

  // Initialize stream configuration when broadcast becomes available
  useEffect(() => {
    const initializeStream = async () => {
      if (!currentBroadcast || currentBroadcast.status !== 'LIVE') {
        setIsStreamReady(false);
        return;
      }

      // Don't reinitialize if stream is already ready and playing
      if (isStreamReady && streamingState.isPlaying) {
        return;
      }

      // Don't reinitialize if already loading to prevent conflicts
      if (streamingState.isLoading) {
        return;
      }

      try {
        
        // Get stream configuration (always MP3 for mobile)
        const config = await streamService.getStreamConfig();
        
        // Use MP3 stream exclusively for mobile
        const mp3StreamUrl = 'https://icecast.software/live.mp3';
        
        // Update stream config in audio service
        await streamingActions.updateStreamConfig({
          ...config,
          streamUrl: mp3StreamUrl,
          isLive: currentBroadcast.status === 'LIVE',
        });

        // Update local stream status
        setStreamStatus({
          isLive: currentBroadcast.status === 'LIVE',
          listenerCount: config.listenerCount || 0,
          streamUrl: mp3StreamUrl,
        });

        // Load the MP3 stream (but don't play yet)
        await streamingActions.loadStream(mp3StreamUrl);
        
        // Stream is ready immediately after loading
        setIsStreamReady(true);
        
      } catch (error) {
        console.error('❌ Failed to initialize MP3 stream:', error);
        setIsStreamReady(false);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
          // Only show network errors to user
          Alert.alert(
            'Network Error', 
            'Unable to connect to the streaming server. Please check your internet connection and try again.'
          );
        } else {
          // For other errors, just log them and update status
        }
      }
    };

    // Only initialize once per broadcast
    initializeStream();
  }, [currentBroadcast?.id, currentBroadcast?.status]); // Removed isStreamReady and streamingState.isPlaying dependencies to prevent loops

  // Auto-play once when user opens the Listen screen and the broadcast is LIVE
  // This mimics Twitch-like behavior: if stream is live, start playing without extra steps
  useEffect(() => {
    if (!currentBroadcast || currentBroadcast.status !== 'LIVE') {
      return;
    }

    // Avoid repeated auto-play attempts (e.g., due to re-renders)
    if (hasAttemptedAutoPlayRef.current) {
      return;
    }

    // Only attempt auto-play if we're not already playing or loading
    if (!streamingState.isPlaying && !streamingState.isLoading) {
      hasAttemptedAutoPlayRef.current = true;
      // Fire and forget; handleInstantTuneIn already manages errors and alerts
      handleInstantTuneIn();
    }
  }, [currentBroadcast?.id, currentBroadcast?.status]);

  // Periodic check for MP3 stream availability when broadcast is live but stream not ready
  useEffect(() => {
    if (!currentBroadcast || currentBroadcast.status !== 'LIVE' || isStreamReady) {
      return; // Don't check if no broadcast, not live, or stream already ready
    }

    
    const checkInterval = setInterval(async () => {
      try {
        
        // Simplified check - just try to load the stream directly
        // This is less aggressive than the previous approach
        const mp3StreamUrl = 'https://icecast.software/live.mp3';
        
        try {
          await streamingActions.loadStream(mp3StreamUrl);
          
          clearInterval(checkInterval);
          
          // Update stream status
          setStreamStatus(prev => ({
            ...prev,
            streamUrl: mp3StreamUrl,
          }));
          
          // Mark as ready
          setTimeout(() => {
            setIsStreamReady(true);
          }, 1000);
        } catch (error) {
        }
      } catch (error) {
        console.error('❌ Error checking MP3 stream availability:', error);
      }
    }, 30000); // Check every 30 seconds instead of 10 to be less aggressive

    // Cleanup interval on unmount or when dependencies change
    return () => {
      clearInterval(checkInterval);
    };
  }, [currentBroadcast?.id, currentBroadcast?.status, isStreamReady, streamingActions]);

  // Custom play function with better error handling and immediate loading feedback
  const handlePlayPause = useCallback(async () => {
    
    if (!currentBroadcast || currentBroadcast.status !== 'LIVE') {
      Alert.alert('Stream Unavailable', 'The broadcast is not currently live. Please check back later.');
      return;
    }

    // Prevent rapid clicking
    if (streamingState.isLoading) {
      return;
    }

    try {
      // If stream is ready or already playing, just toggle
      if (isStreamReady || streamingState.isPlaying) {
        await streamingActions.togglePlayPause();
        return;
      }
        
      // If stream not ready and not playing, try to load first
      const mp3StreamUrl = 'https://icecast.software/live.mp3';
      
      try {
        // Load stream - this will show loading state automatically
        await streamingActions.loadStream(mp3StreamUrl);
        
        // Stream is ready immediately, try to play
        setIsStreamReady(true);
        try {
          await streamingActions.togglePlayPause();
        } catch (error) {
          console.error('❌ Failed to start playback after loading:', error);
        }
      } catch (error) {
        console.error('❌ Failed to load stream:', error);
        Alert.alert('Connection Error', 'Unable to connect to the audio stream. Please check your internet connection and try again.');
      }
    } catch (error) {
      console.error('❌ Failed to handle play/pause:', error);
      Alert.alert('Playback Error', 'Failed to control audio playback. Please try again.');
    }
  }, [isStreamReady, streamingState.isPlaying, streamingState.isLoading, streamingActions, currentBroadcast]);

  const handleInstantTuneIn = useCallback(async () => {
    if (streamingState.isLoading) {
      return;
    }
    await handlePlayPause();
  }, [handlePlayPause, streamingState.isLoading]);

  // Fetch user data when auth token is available
  useEffect(() => {
    const fetchUserData = async () => {
      if (!authToken) {
        setUserData(null);
        setCurrentUserId(null);
        return;
      }

      try {
        const result = await getMe();
        if ('error' in result) {
          console.error('❌ Failed to fetch user data:', result.error);
          setUserData(null);
          setCurrentUserId(null);
        } else {
          // Convert UserData to UserAuthData format
          const userAuthData: UserAuthData = {
            name: (result as any).name || (result as any).fullName || undefined,
            fullName: (result as any).fullName || undefined,
            firstName: (result as any).firstName || undefined,
            lastName: (result as any).lastName || undefined,
          };
          setUserData(userAuthData);
          setCurrentUserId(result.id ? parseInt(result.id.toString(), 10) : null);
        }
      } catch (error) {
        console.error('❌ Error fetching user data:', error);
        setUserData(null);
        setCurrentUserId(null);
      }
    };

    fetchUserData();
  }, [authToken]);

  // Update media metadata when now playing info changes - OPTIMIZED to prevent loops
  useEffect(() => {
    if (nowPlayingInfo && streamingState.isPlaying) {
      streamingActions.updateMediaMetadata(
        nowPlayingInfo.songTitle,
        nowPlayingInfo.artist,
        'WildCat Radio Live'
      ).catch(error => {
        console.error('Failed to update media metadata:', error);
      });
    }
  }, [nowPlayingInfo?.songTitle, nowPlayingInfo?.artist, streamingState.isPlaying]); // Removed streamingActions to prevent loops

  const listenerName = useMemo(() => {
    if (!userData || typeof userData !== 'object') return 'Listener';
    
    try {
      // Use the same logic as the profile screen - prioritize 'name' field
      if (userData.name && typeof userData.name === 'string' && userData.name.trim()) {
        return userData.name.trim();
      }
      if (userData.fullName && typeof userData.fullName === 'string' && userData.fullName.trim()) {
        return userData.fullName.trim();
      }
      if (userData.firstName && typeof userData.firstName === 'string' && userData.firstName.trim()) {
        const lastName = userData.lastName && typeof userData.lastName === 'string' ? userData.lastName.trim() : '';
        return `${userData.firstName.trim()} ${lastName}`.trim();
      }
    } catch (error) {
      console.warn('Error processing user name:', error);
    }
    
    return 'Listener';
  }, [userData]);

  const tabDefinitions: TabDefinition[] = useMemo(() => [
    { name: 'Chat', icon: 'chatbubbles-outline', key: 'chat' },
    { name: 'Requests', icon: 'musical-notes-outline', key: 'requests' },
    { name: 'Polls', icon: 'stats-chart-outline', key: 'polls' },
  ], []);

  // WebSocket connection health checker with polling fallback
  useEffect(() => {
    if (!currentBroadcast?.id) return;

    let healthCheckInterval: NodeJS.Timeout | null = null;
    let pollingInterval: NodeJS.Timeout | null = null;

    const checkWebSocketHealth = async () => {
      // Check if WebSocket is connected
      if (!isWebSocketConnected) {
        console.log('🔄 WebSocket disconnected, attempting to reconnect...');
        // Trigger reconnection by re-subscribing
        if (currentBroadcast?.id && authToken) {
          try {
            if (chatConnectionRef.current) {
              chatConnectionRef.current.disconnect();
              chatConnectionRef.current = null;
            }
            // Reconnect will be handled by the chat WebSocket setup effect
          } catch (e) {
            console.warn('Error during WebSocket health check reconnect:', e);
          }
        }
      }

      // If still disconnected after health check, use polling as fallback
      if (!isWebSocketConnected && currentBroadcast?.id) {
        // Poll for new messages every 5 seconds as fallback
        if (!pollingInterval) {
          console.log('📡 Starting polling fallback for chat messages');
          pollingInterval = setInterval(async () => {
            try {
              const messagesResult = await chatService.getMessages(
                currentBroadcast.id,
                authToken || undefined
              );
              if (!('error' in messagesResult) && messagesResult.data) {
                setChatMessages(prevMessages => {
                  const serverMessages = messagesResult.data || [];
                  const mergedMessages = [...serverMessages, ...prevMessages];
                  
                  // Remove duplicates
                  const uniqueMessages = mergedMessages.filter((msg, index, array) => 
                    array.findIndex(m => 
                      m.id === msg.id || 
                      (m.content === msg.content && 
                       m.sender?.name === msg.sender?.name &&
                       Math.abs(new Date(m.createdAt).getTime() - new Date(msg.createdAt).getTime()) < 5000)
                    ) === index
                  );
                  
                  const sortedMessages = uniqueMessages.sort((a, b) => 
                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                  );
                  
                  // Cache the messages
                  CacheService.cacheChatMessages(currentBroadcast.id, sortedMessages);
                  
                  return sortedMessages;
                });
              }
            } catch (error) {
              console.warn('Error in polling fallback:', error);
            }
          }, 5000); // Poll every 5 seconds
        }
      } else {
        // WebSocket is connected, stop polling
        if (pollingInterval) {
          clearInterval(pollingInterval);
          pollingInterval = null;
          console.log('✅ WebSocket connected, stopping polling fallback');
        }
      }
    };

    // Check WebSocket health every 10 seconds
    healthCheckInterval = setInterval(checkWebSocketHealth, 10000);
    
    // Initial check
    checkWebSocketHealth();

    return () => {
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
      }
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [currentBroadcast?.id, isWebSocketConnected, authToken]);

  // Setup chat WebSocket subscription like frontend
  useEffect(() => {
    if (!currentBroadcast?.id) {
      // Clean up chat connection if no broadcast
      if (chatConnectionRef.current) {
        chatConnectionRef.current.disconnect();
        chatConnectionRef.current = null;
        setIsWebSocketConnected(false);
      }
      return;
    }

    // Don't setup if authToken is required but missing (chat works without auth for reading)
    let isMounted = true;

    const setupChatWebSocket = async () => {
      try {
        // Clean up existing connection
        if (chatConnectionRef.current) {
          try {
            chatConnectionRef.current.disconnect();
          } catch (e) {
            console.warn('Error disconnecting chat:', e);
          }
          chatConnectionRef.current = null;
        }
        
        if (!isMounted) return;
        
        // Set up new connection like frontend
        const connection = await chatService.subscribeToChatMessages(
          currentBroadcast.id,
          authToken || undefined,
          (newMessage: ChatMessageDTO) => {
            // Double-check the message is for the current broadcast
            if (newMessage.broadcastId === currentBroadcast.id) {
              setChatMessages(prev => {
                const exists = prev.some(msg => msg.id === newMessage.id);
                if (exists) {
                  return prev;
                }
                
                // Secondary duplicate check by content and timing for edge cases
                const contentDuplicate = prev.some(msg => 
                  msg.content === newMessage.content && 
                  msg.sender?.name === newMessage.sender?.name &&
                  Math.abs(new Date(msg.createdAt).getTime() - new Date(newMessage.createdAt).getTime()) < 5000
                );
                if (contentDuplicate) {
                  return prev;
                }
                
                // Add new message and sort by timestamp
                const newMessages = [...prev, newMessage];
                const sortedMessages = newMessages.sort((a, b) => 
                  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );
                
                // Cache the updated messages (queue behavior - keeps last 50)
                CacheService.cacheChatMessages(currentBroadcast.id, sortedMessages);
                
                return sortedMessages;
              });
            }
          },
          {
            onConnectionChange: (connected: boolean) => {
              // Update WebSocket connection status
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
          // Component unmounted, clean up
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
  }, [currentBroadcast?.id, authToken]);

  // Setup poll WebSocket subscription for real-time updates
  useEffect(() => {
    if (!currentBroadcast?.id || !authToken) {
      // Clean up poll connection if no broadcast or auth
      if (pollConnectionRef.current) {
        try {
          pollConnectionRef.current.disconnect();
        } catch (e) {
          console.warn('Error disconnecting poll:', e);
        }
        pollConnectionRef.current = null;
      }
      return;
    }

    let isMounted = true;

    const setupPollWebSocket = async () => {
      try {
        console.log('🔄 BroadcastScreen: Setting up poll WebSocket for broadcast:', currentBroadcast.id);
        
        // Clean up existing connection
        if (pollConnectionRef.current) {
          try {
            pollConnectionRef.current.disconnect();
          } catch (e) {
            console.warn('Error disconnecting existing poll connection:', e);
          }
          pollConnectionRef.current = null;
        }
        
        if (!isMounted) return;
        
        // Set up new connection like frontend
        const connection = await pollService.subscribeToPolls(
          currentBroadcast.id,
          authToken,
          (pollUpdate: any) => {
            console.log('📊 BroadcastScreen: Received poll WebSocket update:', pollUpdate);
            
            switch (pollUpdate.type) {
              case 'POLL_VOTE':
                // Update existing poll with new vote data
                setActivePolls(prev => prev.map(poll => 
                  poll.id === pollUpdate.pollId 
                    ? { 
                        ...poll, 
                        options: pollUpdate.poll?.options || poll.options,
                        // Update vote counts if available
                        ...(pollUpdate.poll ? pollUpdate.poll : {})
                      }
                    : poll
                ));
                break;
                
              case 'NEW_POLL':
                console.log('📊 BroadcastScreen: NEW_POLL received:', pollUpdate.poll);
                // Always add the poll if it exists in the message (backend sends active polls)
                if (pollUpdate.poll) {
                  // Map backend format (active) to mobile format (isActive)
                  const pollToAdd = { 
                    ...pollUpdate.poll, 
                    isActive: pollUpdate.poll.isActive !== undefined ? pollUpdate.poll.isActive : (pollUpdate.poll.active !== undefined ? pollUpdate.poll.active : true),
                    isEnded: pollUpdate.poll.isEnded !== undefined ? pollUpdate.poll.isEnded : (pollUpdate.poll.endedAt !== null && pollUpdate.poll.endedAt !== undefined),
                  };
                  console.log('📊 BroadcastScreen: Adding poll to activePolls:', pollToAdd);
                  setActivePolls(prev => {
                    const exists = prev.some(poll => poll.id === pollToAdd.id);
                    if (exists) {
                      console.log('📊 BroadcastScreen: Poll already exists, updating:', pollToAdd.id);
                      return prev.map(poll => 
                        poll.id === pollToAdd.id ? pollToAdd : poll
                      );
                    }
                    console.log('📊 BroadcastScreen: Adding new poll to list. Previous count:', prev.length);
                    const newList = [pollToAdd, ...prev];
                    console.log('📊 BroadcastScreen: New poll list count:', newList.length);
                    // Cache the updated polls (queue behavior - keeps last 50)
                    if (currentBroadcast?.id) {
                      CacheService.cachePolls(currentBroadcast.id, newList);
                    }
                    return newList;
                  });
                  // Also trigger a refresh to ensure we have the latest data
                  setTimeout(() => {
                    pollService.getActivePolls(currentBroadcast.id, authToken)
                      .then(result => {
                        if (!('error' in result) && result.data) {
                          console.log('📊 BroadcastScreen: Refreshed polls after NEW_POLL. Count:', result.data.length);
                          setActivePolls(result.data);
                          // Cache the refreshed polls
                          if (currentBroadcast?.id) {
                            CacheService.cachePolls(currentBroadcast.id, result.data);
                          }
                        } else {
                          console.warn('📊 BroadcastScreen: Error refreshing polls after NEW_POLL:', result);
                        }
                      })
                      .catch(err => console.warn('Error refreshing polls after NEW_POLL:', err));
                  }, 1000);
                } else {
                  console.warn('📊 BroadcastScreen: NEW_POLL message missing poll data:', pollUpdate);
                }
                break;
                
              case 'POLL_UPDATED':
                console.log('📊 BroadcastScreen: POLL_UPDATED received:', pollUpdate.poll);
                if (pollUpdate.poll) {
                  // Map backend format to mobile format
                  const mappedPoll = {
                    ...pollUpdate.poll,
                    isActive: pollUpdate.poll.isActive !== undefined ? pollUpdate.poll.isActive : (pollUpdate.poll.active !== undefined ? pollUpdate.poll.active : false),
                    isEnded: pollUpdate.poll.isEnded !== undefined ? pollUpdate.poll.isEnded : (pollUpdate.poll.endedAt !== null && pollUpdate.poll.endedAt !== undefined),
                  };
                  
                  if (mappedPoll.isActive) {
                    // Poll became active, add it to the list
                    setActivePolls(prev => {
                      const exists = prev.some(poll => poll.id === mappedPoll.id);
                      if (exists) {
                        // Update existing poll
                        const updated = prev.map(poll => 
                          poll.id === mappedPoll.id 
                            ? { ...poll, ...mappedPoll }
                            : poll
                        );
                        // Cache the updated polls
                        CacheService.cachePolls(currentBroadcast.id, updated);
                        return updated;
                      } else {
                        // Add new active poll
                        console.log('📊 BroadcastScreen: Adding updated poll to list');
                        const newList = [mappedPoll, ...prev];
                        // Cache the updated polls
                        CacheService.cachePolls(currentBroadcast.id, newList);
                        return newList;
                      }
                    });
                  } else {
                    // Poll became inactive, remove it from the list
                    console.log('📊 BroadcastScreen: Removing inactive poll:', mappedPoll.id);
                    setActivePolls(prev => {
                      const filtered = prev.filter(poll => poll.id !== mappedPoll.id);
                      // Cache the updated polls
                      CacheService.cachePolls(currentBroadcast.id, filtered);
                      return filtered;
                    });
                  }
                }
                break;
                
              case 'POLL_RESULTS':
                if (pollUpdate.pollId && pollUpdate.results) {
                  setActivePolls(prev => prev.map(poll => 
                    poll.id === pollUpdate.pollId 
                      ? { 
                          ...poll, 
                          options: pollUpdate.results.options || poll.options
                        }
                      : poll
                  ));
                }
                break;
                
              case 'POLL_DELETED':
                console.log('📊 BroadcastScreen: POLL_DELETED received:', pollUpdate.pollId);
                // Remove deleted poll from the list
                if (pollUpdate.pollId) {
                  setActivePolls(prev => {
                    const filtered = prev.filter(poll => poll.id !== pollUpdate.pollId);
                    console.log('📊 BroadcastScreen: Removed deleted poll. Remaining:', filtered.length);
                    // Cache the updated polls
                    if (currentBroadcast?.id) {
                      CacheService.cachePolls(currentBroadcast.id, filtered);
                    }
                    return filtered;
                  });
                  // Also refresh polls to ensure we have the latest state
                  setTimeout(() => {
                    if (currentBroadcast?.id && authToken) {
                      pollService.getActivePolls(currentBroadcast.id, authToken)
                        .then(result => {
                          if (!('error' in result) && result.data) {
                            console.log('📊 BroadcastScreen: Refreshed polls after deletion');
                            setActivePolls(result.data);
                            // Cache the refreshed polls
                            if (currentBroadcast?.id) {
                              CacheService.cachePolls(currentBroadcast.id, result.data);
                            }
                          }
                        })
                        .catch(err => console.warn('Error refreshing polls after deletion:', err));
                    }
                  }, 500);
                }
                break;
                
              default:
            }
          }
        );
        
        if (isMounted) {
          pollConnectionRef.current = connection;
          console.log('✅ BroadcastScreen: Poll WebSocket connected successfully');
        } else {
          // Component unmounted, clean up
          connection.disconnect();
        }
        
      } catch (error) {
        console.error('❌ BroadcastScreen: Failed to setup poll WebSocket:', error);
        
        if (!isMounted) return;
        
        // Fallback: Set up periodic polling if WebSocket fails
        console.log('🔄 BroadcastScreen: Setting up fallback polling for polls');
        const pollInterval = setInterval(async () => {
          if (!isMounted || !currentBroadcast?.id || !authToken) {
            clearInterval(pollInterval);
            return;
          }
          try {
              const result = await pollService.getActivePolls(currentBroadcast.id, authToken);
              if (!('error' in result) && result.data) {
                setActivePolls(result.data);
                // Cache the refreshed polls
                if (currentBroadcast?.id) {
                  CacheService.cachePolls(currentBroadcast.id, result.data);
                }
              }
            } catch (err) {
              console.warn('Error in fallback poll refresh:', err);
            }
        }, 10000); // Poll every 10 seconds as fallback
        
        // Store interval for cleanup
        if (isMounted) {
          (pollConnectionRef.current as any) = { 
            disconnect: () => {
              clearInterval(pollInterval);
            },
            _isFallback: true 
          };
        }
      }
    };

    setupPollWebSocket();

    return () => {
      isMounted = false;
      if (pollConnectionRef.current) {
        try {
          if ((pollConnectionRef.current as any)._isFallback) {
            // It's a fallback interval, just clear it
            pollConnectionRef.current.disconnect();
          } else {
            pollConnectionRef.current.disconnect();
          }
        } catch (e) {
          console.warn('Error cleaning up poll connection:', e);
        }
        pollConnectionRef.current = null;
      }
    };
  }, [currentBroadcast?.id, authToken]);

  // Setup broadcast-specific WebSocket subscription (checkpoints, recovery)
  useEffect(() => {
    if (!currentBroadcast?.id || !authToken) {
      if (broadcastConnectionRef.current) {
        try {
          broadcastConnectionRef.current.disconnect();
        } catch (e) {
          console.warn('Error disconnecting broadcast specific:', e);
        }
        broadcastConnectionRef.current = null;
      }
      return;
    }

    let isMounted = true;

    const setupBroadcastSpecificWebSocket = async () => {
      try {
        console.log('🔄 BroadcastScreen: Setting up specific WebSocket for broadcast:', currentBroadcast.id);
        
        if (broadcastConnectionRef.current) {
          try {
            broadcastConnectionRef.current.disconnect();
          } catch (e) {
            console.warn('Error disconnecting existing broadcast connection:', e);
          }
          broadcastConnectionRef.current = null;
        }
        
        if (!isMounted) return;
        
        // Use websocketService directly as we don't have a service wrapper for this yet in mobile
        // This matches the pattern used in other services but direct
        const connection = await websocketService.subscribe(
          `/topic/broadcast/${currentBroadcast.id}`,
          (message: any) => {
            try {
              const payload = typeof message?.body === 'string' ? JSON.parse(message.body) : message;
              console.log('📡 Broadcast specific update:', payload.type);
              
              if (payload.type === 'BROADCAST_CHECKPOINT') {
                 // Update duration from checkpoint
                 console.log('⏱️ Checkpoint received:', payload);
                 // We could update a lastSaved state here if we had one
              } else if (payload.type === 'BROADCAST_RECOVERY') {
                 console.log('🔄 Recovery received:', payload);
                 setRecoveryNotification({
                    message: payload.message || 'Broadcast recovered',
                    timestamp: Date.now()
                 });
                 setTimeout(() => setRecoveryNotification(null), 5000);
                 
                 if (payload.broadcast) {
                    setCurrentBroadcast(payload.broadcast);
                 }
              }
            } catch (error) {
              console.error('❌ Error parsing broadcast specific message:', error);
            }
          },
          authToken
        );
        
        if (isMounted) {
          broadcastConnectionRef.current = connection;
          console.log('✅ BroadcastScreen: Specific WebSocket connected');
        } else {
          connection.unsubscribe();
        }
        
      } catch (error) {
        console.error('❌ Failed to setup broadcast specific WebSocket:', error);
      }
    };

    setupBroadcastSpecificWebSocket();

    return () => {
      isMounted = false;
      if (broadcastConnectionRef.current) {
        try {
          if (broadcastConnectionRef.current.unsubscribe) {
             broadcastConnectionRef.current.unsubscribe();
          } else if (broadcastConnectionRef.current.disconnect) {
             broadcastConnectionRef.current.disconnect();
          }
        } catch (e) {
          console.warn('Error cleaning up broadcast specific connection:', e);
        }
        broadcastConnectionRef.current = null;
      }
    };
  }, [currentBroadcast?.id, authToken]);

  // Keyboard animation handling
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        setIsKeyboardVisible(true);
        
        // Calculate how much to move up to cover the Live card area
        // This moves the tabs up to where the Live card was positioned
        const moveUpDistance = 5; // More reasonable distance to cover the compact live card area
        
        Animated.timing(tabContentTranslateY, {
          toValue: -moveUpDistance,
          duration: Platform.OS === 'ios' ? (event.duration || 350) : 400,
          easing: Easing.bezier(0.25, 0.46, 0.45, 0.94), // Smooth ease-out curve
          useNativeDriver: false,
        }).start();
      }
    );

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (event) => {
        setIsKeyboardVisible(false);
        
        Animated.timing(tabContentTranslateY, {
          toValue: 0,
          duration: Platform.OS === 'ios' ? (event.duration || 300) : 350,
          easing: Easing.bezier(0.25, 0.46, 0.45, 0.94), // Smooth ease-out curve
          useNativeDriver: false,
        }).start();
      }
    );

    return () => {
      keyboardWillShowListener?.remove();
      keyboardWillHideListener?.remove();
    };
  }, [tabContentTranslateY]);

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
            useNativeDriver: false, // Must be false for layout properties
          }),
          Animated.timing(underlineWidth, {
            toValue: currentTabLayout.width,
            duration: 250,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false, // Must be false for layout properties
          }),
        ]).start();
      }
    }
  }, [activeTab, tabLayouts, isInitialLayoutDone, tabDefinitions, underlinePosition, underlineWidth]);

  useEffect(() => {
    setIsBroadcastListening(streamingState.isPlaying);
  }, [streamingState.isPlaying, setIsBroadcastListening]);

  // Notification state change handler for the broadcast screen's CustomHeader
  // Cleanup effect to reset broadcast listening state on unmount
  useEffect(() => {
    return () => {
      // Reset broadcast listening state when component unmounts
      setIsBroadcastListening(false);
      // Clean up chat connection
      if (chatConnectionRef.current) {
        chatConnectionRef.current.disconnect();
        chatConnectionRef.current = null;
      }
      // Clean up broadcast specific connection
      if (broadcastConnectionRef.current) {
        broadcastConnectionRef.current.disconnect();
        broadcastConnectionRef.current = null;
      }
      // Clean up poll connection
      if (pollConnectionRef.current) {
        pollConnectionRef.current.disconnect();
        pollConnectionRef.current = null;
      }
    };
  }, [setIsBroadcastListening]);

  const loadInitialDataForBroadcastScreen = useCallback(async (isBackgroundUpdate = false) => {
    // Public access - no auth required for listening
    if (!isBackgroundUpdate) {
      setIsLoading(true);
      setError(null);
      // Keep all cached data across tab switches (including when unauthenticated)
      // so Chat/Requests/Polls persist. Do not clear here.
      setNowPlayingInfo(null); // Clear now playing on new load
    }

    try {
      let broadcastToUse: Broadcast | null = null;
      if (routeBroadcastId) {
        const detailsResult = await getBroadcastDetails(routeBroadcastId, authToken || null);
        if ('error' in detailsResult) throw new Error(detailsResult.error);
        broadcastToUse = detailsResult;
      } else {
        // Auto-detect live broadcast - public access
        const liveBroadcastsResult = await getLiveBroadcasts(authToken || null);
        if ('error' in liveBroadcastsResult) throw new Error(liveBroadcastsResult.error);
        if (liveBroadcastsResult.length > 0) {
          broadcastToUse = liveBroadcastsResult[0];
        } else {
          setCurrentBroadcast(null);
          setNowPlayingInfo(null);
          // Fetch upcoming broadcasts for "Off Air" state
          try {
            const upcomingResult = await getUpcomingBroadcasts(authToken || null);
            if (!('error' in upcomingResult)) {
              setUpcomingBroadcasts(upcomingResult.slice(0, 3)); // Get next 3 shows
            }
          } catch (e) {
            console.error('Failed to fetch upcoming broadcasts:', e);
          }
          setIsLoading(false);
          return;
        }
      }
      setCurrentBroadcast(broadcastToUse);

      // Removed mock Now Playing Info ("Wildcat's Choice") to clean up hero and avoid misleading text
      // If needed later, wire to real now-playing API instead of a placeholder

      if (broadcastToUse) {
        // Note: Cache loading is handled in a separate useEffect that runs when currentBroadcast changes
        // This ensures cache loads immediately when broadcast is set, before server fetch completes

        // Always fetch chat messages (public read), other features when authenticated
        const [messagesResult, pollsResult, songRequestsResult] = await Promise.all([
          chatService.getMessages(broadcastToUse.id, authToken || undefined),
          authToken ? pollService.getActivePolls(broadcastToUse.id, authToken) : Promise.resolve({ data: [] as any }),
          authToken ? songRequestService.getSongRequests(broadcastToUse.id, authToken) : Promise.resolve({ data: [] as any }),
        ]);

        if (!('error' in messagesResult) && messagesResult.data) {
          // Merge cached messages with server messages
          setChatMessages(prevMessages => {
            const serverMessages = messagesResult.data || [];
            console.log(`📥 Server fetch: ${serverMessages.length} messages, Current state: ${prevMessages.length} messages`);
            
            // If prevMessages is empty, it means cache didn't load or was cleared
            // In that case, just use server messages
            if (prevMessages.length === 0) {
              console.log('⚠️ No previous messages (cache may not have loaded), using server messages only');
              const sorted = serverMessages.sort((a, b) => 
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              );
              CacheService.cacheChatMessages(broadcastToUse.id, sorted);
              setTimeout(() => {
                chatScrollViewRef.current?.scrollToEnd({ animated: true });
              }, 100);
              return sorted;
            }
            
            // Merge server messages with cached messages (prevMessages)
            // Server messages are more recent, so prioritize them
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
            
            const sortedMessages = uniqueMessages.sort((a, b) => 
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            
            console.log(`✅ Merged: ${prevMessages.length} cached + ${serverMessages.length} server = ${sortedMessages.length} total`);
            
            // Cache the merged messages
            CacheService.cacheChatMessages(broadcastToUse.id, sortedMessages);
            
            // Scroll to bottom after updating with fresh data
            setTimeout(() => {
              chatScrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
            
            return sortedMessages;
          });
        } else {
          console.error('❌ Failed to fetch initial chat:', messagesResult.error);
          // If server fetch fails, check if we have messages in state (from cache)
          // If not, try to load cache one more time
          setChatMessages(currentMessages => {
            if (currentMessages.length === 0) {
              console.log('⚠️ No messages in state, attempting to load cache again...');
              CacheService.getCachedChatMessages(broadcastToUse.id).then(cached => {
                if (cached && cached.length > 0) {
                  console.log(`✅ Loaded ${cached.length} messages from cache after server failure`);
                  setChatMessages(cached);
                }
              });
            }
            return currentMessages;
          });
        }

        if (!('error' in pollsResult) && pollsResult.data) {
          console.log('📊 BroadcastScreen: Fetched polls:', pollsResult.data.length, pollsResult.data.map(p => ({ id: p.id, question: p.question, isActive: p.isActive })));
          setActivePolls(pollsResult.data);
        } else {
          console.error('Failed to fetch initial polls:', 'error' in pollsResult ? pollsResult.error : 'Unknown error');
        }

        if (!('error' in songRequestsResult)) {
          setSongRequests(songRequestsResult.data || []);
        } else {
          console.error('Failed to fetch initial song requests:', songRequestsResult.error);
        }
      }
    } catch (e: any) {
      setError(e.message || "Failed to load broadcast data.");
      setCurrentBroadcast(null);
      setNowPlayingInfo(null);
    } finally {
      setIsLoading(false);
    }
  }, [authToken, routeBroadcastId]);

  // Initial data fetch
  useEffect(() => {
    loadInitialDataForBroadcastScreen();
  }, [loadInitialDataForBroadcastScreen]);

  useEffect(() => {
    if (chatMessages.length > 0) {
      setTimeout(() => chatScrollViewRef.current?.scrollToEnd({ animated: true }), 300);
    }
  }, [chatMessages]);

  // Handle WebSocket reconnection when app becomes active
  useEffect(() => {
    const handleWebSocketReconnection = (nextAppState: AppStateStatus) => {
      
      if (nextAppState === 'active' && !isWebSocketConnected) {
        // App came to foreground and WebSocket is disconnected, try to reconnect
        setTimeout(() => {
          if (!isWebSocketConnected && currentBroadcast?.id && authToken) {
            // The WebSocket will be reconnected by the effect above
          }
        }, 1000);
      } else if (nextAppState === 'background') {
      }
    };

    const subscription = AppState.addEventListener('change', handleWebSocketReconnection);
    
    return () => {
      subscription?.remove();
    };
  }, [isWebSocketConnected, currentBroadcast?.id, authToken]);

  // ===== AUTOMATIC STATUS UPDATES FOR LISTENERS =====

  // Global Broadcast WebSocket (Real-time updates) - Listen for broadcast start/end
  useEffect(() => {
    // Only setup if we don't have a specific broadcast ID
    if (routeBroadcastId) {
      return;
    }

    let disconnectGlobalWs: (() => void) | null = null;
    let isMounted = true;

    const handleGlobalBroadcastUpdate = (update: any) => {
      if (!update || typeof update !== 'object') return;

      const activeBroadcast = currentBroadcastRef.current;

      switch (update.type) {
        case 'BROADCAST_STARTED':
          if (update.broadcast) {
            setCurrentBroadcast(update.broadcast);
            setStreamStatus((prev) => ({ ...prev, isLive: true }));
          }
          break;
        case 'BROADCAST_ENDED':
          if (!update.broadcastId || !activeBroadcast || activeBroadcast.id === update.broadcastId) {
            setCurrentBroadcast(null);
            setStreamStatus((prev) => ({ ...prev, isLive: false }));
          }
          break;
        case 'BROADCAST_RECOVERY':
          console.log('📡 Broadcast recovery notification received:', update);
          // Show recovery notification to listeners (aligned with website)
          setRecoveryNotification({
            message: update.message || 'Broadcast recovered after brief interruption',
            timestamp: update.timestamp || Date.now()
          });
          
          if (update.broadcast) {
            setCurrentBroadcast(update.broadcast);
            setStreamStatus((prev) => ({ ...prev, isLive: update.broadcast.status === 'LIVE' }));
          }
          
          // Hide notification after 5 seconds (aligned with website)
          setTimeout(() => {
            setRecoveryNotification(null);
          }, 5000);
          break;
        case 'LISTENER_COUNT_UPDATE': {
          const count = typeof update.listenerCount === 'number'
            ? update.listenerCount
            : typeof update.data?.listenerCount === 'number'
              ? update.data.listenerCount
              : null;
          if (count !== null) {
            setStreamStatus((prev) => ({ ...prev, listenerCount: count }));
          }
          break;
        }
        case 'STREAM_STATUS': {
          const nextCount = typeof update?.data?.listenerCount === 'number'
            ? update.data.listenerCount
            : typeof update.listenerCount === 'number'
              ? update.listenerCount
              : null;
          const nextLive = typeof update?.data?.isLive === 'boolean'
            ? update.data.isLive
            : typeof update.isLive === 'boolean'
              ? update.isLive
              : null;

          // Auto-end broadcast if stream status explicitly reports not live while we think we are live
          if (nextLive === false && currentBroadcastRef.current) {
             console.log('📡 Stream status reports NOT LIVE. Ending current broadcast session.');
             setCurrentBroadcast(null);
             setStreamStatus((prev) => ({ ...prev, isLive: false }));
          } else {
             setStreamStatus((prev) => ({
               ...prev,
               listenerCount: nextCount !== null ? nextCount : prev.listenerCount,
               isLive: nextLive !== null ? nextLive : prev.isLive,
             }));
          }
          break;
        }
        default:
          break;
      }
    };

    const setupGlobalBroadcastWebSocket = async () => {
      try {
        const result = await chatService.subscribeToGlobalBroadcastUpdates(
          handleGlobalBroadcastUpdate,
          authToken || ''
        );

        if (result.error || !result.data) {
          throw new Error(result.error || 'Failed to subscribe to global broadcast updates');
        }

        if (!isMounted) {
          result.data.disconnect();
          return;
        }

        disconnectGlobalWs = result.data.disconnect;
      } catch (error) {
        console.error('🌐 Failed to setup global broadcast WebSocket:', error);
      }
    };

    setupGlobalBroadcastWebSocket();

    // Cleanup function
    return () => {
      isMounted = false;
      if (disconnectGlobalWs) {
        disconnectGlobalWs();
      }
    };
  }, [routeBroadcastId, authToken]);

  // Refresh chat history when the Listen screen regains focus (improves consistency)
  useFocusEffect(
    useCallback(() => {
      if (currentBroadcast?.id) {
        refreshChatData();
      }
      return () => {};
    }, [currentBroadcast?.id, refreshChatData])
  );

  // Lightweight periodic refresh as a safety net when viewing Chat
  useEffect(() => {
    if (!currentBroadcast?.id || activeTab !== 'chat') return;
    const id = setInterval(() => {
      refreshChatData();
    }, 30000); // every 30s as fallback if WS hiccups
    return () => clearInterval(id);
  }, [currentBroadcast?.id, activeTab, refreshChatData]);

  const handleSendChatMessage = async () => {
    if (!authToken || !currentBroadcast || !chatInput.trim()) return;
    
    // Check if user is banned
    if (isBanned) {
      Alert.alert("Banned from Chat", banMessage || "You have been banned from this chat.");
      return;
    }

    // Check slow mode (matching website implementation)
    if (slowModeEnabled && slowModeSeconds > 0) {
      const now = Date.now();
      const timeSinceLastMessage = (now - lastMessageTime) / 1000; // Convert to seconds
      
      if (lastMessageTime > 0 && timeSinceLastMessage < slowModeSeconds) {
        const waitTime = Math.ceil(slowModeSeconds - timeSinceLastMessage);
        setSlowModeWaitSeconds(waitTime);
        Alert.alert(
          "Slow Mode Active", 
          `Please wait ${waitTime} second${waitTime !== 1 ? 's' : ''} before sending another message.`
        );
        return;
      }
    }
    
    const messageToSend = chatInput;
    setChatInput(''); // Clear input immediately
    setIsSubmitting(true);
    setSlowModeWaitSeconds(null); // Clear any previous slow mode wait
    
    try {
        // Use chatService like frontend
        const result = await chatService.sendMessage(currentBroadcast.id, { content: messageToSend }, authToken);
        
        if ('error' in result) {
          console.error('❌ Failed to send message:', result.error);
          
          // Enhanced error handling (matching website)
          const errorMessage = result.error || "Failed to send message. Please try again.";
          
          // Check for slow mode error
          if (errorMessage.toLowerCase().includes('slow mode')) {
            const match = errorMessage.match(/(\d+)\s*second/i);
            const waitSeconds = match ? parseInt(match[1], 10) : slowModeSeconds;
            setSlowModeWaitSeconds(waitSeconds);
            Alert.alert("Slow Mode", `Please wait ${waitSeconds} seconds before sending another message.`);
          }
          // Check for ban error
          else if (errorMessage.toLowerCase().includes('banned')) {
            setIsBanned(true);
            setBanMessage(errorMessage);
            Alert.alert("Banned from Chat", errorMessage);
          }
          // Check for profanity filter
          else if (errorMessage.toLowerCase().includes('profanity') || errorMessage.toLowerCase().includes('inappropriate')) {
            Alert.alert("Message Blocked", "Your message contains inappropriate content.");
          }
          // Generic error
          else {
            Alert.alert("Error", errorMessage);
          }
          
          // Restore message to input on error
          setChatInput(messageToSend);
        } else if (result.data) {
          // Update last message time for slow mode
          setLastMessageTime(Date.now());
          // Message will appear via WebSocket when server broadcasts it
          // Track this as our own message FIRST to prevent left-side flicker
          setUserMessageIds(prev => {
            const newSet = new Set([...prev, result.data!.id]);
            return newSet;
          });
          
          // Then add the sent message to chat messages
          setChatMessages(prev => {
            // Check if message already exists (avoid duplicates)
            const exists = prev.some(msg => msg.id === result.data!.id);
            if (exists) {
              return prev;
            }
            
            // Add new message and sort by timestamp
            const newMessages = [...prev, result.data!].filter((msg): msg is ChatMessageDTO => msg !== undefined);
            return newMessages.sort((a, b) => 
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          });
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
    if (!authToken || !currentBroadcast || !songTitleInput.trim()) {
        Alert.alert("Missing Info", "Please enter a song title.");
        return;
    }
    setIsSubmitting(true);
    const payload = {
      songTitle: songTitleInput.trim(),
    };
    const result = await songRequestService.createSongRequest(currentBroadcast.id, payload, authToken);
    if ('error' in result) {
      Alert.alert("Error", result.error || "Failed to request song.");
    } else {
      Alert.alert("Success", "Song requested successfully!");
      setSongTitleInput('');
    }
    setIsSubmitting(false);
  };

  const handleVoteOnPoll = async (pollId: number, optionId: number) => {
    if (!authToken || !currentBroadcast) return;
    setIsSubmitting(true);
    try {
      const result = await voteOnPoll(pollId, { optionId }, authToken);
      if ('error' in result) {
        console.error('Vote error:', result.error);
        Alert.alert("Error", result.error || "Failed to submit vote.");
      } else {
        console.log('Vote successful:', result);
        // Don't show alert for success - just refresh the poll
        // Refresh polls after voting
        pollService.getActivePolls(currentBroadcast.id, authToken)
          .then(pollsResult => {
              if (!('error' in pollsResult) && pollsResult.data) {
                console.log('Polls refreshed after vote');
                setActivePolls(pollsResult.data);
              }
          })
          .catch(err => console.error("Error refreshing polls after vote:", err));
      }
    } catch (error) {
      console.error('Vote exception:', error);
      Alert.alert("Error", "Failed to submit vote. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Refresh functions for each tab
  const refreshChatData = useCallback(async () => {
    if (!currentBroadcast?.id) return;
    setIsRefreshingChat(true);
    try {
      const messagesResult = await chatService.getMessages(currentBroadcast.id, authToken || undefined);
      if (!('error' in messagesResult) && messagesResult.data) {
        // Smart merge: preserve recent local messages that might not be on server yet
        setChatMessages(prevMessages => {
          const serverMessages = messagesResult.data || [];
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
          
          const sortedMessages = uniqueMessages.sort((a, b) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          
          // Cache the refreshed messages (queue behavior - keeps last 50)
          if (currentBroadcast?.id) {
            CacheService.cacheChatMessages(currentBroadcast.id, sortedMessages);
          }
          
          return sortedMessages;
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
      const songRequestsResult = await songRequestService.getSongRequests(currentBroadcast.id, authToken);
      if (!('error' in songRequestsResult)) {
        setSongRequests(songRequestsResult.data || []);
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
      const pollsResult = await pollService.getActivePolls(currentBroadcast.id, authToken);
      if (!('error' in pollsResult) && pollsResult.data) {
        setActivePolls(pollsResult.data);
        // Cache the refreshed polls (queue behavior - keeps last 50)
        CacheService.cachePolls(currentBroadcast.id, pollsResult.data);
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

  // Memoized chat messages to prevent unnecessary re-renders
  const memoizedChatMessages = useMemo(() => {
    const filteredMessages = chatMessages.filter(msg => msg && msg.id);
    return filteredMessages;
  }, [chatMessages]);

  // Memoized message ownership calculation to prevent performance loops
  const messageOwnershipMap = useMemo(() => {
    const ownershipMap = new Map<number, boolean>();
    
    memoizedChatMessages.forEach(msg => {
      // Method 1: Check userMessageIds Set (for messages sent in this session)
      if (userMessageIds.has(msg.id)) {
        ownershipMap.set(msg.id, true);
        return;
      }
      
      // Method 2: Compare sender ID with current user ID (most reliable)
      if (currentUserId && msg.sender?.id && msg.sender.id === currentUserId) {
        ownershipMap.set(msg.id, true);
        return;
      }
      
      // Method 3: Compare sender name with listenerName (fallback)
      if (listenerName && listenerName !== 'Listener') {
        const firstName = msg.sender?.firstname || "";
        const lastName = msg.sender?.lastname || "";
        const fullName = `${firstName} ${lastName}`.trim();
        const rawName = msg.sender?.name || fullName;
        
        if (rawName) {
          const senderName = rawName.toLowerCase().trim();
          const userListenerName = listenerName.toLowerCase().trim();
          if (senderName === userListenerName) {
            ownershipMap.set(msg.id, true);
            return;
          }
        }
      }
      
      // Method 4: Additional name variations check
      if (userData) {
        const firstName = msg.sender?.firstname || "";
        const lastName = msg.sender?.lastname || "";
        const fullName = `${firstName} ${lastName}`.trim();
        const rawName = msg.sender?.name || fullName;

        if (rawName) {
          const senderName = rawName.toLowerCase().trim();
          
          // Check all possible name variations
          const nameVariations = [
            userData.name?.toLowerCase().trim(),
            userData.fullName?.toLowerCase().trim(),
            userData.firstName?.toLowerCase().trim(),
            `${userData.firstName?.toLowerCase().trim()} ${userData.lastName?.toLowerCase().trim()}`.trim()
          ].filter(Boolean);
          
          if (nameVariations.some(variation => variation === senderName)) {
            ownershipMap.set(msg.id, true);
            return;
          }
        }
      }
      
      // Default to false if no match
      ownershipMap.set(msg.id, false);
    });
    
    return ownershipMap;
  }, [memoizedChatMessages, currentUserId, listenerName, userData, userMessageIds]);

  const nextShow = upcomingBroadcasts.length > 0 ? upcomingBroadcasts[0] : null;

  const nextShowStart = useMemo(() => {
    if (!nextShow?.scheduledStart && !nextShow?.startTime) return null;
    try {
      const startValue = nextShow.scheduledStart || nextShow.startTime;
      return format(parseISO(startValue), "EEEE, MMM d • h:mm a");
    } catch {
      return null;
    }
  }, [nextShow?.scheduledStart, nextShow?.startTime]);

  const nextShowHost = useMemo(() => {
    if (!nextShow) return null;
    return nextShow.dj?.name || nextShow.djName || nextShow.hostName || nextShow.startedBy?.name || null;
  }, [nextShow]);




  const renderTabContent = () => {
    switch (activeTab) {
      case 'chat':
        return (
          <ChatTab
            authToken={authToken}
            isLoading={isLoading}
            isRefreshingChat={isRefreshingChat}
            isWebSocketConnected={isWebSocketConnected}
            memoizedChatMessages={memoizedChatMessages}
            messageOwnershipMap={messageOwnershipMap}
            chatScrollViewRef={chatScrollViewRef}
            slowModeEnabled={slowModeEnabled}
            slowModeSeconds={slowModeSeconds}
            slowModeWaitSeconds={slowModeWaitSeconds}
            isBanned={isBanned}
            banMessage={banMessage}
            currentBroadcast={currentBroadcast}
            chatInput={chatInput}
            setChatInput={setChatInput}
            isSubmitting={isSubmitting}
            handleSendChatMessage={handleSendChatMessage}
            onRequestPress={() => setActiveTab('requests')}
          />
        );
      case 'requests':
        return (
          <RequestsTab
            authToken={authToken}
            songRequests={songRequests}
            isRefreshingRequests={isRefreshingRequests}
            refreshRequestsData={refreshRequestsData}
            currentBroadcast={currentBroadcast}
            songTitleInput={songTitleInput}
            setSongTitleInput={setSongTitleInput}
            isSubmitting={isSubmitting}
            handleCreateSongRequest={handleCreateSongRequest}
          />
        );
      case 'polls':
        return (
          <PollsTab
            authToken={authToken}
            activePolls={activePolls}
            isLoading={isLoading}
            isRefreshingPolls={isRefreshingPolls}
            refreshPollsData={refreshPollsData}
            isSubmitting={isSubmitting}
            currentBroadcast={currentBroadcast}
            handleVoteOnPoll={handleVoteOnPoll}
          />
        );
      default:
        return null;
    }
  };

  // Show skeleton overlay while we fetch the initial broadcast data
  const showGlobalSkeleton = isLoading && !currentBroadcast && !nowPlayingInfo;

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
  const isBroadcastLive = currentBroadcast?.status === 'LIVE';

  const renderListenHero = () => {
    if (!currentBroadcast) return null;

    const listenerDisplay =
      streamStatus.listenerCount ||
      streamingState.listenerCount ||
      0;

    const heroHeadline = streamingState.isPlaying
      ? 'Listening Live'
      : streamingState.isLoading
        ? 'Connecting...'
        : 'Tap to Listen';

    // Show the actual broadcast title and current DJ in the hero (not the song metadata)
    const heroSubtitle = currentBroadcast.title;
    const heroMeta = currentBroadcast.dj?.name || 'Wildcat Radio';

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
              <Text style={styles.instantListenTitle}>
                {heroSubtitle}
              </Text>
              <Text style={styles.instantListenSubtitle}>
                with {heroMeta}
              </Text>
            </View>
            <View style={styles.instantListenRightIcon}>
              <Ionicons name="radio" size={22} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          {/** Meta row (now playing + connectivity) removed to compress layout per request **/}
        </LinearGradient>
      </View>
    );
  };

  // Fetch current active DJ when broadcast is live (aligned with website)
  useEffect(() => {
    const fetchCurrentActiveDJ = async () => {
      if (currentBroadcast?.status === 'LIVE' && currentBroadcast?.id && authToken) {
        try {
          const response = await getCurrentActiveDJ(currentBroadcast.id, authToken);
          if (!('error' in response)) {
            setCurrentActiveDJ(response);
          } else {
            // Fallback to startedBy or dj if API fails
            if (currentBroadcast?.startedBy) {
              setCurrentActiveDJ(currentBroadcast.startedBy);
            } else if (currentBroadcast?.dj) {
              setCurrentActiveDJ(currentBroadcast.dj);
            }
          }
        } catch (error) {
          console.warn('Error fetching current active DJ:', error);
          // Fallback to startedBy or dj if error
          if (currentBroadcast?.startedBy) {
            setCurrentActiveDJ(currentBroadcast.startedBy);
          } else if (currentBroadcast?.dj) {
            setCurrentActiveDJ(currentBroadcast.dj);
          }
        }
      } else {
        setCurrentActiveDJ(null);
      }
    };

    fetchCurrentActiveDJ();
    // Refresh every 30 seconds (aligned with website)
    const interval = setInterval(fetchCurrentActiveDJ, 30000);
    return () => clearInterval(interval);
  }, [currentBroadcast?.id, currentBroadcast?.status, currentBroadcast?.startedBy, currentBroadcast?.dj, authToken]);

  // Clear current active DJ when broadcast ends (aligned with website)
  useEffect(() => {
    if (currentBroadcast && currentBroadcast.status !== 'LIVE') {
      setCurrentActiveDJ(null);
    }
  }, [currentBroadcast?.status]);

  return (
    <View style={[styles.container]} className="flex-1 bg-anti-flash_white">
      <Stack.Screen 
        options={{
            headerShown: true, // Always use tab layout header for consistency
        }}
       />
      
      {/* Recovery Notification Banner (aligned with website) */}
      {recoveryNotification && (
        <View className="mx-4 mt-2 mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <View className="flex-row items-center">
            <Ionicons name="information-circle" size={20} color="#2563EB" style={{ marginRight: 8 }} />
            <Text className="text-blue-800 text-sm font-medium">
              {recoveryNotification.message}
            </Text>
          </View>
        </View>
      )}
      
      {!currentBroadcast ? (
        // Beautiful Off Air state with next show info
        <ScrollView
          style={{ backgroundColor: '#F5F5F5' }}
          contentContainerStyle={{ 
            paddingBottom: insets.bottom + 24,
            paddingTop: Platform.OS === 'android' ? 12 : 6,
            paddingHorizontal: 20,
            backgroundColor: '#F5F5F5',
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshingBroadcast}
              onRefresh={refreshBroadcastData}
              colors={['#91403E']}
              tintColor="#91403E"
            />
          }
        >
          <View style={{ width: '100%', paddingVertical: 32 }}>
            <LinearGradient
              colors={['#641B1F', '#2B0D13']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.offAirCard}
            >
              <View style={styles.offAirHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={styles.offAirIconWrapper}>
                    <Ionicons name="musical-notes-outline" size={36} color="#FFC30B" />
                  </View>
                  <View>
                    <Text style={styles.offAirHeading}>Wildcat Radio</Text>
                    <Text style={styles.offAirSubheading}>No broadcast currently active</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={loadInitialDataForBroadcastScreen}
                  activeOpacity={0.8}
                  style={styles.offAirRefreshButton}
                >
                  <Ionicons name="refresh" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <Text style={styles.offAirDescription}>
                {nextShowStart
                  ? `Next live show starts ${nextShowStart}${nextShowHost ? ` with ${nextShowHost}` : ''}.`
                  : "We're getting the next broadcast ready. Check the schedule for upcoming shows."}
              </Text>

            </LinearGradient>

            {/* Next Show Card */}
            {nextShow && (
              <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 24,
                padding: 24,
                width: '100%',
                marginBottom: 20,
                shadowColor: '#91403E',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.15,
                shadowRadius: 16,
                elevation: 8,
                borderWidth: 1,
                borderColor: '#F3F4F6',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <View style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: '#FFC30B',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 14,
                    shadowColor: '#FFC30B',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 6,
                  }}>
                    <Ionicons name="time" size={24} color="#000000" />
                  </View>
                  <Text style={{
                    fontSize: 20,
                    fontWeight: 'bold',
                    color: '#1F2937',
                    letterSpacing: -0.5,
                  }}>
                    Upcoming Live Show
                  </Text>
                </View>
                <Text style={{
                  fontSize: 22,
                  fontWeight: 'bold',
                  color: '#1F2937',
                  marginBottom: 10,
                  letterSpacing: -0.3,
                }}>
                  {nextShow.title}
                </Text>
                {nextShowHost && (
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    marginBottom: 12,
                    backgroundColor: '#F9FAFB',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 12,
                    alignSelf: 'flex-start',
                  }}>
                    <Ionicons name="person" size={18} color="#91403E" style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 15, color: '#91403E', fontWeight: '700' }}>
                      {nextShowHost}
                    </Text>
                  </View>
                )}
                {nextShowStart && (
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    marginTop: 8,
                    marginBottom: 12,
                  }}>
                    <Ionicons name="calendar" size={18} color="#6B7280" style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 15, color: '#6B7280', fontWeight: '600' }}>
                      {nextShowStart}
                    </Text>
                  </View>
                )}
                <View style={{
                  backgroundColor: '#91403E',
                  borderRadius: 16,
                  padding: 14,
                  marginTop: 8,
                }}>
                  <Text style={{ 
                    fontSize: 14, 
                    color: '#FFFFFF', 
                    fontWeight: '700',
                    textAlign: 'center',
                    letterSpacing: 0.5,
                  }}>
                    {nextShow?.scheduledStart
                      ? `Starts ${formatDistanceToNow(parseISO(nextShow.scheduledStart), { addSuffix: true })}`
                      : 'Stay tuned'}
                  </Text>
                </View>
              </View>
            )}

          </View>
        </ScrollView>
      ) : currentBroadcast ? (
        isBroadcastLive ? (
          // LIVE: Use a flex layout (no outer ScrollView) so the bottom card is always visible
          <View className="flex-1 bg-gray-50" style={{ paddingTop: 4, paddingBottom: 0 }}>
            {renderListenHero()}
            <View style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 0,
              marginHorizontal: 0,
              marginBottom: 0,
              overflow: 'visible',
              // Ensure the interaction card is always visible
              minHeight: 300,
              flexShrink: 0,
              flex: 1, // Fill remaining space so the chat input reaches the navbar
            }}>
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
                keyboardVerticalOffset={Platform.OS === 'ios' ? (insets.bottom + 56) : 0}
                style={{ minHeight: 260 }}
              >
                {renderTabContent()}
              </KeyboardAvoidingView>
            </View>
          </View>
        ) : (
          // NOT LIVE: Show the same bottom interaction card so tabs are always visible
          <View className="flex-1 bg-gray-50" style={{ paddingTop: 4, paddingBottom: 0 }}>
            {renderListenHero()}
            <View style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 0,
              marginHorizontal: 0,
              marginBottom: 0,
              overflow: 'visible',
              // Ensure the interaction card is always visible
              minHeight: 300,
              flexShrink: 0,
              flex: 1, // Fill remaining space so the chat input reaches the navbar
            }}>
              {/* Subtle notice while not live */}
              <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FFF7ED', borderBottomWidth: 1, borderBottomColor: '#FDE68A' }}>
                <Text style={{ color: '#92400E', fontSize: 12, fontWeight: '700' }}>Interactive features unlock when the broadcast goes LIVE.</Text>
              </View>

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
                keyboardVerticalOffset={Platform.OS === 'ios' ? (insets.bottom + 56) : 0}
                style={{ minHeight: 260 }}
              >
                {renderTabContent()}
              </KeyboardAvoidingView>
            </View>
          </View>
        )
      ) : null}

      {showGlobalSkeleton && (
        <View style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 0,
          right: 0,
          bottom: insets.bottom + 64, // leave room for tab bar
          backgroundColor: 'rgba(243, 244, 246, 0.9)',
        }} pointerEvents="none">
          <ScrollView
            style={{ backgroundColor: 'transparent' }}
            contentContainerStyle={{ 
              paddingBottom: 100,
              paddingTop: Platform.OS === 'android' ? 12 : 6,
              paddingHorizontal: 20,
            }}
            showsVerticalScrollIndicator={false}
          >
            <BroadcastSkeleton />
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6', 
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
    shadowOpacity: 0.25,
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
    backgroundColor: '#FDFCF3',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginBottom: 12,
  },
  instantListenButtonDisabled: {
    opacity: 0.6,
  },
  instantListenIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FACC15',
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
    color: '#6B7280',
    fontWeight: '700',
    marginBottom: 4,
  },
  instantListenTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
    flexShrink: 1,
    flexWrap: 'wrap',
    lineHeight: 22,
  },
  instantListenSubtitle: {
    fontSize: 14,
    color: '#6B7280',
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
  // Removed heroMetaRow, heroMetaItem, heroMetaText styles along with the meta row UI
  tabBar: {
  },
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
});
export default BroadcastScreen;
