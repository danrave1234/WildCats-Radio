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
} from '../../services/apiService';
import { chatService } from '../../services/chatService';
import { pollService } from '../../services/pollService';
import { songRequestService } from '../../services/songRequestService';
import { broadcastService } from '../../services/broadcastService';
import streamService from '../../services/streamService';
import audioStreamingService from '../../services/audioStreamingService';
import { useAudioStreaming } from '../../hooks/useAudioStreaming';
import { runStreamDiagnostics, quickStreamTest } from '../../services/streamDebugUtils';
import { websocketService } from '../../services/websocketService';
import '../../global.css';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import HeroPlayButton from '../../components/HeroPlayButton';
import NowPlayingCard from '../../components/NowPlayingCard';
import LoginPrompt from '../../components/LoginPrompt';

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

  // Memoized border radius calculation
  const borderRadius = useMemo(() => {
    const baseRadius = 18;
    const smallRadius = 4;
    
    if (isOwnMessage) {
      // Own messages on the right
      if (isFirstInGroup && isLastInGroup) {
        // Single message
        return {
          borderTopLeftRadius: baseRadius,
          borderTopRightRadius: baseRadius,
          borderBottomLeftRadius: baseRadius,
          borderBottomRightRadius: baseRadius,
        };
      } else if (isFirstInGroup) {
        // First in group
        return {
          borderTopLeftRadius: baseRadius,
          borderTopRightRadius: baseRadius,
          borderBottomLeftRadius: baseRadius,
          borderBottomRightRadius: smallRadius,
        };
      } else if (isLastInGroup) {
        // Last in group
        return {
          borderTopLeftRadius: baseRadius,
          borderTopRightRadius: smallRadius,
          borderBottomLeftRadius: baseRadius,
          borderBottomRightRadius: baseRadius,
        };
      } else {
        // Middle of group
        return {
          borderTopLeftRadius: baseRadius,
          borderTopRightRadius: smallRadius,
          borderBottomLeftRadius: baseRadius,
          borderBottomRightRadius: smallRadius,
        };
      }
    } else {
      // Other users' messages on the left
      if (isFirstInGroup && isLastInGroup) {
        // Single message
        return {
          borderTopLeftRadius: baseRadius,
          borderTopRightRadius: baseRadius,
          borderBottomLeftRadius: baseRadius,
          borderBottomRightRadius: baseRadius,
        };
      } else if (isFirstInGroup) {
        // First in group
        return {
          borderTopLeftRadius: baseRadius,
          borderTopRightRadius: baseRadius,
          borderBottomLeftRadius: smallRadius,
          borderBottomRightRadius: baseRadius,
        };
      } else if (isLastInGroup) {
        // Last in group
        return {
          borderTopLeftRadius: smallRadius,
          borderTopRightRadius: baseRadius,
          borderBottomLeftRadius: baseRadius,
          borderBottomRightRadius: baseRadius,
        };
      } else {
        // Middle of group
        return {
          borderTopLeftRadius: smallRadius,
          borderTopRightRadius: baseRadius,
          borderBottomLeftRadius: smallRadius,
          borderBottomRightRadius: baseRadius,
        };
      }
    }
  }, [isOwnMessage, isFirstInGroup, isLastInGroup]);

  // Get the appropriate border radius for message grouping
  const getBorderRadius = () => borderRadius;

  return (
    <Animated.View 
      style={{
        transform: [
          { translateY: slideAnim },
          { scale: scaleAnim }
        ],
        opacity: opacityAnim,
      }}
      className={`${isFirstInGroup ? 'mt-3' : 'mt-1'} ${isOwnMessage ? 'items-end pr-4' : 'flex-row items-end pl-4'}`}
    >
      {/* Avatar for other users only */}
      {!isOwnMessage && (
        <Animated.View 
          className="mr-3 mb-1"
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
                {(() => {
                  const senderName = message.sender?.name || 'U';
                  // Check if sender is a DJ
                  if (senderName.toLowerCase().includes('dj')) {
                    return 'DJ';
                  }
                  // Regular initials for other users
                  return senderName.charAt(0).toUpperCase();
                })()}
              </Text>
            </View>
          ) : (
            <View className="w-8 h-8" />
          )}
        </Animated.View>
      )}

      {/* Message Bubble Container */}
      <View className={`${isOwnMessage ? 'max-w-[75%]' : 'max-w-[70%]'}`} style={{ alignSelf: isOwnMessage ? 'flex-end' : 'flex-start' }}>
        {/* Sender name for other users - only show on first message in group */}
        {!isOwnMessage && isFirstInGroup && (
          <Animated.Text 
            className="text-xs font-semibold text-gray-600 mb-1 ml-3"
            style={{
              opacity: opacityAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            {message.sender?.name || 'User'}
          </Animated.Text>
        )}
        
        <Animated.View 
          style={[
            {
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: isOwnMessage ? '#91403E' : '#F5F5F5',
              ...getBorderRadius(),
              transform: [{ scale: scaleAnim }],
              alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: isOwnMessage ? 0.2 : 0.1,
              shadowRadius: 2,
              elevation: 2,
            }
          ]}
        >
          <Text 
            style={{
              fontSize: 16,
              lineHeight: 20,
              color: isOwnMessage ? '#FFFFFF' : '#000000',
              fontWeight: '400',
            }}
          >
            {message.content || ''}
          </Text>
        </Animated.View>
        
        {/* Timestamp - only show on last message in group */}
        {isLastInGroup && (
          <Animated.Text 
            className={`text-xs text-gray-400 mt-1 ${
              isOwnMessage ? 'mr-2 text-right' : 'ml-2'
            }`}
            style={{
              opacity: opacityAnim,
              alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
            }}
          >
            {(() => {
              try {
                if (!message.createdAt || typeof message.createdAt !== 'string') {
                  return 'Just now';
                }
                
                // Parse the message date more reliably
                let messageDate;
                try {
                  // Try parsing as-is first
                  messageDate = new Date(message.createdAt);
                  
                  // If invalid, try adding Z for UTC
                  if (isNaN(messageDate.getTime())) {
                    messageDate = message.createdAt.endsWith('Z') 
                      ? new Date(message.createdAt) 
                      : new Date(message.createdAt + 'Z');
                  }
                } catch {
                  return 'Just now';
                }
                
                // Check if date is valid
                if (!messageDate || isNaN(messageDate.getTime())) {
                  return 'Just now';
                }
                
                // Use currentTime for live updates
                const now = currentTime;
                const diffInSeconds = Math.floor((now.getTime() - messageDate.getTime()) / 1000);
                const diffInMinutes = Math.floor(diffInSeconds / 60);
                const diffInHours = Math.floor(diffInMinutes / 60);
                const diffInDays = Math.floor(diffInHours / 24);
                
                // Messenger-style timestamp logic
                if (diffInSeconds < 60) {
                  return 'Just now';
                } else if (diffInMinutes < 60) {
                  return `${diffInMinutes}m ago`;
                } else if (diffInHours < 24) {
                  return `${diffInHours}h ago`;
                } else if (diffInDays === 1) {
                  return 'Yesterday';
                } else if (diffInDays < 7) {
                  return `${diffInDays}d ago`;
                } else {
                  // For older messages, show the date
                  return messageDate.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  });
                }
              } catch (error) {
                console.warn('Error parsing message timestamp:', error, message.createdAt);
                return 'Just now';
              }
            })()}
          </Animated.Text>
        )}
      </View>
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  // Only re-render if essential props change
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.isOwnMessage === nextProps.isOwnMessage &&
    prevProps.showAvatar === nextProps.showAvatar &&
    prevProps.isLastInGroup === nextProps.isLastInGroup &&
    prevProps.isFirstInGroup === nextProps.isFirstInGroup &&
    prevProps.listenerName === nextProps.listenerName
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

