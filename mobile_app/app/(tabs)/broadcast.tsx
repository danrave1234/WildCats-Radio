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
  Keyboard,
  RefreshControl,
  Animated,
  Easing,
  Pressable,
  Dimensions,
  Modal,
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
import { getUpcomingBroadcasts, getMe, UserData } from '../../services/userService';

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

// Helper function to get user initials
const getInitials = (user: any) => {
  if (!user) return 'LS';
  const firstInitial = user.firstname ? user.firstname.charAt(0) : '';
  const lastInitial = user.lastname ? user.lastname.charAt(0) : '';
  return `${firstInitial}${lastInitial}`.toUpperCase() || 'LS';
};

const BroadcastScreen: React.FC = () => {
  const router = useRouter();
  const { currentUser, isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const [streamingState, streamingActions] = useAudioStreaming();
  const [currentBroadcast, setCurrentBroadcast] = useState<Broadcast | null>(null);
  const [upcomingBroadcasts, setUpcomingBroadcasts] = useState<Broadcast[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [songRequests, setSongRequests] = useState<SongRequest[]>([]);
  const [activePoll, setActivePoll] = useState<Poll | null>(null);
  const [selectedPollOption, setSelectedPollOption] = useState<number | null>(null);
  const [pollLoading, setPollLoading] = useState(false);
  const [pollTimeRemaining, setPollTimeRemaining] = useState<number | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartTimeRef = useRef<number | null>(null);
  
  // Clear activePoll when poll becomes inactive (matches frontend pattern)
  useEffect(() => {
    if (activePoll && activePoll.active === false) {
      setActivePoll(null);
      setSelectedPollOption(null);
      setPollTimeRemaining(null);
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      pollStartTimeRef.current = null;
    }
  }, [activePoll?.active]);

  // Poll timer countdown
  useEffect(() => {
    // Clear any existing timer
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    // Only start timer if poll is active and has duration
    if (!activePoll || !activePoll.active || !activePoll.durationSeconds) {
      setPollTimeRemaining(null);
      pollStartTimeRef.current = null;
      return;
    }

    // Initialize timer
    const durationMs = activePoll.durationSeconds * 1000;
    pollStartTimeRef.current = Date.now();
    setPollTimeRemaining(durationMs);

    // Update timer every second
    pollTimerRef.current = setInterval(() => {
      if (!pollStartTimeRef.current) {
        return;
      }

      const elapsed = Date.now() - pollStartTimeRef.current;
      const remaining = Math.max(0, durationMs - elapsed);

      if (remaining <= 0) {
        setPollTimeRemaining(0);
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        // Poll will be cleared by the active check effect
      } else {
        setPollTimeRemaining(remaining);
      }
    }, 1000);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [activePoll?.id, activePoll?.active, activePoll?.durationSeconds]);

  // Format poll time remaining
  const formatPollTime = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${seconds}s`;
  };
  const [activeTab, setActiveTab] = useState('chat');
  const [chatInput, setChatInput] = useState('');
  const [songTitleInput, setSongTitleInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingChat, setIsRefreshingChat] = useState(false);
  const [isRefreshingRequests, setIsRefreshingRequests] = useState(false);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>({
    isLive: false,
    listenerCount: 0,
    streamUrl: 'https://icecast.software/live.mp3',
  });
  const [isStreamReady, setIsStreamReady] = useState(false);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [recoveryNotification, setRecoveryNotification] = useState<{ message: string; timestamp: number } | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
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
  ], []);

  // Fetch user data when authenticated
  useEffect(() => {
    const fetchUserData = async () => {
      if (isAuthenticated && showProfileModal) {
        setIsLoadingUserData(true);
        try {
          const data = await getMe();
          if (!('error' in data)) {
            setUserData(data);
          }
        } catch (error) {
          console.error('Failed to fetch user data:', error);
        } finally {
          setIsLoadingUserData(false);
        }
      }
    };
    fetchUserData();
  }, [isAuthenticated, showProfileModal]);

  // Keep ref updated
  useEffect(() => {
    currentBroadcastRef.current = currentBroadcast;
  }, [currentBroadcast]);

  // Track keyboard height for proper input positioning
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

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

  // Fetch polls - matching frontend pattern
  const fetchPolls = useCallback(async () => {
    if (!currentBroadcast?.id) {
      setActivePoll(null);
      return;
    }
    try {
      setPollLoading(true);
      
      // First try to get active polls
      const activeResult = await pollService.getActivePollsForBroadcast(currentBroadcast.id);
      if (!('error' in activeResult) && activeResult.data && activeResult.data.length > 0) {
        const firstActive = activeResult.data[0];
        // Fetch results for active poll
        try {
          const resultsResponse = await pollService.getPollResults(firstActive.id);
          // Check if user has already voted
          let userVoted = false;
          let userVotedFor = null;
          if (currentUser && isAuthenticated) {
            try {
              const userVoteResponse = await pollService.getUserVote(firstActive.id);
              userVoted = !!userVoteResponse.data;
              userVotedFor = userVoteResponse.data || null;
            } catch (error) {
              // If getUserVote fails, assume user hasn't voted
              console.debug('Could not fetch user vote status:', error);
            }
          }
          setActivePoll({
            ...firstActive,
            options: resultsResponse.data?.options || firstActive.options || [],
            totalVotes: resultsResponse.data?.totalVotes || firstActive.options?.reduce((sum: number, option: any) => sum + (option.votes || option.voteCount || 0), 0) || 0,
            userVoted,
            userVotedFor
          });
          return;
        } catch (error) {
          // Fallback if results fetch fails
          // Still check user vote status
          let userVoted = false;
          let userVotedFor = null;
          if (currentUser && isAuthenticated) {
            try {
              const userVoteResponse = await pollService.getUserVote(firstActive.id);
              userVoted = !!userVoteResponse.data;
              userVotedFor = userVoteResponse.data || null;
            } catch (error) {
              console.debug('Could not fetch user vote status:', error);
            }
          }
          setActivePoll({
            ...firstActive,
            totalVotes: firstActive.options?.reduce((sum: number, option: any) => sum + (option.votes || option.voteCount || 0), 0) || 0,
            userVoted,
            userVotedFor
          });
          return;
        }
      }
      
      // Don't show ended polls - only show active polls (matches frontend behavior)
      
      setActivePoll(null);
    } catch (error) {
      console.error('Failed to fetch polls:', error);
      setActivePoll(null);
    } finally {
      setPollLoading(false);
    }
  }, [currentBroadcast?.id, currentUser, isAuthenticated]);

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
                return newMessages.sort((a, b) => {
                  const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                  const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                  return timeA - timeB;
                });
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

  // Setup WebSocket for polls
  useEffect(() => {
    if (!currentBroadcast?.id) {
      if (pollConnectionRef.current) {
        pollConnectionRef.current.disconnect();
        pollConnectionRef.current = null;
      }
      return;
    }

    let isMounted = true;

    const setupPollWebSocket = async () => {
      try {
        if (pollConnectionRef.current) {
          try {
            pollConnectionRef.current.disconnect();
          } catch (e) {
            console.warn('Error disconnecting poll:', e);
          }
          pollConnectionRef.current = null;
        }
        
        if (!isMounted) return;
        
        const connection = await pollService.subscribeToPolls(
          currentBroadcast.id,
          undefined, // authToken - using cookie-based auth
          (update: any) => {
            try {
              switch (update.type) {
                case 'NEW_POLL': {
                  const p = update.poll;
                  if (p && p.active) {
                    // Reset timer for new poll
                    pollStartTimeRef.current = Date.now();
                    
                    // Set poll immediately for real-time display (optimistic update)
                    setActivePoll({
                      ...p,
                      userVoted: false,
                      userVotedFor: null
                    });
                    
                    // Check user vote status in background (non-blocking)
                    if (currentUser && isAuthenticated) {
                      pollService.getUserVote(p.id)
                        .then(userVoteResponse => {
                          setActivePoll((prev: Poll | null) => (
                            prev && prev.id === p.id
                              ? {
                                  ...prev,
                                  userVoted: !!userVoteResponse.data,
                                  userVotedFor: userVoteResponse.data || null
                                }
                              : prev
                          ));
                        })
                        .catch(error => {
                          console.debug('Could not fetch user vote status for new poll:', error);
                          // Keep poll displayed, vote status will remain false
                        });
                    }
                  }
                  break;
                }
                case 'POLL_RESULTS': {
                  const results = update.results;
                  const pollId = update.pollId;
                  if (results && pollId) {
                    setActivePoll((prev: Poll | null) => (
                      prev && prev.id === pollId
                        ? { 
                            ...prev, 
                            options: results.options || prev.options, 
                            totalVotes: results.totalVotes ?? prev.totalVotes 
                          }
                        : prev
                    ));
                  }
                  break;
                }
                case 'POLL_UPDATED': {
                  const p = update.poll;
                  if (p) {
                    // If poll is no longer active, clear it (finished polls should not be displayed)
                    if (!p.active) {
                      setActivePoll(null);
                      setSelectedPollOption(null);
                      setPollTimeRemaining(null);
                      if (pollTimerRef.current) {
                        clearInterval(pollTimerRef.current);
                        pollTimerRef.current = null;
                      }
                      pollStartTimeRef.current = null;
                      break;
                    }
                    
                    // Reset timer if poll ID changed or duration changed
                    const prevPoll = activePoll;
                    if (!prevPoll || prevPoll.id !== p.id || prevPoll.durationSeconds !== p.durationSeconds) {
                      pollStartTimeRef.current = Date.now();
                    }
                    
                    // Set poll immediately for real-time display (optimistic update)
                    setActivePoll((prev: Poll | null) => {
                      // Preserve existing userVoted status if poll ID matches (prevents flicker)
                      const existingVoteStatus = prev && prev.id === p.id 
                        ? { userVoted: prev.userVoted, userVotedFor: prev.userVotedFor }
                        : { userVoted: false, userVotedFor: null };
                      
                      return {
                        ...p,
                        ...existingVoteStatus
                      };
                    });
                    
                    // Check user vote status in background (non-blocking) when poll is reposted
                    if (currentUser && isAuthenticated) {
                      pollService.getUserVote(p.id)
                        .then(userVoteResponse => {
                          setActivePoll((prev: Poll | null) => (
                            prev && prev.id === p.id
                              ? {
                                  ...prev,
                                  userVoted: !!userVoteResponse.data,
                                  userVotedFor: userVoteResponse.data || null
                                }
                              : prev
                          ));
                        })
                        .catch(error => {
                          console.debug('Could not fetch user vote status for updated poll:', error);
                          // Keep poll displayed, vote status will remain as-is
                        });
                    }
                  }
                  break;
                }
                case 'POLL_DELETED': {
                  const deletedPollId = update.pollId || update.id || null;
                  if (!deletedPollId || !activePoll) break;
                  if (activePoll.id === deletedPollId) {
                    setActivePoll(null);
                  }
                  break;
                }
                default:
                  // ignore
                  break;
              }
            } catch (e) {
              console.error('Error handling poll update:', e);
            }
          }
        );
        
        if (isMounted) {
          pollConnectionRef.current = connection;
        } else {
          connection.disconnect();
        }
      } catch (error) {
        console.error('❌ Failed to setup poll WebSocket:', error);
      }
    };

    setupPollWebSocket();

    return () => {
      isMounted = false;
      if (pollConnectionRef.current) {
        try {
          pollConnectionRef.current.disconnect();
        } catch (e) {
          console.warn('Error cleaning up poll connection:', e);
        }
        pollConnectionRef.current = null;
      }
    };
  }, [currentBroadcast?.id, currentUser, isAuthenticated]);

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

  // Handle poll option selection
  const handlePollOptionSelect = useCallback((optionId: number) => {
    if (!currentUser || !activePoll || activePoll.userVoted || !activePoll.active || currentBroadcast?.status !== 'LIVE') return;
    setSelectedPollOption(optionId);
  }, [currentUser, activePoll, currentBroadcast?.status]);

  // Handle poll vote submission - matching frontend pattern
  const handlePollVote = useCallback(async () => {
    if (!currentBroadcast || !isAuthenticated || !activePoll || !selectedPollOption) return;
    // Allow voting only if poll is active
    if (activePoll.userVoted || !activePoll.active || currentBroadcast.status !== 'LIVE') return;
    
    try {
      setPollLoading(true);

      // Send vote to backend
      const voteData = {
        pollId: activePoll.id,
        optionId: selectedPollOption
      };

      const result = await pollService.voteOnPoll(activePoll.id, voteData);
      
      if ('error' in result) {
        Alert.alert('Error', result.error || 'Failed to submit vote.');
        return;
      }

      // Get updated poll results
      const resultsResponse = await pollService.getPollResults(activePoll.id);
      
      if ('error' in resultsResponse) {
        Alert.alert('Error', 'Failed to fetch updated poll results.');
        return;
      }

      // Get user vote status
      const userVoteResponse = await pollService.getUserVote(activePoll.id);

      // Update current poll with results
      setActivePoll((prev: Poll | null) => {
        if (!prev || prev.id !== activePoll.id) return prev;
        return {
          ...prev,
          options: resultsResponse.data?.options || prev.options,
          totalVotes: resultsResponse.data?.totalVotes || prev.totalVotes,
          userVoted: true,
          userVotedFor: selectedPollOption
        };
      });

      // Reset selection
      setSelectedPollOption(null);
    } catch (error: any) {
      console.error("Error submitting vote:", error);
      Alert.alert('Error', error.message || 'Failed to submit vote. Please try again.');
    } finally {
      setPollLoading(false);
    }
  }, [currentBroadcast, isAuthenticated, activePoll, selectedPollOption]);

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


  const refreshBroadcastData = useCallback(async () => {
    setIsRefreshing(true);
    await fetchBroadcast();
    setIsRefreshing(false);
  }, [fetchBroadcast]);

  // Render poll section - matching frontend pattern
  const renderPoll = () => {
    if (!currentBroadcast || currentBroadcast.status !== 'LIVE') {
      return null;
    }

    if (pollLoading && !activePoll) {
      return (
        <View style={styles.pollSection}>
          <View style={styles.pollCard}>
            <ActivityIndicator size="small" color="#91403E" />
            <Text style={{ color: '#ADADB8', marginTop: 8 }}>Loading polls...</Text>
          </View>
        </View>
      );
    }

    // Don't show poll if it doesn't exist or is not active (finished polls should not be displayed)
    if (!activePoll || !activePoll.active) {
      return null;
    }

    const canVote =
      currentUser &&
      activePoll &&
      activePoll.active &&
      !activePoll.userVoted &&
      currentBroadcast.status === 'LIVE' &&
      !pollLoading;

    const showResults =
      activePoll && (!activePoll.active || (activePoll.userVoted && currentUser));

    const totalVotes = activePoll.totalVotes || activePoll.options.reduce((sum, opt) => sum + (opt.votes || opt.voteCount || 0), 0);
    const optionList = activePoll.options || [];

    return (
      <View style={styles.pollSection}>
        <View style={styles.pollCard}>
          <View style={styles.pollHeader}>
            <Text style={styles.pollQuestion}>{activePoll.question || activePoll.title}</Text>
            {pollTimeRemaining !== null && pollTimeRemaining > 0 && (
              <View style={styles.pollTimerContainer}>
                <Ionicons name="time-outline" size={14} color="#F59E0B" />
                <Text style={styles.pollTimerText}>Ends in {formatPollTime(pollTimeRemaining)}</Text>
              </View>
            )}
          </View>
          {optionList.map((option) => {
            const votes = option.votes || option.voteCount || 0;
            const percentage =
              totalVotes && showResults
                ? Math.round((votes / totalVotes) * 100) || 0
                : 0;
            const isSelected = selectedPollOption === option.id;
            const isUserChoice = activePoll.userVotedFor === option.id;
            const canInteract =
              currentUser && activePoll.active && !activePoll.userVoted && currentBroadcast.status === 'LIVE';

            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.pollOption,
                  !currentUser
                    ? styles.pollOptionDisabled
                    : showResults
                      ? isUserChoice
                        ? styles.pollOptionUserChoice
                        : styles.pollOptionDefault
                      : isSelected
                        ? styles.pollOptionSelected
                        : styles.pollOptionDefault,
                ]}
                onPress={() => canInteract && handlePollOptionSelect(option.id)}
                disabled={!canInteract}
              >
                <View style={styles.pollOptionContent}>
                  <Text style={styles.pollOptionText}>{option.optionText || option.text}</Text>
                  {showResults ? (
                    <Text style={styles.pollOptionCount}>{percentage}%</Text>
                  ) : (
                    canInteract && (
                      <View
                        style={[
                          styles.pollRadioButton,
                          isSelected && styles.pollRadioButtonSelected,
                        ]}
                      />
                    )
                  )}
                </View>
                {showResults && (
                  <View style={styles.pollBarContainer}>
                    <View
                      style={[
                        styles.pollBar,
                        { width: `${percentage}%` },
                        isUserChoice && styles.pollBarUserChoice,
                      ]}
                    />
                  </View>
                )}
                {showResults && (
                  <Text style={styles.pollVoteCount}>
                    {votes} {votes === 1 ? 'vote' : 'votes'}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}

          {currentUser && activePoll.active && !activePoll.userVoted && (
            <TouchableOpacity
              style={[styles.pollVoteButton, (!canVote || !selectedPollOption || pollLoading) && styles.pollVoteButtonDisabled]}
              onPress={handlePollVote}
              disabled={!canVote || !selectedPollOption || pollLoading}
            >
              {pollLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.pollVoteButtonText}>Vote now</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

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
                {isBroadcastLive 
                  ? `LIVE (${listenerDisplay.toLocaleString()} listener${listenerDisplay !== 1 ? 's' : ''})`
                  : 'STANDBY'}
              </Text>
            </View>
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
        // Show message when broadcast is not live, similar to frontend
        if (!currentBroadcast || currentBroadcast.status !== 'LIVE') {
          return (
            <View style={{ flex: 1, backgroundColor: '#0E0E10', justifyContent: 'center', alignItems: 'center' }}>
              <View style={{ alignItems: 'center', paddingHorizontal: 32 }}>
                <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: '#91403E', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Ionicons name="chatbubbles-outline" size={32} color="#FFFFFF" />
                </View>
                <Text style={{ fontSize: 14, color: '#ADADB8', textAlign: 'center', fontWeight: '500' }}>
                  Live chat is only available during broadcasts
                </Text>
              </View>
            </View>
          );
        }

        return (
          <View style={{ flex: 1, backgroundColor: '#0E0E10' }}>
            <ScrollView
              ref={chatScrollViewRef}
              style={{ flex: 1, backgroundColor: '#0E0E10' }}
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: chatMessages.length === 0 ? 'center' : 'flex-start',
                paddingTop: 12,
                paddingBottom: keyboardHeight > 0 ? keyboardHeight + 60 : 80,
                paddingHorizontal: 0,
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
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
                          {message.createdAt 
                            ? format(parseISO(message.createdAt), 'HH:mm')
                            : format(new Date(), 'HH:mm')}
                        </Text>
                      </View>
                      <Text style={styles.chatMessageContent}>{message.content}</Text>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View
              style={[
                styles.keyboardAvoidingWrapper,
                { paddingBottom: keyboardHeight > 0 ? keyboardHeight - insets.bottom : 0 }
              ]}
            >
              {isAuthenticated ? (
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
              ) : (
                <View style={styles.chatLoginPrompt}>
                  <Text style={styles.chatLoginText}>Sign in to join the chat</Text>
                </View>
              )}
            </View>
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

      {/* Avatar/Login Buttons - Top right corner */}
      <View style={[styles.headerRightContainer, { top: insets.top + (Platform.OS === 'ios' ? 8 : 12) }]}>
        {isAuthenticated && currentUser ? (
          <TouchableOpacity
            style={styles.avatarButton}
            activeOpacity={0.8}
            onPress={() => setShowProfileModal(true)}
          >
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>{getInitials(currentUser)}</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerAuthButtons}>
            <TouchableOpacity
              style={styles.headerLoginButton}
              onPress={() => router.push('/auth/login' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.headerLoginButtonText}>Log in</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerSignupButton}
              onPress={() => router.push('/auth/signup' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.headerSignupButtonText}>Sign up</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Recovery Notification */}
      {recoveryNotification && (
        <View style={styles.recoveryNotification}>
          <Ionicons name="information-circle" size={20} color="#2563EB" style={{ marginRight: 8 }} />
          <Text style={styles.recoveryText}>{recoveryNotification.message}</Text>
        </View>
      )}

      {/* Always show tabs, even when no broadcast */}
      <View style={{ flex: 1, backgroundColor: '#0E0E10', paddingTop: insets.top + 60 }}>
        {renderListenHero()}
        {renderPoll()}
        <View style={[styles.tabContainer, { flexShrink: 1 }]}>
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

          {renderTabContent()}
        </View>
      </View>

      {/* Profile Modal - Personal Information */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Background gradients */}
          <View style={styles.modalBackgroundBase} />
          <LinearGradient
            colors={['rgba(15,23,42,0.95)', 'rgba(2,6,23,0.95)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.modalGradientOverlay1}
          />
          <LinearGradient
            colors={['rgba(127,29,29,0.35)', 'transparent']}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={styles.modalGradientMaroon1}
          />
          <LinearGradient
            colors={['rgba(251,191,36,0.18)', 'transparent']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.modalGradientYellow1}
          />
          <LinearGradient
            colors={['rgba(251,191,36,0.50)', 'rgba(127,29,29,0.45)', 'transparent']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.modalGradientBlur1}
          />
          <LinearGradient
            colors={['rgba(127,29,29,0.60)', 'rgba(225,29,72,0.45)', 'transparent']}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={styles.modalGradientBlur2}
          />

          <TouchableOpacity 
            onPress={() => setShowProfileModal(false)}
            style={styles.modalCloseButton}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color="#94a3b8" />
          </TouchableOpacity>

          <ScrollView 
            style={styles.modalScrollView} 
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalSectionTitle}>Personal Information</Text>
              <Text style={styles.modalContentSubtitle}>Your account details</Text>
              
              {isLoadingUserData ? (
                <View style={styles.modalLoadingContainer}>
                  <ActivityIndicator size="large" color="#91403E" />
                </View>
              ) : userData ? (
                <View style={styles.infoSection}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>FULL NAME</Text>
                    <Text style={styles.infoValue}>
                      {`${userData.firstname || ''} ${userData.lastname || ''}`.trim() || 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>EMAIL</Text>
                    <Text style={styles.infoValue}>{userData.email || 'N/A'}</Text>
                  </View>
                  {userData.gender && (
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>GENDER</Text>
                      <Text style={styles.infoValue}>
                        {userData.gender === 'MALE' ? 'Male' : 
                         userData.gender === 'FEMALE' ? 'Female' : 
                         userData.gender === 'OTHER' ? 'Other' : 
                         userData.gender}
                      </Text>
                    </View>
                  )}
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>ROLE</Text>
                    <Text style={styles.infoValue}>{userData.role || 'N/A'}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.modalErrorContainer}>
                  <Text style={styles.modalErrorText}>Unable to load personal information</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  headerRightContainer: {
    position: 'absolute',
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarButton: {
    padding: 4,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFC30B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#B5830F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  headerAuthButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerLoginButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(145, 64, 62, 0.5)',
  },
  headerLoginButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#91403E',
  },
  headerSignupButton: {
    backgroundColor: '#91403E',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    shadowColor: '#91403E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  headerSignupButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
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
    marginBottom: 8,
    marginTop: 4,
  },
  listenHeroCard: {
    borderRadius: 24,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
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
    letterSpacing: 0.5,
    fontSize: 10,
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
    flex: 0.7,
    minHeight: 200,
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
  keyboardAvoidingWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0E0E10',
    borderTopWidth: 1,
    borderTopColor: '#26262C',
  },
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
    paddingTop: 6,
    paddingBottom: 0,
    backgroundColor: '#0E0E10',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#0E0E10',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#26262C',
    minHeight: 36,
    maxHeight: 36,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  pollSection: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  pollCard: {
    backgroundColor: '#1F1F23',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#26262C',
  },
  pollHeader: {
    marginBottom: 16,
  },
  pollQuestion: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  pollTimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  pollTimerText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
    marginLeft: 4,
  },
  pollOption: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#26262C',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#26262C',
  },
  pollOptionDefault: {
    borderColor: '#26262C',
    backgroundColor: '#26262C',
  },
  pollOptionSelected: {
    borderColor: '#91403E',
    backgroundColor: '#2A1F1F',
  },
  pollOptionDisabled: {
    borderColor: '#26262C',
    backgroundColor: '#1F1F23',
    opacity: 0.75,
  },
  pollOptionUserChoice: {
    borderColor: '#10B981',
    backgroundColor: '#064E3B',
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
  pollBarUserChoice: {
    backgroundColor: '#10B981',
  },
  pollRadioButton: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ADADB8',
  },
  pollRadioButtonSelected: {
    backgroundColor: '#91403E',
    borderColor: '#91403E',
  },
  pollVoteCount: {
    fontSize: 11,
    color: '#ADADB8',
    marginTop: 4,
  },
  pollVoteButton: {
    marginTop: 16,
    backgroundColor: '#91403E',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pollVoteButtonDisabled: {
    opacity: 0.5,
  },
  pollVoteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
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
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#020617',
  },
  modalBackgroundBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#020617',
  },
  modalGradientOverlay1: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.7,
  },
  modalGradientMaroon1: {
    position: 'absolute',
    bottom: -Dimensions.get('window').height * 0.3,
    left: -Dimensions.get('window').width * 0.2,
    width: Dimensions.get('window').width * 0.8,
    height: Dimensions.get('window').height * 0.8,
    opacity: 0.7,
  },
  modalGradientYellow1: {
    position: 'absolute',
    top: -Dimensions.get('window').height * 0.2,
    right: -Dimensions.get('window').width * 0.15,
    width: Dimensions.get('window').width * 0.7,
    height: Dimensions.get('window').height * 0.7,
    opacity: 0.7,
  },
  modalGradientBlur1: {
    position: 'absolute',
    top: -Dimensions.get('window').height * 0.3,
    right: -Dimensions.get('window').width * 0.15,
    width: Dimensions.get('window').width * 1.2,
    height: Dimensions.get('window').height * 0.8,
    opacity: 0.8,
  },
  modalGradientBlur2: {
    position: 'absolute',
    bottom: -Dimensions.get('window').height * 0.4,
    left: -Dimensions.get('window').width * 0.2,
    width: Dimensions.get('window').width * 1.2,
    height: Dimensions.get('window').height * 1.0,
    opacity: 0.7,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    paddingBottom: 40,
    paddingTop: 16,
  },
  modalContent: {
    padding: 24,
  },
  modalSectionTitle: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#e2e8f0',
    textAlign: 'left',
    marginBottom: 8,
  },
  modalContentSubtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'left',
    marginBottom: 32,
  },
  modalLoadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalErrorContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  modalErrorText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  infoSection: {
    gap: 16,
  },
  infoItem: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    color: '#e2e8f0',
  },
});

export default BroadcastScreen;
