"use client"

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "react-router-dom";
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  PaperAirplaneIcon,
  MusicalNoteIcon,
  ChatBubbleLeftRightIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/solid";
import AudioVisualizer from "../components/AudioVisualizer";
import { broadcastService, chatService, songRequestService, pollService, streamService } from "../services/api";
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from "../context/AuthContext";
import { useStreaming } from "../context/StreamingContext";

export default function ListenerDashboard() {
  const { id: broadcastIdParam } = useParams();
  const location = useLocation();
  const { currentUser } = useAuth();
  const isSpecificBroadcast = location.pathname.startsWith('/broadcast/');
  
  // Get streaming context
  const { 
    isLive,
    isListening,
    audioPlaying,
    volume,
    isMuted,
    listenerCount,
    startListening,
    stopListening,
    toggleAudio,
    updateVolume,
    toggleMute,
    serverConfig
  } = useStreaming();
  
  // If we're accessing a specific broadcast by ID, set it as the current broadcast
  const targetBroadcastId = isSpecificBroadcast && broadcastIdParam ? parseInt(broadcastIdParam, 10) : null;
  const [streamError, setStreamError] = useState(null);

  // Original states from ListenerDashboard.jsx
  const [nextBroadcast, setNextBroadcast] = useState(null);
  const [currentBroadcastId, setCurrentBroadcastId] = useState(null);
  const [currentBroadcast, setCurrentBroadcast] = useState(null);

  // Audio visualizer state
  const [audioData, setAudioData] = useState(new Uint8Array(0));
  const [visualizerEnabled, setVisualizerEnabled] = useState(true);

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatMessage, setChatMessage] = useState('');
  const [showChat, setShowChat] = useState(false);

  // Song request state
  const [songRequests, setSongRequests] = useState([]);
  const [songRequest, setSongRequest] = useState({ title: '', artist: '' });
  const [showSongRequests, setShowSongRequests] = useState(false);

  // Poll state
  const [polls, setPolls] = useState([]);
  const [activePoll, setActivePoll] = useState(null);
  const [showPolls, setShowPolls] = useState(false);
  const [userVotes, setUserVotes] = useState({});
  
  // UI state
  const [activeTab, setActiveTab] = useState("song");
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [pollLoading, setPollLoading] = useState(false);
  const [currentSong, setCurrentSong] = useState(null);

  // Local audio state for the dashboard player (separate from streaming context)
  const [localAudioPlaying, setLocalAudioPlaying] = useState(false);
  
  // Local listener count state (fallback if streaming context doesn't update)
  const [localListenerCount, setLocalListenerCount] = useState(0);
  
  // Poll selection state
  const [selectedPollOption, setSelectedPollOption] = useState(null);
  
  // Chat timestamp update state
  const [chatTimestampTick, setChatTimestampTick] = useState(0);
  
  // WebSocket references for interactions
  const chatWsRef = useRef(null);
  const songRequestWsRef = useRef(null);
  const pollWsRef = useRef(null);
  const broadcastWsRef = useRef(null);
  
  // UI refs
  const chatContainerRef = useRef(null);
  const abortControllerRef = useRef(null);
  
  // Audio processing for visualizer
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioSourceRef = useRef(null);
  const animationRef = useRef(null);
  
  // Load current broadcast on component mount
  useEffect(() => {
    const fetchCurrentBroadcast = async () => {
      try {
        // If we're looking at a specific broadcast by ID
        if (targetBroadcastId) {
          const response = await broadcastService.getById(targetBroadcastId);
          setCurrentBroadcast(response.data);
          setCurrentBroadcastId(targetBroadcastId);
          return;
        }
        
        // Otherwise, get the active broadcast
        const activeBroadcast = await broadcastService.getActiveBroadcast();
        if (activeBroadcast) {
          setCurrentBroadcast(activeBroadcast);
          setCurrentBroadcastId(activeBroadcast.id);
          return;
        }
        
        // If no active broadcast, get the next scheduled broadcast
        const upcomingResponse = await broadcastService.getUpcoming();
        if (upcomingResponse.data && upcomingResponse.data.length > 0) {
          setNextBroadcast(upcomingResponse.data[0]); // Get the first upcoming broadcast
        }
      } catch (error) {
        console.error('Error fetching broadcast information:', error);
        setStreamError('Failed to load broadcast information');
      }
    };
    
    fetchCurrentBroadcast();
  }, [targetBroadcastId]);

  // Handle play/pause
  const handlePlayPause = () => {
    try {
      toggleAudio();
    } catch (error) {
      console.error('Error toggling audio:', error);
      setStreamError('Failed to control audio playback');
    }
  };

  // Handle volume change
  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value);
    updateVolume(newVolume);
  };

  // Handle mute toggle
  const handleMuteToggle = () => {
    toggleMute();
  };

  // Refresh stream function
  const refreshStream = () => {
    if (audioRef.current && serverConfig?.streamUrl) {
      const wasPlaying = audioPlaying;
      audioRef.current.pause();
      audioRef.current.src = '';
      
      setTimeout(() => {
        audioRef.current.src = serverConfig.streamUrl;
        audioRef.current.load();
        
        if (wasPlaying) {
          audioRef.current.play().catch(error => {
            console.error('Error restarting playback:', error);
            setStreamError('Failed to restart playback. Please try again.');
          });
        }
      }, 100);
    }
  };

  // Audio refs from ListenerDashboard2.jsx
  const audioRef = useRef(null);
  const statusCheckInterval = useRef(null);
  const wsRef = useRef(null);
  const wsConnectingRef = useRef(false);
  const heartbeatInterval = useRef(null);

  // Initialize audio element when serverConfig is available
  useEffect(() => {
    console.log('Audio initialization useEffect called:', {
      serverConfigExists: !!serverConfig,
      audioRefCurrentExists: !!audioRef.current,
      streamUrl: serverConfig?.streamUrl
    });
    
    if (serverConfig && !audioRef.current) {
      console.log('Initializing audio element with stream URL:', serverConfig.streamUrl);
      audioRef.current = new Audio();
      audioRef.current.preload = 'none';
      audioRef.current.volume = isMuted ? 0 : volume / 100;
      
      // Add event listeners for audio events
      audioRef.current.onloadstart = () => console.log('Audio loading started');
      audioRef.current.oncanplay = () => console.log('Audio can start playing');
      audioRef.current.onplay = () => console.log('Audio play event fired');
      audioRef.current.onpause = () => console.log('Audio pause event fired');
      audioRef.current.onerror = (e) => {
        console.error('Audio error:', e);
        console.error('Audio error details:', {
          error: e.target?.error,
          code: e.target?.error?.code,
          message: e.target?.error?.message,
          networkState: e.target?.networkState,
          readyState: e.target?.readyState,
          src: e.target?.src
        });
        setStreamError('Audio playback error. Please try refreshing or check your internet connection.');
      };
    }
    
    return () => {
      // Cleanup audio element on unmount
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, [serverConfig, volume, isMuted]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!serverConfig) return;

    let reconnectTimer = null;
    let isReconnecting = false;
    let wsInstance = null;
    let wsConnectionAttemptCount = 0;
    const MAX_CONNECTION_ATTEMPTS = 5;

    // Function to connect WebSocket with proper error handling
    const connectWebSocket = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      // Prevent duplicate connections
      if (isReconnecting || wsConnectingRef.current) return;
      
      // Increment connection attempt counter
      wsConnectionAttemptCount++;
      
      // Use a delay to avoid React StrictMode double-mounting issues
      // Increase delay for subsequent attempts
      const connectionDelay = Math.min(300 * wsConnectionAttemptCount, 2000);
      console.log(`Delaying WebSocket connection by ${connectionDelay}ms (attempt ${wsConnectionAttemptCount})`);
      
      reconnectTimer = setTimeout(() => {
        isReconnecting = true;
        wsConnectingRef.current = true;

        // Simple WebSocket URL construction
        // For deployed environments, always use secure WebSocket (wss)
        // For localhost development, use ws
        const wsProtocol = window.location.hostname === 'localhost' ? 'ws' : 'wss';
        
        // Check if we should use localhost instead of the deployed backend
        // Force useLocalBackend to true to ensure we're using the local backend
        const useLocalBackend = true; // Override the environment variable
        
        let wsBaseUrl;
        if (useLocalBackend) {
          wsBaseUrl = 'localhost:8080';
        } else {
          wsBaseUrl = import.meta.env.VITE_WS_BASE_URL;
        }
        
      const cleanHost = wsBaseUrl.replace(/^(https?:\/\/|wss?:\/\/)/, '');
      
      // Get JWT token for authentication
      const getCookie = (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
        return null;
      };
      
      const token = getCookie('token');
      const listenerWsUrl = `${wsProtocol}://${cleanHost}/ws/listener${token ? `?token=${encodeURIComponent(token)}` : ''}`;

      console.log('Using WebSocket URL:', listenerWsUrl.replace(/token=[^&]*/, 'token=***'));

      try {
          console.log('Listener Dashboard connecting to WebSocket with authentication');

          // Close existing connection if any
          if (wsRef.current) {
            try {
              // First remove handlers to prevent reconnection logic from firing
              wsRef.current.onclose = null;
              wsRef.current.onerror = null;
              
              if (wsRef.current.readyState !== WebSocket.CLOSING && 
                  wsRef.current.readyState !== WebSocket.CLOSED) {
                wsRef.current.close(1000, "Replacing connection");
            }
          } catch (e) {
              console.warn('Error closing existing WebSocket:', e);
          }
        }

          // Create new connection with authentication
          wsInstance = new WebSocket(listenerWsUrl);
          wsRef.current = wsInstance;

          // Set up event handlers
        wsInstance.onopen = () => {
            console.log('WebSocket connected for listener updates');
            isReconnecting = false;
            wsConnectingRef.current = false;
            wsConnectionAttemptCount = 0; // Reset counter on successful connection

            // Send initial status
          setTimeout(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                const currentlyPlaying = audioRef.current && !audioRef.current.paused && localAudioPlaying;
                if (currentlyPlaying) {
                  const message = {
                    type: 'LISTENER_STATUS',
                    action: 'START_LISTENING',
                    broadcastId: currentBroadcastId,
                    userId: currentUser?.id,
                    userName: currentUser?.firstName || currentUser?.name || 'Anonymous',
                    timestamp: Date.now()
                  };
                  wsRef.current.send(JSON.stringify(message));
                  console.log('Sent initial listener status on WebSocket connect: listening', message);
                } else {
                  console.log('WebSocket connected but not currently listening');
                }
              }
            }, 100);

            // Set up heartbeat
          if (heartbeatInterval.current) {
              clearInterval(heartbeatInterval.current);
          }

          heartbeatInterval.current = setInterval(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && audioRef.current) {
                const currentlyPlaying = !audioRef.current.paused && localAudioPlaying;
              if (currentlyPlaying) {
                  const message = {
                    type: 'LISTENER_STATUS',
                    action: 'HEARTBEAT',
                    broadcastId: currentBroadcastId,
                    userId: currentUser?.id,
                    userName: currentUser?.firstName || currentUser?.name || 'Anonymous',
                    timestamp: Date.now()
                  };
                  wsRef.current.send(JSON.stringify(message));
                  console.log('Heartbeat: Sent listener status (listening)', message);
                }
              }
            }, 15000);
          };

        wsInstance.onmessage = (event) => {
          try {
              const data = JSON.parse(event.data);
              console.log('WebSocket message received:', data);

            if (data.type === 'STREAM_STATUS') {
                console.log('ListenerDashboard: Stream status updated via WebSocket:', data.isLive);
                
                // Update local listener count if provided
                if (data.listenerCount !== undefined) {
                  console.log('ListenerDashboard: Updating listener count to:', data.listenerCount);
                  setLocalListenerCount(data.listenerCount);
                }
            }
          } catch (error) {
              console.error('Error parsing WebSocket message:', error);
          }
          };

        wsInstance.onclose = (event) => {
            console.log(`WebSocket disconnected with code ${event.code}, reason: ${event.reason}`);
            isReconnecting = false;
            wsConnectingRef.current = false;

          if (heartbeatInterval.current) {
              clearInterval(heartbeatInterval.current);
              heartbeatInterval.current = null;
            }

            // Only reconnect on unexpected close and if we haven't exceeded max attempts
            if (event.code !== 1000 && event.code !== 1001 && wsConnectionAttemptCount < MAX_CONNECTION_ATTEMPTS) {
              console.log(`Attempting to reconnect WebSocket in ${3000 * wsConnectionAttemptCount}ms (attempt ${wsConnectionAttemptCount})`);
              reconnectTimer = setTimeout(connectWebSocket, 3000 * wsConnectionAttemptCount);
            } else if (wsConnectionAttemptCount >= MAX_CONNECTION_ATTEMPTS) {
              console.log(`Maximum connection attempts (${MAX_CONNECTION_ATTEMPTS}) reached. Stopping reconnection attempts.`);
            }
          };

        wsInstance.onerror = (error) => {
            console.error('WebSocket error:', error);
            // Don't set isReconnecting to false here, let onclose handle it
          };
      } catch (error) {
          console.error('Error creating WebSocket:', error);
          isReconnecting = false;
          wsConnectingRef.current = false;
          
          if (wsConnectionAttemptCount < MAX_CONNECTION_ATTEMPTS) {
            reconnectTimer = setTimeout(connectWebSocket, 3000 * wsConnectionAttemptCount);
          }
        }
      }, connectionDelay); // Delay to avoid React StrictMode issues
    };

    // Initial connection
    connectWebSocket();

    // Cleanup function
    return () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }

      if (wsRef.current) {
        try {
          console.log('Closing WebSocket due to component unmount');
          
          // Send stop listening message if currently playing
          if (wsRef.current.readyState === WebSocket.OPEN && localAudioPlaying) {
            const message = {
              type: 'LISTENER_STATUS',
              action: 'STOP_LISTENING',
              broadcastId: currentBroadcastId,
              userId: currentUser?.id,
              userName: currentUser?.firstName || currentUser?.name || 'Anonymous',
              timestamp: Date.now()
            };
            wsRef.current.send(JSON.stringify(message));
            console.log('Sent listener stop message due to component unmount:', message);
          }
          
          // Remove event handlers first
          wsRef.current.onclose = null;
          wsRef.current.onerror = null;
          wsRef.current.onmessage = null;
          wsRef.current.onopen = null;
          
          wsRef.current.close(1000, 'Component unmounting');
        } catch (e) {
          console.warn('Error closing WebSocket during cleanup:', e);
        }
      }
    };
  }, [serverConfig]);

  // Send player status when playing state changes
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('Sent player status to server:', audioPlaying ? 'playing' : 'paused')
    }
  }, [audioPlaying])

  // Stream status checking from ListenerDashboard2.jsx
  useEffect(() => {
    if (!serverConfig) return

    const checkStatus = () => {
      // Skip polling if WebSocket is connected and working
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log('Skipping status poll - WebSocket is active')
        return
      }

      streamService.getStatus()
        .then(response => {
          console.log("Backend stream status:", response.data)

          if (response.data && response.data.data) {
            const statusData = response.data.data
            console.log('Stream status updated via HTTP:', statusData.live)
          }
        })
        .catch(error => {
          console.error('Error checking status:', error)
        })
    }

    // Initial check
    checkStatus()
    
    // Minimal polling since WebSocket handles real-time updates
    // Only check occasionally for server health when WebSocket isn't available
    statusCheckInterval.current = setInterval(checkStatus, 120000) // Check every 2 minutes instead of 30s

    return () => {
      if (statusCheckInterval.current) {
        clearInterval(statusCheckInterval.current)
      }
    }
  }, [serverConfig])

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      const newVolume = isMuted ? 0 : volume / 100
      audioRef.current.volume = newVolume
      console.log('Volume updated to:', newVolume)
    }
  }, [volume, isMuted])

  // Add this helper function at the top of the component
  const isAtBottom = (container) => {
    if (!container) return true;
    const { scrollTop, scrollHeight, clientHeight } = container;
    return Math.abs(scrollHeight - clientHeight - scrollTop) < 10;
  };

  // Function to scroll to bottom
  const scrollToBottom = () => {
    const container = chatContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  };

  // Fetch initial chat messages when broadcast becomes available
  useEffect(() => {
    // Guard: Only fetch if we have a valid broadcast ID
    if (!currentBroadcastId || currentBroadcastId <= 0) {
      setChatMessages([]); // Clear messages when no valid broadcast
      return;
    }

    const fetchChatMessages = async () => {
      try {
        // Cancel any previous request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        // Create new abort controller for this request
        abortControllerRef.current = new AbortController();

        // Clear old messages immediately when switching broadcasts
        setChatMessages([]);

        const response = await chatService.getMessages(currentBroadcastId);

        // Double-check that the response is for the current broadcast
        const newMessages = response.data.filter(msg => msg.broadcastId === currentBroadcastId);

        // Check if we're at the bottom before updating messages
        const container = chatContainerRef.current;
        const wasAtBottom = isAtBottom(container);

        // Update messages only if still the same broadcast
        if (currentBroadcastId === currentBroadcastId) {
          setChatMessages(newMessages);

          // Only scroll if user was already at the bottom
          if (wasAtBottom) {
            setTimeout(() => {
              if (container) {
                container.scrollTop = container.scrollHeight;
              }
            }, 100);
          }
        }
      } catch (error) {
        // Ignore aborted requests
        if (error.name === 'AbortError') {
          return;
        }
        console.error("Listener Dashboard: Error fetching chat messages:", error);
      }
    };

    fetchChatMessages();

    // Only use polling as fallback if WebSocket is not available AND not live
    // Remove polling since WebSocket should handle real-time updates
    // Keep only for development/debugging if needed

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setChatMessages([]);
    };
  }, [currentBroadcastId, isLive]);

  // Setup WebSocket connections for real-time updates after initial data is loaded
  // This replaces most HTTP polling with real-time WebSocket communication:
  // - Chat messages: Real-time via WebSocket
  // - Song requests: Real-time via WebSocket  
  // - Poll updates: Real-time via WebSocket
  // - Broadcast status: Real-time via WebSocket
  // - Listener count: Real-time via WebSocket
  useEffect(() => {
    // Guard: Only setup WebSockets if we have a valid broadcast ID and are live
    if (!currentBroadcastId || currentBroadcastId <= 0 || !isLive) {
      // Cleanup any existing connections when not live
      if (chatWsRef.current) {
        chatWsRef.current.disconnect();
        chatWsRef.current = null;
      }
      if (songRequestWsRef.current) {
        songRequestWsRef.current.disconnect();
        songRequestWsRef.current = null;
      }
      if (pollWsRef.current) {
        pollWsRef.current.disconnect();
        pollWsRef.current = null;
      }
      if (broadcastWsRef.current) {
        broadcastWsRef.current.disconnect();
        broadcastWsRef.current = null;
      }
      return;
    }

    console.log('Listener Dashboard: Setting up WebSocket connections for broadcast:', currentBroadcastId);

    // Setup Chat WebSocket
    const setupChatWebSocket = async () => {
      try {
        // Clean up any existing connection first
        if (chatWsRef.current) {
          console.log('Listener Dashboard: Cleaning up existing chat WebSocket');
          chatWsRef.current.disconnect();
          chatWsRef.current = null;
        }

        const connection = await chatService.subscribeToChatMessages(currentBroadcastId, (newMessage) => {
          // Double-check the message is for the current broadcast
          if (newMessage.broadcastId === currentBroadcastId) {
            setChatMessages(prev => {
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) {
                return prev;
              }

              const wasAtBottom = isAtBottom(chatContainerRef.current);
              const updated = [...prev, newMessage].sort((a, b) => 
                new Date(a.createdAt) - new Date(b.createdAt)
              );

              if (wasAtBottom) {
                setTimeout(scrollToBottom, 50);
              }

              return updated;
            });
          }
        });
        chatWsRef.current = connection;
        console.log('Listener Dashboard: Chat WebSocket connected successfully');
      } catch (error) {
        console.error('Listener Dashboard: Failed to connect chat WebSocket:', error);
      }
    };

    // Setup Song Request WebSocket
    const setupSongRequestWebSocket = async () => {
      try {
        // Clean up any existing connection first
        if (songRequestWsRef.current) {
          console.log('Listener Dashboard: Cleaning up existing song request WebSocket');
          songRequestWsRef.current.disconnect();
          songRequestWsRef.current = null;
        }

        const connection = await songRequestService.subscribeToSongRequests(currentBroadcastId, (newRequest) => {
          // Double-check the request is for the current broadcast
          if (newRequest.broadcastId === currentBroadcastId) {
            // You can add notification logic here if needed
          }
        });
        songRequestWsRef.current = connection;
        console.log('Listener Dashboard: Song request WebSocket connected successfully');
      } catch (error) {
        console.error('Listener Dashboard: Failed to connect song request WebSocket:', error);
      }
    };

    // Setup Poll WebSocket
    const setupPollWebSocket = async () => {
      try {
        // Clean up any existing connection first
        if (pollWsRef.current) {
          console.log('Listener Dashboard: Cleaning up existing poll WebSocket');
          pollWsRef.current.disconnect();
          pollWsRef.current = null;
        }

        const connection = await pollService.subscribeToPolls(currentBroadcastId, (data) => {
          console.log('Listener Dashboard: Received poll WebSocket message:', data);
          switch (data.type) {
            case 'NEW_POLL':
              if (data.poll && data.poll.isActive) {
                console.log('Listener Dashboard: New poll received:', data.poll);
                setActivePoll({
                  ...data.poll,
                  totalVotes: data.poll.options.reduce((sum, option) => sum + (option.votes || 0), 0),
                  userVoted: false
                });
                // Reset selection for new poll
                setSelectedPollOption(null);
              }
              break;

            case 'POLL_VOTE':
              // Handle real-time vote updates
              if (data.pollId === activePoll?.id && data.poll) {
                console.log('Listener Dashboard: Poll vote update received:', data.poll);
                setActivePoll(prev => prev ? {
                  ...prev,
                  options: data.poll.options || prev.options,
                  totalVotes: data.poll.totalVotes || (data.poll.options ? data.poll.options.reduce((sum, option) => sum + (option.votes || 0), 0) : prev.totalVotes)
                } : null);
              }
              break;

            case 'POLL_UPDATED':
              if (data.poll && !data.poll.isActive && activePoll?.id === data.poll.id) {
                console.log('Listener Dashboard: Poll ended:', data.poll);
                setActivePoll(null);
                setSelectedPollOption(null);
              }
              break;

            case 'POLL_RESULTS':
              if (data.pollId === activePoll?.id && data.results) {
                console.log('Listener Dashboard: Poll results update received:', data.results);
                setActivePoll(prev => prev ? {
                  ...prev,
                  options: data.results.options,
                  totalVotes: data.results.totalVotes
                } : null);
              }
              break;
              
            default:
              console.log('Listener Dashboard: Unknown poll message type:', data.type);
          }
        });
        pollWsRef.current = connection;
        console.log('Listener Dashboard: Poll WebSocket connected successfully');
      } catch (error) {
        console.error('Listener Dashboard: Failed to connect poll WebSocket:', error);
      }
    };

    // Setup Broadcast WebSocket for broadcast-level updates
    const setupBroadcastWebSocket = async () => {
      try {
        // Clean up any existing connection first
        if (broadcastWsRef.current) {
          console.log('Listener Dashboard: Cleaning up existing broadcast WebSocket');
          broadcastWsRef.current.disconnect();
          broadcastWsRef.current = null;
        }

        // Use the broadcast service from api.js
        const connection = await broadcastService.subscribeToBroadcastUpdates(currentBroadcastId, (message) => {
          
          switch (message.type) {
            case 'BROADCAST_STARTED':
              console.log('Stream started via WebSocket');
              break;
              
            case 'BROADCAST_ENDED':
              console.log('Stream ended via WebSocket');
              break;
              
            case 'LISTENER_COUNT_UPDATE':
              console.log('Listener count updated via WebSocket:', message.data?.listenerCount || 0);
              break;
              
            case 'BROADCAST_STATUS_UPDATE':
              console.log('Broadcast status updated via WebSocket:', message.broadcast.status === 'LIVE');
              break;
              
            case 'LISTENER_JOINED':
              // Update listener count if provided
              console.log('Listener joined via WebSocket:', message.data?.listenerCount !== undefined ? message.data.listenerCount : 0);
              break;
              
            case 'LISTENER_LEFT':
              // Update listener count if provided
              console.log('Listener left via WebSocket:', message.data?.listenerCount !== undefined ? message.data.listenerCount : 0);
              break;
              
            default:
              // Unknown message type - can be safely ignored
          }
        });
        
        broadcastWsRef.current = connection;
        console.log('Listener Dashboard: Broadcast WebSocket connected successfully');
      } catch (error) {
        console.error('Listener Dashboard: Failed to connect broadcast WebSocket:', error);
      }
    };

    // Setup WebSockets immediately - no delay needed with proper guards
    setupChatWebSocket();
    setupSongRequestWebSocket();
    setupPollWebSocket();
    setupBroadcastWebSocket();

    return () => {
      console.log('Listener Dashboard: Cleaning up WebSocket connections for broadcast:', currentBroadcastId);
      if (chatWsRef.current) {
        chatWsRef.current.disconnect();
        chatWsRef.current = null;
      }
      if (songRequestWsRef.current) {
        songRequestWsRef.current.disconnect();
        songRequestWsRef.current = null;
      }
      if (pollWsRef.current) {
        pollWsRef.current.disconnect();
        pollWsRef.current = null;
      }
      if (broadcastWsRef.current) {
        broadcastWsRef.current.disconnect();
        broadcastWsRef.current = null;
      }
    };
  }, [currentBroadcastId, isLive]); // Removed chatMessages.length and activePoll?.id dependencies to prevent unnecessary re-runs

  // Update chat timestamps every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setChatTimestampTick(prev => prev + 1);
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Update the scroll event listener
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setShowScrollBottom(!isAtBottom(container));
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle chat submission
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim() || !currentBroadcastId) return;

    // Validate message length
    if (chatMessage.length > 1500) {
      alert("Message cannot exceed 1500 characters");
      return;
    }

    const messageToSend = chatMessage.trim();
    setChatMessage(''); // Clear input immediately for better UX

    try {
      // Create message object to send to the server
      const messageData = {
        content: messageToSend
      };

      // Send message to the server
      await chatService.sendMessage(currentBroadcastId, messageData);

      // The WebSocket will handle adding the message to the UI
      // If WebSocket is not connected, fetch messages as fallback
      if (!chatWsRef.current || !chatWsRef.current.isConnected()) {
        const response = await chatService.getMessages(currentBroadcastId);
        setChatMessages(response.data);
      }

      // Always scroll to bottom after sending your own message
      scrollToBottom();
    } catch (error) {
      console.error("Error sending chat message:", error);
      if (error.response?.data?.message?.includes("1500 characters")) {
        alert("Message cannot exceed 1500 characters");
      } else {
        alert("Failed to send message. Please try again.");
      }
      setChatMessage(messageToSend); // Restore the message if sending failed
    }
  };

  // Check if a broadcast is live
  useEffect(() => {
    const checkBroadcastStatus = async () => {
      // Skip polling if WebSocket is connected and handling broadcast updates
      if (broadcastWsRef.current?.isConnected && broadcastWsRef.current.isConnected()) {
        console.log('Skipping broadcast status poll - WebSocket is handling updates')
        return
      }

      try {
        // If we have a target broadcast ID (from URL), use that
        if (targetBroadcastId && !isNaN(targetBroadcastId)) {
          try {
            // Fetch the specific broadcast
            const broadcastResponse = await broadcastService.getBroadcast(targetBroadcastId);
            const targetBroadcast = broadcastResponse.data;
            
            if (targetBroadcast) {
              setCurrentBroadcastId(targetBroadcast.id);
              setCurrentBroadcast(targetBroadcast);
              console.log("Target broadcast loaded:", targetBroadcast);
              return; // Exit early since we found our target broadcast
            }
          } catch (error) {
            console.error("Error fetching target broadcast:", error);
            // Continue to fetch live broadcasts as fallback
          }
        }
        
        // Fetch live broadcasts from API
        const response = await broadcastService.getLive();
        const liveBroadcasts = response.data;

        // If there are any live broadcasts, set isLive to true
        if (liveBroadcasts && liveBroadcasts.length > 0) {
          console.log("Live broadcast:", liveBroadcasts[0]);
          } else {
          console.log("No live broadcasts found");
        }
      } catch (error) {
        console.error("Error checking broadcast status:", error);
      }
    }

    // Initial check
    checkBroadcastStatus();
    
    // Very minimal polling since WebSocket handles all real-time broadcast updates
    // Only check occasionally for fallback scenarios or initial setup
    const interval = setInterval(checkBroadcastStatus, 600000); // Check every 10 minutes instead of 5 minutes

    return () => clearInterval(interval);
  }, [targetBroadcastId]); // Add targetBroadcastId as dependency

  // Fetch active polls for the current broadcast
  useEffect(() => {
    if (currentBroadcastId && isLive) {
      const fetchActivePolls = async () => {
        try {
          const response = await pollService.getActivePollsForBroadcast(currentBroadcastId);

          if (response.data && response.data.length > 0) {
            // Get the first active poll
            const activePoll = response.data[0];

            // Check if the user has already voted
            try {
              const hasVotedResponse = await pollService.hasUserVoted(activePoll.id);

              if (hasVotedResponse.data) {
                // User has voted, get their vote
                const userVoteResponse = await pollService.getUserVote(activePoll.id);
                setUserVotes(prev => ({ ...prev, [activePoll.id]: userVoteResponse.data }));

                // Get poll results
                const resultsResponse = await pollService.getPollResults(activePoll.id);

                // Combine poll data with results
                setActivePoll({
                  ...activePoll,
                  options: resultsResponse.data.options,
                  totalVotes: resultsResponse.data.totalVotes,
                  userVoted: true,
                  userVotedFor: userVoteResponse.data.optionId
                });
              } else {
                // User hasn't voted
                setActivePoll({
                  ...activePoll,
                  totalVotes: activePoll.options.reduce((sum, option) => sum + option.votes, 0),
                  userVoted: false
                });
              }
            } catch (error) {
              console.error("Error checking user vote:", error);
              setActivePoll({
                ...activePoll,
                totalVotes: activePoll.options.reduce((sum, option) => sum + option.votes, 0),
                userVoted: false
              });
            }
          } else {
            setActivePoll(null);
          }
        } catch (error) {
          console.error("Error fetching active polls:", error);
        }
      };

      fetchActivePolls();

      // Minimal polling since WebSocket handles all poll updates in real-time
      // Only check very occasionally as fallback
      const interval = setInterval(fetchActivePolls, 300000); // Check every 5 minutes instead of 1 minute

      return () => clearInterval(interval);
    } else {
      // Reset poll when no broadcast is live
      setActivePoll(null);
    }
  }, [currentBroadcastId, isLive]);

  // Toggle play/pause with enhanced logic from ListenerDashboard2.jsx
  const togglePlay = () => {
    console.log('Toggle play called, current state:', { 
      localAudioPlaying, 
      wsReadyState: wsRef.current?.readyState,
      audioRefExists: !!audioRef.current,
      serverConfigExists: !!serverConfig,
      streamUrl: serverConfig?.streamUrl
    })

    if (!audioRef.current || !serverConfig) {
      console.error('Audio player not ready:', {
        audioRefCurrent: !!audioRef.current,
        serverConfig: !!serverConfig,
        serverConfigStreamUrl: serverConfig?.streamUrl
      });
      setStreamError("Audio player not ready. Please wait...")
      return
    }

    try {
      if (localAudioPlaying) {
        console.log('Pausing playback')
        audioRef.current.pause()
        setLocalAudioPlaying(false); // Update local state
        console.log('Stream paused')
        
        // Notify server that listener stopped playing
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const message = {
            type: 'LISTENER_STATUS',
            action: 'STOP_LISTENING',
            broadcastId: currentBroadcastId,
            userId: currentUser?.id,
            userName: currentUser?.firstName || currentUser?.name || 'Anonymous',
            timestamp: Date.now()
          };
          wsRef.current.send(JSON.stringify(message));
          console.log('Sent listener stop message to server:', message);
        }
      } else {
        console.log('Starting playback')
        const currentSrc = audioRef.current.src
        const expectedSrc = serverConfig.streamUrl.startsWith('http') 
          ? serverConfig.streamUrl 
          : `http://${serverConfig.streamUrl}`

        if (!currentSrc || currentSrc !== expectedSrc || currentSrc.includes('localhost:5173') || currentSrc.startsWith('blob:') || currentSrc === 'about:blank') {
          console.log('Setting new stream URL:', expectedSrc)
          audioRef.current.src = expectedSrc
          audioRef.current.load()
        }

        let playPromise
        try {
          playPromise = audioRef.current.play()
          console.log('Play method called')
        } catch (playError) {
          console.error('Error calling play method:', playError)
          setStreamError(`Error starting playback: ${playError.message}`)
          return
        }

        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('Playback started successfully')
              setLocalAudioPlaying(true); // Update local state
              console.log('Stream playing')
              setStreamError(null)
              
              // Notify server that listener started playing
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                if (!currentUser) {
                  console.warn('No current user available for listener status message');
                }
                const message = {
                  type: 'LISTENER_STATUS',
                  action: 'START_LISTENING',
                  broadcastId: currentBroadcastId,
                  userId: currentUser?.id,
                  userName: currentUser?.firstName || currentUser?.name || 'Anonymous',
                  timestamp: Date.now()
                };
                wsRef.current.send(JSON.stringify(message));
                console.log('Sent listener start message to server:', message);
              }
            })
            .catch(error => {
              console.error("Playback failed:", error)

              if (error.name === 'NotAllowedError') {
                setStreamError("Browser blocked autoplay. Please click play again to start listening.")
              } else if (error.name === 'NotSupportedError') {
                setStreamError("Your browser doesn't support this audio format. Try refreshing or use a different browser.")
              } else if (error.name === 'AbortError') {
                setStreamError("Playback was interrupted. Please try again.")
              } else {
                setStreamError(`Playback failed: ${error.message}. Please check if the stream is live.`)
              }
              setLocalAudioPlaying(false); // Update local state on error
              console.log('Stream paused')
              
              // Notify server that listener stopped playing due to error
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                const message = {
                  type: 'LISTENER_STATUS',
                  action: 'STOP_LISTENING',
                  broadcastId: currentBroadcastId,
                  userId: currentUser?.id,
                  userName: currentUser?.firstName || currentUser?.name || 'Anonymous',
                  timestamp: Date.now()
                };
                wsRef.current.send(JSON.stringify(message));
                console.log('Sent listener stop message to server (due to error):', message);
              }
            })
        } else {
          console.warn('Play promise is undefined, cannot track playback status')
        }
      }
    } catch (error) {
      console.error("Error toggling playback:", error)
      setStreamError(`Playback error: ${error.message}. Please try again.`)
    }
  }

  // Handle song request submission
  const handleSongRequestSubmit = async (e) => {
    e.preventDefault();
    if (!songRequest.title.trim() || !songRequest.artist.trim() || !currentBroadcastId) return;

    try {
      // Create song request object to send to the server
      const requestData = {
        songTitle: songRequest.title,
        artist: songRequest.artist,
        dedication: songRequest.dedication
      };

      // Send song request to the server
      await songRequestService.createRequest(currentBroadcastId, requestData);

      // Show success message
      alert(`Song request submitted: "${songRequest.title}" by ${songRequest.artist}`);

      // Reset the form
      setSongRequest({ title: '', artist: '', dedication: '' });
    } catch (error) {
      console.error("Error submitting song request:", error);
      alert("Failed to submit song request. Please try again.");
    }
  };

  // Handle poll option selection
  const handlePollOptionSelect = (optionId) => {
    if (!activePoll || activePoll.userVoted || !isLive) return;
    setSelectedPollOption(optionId);
  };

  // Handle poll vote submission
  const handlePollVote = async () => {
    if (!activePoll || !selectedPollOption || activePoll.userVoted || !isLive) return;

    try {
      setPollLoading(true);

      // Send vote to backend
      const voteData = {
        pollId: activePoll.id,
        optionId: selectedPollOption
      };

      await pollService.vote(activePoll.id, voteData);

      // Get updated poll results
      const resultsResponse = await pollService.getPollResults(activePoll.id);

      // Update user vote
      const userVoteResponse = await pollService.getUserVote(activePoll.id);
      setUserVotes(prev => ({ ...prev, [activePoll.id]: userVoteResponse.data }));

      // Update current poll with results
      setActivePoll(prev => ({
        ...prev,
        options: resultsResponse.data.options,
        totalVotes: resultsResponse.data.totalVotes,
        userVoted: true,
        userVotedFor: selectedPollOption
      }));

      // Reset selection
      setSelectedPollOption(null);

    } catch (error) {
      console.error("Error submitting vote:", error);
      alert("Failed to submit vote. Please try again.");
    } finally {
      setPollLoading(false);
    }
  };

  // Render chat messages
  const renderChatMessages = () => (
    <div className="max-h-60 overflow-y-auto space-y-3 mb-4 chat-messages-container custom-scrollbar" ref={chatContainerRef}>
      {chatMessages.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400 py-4">No messages yet</p>
      ) : (
        chatMessages
          .slice()
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
          .map((msg) => {
            // Ensure we have valid message data
            if (!msg || !msg.sender) {
              console.log('Listener Dashboard: Skipping invalid message:', msg);
              return null;
            }

            // Check if the message is from a DJ
            const isDJ = msg.sender && msg.sender.name && msg.sender.name.includes("DJ");
            const senderName = msg.sender.name || 'Unknown User';
            const initials = senderName.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2);

            // Handle date parsing more robustly
            let messageDate;
            try {
              messageDate = msg.createdAt ? new Date(msg.createdAt.endsWith('Z') ? msg.createdAt : msg.createdAt + 'Z') : null;
            } catch (error) {
              console.error('Listener Dashboard: Error parsing message date:', error);
              messageDate = new Date();
            }

            // Format relative time (updated every minute due to chatTimestampTick)
            const timeAgo = messageDate && !isNaN(messageDate.getTime()) 
              ? formatDistanceToNow(messageDate, { addSuffix: false }) 
              : 'Just now';

            // Format the timeAgo to match the requested format (e.g., "2 minutes ago" -> "2 min ago")
            const formattedTimeAgo = timeAgo
              .replace(' seconds', ' sec')
              .replace(' second', ' sec')
              .replace(' minutes', ' min')
              .replace(' minute', ' min')
              .replace(' hours', ' hour')
              .replace(' days', ' day')
              .replace(' months', ' month')
              .replace(' years', ' year');

            return (
              <div
                key={msg.id}
                className="mb-3"
              >
                <div className="flex items-center mb-1">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs text-white font-medium ${isDJ ? 'bg-maroon-600' : 'bg-gray-500'}`}>
                    {isDJ ? 'DJ' : initials}
                  </div>
                  <div className="ml-2">
                    <span className="font-medium text-sm text-gray-900 dark:text-white">{senderName}</span>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formattedTimeAgo} ago
                    </div>
                  </div>
                </div>
                <div className={`rounded-lg p-3 ml-8 ${isDJ ? 'bg-maroon-100 dark:bg-maroon-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{msg.content || 'No content'}</p>
                </div>
              </div>
            );
          })
          .filter(Boolean)
      )}
    </div>
  );

  // Render chat input
  const renderChatInput = () => (
    <form onSubmit={handleChatSubmit} className="flex items-center">
      <input
        type="text"
        value={chatMessage}
        onChange={(e) => {
          // Limit input to 1500 characters
          if (e.target.value.length <= 1500) {
            setChatMessage(e.target.value);
          }
        }}
        placeholder="Type your message..."
        className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-l-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
        disabled={!isLive}
        maxLength={1500}
      />
      <button
        type="submit"
        disabled={!isLive || !chatMessage.trim() || chatMessage.length > 1500}
        className={`p-2 rounded-r-md ${
          isLive && chatMessage.trim() && chatMessage.length <= 1500
            ? "bg-maroon-700 hover:bg-maroon-800 text-white"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
        }`}
      >
        <PaperAirplaneIcon className="h-5 w-5" />
      </button>
    </form>
  );

  return (
    <div className="container mx-auto px-4 pb-6 bg-gray-100 dark:bg-gray-900">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 pt-6">Broadcast Stream</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content area - left 2/3 */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="bg-maroon-700 rounded-lg overflow-hidden mb-6 h-[200px] flex flex-col justify-center relative">
            {/* Live indicator */}
            <div className="absolute top-4 left-4 z-10">
              {isLive ? (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-600 text-white">
                  <span className="h-2 w-2 rounded-full bg-white mr-1 animate-pulse"></span>
                  LIVE ({Math.max(listenerCount, localListenerCount)} listeners)
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-600 text-white">
                  OFF AIR
                </span>
              )}
            </div>

            {/* Stream Error Display */}
            {streamError && (
              <div className="absolute top-12 left-4 right-4 p-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200 rounded-md text-xs">
                {streamError}
              </div>
            )}

            {isLive ? (
              <>
                <div className="flex p-4">
                  {/* Album art / Left section */}
                  <div className="w-24 h-24 bg-maroon-800 flex items-center justify-center text-white text-2xl rounded-lg">
                    $
                  </div>

                  {/* Track info */}
                  <div className="ml-4 text-white">
                    <h3 className="text-xl font-bold">{currentBroadcast?.title || "Loading..."}</h3>
                    <p className="text-sm opacity-80">
                      {currentBroadcast?.host?.name 
                        ? `Hosted by ${currentBroadcast.host.name}` 
                        : currentBroadcast?.dj?.name 
                          ? `Hosted by ${currentBroadcast.dj.name}`
                          : "Loading..."}
                    </p>

                    <div className="mt-4">
                      <p className="text-xs uppercase opacity-60">NOW PLAYING</p>
                      {currentSong ? (
                        <>
                          <p className="text-sm font-medium">{currentSong.title}</p>
                          <p className="text-xs opacity-70">{currentSong.artist}</p>
                        </>
                      ) : (
                        <p className="text-sm opacity-70">No track information available</p>
                      )}
                    </div>
                  </div>

                  {/* Play/Pause and Refresh Controls */}
                  <div className="ml-auto flex flex-col items-center justify-center space-y-2">
                    <button
                      onClick={togglePlay}
                      disabled={!serverConfig}
                      className={`p-3 rounded-full ${
                        !serverConfig
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : localAudioPlaying
                          ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                          : 'bg-green-100 text-green-800 hover:bg-green-200'
                      }`}
                      aria-label={localAudioPlaying ? 'Pause' : 'Play'}
                    >
                      {localAudioPlaying ? (
                        <PauseIcon className="h-6 w-6" />
                      ) : (
                        <PlayIcon className="h-6 w-6" />
                      )}
                    </button>

                    <button
                      onClick={refreshStream}
                      className="p-2 text-white hover:text-gray-300"
                      aria-label="Refresh Stream"
                    >
                      <ArrowPathIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Volume control */}
                <div className="flex items-center px-4 py-3">
                  <button onClick={handleMuteToggle} className="text-white mr-2">
                    {isMuted ? (
                      <SpeakerXMarkIcon className="h-5 w-5" />
                    ) : (
                      <SpeakerWaveIcon className="h-5 w-5" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="ml-2 text-white text-xs w-7 text-right">{volume}%</div>
                </div>
              </>
            ) : (
              <div className="text-center text-white">
                <h2 className="text-2xl font-bold mb-3">WildCats Radio</h2>
                <p className="mb-2">No broadcast currently active</p>
                {nextBroadcast ? (
                  <p className="text-sm opacity-70">
                    Next broadcast: {nextBroadcast.title} on {nextBroadcast.date} at {nextBroadcast.time}
                  </p>
                ) : (
                  <p className="text-sm opacity-70">No upcoming broadcasts scheduled</p>
                )}
              </div>
            )}
          </div>

          {/* Interactive section tabs */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex-grow">
            {/* Tab headers */}
            <div className="flex">
              <button
                onClick={() => setActiveTab("song")}
                className={`flex-1 py-3 px-4 text-center text-sm font-medium ${
                  activeTab === "song"
                    ? "border-b-2 border-maroon-700 text-maroon-700 dark:border-maroon-500 dark:text-maroon-400"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 border-b border-gray-200 dark:border-gray-700"
                }`}
              >
                <div className="flex justify-center items-center">
                  <MusicalNoteIcon className="h-5 w-5 mr-2" />
                  Song Request
                </div>
              </button>
              <button
                onClick={() => setActiveTab("poll")}
                className={`flex-1 py-3 px-4 text-center text-sm font-medium ${
                  activeTab === "poll"
                    ? "border-b-2 border-maroon-700 text-maroon-700 dark:border-maroon-500 dark:text-maroon-400"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 border-b border-gray-200 dark:border-gray-700"
                }`}
              >
                <div className="flex justify-center items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  Poll
                </div>
              </button>
            </div>

            {/* Tab content */}
            <div className="bg-white dark:bg-gray-800 flex-grow flex flex-col h-[450px]">
              {/* Song Request Tab */}
              {activeTab === "song" && (
                <div className="p-6 flex-grow flex flex-col h-full">
                  {isLive ? (
                    <form onSubmit={handleSongRequestSubmit} className="space-y-5 flex-grow flex flex-col">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Song Title
                        </label>
                        <input
                          type="text"
                          value={songRequest.title}
                          onChange={(e) => setSongRequest({ ...songRequest, title: e.target.value })}
                          placeholder="Enter song title"
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Artist
                        </label>
                        <input
                          type="text"
                          value={songRequest.artist}
                          onChange={(e) => setSongRequest({ ...songRequest, artist: e.target.value })}
                          placeholder="Enter artist name"
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          required
                        />
                      </div>

                      <div className="flex-grow">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Dedication (Optional)
                        </label>
                        <textarea
                          value={songRequest.dedication}
                          onChange={(e) => setSongRequest({ ...songRequest, dedication: e.target.value })}
                          placeholder="Add a message or dedication"
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white h-full min-h-[120px]"
                        />
                      </div>

                      <div className="mt-auto flex justify-between items-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Song requests are subject to availability and DJ's playlist.
                        </p>
                        <button
                          type="submit"
                          className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium py-2 px-6 rounded"
                        >
                          Submit Request
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center w-full">
                        <div className="flex items-center mb-8 justify-center">
                          <div className="bg-pink-100 dark:bg-maroon-900/30 rounded-full p-3 mr-4">
                            <MusicalNoteIcon className="h-6 w-6 text-maroon-600 dark:text-maroon-400" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white text-lg">Request a Song</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Let us know what you'd like to hear next</p>
                          </div>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400">Song requests are only available during live broadcasts</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Poll Tab */}
              {activeTab === "poll" && (
                <div className="p-6 flex-grow flex flex-col h-full">
                  {isLive ? (
                    <>
                      {pollLoading && !activePoll ? (
                        <div className="text-center py-8 flex-grow flex items-center justify-center">
                          <p className="text-gray-500 dark:text-gray-400 animate-pulse">Loading polls...</p>
                        </div>
                      ) : activePoll ? (
                        <div className="flex-grow flex flex-col">
                          {/* Poll Question */}
                          <div className="mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                              {activePoll.question || activePoll.title}
                            </h3>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {activePoll.userVoted ? 'You have voted' : 'Choose your answer and click Vote'}
                            </div>
                          </div>

                          {/* Poll Options */}
                          <div className="space-y-3 mb-6 flex-grow">
                            {activePoll.options.map((option) => {
                              const percentage = activePoll.userVoted 
                                ? Math.round((option.votes / activePoll.totalVotes) * 100) || 0 
                                : 0;
                              const isSelected = selectedPollOption === option.id;
                              const isUserChoice = activePoll.userVotedFor === option.id;
                              
                              return (
                                <div key={option.id} className="space-y-1">
                                  <div 
                                    className={`w-full border-2 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${
                                      activePoll.userVoted 
                                        ? isUserChoice
                                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                          : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700'
                                        : isSelected
                                          ? 'border-maroon-500 bg-maroon-50 dark:bg-maroon-900/20'
                                          : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-maroon-300'
                                    }`}
                                    onClick={() => !activePoll.userVoted && handlePollOptionSelect(option.id)}
                                  >
                                    <div className="p-3">
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                                          {option.optionText || option.text}
                                        </span>
                                        <div className="flex items-center">
                                          {activePoll.userVoted && (
                                            <span className="text-xs text-gray-600 dark:text-gray-400 mr-2">
                                              {option.votes || 0} votes
                                            </span>
                                          )}
                                          {isSelected && !activePoll.userVoted && (
                                            <div className="w-4 h-4 bg-maroon-500 rounded-full flex items-center justify-center">
                                              <div className="w-2 h-2 bg-white rounded-full"></div>
                                            </div>
                                          )}
                                          {isUserChoice && activePoll.userVoted && (
                                            <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                              </svg>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      
                                      {/* Progress bar for voted polls */}
                                      {activePoll.userVoted && (
                                        <div className="mt-2">
                                          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                            <div 
                                              className={`h-2 rounded-full transition-all duration-300 ${
                                                isUserChoice ? 'bg-green-500' : 'bg-gray-400'
                                              }`}
                                      style={{ width: `${percentage}%` }}
                                            />
                                          </div>
                                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                      {percentage}%
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Vote Button */}
                          <div className="mt-auto flex justify-center">
                            {activePoll.userVoted ? (
                              <div className="text-center">
                                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                  Total votes: {activePoll.totalVotes || 0}
                                </div>
                                <span className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded-lg">
                                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                  You have voted
                                </span>
                              </div>
                            ) : (
                            <button
                                onClick={handlePollVote}
                                disabled={!selectedPollOption || pollLoading}
                                className={`px-8 py-2 rounded-lg font-medium transition-colors ${
                                  selectedPollOption && !pollLoading
                                    ? 'bg-yellow-500 hover:bg-yellow-600 text-black' 
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                              >
                                {pollLoading ? 'Voting...' : 'Vote'}
                            </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 flex-grow flex items-center justify-center">
                          <div>
                            <p className="text-gray-500 dark:text-gray-400 mb-2">No active polls</p>
                            <p className="text-sm text-gray-400 dark:text-gray-500">Active polls will appear during live broadcasts</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center w-full">
                        <div className="mb-8">
                          <h3 className="text-xl font-medium text-gray-900 dark:text-white">Vote</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">selects which you prefer the most?</p>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400">Polls are only available during live broadcasts</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live chat section - right 1/3 */}
        <div className="lg:col-span-1 flex flex-col">
          <div className="bg-maroon-700 text-white p-3 rounded-t-lg">
            <h3 className="font-medium">Live Chat</h3>
            <p className="text-xs opacity-70">{Math.max(listenerCount, localListenerCount)} listeners online</p>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-lg flex-grow flex flex-col h-[494px]">
            {isLive ? (
              <>
                <div 
                  ref={chatContainerRef}
                  className="flex-grow overflow-y-auto p-4 space-y-4 chat-messages-container relative"
                >
                  {chatMessages.map((msg) => {
                    const isDJ = msg.sender && msg.sender.name.includes("DJ");
                    const initials = msg.sender.name.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2);

                    // Parse the createdAt timestamp from the backend
                    let messageDate;
                    try {
                      messageDate = msg.createdAt ? new Date(msg.createdAt.endsWith('Z') ? msg.createdAt : msg.createdAt + 'Z') : null;
                    } catch (error) {
                      console.error('Error parsing message date:', error);
                      messageDate = new Date();
                    }

                    // Format relative time (updated every minute due to chatTimestampTick)
                    const timeAgo = messageDate && !isNaN(messageDate.getTime()) 
                      ? formatDistanceToNow(messageDate, { addSuffix: false }) 
                      : 'Just now';

                    // Format the timeAgo to match the requested format (e.g., "2 minutes ago" -> "2 min ago")
                    const formattedTimeAgo = timeAgo
                      .replace(' seconds', ' sec')
                      .replace(' second', ' sec')
                      .replace(' minutes', ' min')
                      .replace(' minute', ' min')
                      .replace(' hours', ' hour')
                      .replace(' days', ' day')
                      .replace(' months', ' month')
                      .replace(' years', ' year');

                    return (
                      <div key={msg.id} className="mb-4">
                        <div className="flex items-center mb-1">
                          <div className={`h-8 w-8 min-w-[2rem] rounded-full flex items-center justify-center text-xs text-white font-medium ${isDJ ? 'bg-maroon-600' : 'bg-gray-500'}`}>
                            {isDJ ? 'DJ' : initials}
                          </div>
                          <div className="ml-2 overflow-hidden">
                            <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{msg.sender.name}</span>
                          </div>
                        </div>
                        <div className="ml-10 space-y-1">
                          <div className={`rounded-lg p-3 message-bubble ${isDJ ? 'bg-maroon-100 dark:bg-maroon-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                            <p className="text-sm text-gray-800 dark:text-gray-200 chat-message" style={{ wordBreak: 'break-word', wordWrap: 'break-word', overflowWrap: 'break-word', maxWidth: '100%' }}>{msg.content}</p>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 pl-1">
                            {formattedTimeAgo} ago
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Scroll to bottom button */}
                {showScrollBottom && (
                  <div className="absolute bottom-20 right-4">
                    <button
                      onClick={scrollToBottom}
                      className="bg-maroon-600 hover:bg-maroon-700 text-white rounded-full p-2.5 shadow-lg transition-all duration-200 ease-in-out flex items-center justify-center"
                      aria-label="Scroll to bottom"
                    >
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-5 w-5" 
                        viewBox="0 0 20 20" 
                        fill="currentColor"
                      >
                        <path 
                          fillRule="evenodd" 
                          d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L10 15.586l5.293-5.293a1 1 0 011.414 0z" 
                          clipRule="evenodd" 
                        />
                      </svg>
                    </button>
                  </div>
                )}

                <div className="p-2 border-t border-gray-200 dark:border-gray-700 mt-auto">
                  <form onSubmit={handleChatSubmit} className="flex flex-col">
                    <div className="flex mb-1">
                      <input
                        type="text"
                        value={chatMessage}
                        onChange={(e) => {
                          // Limit input to 1500 characters
                          if (e.target.value.length <= 1500) {
                            setChatMessage(e.target.value);
                          }
                        }}
                        placeholder="Type your message..."
                        className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-l-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white max-w-full"
                        maxLength={1500}
                      />
                      <button
                        type="submit"
                        disabled={!chatMessage.trim() || chatMessage.length > 1500}
                        className={`${
                          !chatMessage.trim() || chatMessage.length > 1500
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-maroon-700 hover:bg-maroon-800 dark:bg-maroon-600'
                        } text-white p-2 rounded-r-md flex-shrink-0`}
                      >
                        <PaperAirplaneIcon className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className={`${
                        chatMessage.length > 1500 ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {chatMessage.length}/1500 characters
                      </span>
                      {chatMessage.length > 1500 && (
                        <span className="text-red-500">Message too long</span>
                      )}
                    </div>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-gray-500 dark:text-gray-400">Chat is only available during live broadcasts</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Debug/Network Information - Hidden but available */}
      {serverConfig && false && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
              Debug Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Server IP:</span>
                <code className="ml-2 text-gray-900 dark:text-white">{serverConfig.serverIp}</code>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Icecast Port:</span>
                <code className="ml-2 text-gray-900 dark:text-white">{serverConfig.icecastPort}</code>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Current Listeners:</span>
                <code className="ml-2 text-gray-900 dark:text-white">{listenerCount}</code>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Connection:</span>
                <code className="ml-2 text-gray-900 dark:text-white">
                  {wsRef.current?.readyState === 1 ? 'WebSocket Active' : 'Polling Mode'}
                </code>
              </div>
              <div className="md:col-span-2">
                <span className="font-medium text-gray-700 dark:text-gray-300">Stream URL:</span>
                <code className="ml-2 text-gray-900 dark:text-white">{serverConfig.streamUrl}</code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}