// Animated Audio Wave Component - Fixed to prevent white screen issues
const AnimatedAudioWave: React.FC<{ isPlaying: boolean; size?: number }> = ({ isPlaying, size = 40 }) => {
  const waveAnimations = useRef([
    new Animated.Value(0.3),
    new Animated.Value(0.5),
    new Animated.Value(0.8),
    new Animated.Value(0.4),
    new Animated.Value(0.6),
  ]).current;

  useEffect(() => {
    if (isPlaying) {
      const animations = waveAnimations.map((anim, index) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: Math.random() * 0.8 + 0.2,
              duration: 300 + Math.random() * 200,
              useNativeDriver: true, // Fixed: Use native driver for better performance
            }),
            Animated.timing(anim, {
              toValue: Math.random() * 0.8 + 0.2,
              duration: 300 + Math.random() * 200,
              useNativeDriver: true, // Fixed: Use native driver for better performance
            }),
          ])
        )
      );

      animations.forEach((animation, index) => {
        setTimeout(() => animation.start(), index * 100);
      });

      return () => {
        animations.forEach(animation => animation.stop());
      };
    } else {
      // Reset to static state when not playing
      waveAnimations.forEach(anim => {
        Animated.timing(anim, {
          toValue: 0.3,
          duration: 200,
          useNativeDriver: true, // Fixed: Use native driver for better performance
        }).start();
      });
    }
  }, [isPlaying, waveAnimations]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: size, justifyContent: 'center' }}>
      {waveAnimations.map((anim, index) => (
        <Animated.View
          key={index}
          style={{
            width: 3,
            backgroundColor: '#91403E',
            marginHorizontal: 1,
            borderRadius: 1.5,
            height: size, // Fixed height
            transform: [
              {
                scaleY: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.2, 1], // Scale from 20% to 100%
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
};

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
  const [isListening, setIsListening] = useState(false);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

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

  // Listener WebSocket ref
  const listenerWsRef = useRef<WebSocket | null>(null);
  const heartbeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stream loading state
  const [isStreamReady, setIsStreamReady] = useState(false);

  const [chatInput, setChatInput] = useState('');
  const [songTitleInput, setSongTitleInput] = useState('');
  const [artistInput, setArtistInput] = useState('');

  const chatScrollViewRef = useRef<ScrollView>(null);

  const [tabLayouts, setTabLayouts] = useState<Record<string, { x: number; width: number } | undefined>>({});
  const underlinePosition = useRef(new Animated.Value(0)).current;
  const underlineWidth = useRef(new Animated.Value(0)).current;
  const [isInitialLayoutDone, setIsInitialLayoutDone] = useState(false);

  // Keyboard animation states
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const tabContentTranslateY = useRef(new Animated.Value(0)).current;

  // Poster to tune-in transition animation states
  const tuneInTranslateX = useRef(new Animated.Value(Dimensions.get('window').width)).current;
  
  // Real-time update refs
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  
  // Chat WebSocket connection ref
  const chatConnectionRef = useRef<any>(null);
  
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
        console.log('🎵 Stream already ready and playing, skipping initialization');
        return;
      }

      // Don't reinitialize if already loading to prevent conflicts
      if (streamingState.isLoading) {
        console.log('🎵 Stream already loading, skipping duplicate initialization');
        return;
      }

      try {
        console.log('🎵 Initializing MP3 audio stream for broadcast:', currentBroadcast.id);
        
        // Get stream configuration (always MP3 for mobile)
        const config = await streamService.getStreamConfig();
        console.log('🎵 Stream config received:', config);
        
        // Use MP3 stream exclusively for mobile
        const mp3StreamUrl = 'https://icecast.software/live.mp3';
        console.log('🎵 Using MP3 stream exclusively for mobile:', mp3StreamUrl);
        
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
        console.log('🎵 Loading MP3 stream from:', mp3StreamUrl);
        await streamingActions.loadStream(mp3StreamUrl);
        
        // Stream is ready immediately after loading
        setIsStreamReady(true);
        console.log('✅ MP3 stream loaded and ready for playback');
        
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
          console.log('📡 Stream initialization failed - this is normal if broadcast hasn\'t started streaming yet');
        }
      }
    };

    // Only initialize once per broadcast
    initializeStream();
  }, [currentBroadcast?.id, currentBroadcast?.status]); // Removed isStreamReady and streamingState.isPlaying dependencies to prevent loops

  // Periodic check for MP3 stream availability when broadcast is live but stream not ready
  useEffect(() => {
    if (!currentBroadcast || currentBroadcast.status !== 'LIVE' || isStreamReady) {
      return; // Don't check if no broadcast, not live, or stream already ready
    }

    console.log('📡 Setting up periodic MP3 stream availability check...');
    
    const checkInterval = setInterval(async () => {
      try {
        console.log('🔍 Checking if MP3 stream is now available...');
        
        // Simplified check - just try to load the stream directly
        // This is less aggressive than the previous approach
        const mp3StreamUrl = 'https://icecast.software/live.mp3';
        
        try {
          await streamingActions.loadStream(mp3StreamUrl);
          
          console.log('✅ MP3 stream is now available! Loaded successfully.');
          clearInterval(checkInterval);
          
          // Update stream status
          setStreamStatus(prev => ({
            ...prev,
            streamUrl: mp3StreamUrl,
          }));
          
          // Mark as ready
          setTimeout(() => {
            setIsStreamReady(true);
            console.log('✅ MP3 stream automatically loaded and ready');
          }, 1000);
        } catch (error) {
          console.log('📡 MP3 stream still not available, will check again...');
        }
      } catch (error) {
        console.error('❌ Error checking MP3 stream availability:', error);
      }
    }, 30000); // Check every 30 seconds instead of 10 to be less aggressive

    // Cleanup interval on unmount or when dependencies change
    return () => {
      console.log('🧹 Cleaning up MP3 stream availability check');
      clearInterval(checkInterval);
    };
  }, [currentBroadcast?.id, currentBroadcast?.status, isStreamReady, streamingActions]);

  // Setup listener WebSocket for real-time listener count updates
  useEffect(() => {
    if (!currentBroadcast || currentBroadcast.status !== 'LIVE') {
      // Clean up WebSocket if broadcast is not live
      if (listenerWsRef.current) {
        listenerWsRef.current.close(1000, 'Broadcast ended');
        listenerWsRef.current = null;
      }
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
      return;
    }

    // Skip if already connected
    if (listenerWsRef.current && listenerWsRef.current.readyState === WebSocket.OPEN) {
      console.log('📡 Listener WebSocket already connected');
      return;
    }

    const connectListenerWebSocket = async () => {
      try {
        // Get WebSocket URLs
        const wsUrls = await streamService.getWebSocketUrls();
        const listenerWsUrl = wsUrls.listenerUrl.replace('http://', 'ws://').replace('https://', 'wss://');

        console.log('🔄 Connecting to listener WebSocket:', listenerWsUrl);

        // Create WebSocket connection
        // Type assertion needed for React Native WebSocket compatibility
        const ws = new WebSocket(listenerWsUrl) as any;
        listenerWsRef.current = ws;

        // Connection timeout
        const connectionTimeout = setTimeout(() => {
          if (ws.readyState === WebSocket.CONNECTING) {
            console.warn('⚠️ Listener WebSocket connection timeout');
            ws.close();
          }
        }, 10000); // 10 second timeout

        ws.onopen = () => {
          console.log('✅ Listener WebSocket connected');
          clearTimeout(connectionTimeout);
          
          // Send initial status if playing
          if (streamingState.isPlaying) {
            const message = {
              type: 'LISTENER_STATUS',
              action: 'START_LISTENING',
              broadcastId: currentBroadcast.id,
              userId: currentUserId,
              userName: userData?.name || 'Anonymous Listener',
              timestamp: Date.now(),
            };
            ws.send(JSON.stringify(message));
          }

          // Setup heartbeat with ping/pong
          heartbeatInterval.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              try {
                // Send ping message
                ws.send('ping');
              } catch (error) {
                console.error('❌ Failed to send heartbeat:', error);
              }
            }
          }, 30000) as ReturnType<typeof setInterval>; // 30 seconds to match backend
        };

        ws.onmessage = (event: any) => {
          try {
            // Handle pong response
            if (event.data === 'pong') {
              return;
            }

            const data = JSON.parse(event.data);
            if (data.type === 'STREAM_STATUS' && data.listenerCount !== undefined) {
              setStreamStatus(prev => ({
                ...prev,
                listenerCount: data.listenerCount,
              }));
            }
          } catch (error) {
            console.error('Error parsing listener WebSocket message:', error);
          }
        };

        ws.onerror = (error: any) => {
          console.error('❌ Listener WebSocket error:', error);
          clearTimeout(connectionTimeout);
        };

        ws.onclose = (event: any) => {
          console.log('🔌 Listener WebSocket disconnected:', event.code, event.reason);
          clearTimeout(connectionTimeout);
          
          if (heartbeatInterval.current) {
            clearInterval(heartbeatInterval.current);
            heartbeatInterval.current = null;
          }

          // Only reconnect if it's an unexpected close and broadcast is still live
          if (event.code !== 1000 && event.code !== 1001 && 
              !isReconnecting && 
              currentBroadcast && currentBroadcast.status === 'LIVE') {
            console.log('🔄 Listener WebSocket closed unexpectedly, reconnecting...');
            setIsReconnecting(true);
            setTimeout(() => {
              connectListenerWebSocket();
              setIsReconnecting(false);
            }, 3000);
          }
        };
      } catch (error) {
        console.error('❌ Failed to connect listener WebSocket:', error);
        
        // Retry connection after delay
        if (!isReconnecting && currentBroadcast && currentBroadcast.status === 'LIVE') {
          setIsReconnecting(true);
          setTimeout(() => {
            console.log('🔄 Retrying listener WebSocket connection...');
            connectListenerWebSocket();
            setIsReconnecting(false);
          }, 5000);
        }
      }
    };

    connectListenerWebSocket();

    return () => {
      if (listenerWsRef.current) {
        listenerWsRef.current.close();
        listenerWsRef.current = null;
      }
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
    };
  }, [currentBroadcast?.id, currentBroadcast?.status, streamingState.isPlaying, currentUserId, userData]);

  // Send listener status updates when play state changes
  useEffect(() => {
    if (listenerWsRef.current && listenerWsRef.current.readyState === WebSocket.OPEN) {
      const message = {
        type: 'LISTENER_STATUS',
        action: streamingState.isPlaying ? 'START_LISTENING' : 'STOP_LISTENING',
        broadcastId: currentBroadcast?.id,
        userId: currentUserId,
        userName: userData?.name || 'Anonymous Listener',
        timestamp: Date.now(),
      };
      listenerWsRef.current.send(JSON.stringify(message));
    }
  }, [streamingState.isPlaying, currentBroadcast?.id, currentUserId, userData]);

  // Custom play function with better error handling and immediate loading feedback
  const handlePlayPause = useCallback(async () => {
    console.log('🎵 Play/Pause requested. Current audio state:', streamingState.isPlaying, 'Loading:', streamingState.isLoading);
    
    if (!currentBroadcast || currentBroadcast.status !== 'LIVE') {
      Alert.alert('Stream Unavailable', 'The broadcast is not currently live. Please check back later.');
      return;
    }

    // Prevent rapid clicking
    if (streamingState.isLoading) {
      console.log('🎵 Already loading, ignoring click');
      return;
    }

    try {
      // If stream is ready or already playing, just toggle
      if (isStreamReady || streamingState.isPlaying) {
        console.log('🎵 Stream ready or playing, toggling...');
        await streamingActions.togglePlayPause();
        return;
      }
        
      // If stream not ready and not playing, try to load first
      console.log('🎵 Stream not ready, attempting to load...');
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

  // DEBUG: Add temporary test function
  const testStreamsManually = useCallback(async () => {
    console.log('🔍 Manual MP3 stream test requested...');
    await runStreamDiagnostics();
    
    // Test MP3 stream availability
    const mp3Available = await streamService.isMp3StreamAvailable();
    console.log('📊 MP3 stream availability:', mp3Available);
    
    if (mp3Available) {
      Alert.alert(
        '✅ MP3 Stream Available', 
        'The MP3 stream is working! Would you like to load it now?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Load Stream', 
            onPress: async () => {
              try {
                console.log('🎵 Loading MP3 stream manually...');
                setIsStreamReady(false);
                await streamingActions.loadStream('https://icecast.software/live.mp3');
                setTimeout(() => {
                  setIsStreamReady(true);
                  console.log('✅ MP3 stream loaded manually');
                  Alert.alert('Success', 'MP3 stream loaded and ready to play!');
                }, 1000);
              } catch (error) {
                console.error('❌ Failed to load MP3 stream manually:', error);
                Alert.alert('Error', 'Failed to load MP3 stream. Please try again.');
              }
            }
          }
        ]
      );
    } else {
      Alert.alert('❌ MP3 Stream Not Found', 'MP3 stream is not currently available. Please start a broadcast from the web frontend first.');
    }
  }, [streamingActions]);

  // Fetch user data when auth token is available
  useEffect(() => {
    const fetchUserData = async () => {
      if (!authToken) {
        setUserData(null);
        setCurrentUserId(null);
        return;
      }

      try {
        console.log('🔍 Fetching current user data for chat ownership...');
        const result = await getMe();
        if ('error' in result) {
          console.error('❌ Failed to fetch user data:', result.error);
          setUserData(null);
          setCurrentUserId(null);
        } else {
          console.log('✅ User data fetched successfully:', { id: result.id });
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

  // Setup chat WebSocket subscription like frontend
  useEffect(() => {
    if (!currentBroadcast?.id || !authToken) {
      // Clean up chat connection if no broadcast or auth
      if (chatConnectionRef.current) {
        console.log('🧹 Cleaning up chat WebSocket connection');
        chatConnectionRef.current.disconnect();
        chatConnectionRef.current = null;
        setIsWebSocketConnected(false);
      }
      return;
    }

    const setupChatWebSocket = async () => {
      try {
        // Clean up existing connection
        if (chatConnectionRef.current) {
          chatConnectionRef.current.disconnect();
          chatConnectionRef.current = null;
        }
        
        // Set up new connection like frontend
        const connection = await chatService.subscribeToChatMessages(
          currentBroadcast.id,
          authToken,
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
                return newMessages.sort((a, b) => 
                  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );
              });
            }
          },
          {
            onConnectionChange: (connected: boolean) => {
              // Update WebSocket connection status
              console.log('🔌 Chat WebSocket connection status changed:', connected);
              setIsWebSocketConnected(connected);
            },
            onError: (error: any) => {
              console.error('❌ Chat WebSocket error:', error);
              setIsWebSocketConnected(false);
            }
          }
        );
        
        chatConnectionRef.current = connection;
        // Don't set connected to true here - wait for actual connection
        
      } catch (error) {
        console.error('❌ Failed to setup chat WebSocket:', error);
        setIsWebSocketConnected(false);
      }
    };

    setupChatWebSocket();

    return () => {
      if (chatConnectionRef.current) {
        console.log('🧹 Cleaning up chat WebSocket on unmount');
        chatConnectionRef.current.disconnect();
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
        console.log('🧹 Cleaning up poll WebSocket connection');
        pollConnectionRef.current.disconnect();
        pollConnectionRef.current = null;
      }
      return;
    }

    const setupPollWebSocket = async () => {
      try {
        console.log('🔄 Setting up poll WebSocket for broadcast:', currentBroadcast.id);
        
        // Clean up existing connection
        if (pollConnectionRef.current) {
          pollConnectionRef.current.disconnect();
          pollConnectionRef.current = null;
        }
        
        // Set up new connection like frontend
        const connection = await pollService.subscribeToPolls(
          currentBroadcast.id,
          authToken,
          (pollUpdate: any) => {
            console.log('📊 Received poll update:', pollUpdate);
            
            switch (pollUpdate.type) {
              case 'POLL_VOTE':
                console.log('📊 Processing poll vote update for poll:', pollUpdate.pollId);
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
                 console.log('📊 Processing new poll:', pollUpdate.poll);
                 // Only add poll if it's active (listener behavior)
                 if (pollUpdate.poll && pollUpdate.poll.isActive) {
                   setActivePolls(prev => {
                     const exists = prev.some(poll => poll.id === pollUpdate.poll.id);
                     if (exists) return prev;
                     return [pollUpdate.poll, ...prev];
                   });
                 }
                 break;
                
                             case 'POLL_UPDATED':
                 console.log('📊 Processing poll update:', pollUpdate.poll);
                 if (pollUpdate.poll) {
                   if (pollUpdate.poll.isActive) {
                     // Poll became active, add it to the list
                     setActivePolls(prev => {
                       const exists = prev.some(poll => poll.id === pollUpdate.poll.id);
                       if (exists) {
                         // Update existing poll
                         return prev.map(poll => 
                           poll.id === pollUpdate.poll.id 
                             ? { ...poll, ...pollUpdate.poll }
                             : poll
                         );
                       } else {
                         // Add new active poll
                         return [pollUpdate.poll, ...prev];
                       }
                     });
                   } else {
                     // Poll became inactive, remove it from the list
                     setActivePolls(prev => prev.filter(poll => poll.id !== pollUpdate.poll.id));
                   }
                 }
                 break;
                
              case 'POLL_RESULTS':
                console.log('📊 Processing poll results update:', pollUpdate.results);
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
                
              default:
                console.log('📊 Unknown poll update type:', pollUpdate.type);
            }
          }
        );
        
        pollConnectionRef.current = connection;
        console.log('✅ Poll WebSocket connected successfully');
        
      } catch (error) {
        console.error('❌ Failed to setup poll WebSocket:', error);
      }
    };

    setupPollWebSocket();

    return () => {
      if (pollConnectionRef.current) {
        console.log('🧹 Cleaning up poll WebSocket on unmount');
        pollConnectionRef.current.disconnect();
        pollConnectionRef.current = null;
      }
    };
  }, [currentBroadcast?.id, authToken]);

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

  // Animation function for poster to tune-in transition
  const animateToTuneIn = useCallback(() => {
    // Set listening state first so the interface renders
    setIsListening(true);
    // Notify parent about listening state change
    setIsBroadcastListening(true);
    
    // Wait for next frame to ensure component is rendered before animation starts
    requestAnimationFrame(() => {
      // Start animation for tune-in interface (tab bar handled by CustomTabBar)
      Animated.spring(tuneInTranslateX, {
        toValue: 0,
        tension: 65, // Lower tension for slower, smoother movement
        friction: 10, // Balanced friction for natural movement
        useNativeDriver: true,
      }).start();
    });
  }, [tuneInTranslateX, setIsBroadcastListening]);

  // Animation function for going back to poster
  const animateBackToPoster = useCallback(() => {
    // Notify parent about listening state change
    setIsBroadcastListening(false);
    
    // Start animation for tune-in interface (tab bar handled by CustomTabBar)
    Animated.spring(tuneInTranslateX, {
      toValue: Dimensions.get('window').width,
      tension: 65, // Lower tension for slower, smoother movement
      friction: 10, // Balanced friction for natural movement
      useNativeDriver: true,
    }).start(() => {
      // Animation completed, update listening state
      setIsListening(false);
    });
  }, [tuneInTranslateX, setIsBroadcastListening]);

  // Handle broadcast end detection and smooth transition
  useEffect(() => {
    // Check if broadcast ended while user is listening
    if (isListening && currentBroadcast && currentBroadcast.status !== 'LIVE') {
      console.log('📻 Broadcast ended while listening, transitioning back to poster');
      
      // Stop audio playback
      streamingActions.stop().catch(error => {
        console.error('Failed to stop audio on broadcast end:', error);
      });
      
      // Animate back to poster with a slight delay for smooth transition
      setTimeout(() => {
        animateBackToPoster();
      }, 500);
    }
  }, [isListening, currentBroadcast?.status, streamingActions, animateBackToPoster]);

  // Notification state change handler for the broadcast screen's CustomHeader
  const handleNotificationStateChange = useCallback((isOpen: boolean) => {
    setIsBroadcastListening(isOpen);
  }, [setIsBroadcastListening]);

  // Reset animations when going back to poster (without animation)
  useEffect(() => {
    if (!isListening) {
      // Reset animation values immediately when going back to poster
      // Use requestAnimationFrame to ensure this happens after render cycle
      requestAnimationFrame(() => {
        tuneInTranslateX.setValue(Dimensions.get('window').width);
      });
    }
  }, [isListening, tuneInTranslateX]);

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
      // Only clear interactive data if not authenticated
      if (!authToken) {
        setChatMessages([]);
        setActivePolls([]);
        setSongRequests([]);
        setUserMessageIds(new Set());
      }
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

      // MOCK: Set Now Playing Info - Replace with actual API call for current song
      if (broadcastToUse && broadcastToUse.status === 'LIVE') {
        setNowPlayingInfo({ songTitle: 'Wildcat\'s Choice', artist: 'Wildcat Radio' });
        // Example: const songInfo = await getCurrentSongForBroadcast(broadcastToUse.id, authToken);
        // if (!('error' in songInfo)) setNowPlayingInfo(songInfo);
      }

      if (broadcastToUse && authToken) {
        // Only fetch interactive data if authenticated
        const [messagesResult, pollsResult, songRequestsResult] = await Promise.all([
          chatService.getMessages(broadcastToUse.id, authToken),
          pollService.getPollsForBroadcast(broadcastToUse.id, authToken),
          songRequestService.getSongRequests(broadcastToUse.id, authToken),
        ]);

        if (!('error' in messagesResult) && messagesResult.data) {
          // Use smart merge for initial load too, in case WebSocket messages arrived first
          setChatMessages(prevMessages => {
            if (prevMessages.length === 0) {
              // No previous messages, just use server messages
              return messagesResult.data || [];
            }
            
            // Merge with any existing messages (e.g., from WebSocket)
            const serverMessages = messagesResult.data || [];
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

        if (!('error' in pollsResult) && pollsResult.data) {
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

  // Start polling for broadcast status updates (fallback only)
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Poll every 60 seconds as fallback when WebSocket is not connected
    pollIntervalRef.current = setInterval(() => {
      // Only poll if STOMP WebSocket is not connected
      if (!websocketService.isConnected()) {
        loadInitialDataForBroadcastScreen(true); // Background update via HTTP
      } else {
        console.log('📡 Skipping broadcast status poll - STOMP WebSocket is connected');
      }
    }, 60000); // Increased to 60 seconds for mobile battery efficiency
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

  // Handle WebSocket reconnection when app becomes active
  useEffect(() => {
    const handleWebSocketReconnection = (nextAppState: AppStateStatus) => {
      console.log('📱 App state changed to:', nextAppState);
      
      if (nextAppState === 'active' && !isWebSocketConnected) {
        console.log('📱 App became active, checking WebSocket connection...');
        // App came to foreground and WebSocket is disconnected, try to reconnect
        setTimeout(() => {
          if (!isWebSocketConnected && currentBroadcast?.id && authToken) {
            console.log('🔄 Attempting to restore WebSocket connection...');
            // The WebSocket will be reconnected by the effect above
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
  }, [isWebSocketConnected, currentBroadcast?.id, authToken]);

  // ===== AUTOMATIC STATUS UPDATES FOR LISTENERS =====
  // Radio Status Polling (Fallback only - when WebSocket is not connected)
  useEffect(() => {
    // Skip polling if WebSocket is connected - rely on WebSocket updates
    if (isWebSocketConnected) {
      console.log('📡 Skipping radio status poll - WebSocket is connected');
      return;
    }

    const fetchRadioStatus = async () => {
      try {
        console.log('📡 Checking radio status (fallback polling)...');
        const response = await streamService.getStreamStatus();
        
        // Only act on significant status changes, not just live mismatch
        // The stream status checks OGG, but mobile uses MP3, so they can differ
        if (response.live && !currentBroadcast) {
          console.log('📡 Stream is live but no broadcast found, refreshing...');
          // Stream is live but we don't have a broadcast, refresh data
          loadInitialDataForBroadcastScreen(true);
        } 
        // Removed the else if that was causing refresh loops
        // The broadcast and stream can have different "live" states because:
        // - Broadcast status is from backend DB
        // - Stream status is from Icecast (OGG stream)
        // - Mobile uses MP3 stream
        // So this mismatch is actually normal and expected
      } catch (error) {
        console.error('📡 Error fetching radio status:', error);
      }
    };

    // Initial check
    fetchRadioStatus();
    
    // Poll every 30 seconds as fallback when WebSocket is unavailable
    const interval = setInterval(fetchRadioStatus, 30000);
    
    return () => clearInterval(interval);
  }, [currentBroadcast, loadInitialDataForBroadcastScreen, isWebSocketConnected]);

  // Broadcast Status Polling (Fallback only - when WebSocket is not connected)
  useEffect(() => {
    // Skip polling if WebSocket is connected - rely on WebSocket updates
    if (isWebSocketConnected) {
      console.log('📻 Skipping broadcast status poll - WebSocket is connected');
      return;
    }

    // Skip polling if we have a specific broadcast ID from route
    if (routeBroadcastId) {
      console.log('📻 Skipping broadcast status check - using specific broadcast ID');
      return;
    }

    const checkBroadcastStatus = async () => {
      try {
        console.log('📻 Checking broadcast status (fallback polling)...');
        
        if (!authToken) {
          console.log('📻 Skipping broadcast status check - no auth token');
          return;
        }
        
        const liveBroadcasts = await getLiveBroadcasts(authToken);
        
        if ('error' in liveBroadcasts) {
          console.error('📻 Error fetching live broadcasts:', liveBroadcasts.error);
          return;
        }
        
        if (liveBroadcasts.length > 0) {
          const newBroadcast = liveBroadcasts[0];
          
          // Check if this is a different broadcast or status change
          if (!currentBroadcast || 
              currentBroadcast.id !== newBroadcast.id || 
              currentBroadcast.status !== newBroadcast.status) {
            console.log('📻 New broadcast or status change detected:', {
              current: currentBroadcast?.id,
              new: newBroadcast.id,
              currentStatus: currentBroadcast?.status,
              newStatus: newBroadcast.status
            });
            
            // Update broadcast data
            setCurrentBroadcast(newBroadcast);
            
            // If broadcast went from not live to live, show notification
            if (currentBroadcast?.status !== 'LIVE' && newBroadcast.status === 'LIVE') {
              console.log('🎉 Broadcast went LIVE!');
              // You could add a notification here if needed
            }
          }
        } else {
          // No live broadcasts
          if (currentBroadcast?.status === 'LIVE') {
            console.log('📻 Broadcast ended, updating status...');
            setCurrentBroadcast(null);
          }
        }
      } catch (error) {
        console.error('📻 Error checking broadcast status:', error);
      }
    };

    // Initial check
    checkBroadcastStatus();

    // Poll every 10 minutes as fallback when WebSocket is unavailable
    const interval = setInterval(checkBroadcastStatus, 600000);
    
    return () => clearInterval(interval);
  }, [currentBroadcast, routeBroadcastId, authToken, isWebSocketConnected]);

  // Global Broadcast WebSocket (Real-time updates) - Listen for broadcast start/end
  useEffect(() => {
    // Only setup if we don't have a specific broadcast ID
    if (routeBroadcastId) {
      return;
    }

    let connection: any = null;

    const setupGlobalBroadcastWebSocket = async () => {
      if (!authToken) {
        console.log('🌐 Skipping global broadcast WebSocket - no auth token');
        return;
      }
      
      try {
        console.log('🌐 Setting up global broadcast WebSocket...');
        
        // Use the existing WebSocket service to subscribe to global updates
        connection = await chatService.subscribeToGlobalBroadcastUpdates((update) => {
          console.log('🌐 Global broadcast update received:', update);
          
          if (update.type === 'BROADCAST_STARTED') {
            console.log('🎉 New broadcast started:', update.broadcast);
            setCurrentBroadcast(update.broadcast);
            
            // Show notification to user
            Alert.alert(
              'Broadcast Started!',
              `${update.broadcast.title} is now live!`,
              [{ text: 'OK' }]
            );
          } else if (update.type === 'BROADCAST_ENDED') {
            console.log('📻 Broadcast ended:', update.broadcastId);
            if (currentBroadcast?.id === update.broadcastId) {
              setCurrentBroadcast(null);
            }
          }
        }, authToken);
        
        console.log('🌐 Global broadcast WebSocket connected');
      } catch (error) {
        console.error('🌐 Failed to setup global broadcast WebSocket:', error);
      }
    };

    setupGlobalBroadcastWebSocket();

    // Cleanup function
    return () => {
      if (connection?.data?.disconnect) {
        console.log('🌐 Cleaning up global broadcast WebSocket');
        connection.data.disconnect();
      }
    };
  }, [routeBroadcastId, authToken]); // Remove currentBroadcast from dependencies to prevent reconnections

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
        console.log('🚀 Sending via chatService');
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
          console.log('✅ Message sent successfully via chatService');
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
    if (!authToken || !currentBroadcast || !songTitleInput.trim() || !artistInput.trim()) {
        Alert.alert("Missing Info", "Please enter both song title and artist.");
        return;
    }
    setIsSubmitting(true);
    const payload = {
      songTitle: songTitleInput,
      artist: artistInput,
    };
    const result = await songRequestService.createSongRequest(currentBroadcast.id, payload, authToken);
    if ('error' in result) {
      Alert.alert("Error", result.error || "Failed to request song.");
    } else {
      Alert.alert("Success", "Song requested successfully!");
      setSongTitleInput('');
      setArtistInput('');
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
      const messagesResult = await chatService.getMessages(currentBroadcast.id, authToken);
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
      const pollsResult = await pollService.getPollsForBroadcast(currentBroadcast.id, authToken);
      if (!('error' in pollsResult) && pollsResult.data) {
        setActivePolls(pollsResult.data);
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
    console.log(`🔄 Chat messages memoized: ${filteredMessages.length} messages`);
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
      if (listenerName && listenerName !== 'Listener' && msg.sender?.name) {
        const senderName = msg.sender.name.toLowerCase().trim();
        const userListenerName = listenerName.toLowerCase().trim();
        if (senderName === userListenerName) {
          ownershipMap.set(msg.id, true);
          return;
        }
      }
      
      // Method 4: Additional name variations check
      if (userData && msg.sender?.name) {
        const senderName = msg.sender.name.toLowerCase().trim();
        
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
      
      // Default to false if no match
      ownershipMap.set(msg.id, false);
    });
    
    return ownershipMap;
  }, [memoizedChatMessages, currentUserId, listenerName, userData, userMessageIds]);

  const renderChatTab = () => {
    // Show login prompt if not authenticated
    if (!authToken) {
      return (
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <LoginPrompt
            title="Login to Join the Conversation"
            message="Sign in to chat with other listeners and interact with the broadcast."
            icon="chatbubbles-outline"
          />
        </ScrollView>
      );
    }

    return (
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
              <Text className="text-base text-gray-600">Chat with the DJ and other listeners</Text>
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
          justifyContent: memoizedChatMessages.length === 0 ? 'center' : 'flex-end',
          paddingTop: 20, 
          paddingBottom: 20, 
          paddingHorizontal: 16 
        }}
        showsVerticalScrollIndicator={false}
      >
        {(isLoading && memoizedChatMessages.length === 0) && (
          <View className="flex-1 items-center justify-center py-20">
            <View className="bg-white rounded-2xl p-8 shadow-xl items-center">
              <ActivityIndicator size="large" color="#91403E" className="mb-4" />
              <Text className="text-cordovan font-semibold text-lg">Loading chat...</Text>
            </View>
          </View>
        )}
        
        {!isLoading && memoizedChatMessages.length === 0 && (
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
        {memoizedChatMessages.map((msg, index) => {
          // OPTIMIZED MESSAGE OWNERSHIP DETECTION - Using memoized map to prevent performance loops
          const isOwnMessage = messageOwnershipMap.get(msg.id) || false;
          
          const showAvatar = index === memoizedChatMessages.length - 1 || memoizedChatMessages[index + 1]?.sender?.name !== msg.sender?.name;
          const isLastInGroup = index === memoizedChatMessages.length - 1 || memoizedChatMessages[index + 1]?.sender?.name !== msg.sender?.name;
          const isFirstInGroup = index === 0 || memoizedChatMessages[index - 1]?.sender?.name !== msg.sender?.name;
          
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
      
      {/* Slow Mode Indicator (matching website) */}
      {slowModeEnabled && slowModeSeconds > 0 && (
        <View className="bg-amber-50 border-t border-amber-200 px-4 py-2">
          <View className="flex-row items-center">
            <Ionicons name="time-outline" size={16} color="#D97706" />
            <Text className="ml-2 text-amber-700 text-sm font-medium">
              Slow mode is active ({slowModeSeconds}s between messages)
            </Text>
          </View>
          {slowModeWaitSeconds !== null && slowModeWaitSeconds > 0 && (
            <Text className="text-amber-600 text-xs mt-1">
              Please wait {slowModeWaitSeconds} second{slowModeWaitSeconds !== 1 ? 's' : ''} before sending another message
            </Text>
          )}
        </View>
      )}

      {/* Ban Indicator (matching website) */}
      {isBanned && (
        <View className="bg-red-50 border-t border-red-200 px-4 py-2">
          <View className="flex-row items-center">
            <Ionicons name="ban-outline" size={16} color="#DC2626" />
            <Text className="ml-2 text-red-700 text-sm font-medium">
              {banMessage || "You have been banned from this chat."}
            </Text>
          </View>
        </View>
      )}

      {/* Messenger-style Chat Input */}
      <View 
        className="bg-white border-t border-gray-200 px-4 py-3"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 8,
          marginBottom: 14,
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
            placeholder={isBanned ? "You are banned from chatting" : "Type your message..."}
              placeholderTextColor="#9CA3AF"
            value={chatInput}
            onChangeText={setChatInput}
            editable={!isSubmitting && !!currentBroadcast && !isBanned}
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
            disabled={!currentBroadcast || !chatInput.trim() || isBanned}
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

  const renderRequestsTab = () => {
    // Show login prompt if not authenticated
    if (!authToken) {
      return (
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <LoginPrompt
            title="Login to Request Songs"
            message="Sign in to request your favorite songs and see what others are requesting."
            icon="musical-notes-outline"
          />
          {/* Show read-only popular requests */}
          {songRequests.length > 0 && (
            <View style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              padding: 16,
              marginHorizontal: 20,
              marginTop: 16,
            }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 12 }}>
                Popular Requests
              </Text>
              {songRequests.slice(0, 5).map((request) => (
                <View key={request.id} style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: '#E5E7EB',
                }}>
                  <Ionicons name="musical-note" size={20} color="#91403E" style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937' }}>
                      {request.songTitle}
                    </Text>
                    {request.artist && (
                      <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                        {request.artist}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      );
    }

    return (
      <View style={styles.tabContentContainer} className="flex-1 bg-gray-50">
      {/* Fixed Request Song Header */}
      <View className="px-5 pt-6 pb-4 bg-gradient-to-r from-white to-gray-50 border-b border-gray-100">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <View className="bg-red-500/10 p-3 rounded-full mr-3">
              <MaterialCommunityIcons name="music-note-plus" size={26} color="#EF4444" /> 
            </View>
            <View>
              <Text className="text-xl font-bold text-gray-800">Request a Song</Text>
              <Text className="text-base text-gray-600">Let us know what you'd like to hear next</Text>
            </View>
          </View>
          
          {/* Status indicator */}
          <View className="flex-row items-center">
            {isRefreshingRequests && (
              <ActivityIndicator size="small" color="#EF4444" className="mr-2" />
            )}
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ paddingBottom: 30 }}
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
        <View className="px-5 pt-4">
          <View className="mt-2">
            <Text className="text-sm font-medium text-gray-700 mb-1.5 ml-1">Song Title</Text>
            <TextInput
              placeholder="Enter song title"
              placeholderTextColor="#6B7280"
              value={songTitleInput}
              onChangeText={setSongTitleInput}
              editable={!isSubmitting && !!currentBroadcast}
              className="bg-white border border-gray-300 rounded-lg p-3.5 text-base shadow-sm text-gray-800 focus:border-mikado_yellow focus:ring-1 focus:ring-mikado_yellow"
              style={{ fontSize: 16 }}
            />
          </View>

          <View className="mt-5">
            <Text className="text-sm font-medium text-gray-700 mb-1.5 ml-1">Artist</Text>
            <TextInput
              placeholder="Enter artist name"
              placeholderTextColor="#6B7280" 
              value={artistInput}
              onChangeText={setArtistInput}
              editable={!isSubmitting && !!currentBroadcast}
              className="bg-white border border-gray-300 rounded-lg p-3.5 text-base shadow-sm text-gray-800 focus:border-mikado_yellow focus:ring-1 focus:ring-mikado_yellow"
              style={{ fontSize: 16 }}
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
    </View>
    );
  };

  const renderPollsTab = () => {
    // Show login prompt if not authenticated
    if (!authToken) {
      return (
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <LoginPrompt
            title="Login to Vote on Polls"
            message="Sign in to participate in polls and share your opinion with the community."
            icon="stats-chart-outline"
          />
          {/* Show read-only active polls */}
          {activePolls.length > 0 && (
            <View style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              padding: 16,
              marginHorizontal: 20,
              marginTop: 16,
            }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 12 }}>
                Active Polls
              </Text>
              {activePolls.filter(p => p.isActive).map((poll) => (
                <View key={poll.id} style={{
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: '#E5E7EB',
                }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 8 }}>
                    {poll.question}
                  </Text>
                  {poll.options.map((opt) => (
                    <View key={opt.id} style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 6,
                    }}>
                      <View style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: '#D1D5DB',
                        marginRight: 8,
                      }} />
                      <Text style={{ fontSize: 13, color: '#6B7280' }}>{opt.text}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      );
    }

    return (
    <View style={styles.tabContentContainer} className="flex-1 bg-gray-50">
      {/* Fixed Polls Header */}
      <View className="px-5 pt-6 pb-4 bg-gradient-to-r from-white to-gray-50 border-b border-gray-100">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <View className="bg-green-500/10 p-3 rounded-full mr-3">
              <Ionicons name="stats-chart-outline" size={26} color="#22C55E" /> 
            </View>
            <View>
              <Text className="text-xl font-bold text-gray-800">Active Polls</Text>
              <Text className="text-base text-gray-600">Voice your opinion on current topics</Text>
            </View>
          </View>
          
          {/* Status indicator */}
          <View className="flex-row items-center">
            {isRefreshingPolls && (
              <ActivityIndicator size="small" color="#22C55E" className="mr-2" />
            )}
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ paddingBottom: 30 }}
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
        <View className="px-5 pt-4">
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
                  <Text className="text-lg font-bold text-gray-800 mb-2">{poll.question}</Text>
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
    </View>
    );
  };

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

  const renderNowPlayingCard = () => {
    if (!currentBroadcast || !isBroadcastLive) {
      return null; // Don't render if not live
    }
    return (
      <View className="mx-4 my-2 bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Live Badge with listener count */}
        <View className="absolute top-3 right-3 z-20">
          <View className="bg-red-500 px-2.5 py-1 rounded-full flex-row items-center">
            <View className="w-1.5 h-1.5 bg-white rounded-full mr-1.5" />
            <Text className="text-white text-xs font-bold tracking-wide">
              LIVE • {streamStatus.listenerCount || streamingState.listenerCount} listeners
            </Text>
          </View>
        </View>

        <View className="p-4">
          {/* Compact Header */}
          <View className="flex-row items-center mb-3">
            {/* Album Art */}
            <View className="w-10 h-10 rounded-lg mr-3 bg-cordovan items-center justify-center">
              <Ionicons name="radio" size={16} color="white" />
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

          {/* Audio Player Controls */}
          <View className="bg-gray-50 rounded-xl p-3">
            <View className="flex-row items-center justify-between">
              {/* Connection Status Dot */}
              <View className="flex-row items-center">
                <View className={`w-3 h-3 rounded-full mr-3 ${
                  streamingState.error 
                    ? 'bg-red-500' 
                    : isStreamReady && streamingState.isPlaying 
                      ? 'bg-green-500' 
                      : isStreamReady 
                        ? 'bg-orange-500'
                        : streamingState.isLoading
                          ? 'bg-blue-500'
                          : 'bg-gray-400'
                }`} />
                
                {/* Play/Pause Button with Loading State */}
                <TouchableOpacity
                  onPress={handlePlayPause}
                  disabled={!currentBroadcast || streamingState.isLoading}
                  className={`p-3 rounded-full ${
                    streamingState.isLoading
                      ? 'bg-blue-100'
                      : streamingState.isPlaying
                        ? 'bg-yellow-100'
                        : 'bg-green-100'
                  }`}
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 3,
                    elevation: 3,
                  }}
                >
                  {streamingState.isLoading ? (
                    <ActivityIndicator size="small" color="#3B82F6" />
                  ) : streamingState.isPlaying ? (
                    <Ionicons name="pause" size={24} color="#B5830F" />
                  ) : (
                    <Ionicons name="play" size={24} color="#22C55E" />
                  )}
                </TouchableOpacity>
              </View>

              {/* Now Playing Info */}
              <View className="flex-1 mx-3">
                <View className="flex-row items-center mb-1">
                  <Text className="text-gray-800 text-sm font-bold uppercase tracking-wide">
                    {streamingState.isPlaying ? 'NOW PLAYING' : 'PAUSED'}
                  </Text>
                </View>
                
                {nowPlayingInfo ? (
                  <>
                    <Text className="text-gray-800 text-sm font-bold mb-0.5" numberOfLines={1}>
                      {nowPlayingInfo.songTitle}
                    </Text>
                    <Text className="text-gray-600 text-xs font-medium" numberOfLines={1}>
                      {nowPlayingInfo.artist}
                    </Text>
                  </>
                ) : (
                  <Text className="text-gray-600 text-xs font-medium">
                    WildCat Radio Live Stream
                  </Text>
                )}
              </View>
              
              {/* Animated Audio Wave Visualizer */}
              {streamingState.isPlaying && (
                <View className="mr-2">
                  <AnimatedAudioWave isPlaying={streamingState.isPlaying} size={24} />
                </View>
              )}

              {/* Refresh Button */}
              <TouchableOpacity
                onPress={streamingActions.refreshStream}
                className="p-2 ml-2"
                disabled={streamingState.isLoading}
              >
                <Ionicons 
                  name="refresh" 
                  size={20} 
                  color={streamingState.isLoading ? "#CBD5E0" : "#91403E"} 
                />
              </TouchableOpacity>

            </View>
          </View>

          {/* Stream Status */}
          <View className="flex-row items-center justify-center mt-3">
            <View className={`w-2 h-2 rounded-full mr-2 ${
              streamingState.error 
                ? 'bg-red-500' 
                : isStreamReady && streamingState.isPlaying 
                  ? 'bg-green-500' 
                  : isStreamReady 
                    ? 'bg-orange-500'
                    : streamingState.isLoading
                      ? 'bg-blue-500'
                      : 'bg-gray-400'
            }`} />
            <Text className={`text-xs font-medium ${
              streamingState.error 
                ? 'text-red-600' 
                : isStreamReady && streamingState.isPlaying 
                  ? 'text-green-600' 
                  : isStreamReady 
                    ? 'text-orange-600'
                    : streamingState.isLoading
                      ? 'text-blue-600'
                      : 'text-gray-600'
            }`}>
              {streamingState.error 
                ? 'Connection Error' 
                : isStreamReady && streamingState.isPlaying 
                  ? 'Connected • Crystal Clear HD' 
                  : isStreamReady
                    ? 'Ready to Stream'
                    : streamingState.isLoading
                      ? 'Connecting to Stream...'
                      : 'Waiting for Stream...'}
            </Text>
          </View>

          {/* Background Audio Status */}
          {streamingState.backgroundAudio.isBackgroundActive && (
            <View className="flex-row items-center justify-center mt-2">
              <View className="w-2 h-2 rounded-full mr-2 bg-purple-500" />
              <Text className="text-xs font-medium text-purple-600">
                🎵 Background Audio Active
              </Text>
            </View>
          )}

          {/* Error Message */}
          {streamingState.error && (
            <View className="mt-2 p-2 bg-red-50 rounded-lg">
              <Text className="text-red-600 text-xs text-center">
                {streamingState.error}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // Debug function to manually test MP3 stream loading
  const debugLoadMp3Stream = async () => {
    try {
      console.log('🔧 DEBUG: Manually testing MP3 stream loading...');
      const mp3StreamUrl = 'https://icecast.software/live.mp3';
      
      // Bypass all availability checks and try to load directly
      console.log('🎵 DEBUG: Loading MP3 stream directly:', mp3StreamUrl);
      await streamingActions.loadStream(mp3StreamUrl);
      
      // Update stream status
      setStreamStatus(prev => ({
        ...prev,
        streamUrl: mp3StreamUrl,
      }));
      
      // Mark as ready
      setTimeout(() => {
        setIsStreamReady(true);
        console.log('✅ DEBUG: MP3 stream loaded successfully!');
        Alert.alert('Debug Success', 'MP3 stream loaded successfully! You can now try playing it.');
      }, 1000);
      
    } catch (error) {
      console.error('❌ DEBUG: Failed to load MP3 stream:', error);
      Alert.alert('Debug Error', `Failed to load MP3 stream: ${error}`);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]} className="flex-1 bg-anti-flash_white">
      <Stack.Screen 
        options={{
            headerShown: true, // Always use tab layout header for consistency
        }}
       />
      
      {!currentBroadcast ? (
        // Beautiful Off Air state with next show info
        <ScrollView
          style={{ backgroundColor: '#F5F5F5' }}
          contentContainerStyle={{ 
            paddingBottom: 120 + insets.bottom,
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
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <View style={{
              width: 140,
              height: 140,
              borderRadius: 70,
              backgroundColor: '#F3F4F6',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 28,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 6,
              borderWidth: 3,
              borderColor: '#E5E7EB',
            }}>
              <Ionicons name="radio-outline" size={72} color="#9CA3AF" />
            </View>
            <Text style={{
              fontSize: 32,
              fontWeight: 'bold',
              color: '#1F2937',
              marginBottom: 12,
              textAlign: 'center',
              letterSpacing: -0.5,
            }}>
              Currently Off Air
            </Text>
            <Text style={{
              fontSize: 17,
              color: '#6B7280',
              textAlign: 'center',
              marginBottom: 40,
              lineHeight: 26,
              paddingHorizontal: 20,
            }}>
              {upcomingBroadcasts.length > 0
                ? `We'll be back soon! Check out our next show below.`
                : 'We\'re currently off air. Check back soon for exciting shows!'}
            </Text>

            {/* Next Show Card */}
            {upcomingBroadcasts.length > 0 && (
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
                    Next Show
                  </Text>
                </View>
                {upcomingBroadcasts[0] && (() => {
                  const nextShow = upcomingBroadcasts[0];
                  const startTime = parseISO(nextShow.scheduledStart);
                  const timeUntil = formatDistanceToNow(startTime, { addSuffix: true });
                  return (
                    <>
                      <Text style={{
                        fontSize: 22,
                        fontWeight: 'bold',
                        color: '#1F2937',
                        marginBottom: 10,
                        letterSpacing: -0.3,
                      }}>
                        {nextShow.title}
                      </Text>
                      {nextShow.dj?.name && (
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
                            {nextShow.dj.name}
                          </Text>
                        </View>
                      )}
                      <View style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        marginTop: 8,
                        marginBottom: 12,
                      }}>
                        <Ionicons name="calendar" size={18} color="#6B7280" style={{ marginRight: 8 }} />
                        <Text style={{ fontSize: 15, color: '#6B7280', fontWeight: '600' }}>
                          {format(startTime, 'MMM d, yyyy • h:mm a')}
                        </Text>
                      </View>
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
                          Starts {timeUntil}
                        </Text>
                      </View>
                    </>
                  );
                })()}
              </View>
            )}

            <TouchableOpacity
              style={{
                backgroundColor: '#91403E',
                paddingVertical: 14,
                paddingHorizontal: 32,
                borderRadius: 12,
                shadowColor: '#91403E',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }}
              onPress={() => loadInitialDataForBroadcastScreen()}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
                Refresh
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : currentBroadcast ? (
        // Beautiful Listen screen with hero play button and graceful fallback when not live
        <View className="flex-1 bg-gray-50">
          <ScrollView
            contentContainerStyle={{ paddingBottom: 120, paddingTop: Platform.OS === 'android' ? 12 : 6 }}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshingBroadcast}
                onRefresh={refreshBroadcastData}
                colors={['#91403E']}
                tintColor="#91403E"
                title="Pull to refresh"
                titleColor="#91403E"
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {!isBroadcastLive && (
              <View className="mx-5 mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                <Text className="text-amber-800 font-semibold text-base mb-1">
                  Broadcast not live yet
                </Text>
                <Text className="text-amber-700 text-sm">
                  Tap refresh after the DJ goes live to start listening instantly.
                </Text>
              </View>
            )}

            {/* Hero Play Button Section */}
            <View style={{ paddingTop: 20, paddingBottom: 16 }}>
              <HeroPlayButton
                isPlaying={streamingState.isPlaying}
                isLoading={streamingState.isLoading}
                isLive={isBroadcastLive}
                onPress={handlePlayPause}
                disabled={!isStreamReady && !streamingState.isLoading}
                broadcastTitle={currentBroadcast.title}
                djName={currentBroadcast.dj?.name}
                listenerCount={streamStatus.listenerCount}
              />
            </View>

            {/* Now Playing Card */}
            {isBroadcastLive && nowPlayingInfo && (
              <NowPlayingCard
                songTitle={nowPlayingInfo.songTitle}
                artist={nowPlayingInfo.artist}
                isPlaying={streamingState.isPlaying}
                listenerCount={streamStatus.listenerCount}
              />
            )}

            {/* Current Show Info Card */}
            <View style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              padding: 22,
              marginHorizontal: 20,
              marginBottom: 20,
              shadowColor: '#91403E',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.15,
              shadowRadius: 16,
              elevation: 8,
              borderWidth: 1,
              borderColor: '#F3F4F6',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                <View style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: '#91403E',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 14,
                  shadowColor: '#91403E',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6,
                }}>
                  <Ionicons name="radio" size={28} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: 22,
                    fontWeight: 'bold',
                    color: '#1F2937',
                    marginBottom: 6,
                    letterSpacing: -0.5,
                  }}>
                    {currentBroadcast.title}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                    <View style={{
                      backgroundColor: '#FFC30B',
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 14,
                      marginRight: 8,
                      shadowColor: '#FFC30B',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.3,
                      shadowRadius: 4,
                      elevation: 4,
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#000000', letterSpacing: 0.5 }}>DJ</Text>
                    </View>
                    <Text style={{ fontSize: 15, color: '#91403E', fontWeight: '700' }}>
                      {currentBroadcast.dj?.name || 'Wildcat Radio'}
                    </Text>
                  </View>
                </View>
              </View>
              {currentBroadcast.description && (
                <Text style={{
                  fontSize: 15,
                  color: '#6B7280',
                  lineHeight: 22,
                  marginTop: 4,
                }}>
                  {currentBroadcast.description}
                </Text>
              )}
            </View>

            {/* Stream Status */}
            <View style={{
              backgroundColor: streamingState.isPlaying ? '#F0FDF4' : '#F9FAFB',
              borderRadius: 16,
              padding: 16,
              marginHorizontal: 20,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: streamingState.isPlaying ? '#10B981' : '#E5E7EB',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: streamingState.isPlaying ? '#10B981' : '#6B7280',
                  marginRight: 8,
                }} />
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: streamingState.isPlaying ? '#10B981' : '#6B7280',
                }}>
                  {streamingState.isPlaying 
                    ? 'Connected • Crystal Clear HD' 
                    : streamingState.isLoading 
                      ? 'Connecting...' 
                      : isBroadcastLive
                        ? 'Ready to Play'
                        : 'Waiting for DJ'}
                </Text>
              </View>
            </View>
          </ScrollView>

          {isBroadcastLive ? (
            <View style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 8,
              paddingTop: 8,
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
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                style={{ minHeight: 300 }}
              >
                {renderTabContent()}
              </KeyboardAvoidingView>
            </View>
          ) : (
            <View className="mx-5 mt-4 p-4 rounded-2xl bg-white border border-gray-200">
              <Text className="text-base font-semibold text-gray-800 mb-1">
                Live chat, song requests, and polls unlock when the broadcast goes live.
              </Text>
              <Text className="text-sm text-gray-600">
                We’ll pull them up automatically once the DJ starts the show.
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {showGlobalSkeleton && (
        <View style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 0,
          right: 0,
          bottom: insets.bottom,
          backgroundColor: 'rgba(243, 244, 246, 0.9)',
        }}>
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
  tabBar: {
  },
  tabContentContainer: {
    flex: 1,
  },
});
}

export default BroadcastScreen; 