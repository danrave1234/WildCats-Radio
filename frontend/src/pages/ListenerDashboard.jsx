"use client"

import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Send,
  Music,
  RefreshCcw,
  UserPlus,
  LogIn,
  AlertTriangle,
  Mic,
  Vote,
  ArrowDown,
  MessageSquare,
  Crown,
  Eye,
  EyeOff,
} from "lucide-react";
import { broadcastService, chatService, songRequestService, pollService, streamService } from "../services/api";
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from "../context/AuthContext";
import { useStreaming } from "../context/StreamingContext";
import { useLocalBackend, config } from "../config";
import { createLogger } from "../services/logger";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Slider } from "../components/ui/slider";
import { Progress } from "../components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/utils";
import { ScrollArea } from "../components/ui/scroll-area";

const logger = createLogger('ListenerDashboard');

export default function ListenerDashboard() {
  const { id: broadcastIdParam } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isSpecificBroadcast = location.pathname.startsWith('/broadcast/');
  const [forceShowLive, setForceShowLive] = useState(false);

  // Get streaming context
  const { 
    isLive,
    audioPlaying,
    volume,
    isMuted,
    listenerCount,
    toggleAudio,
    updateVolume,
    toggleMute,
    serverConfig
  } = useStreaming();

  // If we're accessing a specific broadcast by ID, set it as the current broadcast
  const targetBroadcastId = isSpecificBroadcast && broadcastIdParam ? parseInt(broadcastIdParam, 10) : null;
  const [streamError, setStreamError] = useState(null);
    // Filter function to prevent showing audio playback errors
    const setFilteredStreamError = (error) => {
      if (error && typeof error === 'string' && 
          (error.includes('Audio playback error') || 
           error.includes('MEDIA_ELEMENT_ERROR') || 
           error.includes('Empty src attribute'))) {
        // Don't set the error if it's an audio playback error
        logger.debug('Suppressing audio playback error message:', error);
        return;
      }
      setStreamError(error);
    };

  // Original states from ListenerDashboard.jsx
  const [nextBroadcast, setNextBroadcast] = useState(null);
  const [currentBroadcastId, setCurrentBroadcastId] = useState(null);
  const [currentBroadcast, setCurrentBroadcast] = useState(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatMessage, setChatMessage] = useState('');

  // Song request state
  const [songRequest, setSongRequest] = useState({ title: '', artist: '' });
  const [songRequestLoading, setSongRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState(null);

  // Poll state
  const [activePoll, setActivePoll] = useState(null);
  const [userVotes, setUserVotes] = useState({});

  // UI state
  const [activeTab, setActiveTab] = useState("song");
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [_currentSong, _setCurrentSong] = useState(null);

  // Local audio state for the dashboard player (separate from streaming context)
  const [localAudioPlaying, setLocalAudioPlaying] = useState(false);

  // Local listener count state (fallback if streaming context doesn't update)
  const [localListenerCount, setLocalListenerCount] = useState(0);

  // Poll selection state
  const [selectedPollOption, setSelectedPollOption] = useState(null);

  // Missing pollLoading state
  const [pollLoading, setPollLoading] = useState(false);

  // Chat timestamp update state
  const [_chatTimestampTick, _setChatTimestampTick] = useState(0);

  // WebSocket connection status
  const [wsConnected, setWsConnected] = useState(false);

  // WebSocket references for interactions
  const chatWsRef = useRef(null);
  const songRequestWsRef = useRef(null);
  const pollWsRef = useRef(null);
  const broadcastWsRef = useRef(null);
  const globalBroadcastWsRef = useRef(null); // For general broadcast status updates

  // UI refs
  const chatContainerRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Audio refs from ListenerDashboard2.jsx
  const audioRef = useRef(null);
  const statusCheckInterval = useRef(null);
  const wsRef = useRef(null);
  const wsConnectingRef = useRef(false);
  const heartbeatInterval = useRef(null);

  // Navigation functions
  const handleLoginRedirect = () => {
    navigate('/login');
  };

  const handleRegisterRedirect = () => {
    navigate('/register');
  };

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
        logger.error('Error fetching broadcast information:', error);
        setFilteredStreamError('Failed to load broadcast information');
      }
    };

    fetchCurrentBroadcast();
  }, [targetBroadcastId]);

  // Handle play/pause
  const handlePlayPause = () => {
    try {
      toggleAudio();
    } catch (error) {
      logger.error('Error toggling audio:', error);
      setFilteredStreamError('Failed to control audio playback');
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
            logger.error('Error restarting playback:', error);
            setFilteredStreamError('Failed to restart playback. Please try again.');
          });
        }
      }, 100);
    }
  };

  // Initialize audio element when serverConfig is available
  useEffect(() => {
    logger.debug('Audio initialization useEffect called:', {
      serverConfigExists: !!serverConfig,
      audioRefCurrentExists: !!audioRef.current,
      streamUrl: serverConfig?.streamUrl
    });

    if (!audioRef.current) {
      logger.debug('Initializing audio element');
      audioRef.current = new Audio();
      audioRef.current.preload = 'none';
      audioRef.current.volume = isMuted ? 0 : volume / 100;

      // Always set a valid source - use config.icecastUrl as fallback
      const streamUrl = serverConfig?.streamUrl || config.icecastUrl;
      audioRef.current.src = streamUrl;
      logger.debug('Set initial audio source to:', streamUrl);

      // Add event listeners for audio events
      audioRef.current.onloadstart = () => logger.debug('Audio loading started');
      audioRef.current.oncanplay = () => logger.debug('Audio can start playing');
      audioRef.current.onplay = () => logger.debug('Audio play event fired');
      audioRef.current.onpause = () => logger.debug('Audio pause event fired');
      audioRef.current.onerror = (e) => {
        // Always ignore empty src attribute errors as they're expected
        const isEmptySrcError = 
          e.target?.error?.code === 4 && 
          e.target?.error?.message?.includes('Empty src attribute');

        // Ignore MEDIA_ELEMENT_ERROR errors completely
        if (isEmptySrcError || e.target?.error?.message?.includes('MEDIA_ELEMENT_ERROR')) {
          logger.debug('Ignoring expected error before playback starts:', e.target?.error?.message);
          return;
        }

        // Only log and show error for other types of errors
        logger.error('Audio error:', e);
        logger.error('Audio error details:', {
          error: e.target?.error,
          code: e.target?.error?.code,
          message: e.target?.error?.message,
          networkState: e.target?.networkState,
          readyState: e.target?.readyState,
          src: e.target?.src
        });
        // Don't set stream error message as requested
      };
    }

    // Update src if serverConfig changes and audioRef already exists
    if (serverConfig?.streamUrl && audioRef.current) {
      audioRef.current.src = serverConfig.streamUrl;
      logger.debug('Updated audio source to:', serverConfig.streamUrl);
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
      logger.debug(`Delaying WebSocket connection by ${connectionDelay}ms (attempt ${wsConnectionAttemptCount})`);

      reconnectTimer = setTimeout(() => {
        isReconnecting = true;
        wsConnectingRef.current = true;

        // Use secure WebSocket protocol (wss) when connecting to a remote server
        // Use ws only if both frontend and backend are on localhost
        const wsBaseUrl = config.wsBaseUrl;
        const cleanHost = wsBaseUrl.replace(/^(https?:\/\/|wss?:\/\/)/, '');
        const isLocalBackend = cleanHost.includes('localhost') || cleanHost.includes('127.0.0.1');
        const wsProtocol = isLocalBackend && window.location.hostname === 'localhost' ? 'ws' : 'wss';

      // Get JWT token for authentication
      const getCookie = (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
        return null;
      };

      const token = getCookie('token');
      const listenerWsUrl = `${wsProtocol}://${cleanHost}/ws/listener${token ? `?token=${encodeURIComponent(token)}` : ''}`;

      logger.debug('Using WebSocket URL:', listenerWsUrl.replace(/token=[^&]*/, 'token=***'));

      try {
          logger.debug('Listener Dashboard connecting to WebSocket with authentication');

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
              logger.warn('Error closing existing WebSocket:', e);
          }
        }

          // Create new connection with authentication
          wsInstance = new WebSocket(listenerWsUrl);
          wsRef.current = wsInstance;

          // Set up event handlers
        wsInstance.onopen = () => {
            logger.info('WebSocket connected for listener updates');
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
                    userId: currentUser?.id || null,
                    userName: currentUser?.firstName || currentUser?.name || 'Anonymous Listener',
                    timestamp: Date.now()
                  };
                  wsRef.current.send(JSON.stringify(message));
                  logger.debug('Sent initial listener status on WebSocket connect: listening', message);
                } else {
                  logger.debug('WebSocket connected but not currently listening');
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
                    userId: currentUser?.id || null,
                    userName: currentUser?.firstName || currentUser?.name || 'Anonymous Listener',
                    timestamp: Date.now()
                  };
                  wsRef.current.send(JSON.stringify(message));
                  logger.debug('Heartbeat: Sent listener status (listening)', message);
                }
              }
            }, 15000);
          };

        wsInstance.onmessage = (event) => {
          try {
              const data = JSON.parse(event.data);
              logger.debug('WebSocket message received:', data);

            if (data.type === 'STREAM_STATUS') {
                logger.debug('ListenerDashboard: Stream status updated via WebSocket:', data.isLive);

                // Update local listener count if provided
                if (data.listenerCount !== undefined) {
                  logger.debug('ListenerDashboard: Updating listener count to:', data.listenerCount);
                  setLocalListenerCount(data.listenerCount);
                }
            }
          } catch (error) {
              logger.error('Error parsing WebSocket message:', error);
          }
          };

        wsInstance.onclose = (event) => {
            logger.info(`WebSocket disconnected with code ${event.code}, reason: ${event.reason}`);
            isReconnecting = false;
            wsConnectingRef.current = false;

          if (heartbeatInterval.current) {
              clearInterval(heartbeatInterval.current);
              heartbeatInterval.current = null;
            }

            // Only reconnect on unexpected close and if we haven't exceeded max attempts
            if (event.code !== 1000 && event.code !== 1001 && wsConnectionAttemptCount < MAX_CONNECTION_ATTEMPTS) {
              logger.debug(`Attempting to reconnect WebSocket in ${3000 * wsConnectionAttemptCount}ms (attempt ${wsConnectionAttemptCount})`);
              reconnectTimer = setTimeout(connectWebSocket, 3000 * wsConnectionAttemptCount);
            } else if (wsConnectionAttemptCount >= MAX_CONNECTION_ATTEMPTS) {
              logger.warn(`Maximum connection attempts (${MAX_CONNECTION_ATTEMPTS}) reached. Stopping reconnection attempts.`);
            }
          };

        wsInstance.onerror = (error) => {
            logger.error('WebSocket error:', error);
            // Don't set isReconnecting to false here, let onclose handle it
          };
      } catch (error) {
          logger.error('Error creating WebSocket:', error);
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
      logger.debug('Listener Dashboard: Cleaning up WebSocket connections for broadcast:', currentBroadcastId);

      // Reset WebSocket connection status
      setWsConnected(false);

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
  }, [currentBroadcastId]); // Removed isLive dependency and unnecessary dependencies to prevent unnecessary re-runs

  // Send player status when playing state changes
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      logger.debug('Sent player status to server:', audioPlaying ? 'playing' : 'paused')
    }
  }, [audioPlaying])

  // Stream status checking from ListenerDashboard2.jsx
  useEffect(() => {
    if (!serverConfig) return

    const checkStatus = () => {
      // Skip polling if WebSocket is connected and working
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        logger.debug('Skipping status poll - WebSocket is active')
        return
      }

      streamService.getStatus()
        .then(response => {
          logger.debug("Backend stream status:", response.data)

          if (response.data && response.data.data) {
            const statusData = response.data.data
            logger.debug('Stream status updated via HTTP:', statusData.live)
          }
        })
        .catch(error => {
          logger.error('Error checking status:', error)
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
      logger.debug('Volume updated to:', newVolume)
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
        logger.error("Listener Dashboard: Error fetching chat messages:", error);
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
    // Guard: Only setup WebSockets if we have a valid broadcast ID
    // We allow unauthenticated users to connect to WebSockets for listening to chat/polls
    if (!currentBroadcastId || currentBroadcastId <= 0) {
      // Cleanup any existing connections when no valid broadcast
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

    logger.debug('Listener Dashboard: Setting up WebSocket connections for broadcast:', currentBroadcastId);

    // Setup Chat WebSocket
    const setupChatWebSocket = async () => {
      try {
        // Reset connection status when setting up new connection
        setWsConnected(false);

        // Clean up any existing connection first
        if (chatWsRef.current) {
          logger.debug('Listener Dashboard: Cleaning up existing chat WebSocket');
          chatWsRef.current.disconnect();
          chatWsRef.current = null;
        }
        const connection = await chatService.subscribeToChatMessages(currentBroadcastId, (newMessage) => {
          // Set connection status to true on first message - this confirms WebSocket is working
          if (!wsConnected) {
            setWsConnected(true);
            logger.debug('Listener Dashboard: WebSocket confirmed working');
          }

          // Double-check the message is for the current broadcast
          if (newMessage.broadcastId === currentBroadcastId) {
            setChatMessages(prev => {
              // Check if message already exists to avoid duplicates
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) {
                return prev;
              }

              // Create a new array instead of modifying the existing one
              const wasAtBottom = isAtBottom(chatContainerRef.current);

              // Use spread operator for a new array and sort properly
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

        // Add a connection status check
        setTimeout(() => {
          if (!wsConnected) {
            logger.warn('Listener Dashboard: WebSocket not confirmed working after 3 seconds, refreshing messages');
            // Fallback - fetch messages again if WebSocket isn't working
            chatService.getMessages(currentBroadcastId).then(response => {
              setChatMessages(response.data);
            }).catch(error => {
              logger.error('Listener Dashboard: Error fetching messages during fallback:', error);
            });
          }
        }, 3000);

        chatWsRef.current = connection;
        logger.debug('Listener Dashboard: Chat WebSocket connected successfully');
      } catch (error) {
        logger.error('Listener Dashboard: Failed to connect chat WebSocket:', error);

        // Important: Fallback to polling on WebSocket failure
        const pollInterval = setInterval(() => {
          if (currentBroadcastId) {
            logger.debug('Listener Dashboard: Polling for messages due to WebSocket failure');
            chatService.getMessages(currentBroadcastId)
                .then(response => {
                  setChatMessages(response.data);
                })
                .catch(error => {
                  logger.error('Listener Dashboard: Error polling messages:', error);
                });
          } else {
            clearInterval(pollInterval);
          }
        }, 5000);

        // Store interval ref for cleanup
        chatWsRef.current = {
          disconnect: () => clearInterval(pollInterval),
          isConnected: () => false
        };
      }
    };

    // Setup Song Request WebSocket
    const setupSongRequestWebSocket = async () => {
      try {
        // Clean up any existing connection first
        if (songRequestWsRef.current) {
          logger.debug('Listener Dashboard: Cleaning up existing song request WebSocket');
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
        logger.debug('Listener Dashboard: Song request WebSocket connected successfully');
      } catch (error) {
        logger.error('Listener Dashboard: Failed to connect song request WebSocket:', error);
      }
    };

    // Setup Poll WebSocket
    const setupPollWebSocket = async () => {
      try {
        // Clean up any existing connection first
        if (pollWsRef.current) {
          logger.debug('Listener Dashboard: Cleaning up existing poll WebSocket');
          pollWsRef.current.disconnect();
          pollWsRef.current = null;
        }

        const connection = await pollService.subscribeToPolls(currentBroadcastId, (data) => {
          logger.debug('Listener Dashboard: Received poll WebSocket message:', data);
          switch (data.type) {
            case 'NEW_POLL':
              if (data.poll && data.poll.isActive) {
                logger.debug('Listener Dashboard: New poll received:', data.poll);
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
                logger.debug('Listener Dashboard: Poll vote update received:', data.poll);
                setActivePoll(prev => prev ? {
                  ...prev,
                  options: data.poll.options || prev.options,
                  totalVotes: data.poll.totalVotes || (data.poll.options ? data.poll.options.reduce((sum, option) => sum + (option.votes || 0), 0) : prev.totalVotes)
                } : null);
              }
              break;

            case 'POLL_UPDATED':
              if (data.poll && !data.poll.isActive && activePoll?.id === data.poll.id) {
                logger.debug('Listener Dashboard: Poll ended:', data.poll);
                setActivePoll(null);
                setSelectedPollOption(null);
              }
              break;

            case 'POLL_RESULTS':
              if (data.pollId === activePoll?.id && data.results) {
                logger.debug('Listener Dashboard: Poll results update received:', data.results);
                setActivePoll(prev => prev ? {
                  ...prev,
                  options: data.results.options,
                  totalVotes: data.results.totalVotes
                } : null);
              }
              break;

            default:
              logger.debug('Listener Dashboard: Unknown poll message type:', data.type);
          }
        });
        pollWsRef.current = connection;
        logger.debug('Listener Dashboard: Poll WebSocket connected successfully');
      } catch (error) {
        logger.error('Listener Dashboard: Failed to connect poll WebSocket:', error);
      }
    };

    // Setup Broadcast WebSocket for broadcast-level updates
    const setupBroadcastWebSocket = async () => {
      try {
        // Clean up any existing connection first
        if (broadcastWsRef.current) {
          logger.debug('Listener Dashboard: Cleaning up existing broadcast WebSocket');
          broadcastWsRef.current.disconnect();
          broadcastWsRef.current = null;
        }

        // Use the broadcast service from api.js
        const connection = await broadcastService.subscribeToBroadcastUpdates(currentBroadcastId, (message) => {
          logger.debug('Listener Dashboard: Broadcast WebSocket message received:', message);

          switch (message.type) {
            case 'BROADCAST_STARTED':
              logger.debug('Stream started via WebSocket');
              // CRITICAL FIX: Always fetch the latest broadcast information when a new broadcast starts
              // This ensures the UI shows the correct title and details immediately
              if (message.broadcast) {
                logger.debug('Broadcast information included in message:', message.broadcast);
                setCurrentBroadcast(message.broadcast);
                setCurrentBroadcastId(message.broadcast.id);
              }
              // Always fetch full details as well, regardless of message content
              logger.debug('Fetching complete broadcast information after BROADCAST_STARTED');
              fetchCurrentBroadcastInfo();
              break;

            case 'BROADCAST_ENDED':
              logger.debug('Stream ended via WebSocket');
              setCurrentBroadcast(null);
              setCurrentBroadcastId(null);
              break;

            case 'LISTENER_COUNT_UPDATE':
              logger.debug('Listener count updated via WebSocket:', message.data?.listenerCount || 0);
              if (message.data?.listenerCount !== undefined) {
                setLocalListenerCount(message.data.listenerCount);
              }
              break;

            case 'BROADCAST_STATUS_UPDATE':
              logger.debug('Broadcast status updated via WebSocket:', message.broadcast?.status === 'LIVE');
              // Update broadcast information when status changes
              if (message.broadcast) {
                setCurrentBroadcast(message.broadcast);
                if (message.broadcast.status === 'LIVE' && !currentBroadcastId) {
                  setCurrentBroadcastId(message.broadcast.id);
                  // Fetch complete details when broadcast goes live
                  logger.debug('Fetching complete broadcast information after status update to LIVE');
                  fetchCurrentBroadcastInfo();
                }
              }
              break;

            case 'LISTENER_JOINED':
              // Update listener count if provided
              logger.debug('Listener joined via WebSocket:', message.data?.listenerCount !== undefined ? message.data.listenerCount : 0);
              if (message.data?.listenerCount !== undefined) {
                setLocalListenerCount(message.data.listenerCount);
              }
              break;

            case 'LISTENER_LEFT':
              // Update listener count if provided
              logger.debug('Listener left via WebSocket:', message.data?.listenerCount !== undefined ? message.data.listenerCount : 0);
              if (message.data?.listenerCount !== undefined) {
                setLocalListenerCount(message.data.listenerCount);
              }
              break;

            default:
              // Unknown message type - can be safely ignored
              logger.debug('Unknown broadcast message type:', message.type);
          }
        });

        broadcastWsRef.current = connection;
        logger.debug('Listener Dashboard: Broadcast WebSocket connected successfully');
      } catch (error) {
        logger.error('Listener Dashboard: Failed to connect broadcast WebSocket:', error);
      }
    };

    // Setup WebSockets immediately - no delay needed with proper guards
    setupChatWebSocket();
    setupSongRequestWebSocket();
    setupPollWebSocket();
    setupBroadcastWebSocket();

    return () => {
      logger.debug('Listener Dashboard: Cleaning up WebSocket connections for broadcast:', currentBroadcastId);
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
  }, [currentBroadcastId]); // Removed chatMessages.length and activePoll?.id dependencies to prevent unnecessary re-runs

  // Update chat timestamps every minute
  useEffect(() => {
    const interval = setInterval(() => {
      _setChatTimestampTick(prev => prev + 1);
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
    if (!currentUser) {
      handleLoginRedirect();
      return;
    }
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
      const response = await chatService.sendMessage(currentBroadcastId, messageData);

      // Important: Always fetch messages after sending to ensure consistency
      const updatedMessages = await chatService.getMessages(currentBroadcastId);

      // Update local state with fresh data from server
      setChatMessages(updatedMessages.data);

      // Always scroll to bottom after sending your own message
      scrollToBottom();
    } catch (error) {
      logger.error("Error sending chat message:", error);
      if (error.response?.data?.message?.includes("1500 characters")) {
        alert("Message cannot exceed 1500 characters");
      } else {
        alert("Failed to send message. Please try again.");
      }
      setChatMessage(messageToSend); // Restore the message if sending failed
    }
  };

  // Helper function to fetch current broadcast info
  const fetchCurrentBroadcastInfo = async () => {
    try {
      // Fetch live broadcasts from API
      const response = await broadcastService.getLive();
      const liveBroadcasts = response.data;

      if (liveBroadcasts && liveBroadcasts.length > 0) {
        const liveBroadcast = liveBroadcasts[0];
        setCurrentBroadcast(liveBroadcast);
        setCurrentBroadcastId(liveBroadcast.id);
        logger.debug("Live broadcast information fetched:", liveBroadcast);
      } else {
        setCurrentBroadcast(null);
        setCurrentBroadcastId(null);
        logger.debug("No live broadcasts found");
      }
    } catch (error) {
      logger.error("Error fetching current broadcast info:", error);
    }
  };

  // Check if a broadcast is live
  useEffect(() => {
    const checkBroadcastStatus = async () => {
      // Skip polling if WebSocket is connected and handling broadcast updates
      if (broadcastWsRef.current?.isConnected && broadcastWsRef.current.isConnected()) {
        logger.debug('Skipping broadcast status poll - WebSocket is handling updates')
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
              logger.debug("Target broadcast loaded:", targetBroadcast);
              return; // Exit early since we found our target broadcast
            }
          } catch (error) {
            logger.error("Error fetching target broadcast:", error);
            // Continue to fetch live broadcasts as fallback
          }
        }

        // Fetch live broadcasts from API
        const response = await broadcastService.getLive();
        const liveBroadcasts = response.data;

        // If there are any live broadcasts, update state
        if (liveBroadcasts && liveBroadcasts.length > 0) {
          const liveBroadcast = liveBroadcasts[0];
          setCurrentBroadcast(liveBroadcast);
          setCurrentBroadcastId(liveBroadcast.id);
          logger.debug("Live broadcast found:", liveBroadcast);
        } else {
          setCurrentBroadcast(null);
          setCurrentBroadcastId(null);
          logger.debug("No live broadcasts found");
        }
      } catch (error) {
        logger.error("Error checking broadcast status:", error);
      }
    }

    // Initial check
    checkBroadcastStatus();

    // Very minimal polling since WebSocket handles all real-time broadcast updates
    // Only check occasionally for fallback scenarios or initial setup
    const interval = setInterval(checkBroadcastStatus, 600000); // Check every 10 minutes instead of 5 minutes

    return () => clearInterval(interval);
  }, [targetBroadcastId]); // Add targetBroadcastId as dependency

  // Global broadcast status WebSocket for real-time broadcast detection
  useEffect(() => {
    const setupGlobalBroadcastWebSocket = async () => {
      try {
        // Clean up any existing connection
        if (globalBroadcastWsRef.current) {
          globalBroadcastWsRef.current.disconnect();
          globalBroadcastWsRef.current = null;
        }

        logger.debug('Setting up global broadcast status WebSocket...');
        
        // Subscribe to global broadcast status updates (no specific broadcast ID)
        const connection = await broadcastService.subscribeToBroadcastUpdates(null, (message) => {
          logger.debug('Global broadcast update received:', message);

          switch (message.type) {
            case 'BROADCAST_STARTED':
              logger.debug('New broadcast started via global WebSocket');
              // CRITICAL FIX: Immediately fetch complete broadcast information
              // This is essential for audio source switching scenarios where the DJ
              // reconnects and creates a new broadcast session
              if (message.broadcast) {
                logger.debug('Updating to new broadcast from global WebSocket:', message.broadcast);
                setCurrentBroadcast(message.broadcast);
                setCurrentBroadcastId(message.broadcast.id);
              }
              // Always fetch complete details to ensure UI is up-to-date
              logger.debug('Fetching complete broadcast information via global WebSocket after BROADCAST_STARTED');
              fetchCurrentBroadcastInfo();
              break;

            case 'BROADCAST_ENDED':
              logger.debug('Broadcast ended via global WebSocket');
              // Only clear state if it matches the current broadcast
              if (!message.broadcast || message.broadcast.id === currentBroadcastId) {
                setCurrentBroadcast(null);
                setCurrentBroadcastId(null);
                logger.debug('Cleared current broadcast state');
              }
              break;

            case 'BROADCAST_STATUS_UPDATE':
              logger.debug('Broadcast status updated via global WebSocket:', message.broadcast?.status);
              if (message.broadcast && message.broadcast.status === 'LIVE') {
                // New broadcast went live
                logger.debug('New broadcast went live via global status update:', message.broadcast);
                setCurrentBroadcast(message.broadcast);
                setCurrentBroadcastId(message.broadcast.id);
                // Fetch complete details for the new live broadcast
                logger.debug('Fetching complete broadcast information for newly live broadcast');
                fetchCurrentBroadcastInfo();
              } else if (message.broadcast && message.broadcast.status !== 'LIVE') {
                // If this was the current broadcast and it's no longer live
                if (currentBroadcastId === message.broadcast.id) {
                  setCurrentBroadcast(null);
                  setCurrentBroadcastId(null);
                  logger.debug('Current broadcast ended via global status update');
                }
              }
              break;

            case 'LISTENER_COUNT_UPDATE':
              // Update listener count for any broadcast updates
              if (message.data?.listenerCount !== undefined) {
                setLocalListenerCount(message.data.listenerCount);
                logger.debug('Updated listener count via global WebSocket:', message.data.listenerCount);
              }
              break;

            default:
              // Other message types can be ignored for global status
              logger.debug('Global WebSocket - ignoring message type:', message.type);
              break;
          }
        });

        globalBroadcastWsRef.current = connection;
        logger.debug('Global broadcast status WebSocket connected successfully');
      } catch (error) {
        logger.error('Failed to connect global broadcast status WebSocket:', error);
        
        // Fallback: increase polling frequency if WebSocket fails
        logger.debug('Setting up fallback polling due to global WebSocket failure');
        const fallbackPolling = setInterval(() => {
          logger.debug('Fallback polling: checking for live broadcasts');
          fetchCurrentBroadcastInfo();
        }, 30000); // Poll every 30 seconds as fallback
        
        // Store the polling interval for cleanup
        globalBroadcastWsRef.current = {
          disconnect: () => {
            clearInterval(fallbackPolling);
            logger.debug('Stopped fallback polling');
          }
        };
      }
    };

    // Set up the global WebSocket connection
    setupGlobalBroadcastWebSocket();

    return () => {
      if (globalBroadcastWsRef.current) {
        globalBroadcastWsRef.current.disconnect();
        globalBroadcastWsRef.current = null;
      }
    };
  }, []); // Run once on component mount

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
              logger.error("Error checking user vote:", error);
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
          logger.error("Error fetching active polls:", error);
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
  const togglePlay = async () => {
    logger.debug('Toggle play called, current state:', { 
      localAudioPlaying, 
      wsReadyState: wsRef.current?.readyState,
      audioRefExists: !!audioRef.current,
      serverConfigExists: !!serverConfig,
      streamUrl: serverConfig?.streamUrl
    })

    if (!audioRef.current || !serverConfig) {
      logger.error('Audio player not ready:', {
        audioRefCurrent: !!audioRef.current,
        serverConfig: !!serverConfig,
        serverConfigStreamUrl: serverConfig?.streamUrl
      });
      setFilteredStreamError("Audio player not ready. Please wait...")
      return
    }

    try {
      if (localAudioPlaying) {
        logger.debug('Pausing playback')
        audioRef.current.pause()
        setLocalAudioPlaying(false); // Update local state
        logger.debug('Stream paused')

        // Notify server that listener stopped playing
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const message = {
            type: 'LISTENER_STATUS',
            action: 'STOP_LISTENING',
            broadcastId: currentBroadcastId,
            userId: currentUser?.id || null,
            userName: currentUser?.firstName || currentUser?.name || 'Anonymous Listener',
            timestamp: Date.now()
          };
          wsRef.current.send(JSON.stringify(message));
          logger.debug('Sent listener stop message to server:', message);
        }
      } else {
        logger.debug('Starting playback');

        // Clear any previous errors
        setFilteredStreamError(null);

        // Improved URL handling with format fallbacks
        let streamUrl = serverConfig.streamUrl;

        // Ensure proper protocol
        if (!streamUrl.startsWith('http')) {
          streamUrl = `http://${streamUrl}`;
        }

        logger.debug('Primary stream URL:', streamUrl);

        // Create array of fallback URLs for better browser compatibility
        const streamUrls = [
          streamUrl, // Original URL (likely .ogg)
          streamUrl.replace('.ogg', ''), // Without extension
          streamUrl.replace('.ogg', '.mp3'), // MP3 fallback
          streamUrl.replace('.ogg', '.aac'), // AAC fallback
        ];

        // Remove duplicates
        const uniqueUrls = [...new Set(streamUrls)];
        logger.debug('Trying stream URLs in order:', uniqueUrls);

        // Try URLs sequentially
        const tryStreamUrl = async (urls, index = 0) => {
          if (index >= urls.length) {
            throw new Error('All stream formats failed to load');
          }

          const currentUrl = urls[index];
          logger.debug(`Trying stream URL ${index + 1}/${urls.length}:`, currentUrl);

          return new Promise((resolve, reject) => {
            // Set up audio element for this attempt
            audioRef.current.src = currentUrl;
            audioRef.current.load();

            // Set up event listeners for this attempt
            const handleCanPlay = () => {
              logger.debug('Audio can play with URL:', currentUrl);
              cleanup();
              resolve(currentUrl);
            };

            const handleError = (e) => {
              logger.debug(`URL ${currentUrl} failed:`, e);
              cleanup();
              tryStreamUrl(urls, index + 1).then(resolve).catch(reject);
            };

            const handleLoadStart = () => {
              logger.debug('Loading started for:', currentUrl);
            };

            const cleanup = () => {
              audioRef.current.removeEventListener('canplay', handleCanPlay);
              audioRef.current.removeEventListener('error', handleError);
              audioRef.current.removeEventListener('loadstart', handleLoadStart);
            };

            // Add event listeners
            audioRef.current.addEventListener('canplay', handleCanPlay, { once: true });
            audioRef.current.addEventListener('error', handleError, { once: true });
            audioRef.current.addEventListener('loadstart', handleLoadStart, { once: true });

            // Set a timeout to try next URL if this one takes too long
            setTimeout(() => {
              if (audioRef.current.readyState === 0) { // HAVE_NOTHING
                logger.debug('URL taking too long, trying next:', currentUrl);
                cleanup();
                tryStreamUrl(urls, index + 1).then(resolve).catch(reject);
              }
            }, 5000); // 5 second timeout
          });
        };

        try {
          const workingUrl = await tryStreamUrl(uniqueUrls);
          logger.debug('Found working stream URL:', workingUrl);

          // Set final configuration
          audioRef.current.volume = isMuted ? 0 : volume / 100;
          audioRef.current.crossOrigin = 'anonymous';

          // Attempt to play
          const playPromise = audioRef.current.play();

          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                logger.debug('Playback started successfully');
                setLocalAudioPlaying(true);
                setFilteredStreamError(null);

                // Notify server that listener started playing
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  const message = {
                    type: 'LISTENER_STATUS',
                    action: 'START_LISTENING',
                    broadcastId: currentBroadcastId,
                    userId: currentUser?.id || null,
                    userName: currentUser?.firstName || currentUser?.name || 'Anonymous Listener',
                    timestamp: Date.now()
                  };
                  wsRef.current.send(JSON.stringify(message));
                  logger.debug('Sent listener start message to server:', message);
                }
              })
              .catch(error => {
                logger.error("Playback failed:", error);

                if (error.name === 'NotAllowedError') {
                  setFilteredStreamError("Browser blocked autoplay. Please click play again to start listening.");
                } else if (error.name === 'NotSupportedError') {
                  setFilteredStreamError("Your browser doesn't support this audio format. Please try a different browser or check if the stream is live.");
                } else if (error.name === 'AbortError') {
                  setFilteredStreamError("Playback was interrupted. Please try again.");
                } else {
                  setFilteredStreamError(`Playback failed: ${error.message}. Please check if the stream is live.`);
                }
                setLocalAudioPlaying(false);
                logger.debug('Stream paused due to error');

                // Notify server that listener stopped playing due to error
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  const message = {
                    type: 'LISTENER_STATUS',
                    action: 'STOP_LISTENING',
                    broadcastId: currentBroadcastId,
                    userId: currentUser?.id || null,
                    userName: currentUser?.firstName || currentUser?.name || 'Anonymous Listener',
                    timestamp: Date.now()
                  };
                  wsRef.current.send(JSON.stringify(message));
                  logger.debug('Sent listener stop message to server (due to error):', message);
                }
              });
          } else {
            logger.warn('Play promise is undefined, cannot track playback status');
          }
        } catch (error) {
          logger.error('All stream URLs failed:', error);
          setFilteredStreamError('Unable to load audio stream. The broadcast may not be live or your browser may not support the stream format.');
          setLocalAudioPlaying(false);
        }
      }
    } catch (error) {
      logger.error("Error toggling playback:", error);
      setFilteredStreamError(`Playback error: ${error.message}. Please try again.`);
    }
  }

  // Handle song request submission
  const handleSongRequestSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      handleLoginRedirect();
      return;
    }
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
      logger.error("Error submitting song request:", error);
      setRequestError("Failed to submit request. Please try again.");
    } finally {
      setSongRequestLoading(false);
    }
  };

  // Handle poll option selection
  const handlePollOptionSelect = (optionId) => {
    if (!currentUser) {
      handleLoginRedirect();
      return;
    }
    if (!activePoll || activePoll.userVoted || !isLive) return;
    setSelectedPollOption(optionId);
  };

  // Handle poll vote submission
  const handlePollVote = async () => {
    if (!currentUser) {
      handleLoginRedirect();
      return;
    }
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
      logger.error("Error submitting vote:", error);
      alert("Failed to submit vote. Please try again.");
    } finally {
      setPollLoading(false);
    }
  };

  // Safe chat message renderer with comprehensive error handling
  const renderSafeChatMessage = (msg) => {
    try {
      if (!msg || !msg.sender || !msg.id || !msg.content) return null;
      
      const isCurrentUser = currentUser && msg.sender.id === currentUser.id;
      const firstName = msg.sender.firstname || '';
      const lastName = msg.sender.lastname || '';
      const fullName = `${firstName} ${lastName}`.trim();
      const senderName = fullName || msg.sender.email || 'Unknown User';
      
      const isDJ = (msg.sender.role && msg.sender.role.includes("DJ"));
      
      const initials = senderName.split(' ').map(part => part[0] || '').join('').toUpperCase().slice(0, 2) || 'U';

      let messageDate;
      try {
        messageDate = msg.createdAt ? new Date(msg.createdAt.endsWith('Z') ? msg.createdAt : msg.createdAt + 'Z') : null;
      } catch (error) {
        logger.error('Error parsing message date:', error);
        messageDate = new Date();
      }

      const timeAgo = messageDate && !isNaN(messageDate.getTime()) 
        ? formatDistanceToNow(messageDate, { addSuffix: false }) 
        : 'now';

      const formattedTimeAgo = timeAgo
        .replace('about', '')
        .replace('almost', '')
        .replace('over', '')
        .replace('less than a minute', 'now')
        .replace(' seconds', 's')
        .replace(' second', 's')
        .replace(' minutes', 'm')
        .replace(' minute', 'm')
        .replace(' hours', 'h')
        .replace(' hour', 'h')
        .replace(' days', 'd')
        .replace(' day', 'd')
        .replace(' months', 'mo')
        .replace(' month', 'mo')
        .replace(' years', 'y')
        .replace(' year', 'y')
        .trim();

      return (
        <div className="flex items-start space-x-3 py-1.5 px-2 -mx-2 rounded-lg transition-colors hover:bg-muted/50">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-wildcats-maroon text-white">
              {isDJ ? <Crown className="h-5 w-5" /> : initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-baseline space-x-2">
              <span className={cn(
                "font-semibold text-sm",
                isDJ && "text-amber-500",
                isCurrentUser && "text-black"
              )}>{isCurrentUser ? 'You' : senderName}</span>
              <span className="text-xs text-muted-foreground">{formattedTimeAgo}</span>
            </div>
            <div className="text-sm text-foreground/90" style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
              {msg.content || 'No content'}
            </div>
          </div>
        </div>
      );
    } catch (error) {
      logger.error('Error rendering chat message:', error, msg);
      return null;
    }
  };

  // Render chat messages
  const renderChatMessages = () => (
    <div className="max-h-60 overflow-y-auto space-y-3 mb-4 chat-messages-container custom-scrollbar" ref={chatContainerRef}>
      {chatMessages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
          <MessageSquare className="h-10 w-10 mb-2" />
          <p className="font-medium">No messages yet</p>
          <p className="text-sm">Be the first one to chat!</p>
        </div>
      ) : (
        chatMessages
          .slice()
          .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
          .map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {renderSafeChatMessage(msg)}
            </motion.div>
          ))
          .filter(Boolean) // Remove any null values from failed renders
      )}
    </div>
  );

  // Render chat input
  const renderChatInput = () => {
    if (!currentUser) {
      return (
        <div className="p-4 bg-muted">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Join the conversation! Login or create an account to chat with other listeners.
            </p>
            <div className="flex space-x-2 justify-center">
              <Button onClick={handleLoginRedirect} size="sm">
                <LogIn className="h-4 w-4 mr-2" />
                Login
              </Button>
              <Button onClick={handleRegisterRedirect} size="sm" variant="secondary">
                <UserPlus className="h-4 w-4 mr-2" />
                Register
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <form onSubmit={handleChatSubmit} className="flex flex-col space-y-2 w-full">
        <Input
          type="text"
          value={chatMessage}
          onChange={(e) => {
            if (e.target.value.length <= 1500) {
              setChatMessage(e.target.value);
            }
          }}
          placeholder={isLive ? "Send a message..." : "Chat available during live broadcasts"}
          className={`h-11 w-full ${isLive ? 'bg-white border-wildcats-maroon focus-visible:ring-wildcats-maroon rounded-sm' : '!bg-gray-200 opacity-100 rounded-sm border-gray-400 disabled:!bg-gray-200 disabled:!opacity-100'}`}
          disabled={!isLive}
          maxLength={1500}
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={!isLive || !chatMessage.trim() || chatMessage.length > 1500}
            className={`h-9 px-4 ${isLive && chatMessage.trim() && chatMessage.length <= 1500 ? 'bg-wildcats-maroon text-white hover:bg-red-800' : 'bg-gray-400 text-white hover:bg-gray-500'}`}
          >
            Chat
          </Button>
        </div>
      </form>
    );
  };

  return (
    <>
      {/* Desktop Layout */}
      <div className="hidden lg:flex h-[calc(100vh-4rem)] overflow-hidden">
        <main className="flex-1 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,448px)] gap-8 pr-8 h-full items-start">
            
            {/* Left Column: Song Request & Polls - Scrollable */}
            <ScrollArea className="h-[calc(100vh-4rem)] hide-scrollbar">
              <div className="space-y-8 pl-8 pr-4 pt-8 pb-8">
                {(isLive || forceShowLive) ? (
                  <>
                    <div>
                      <h2 className="mb-6 text-3xl font-bold text-slate-900 dark:text-white">Live Interactions</h2>
                      {/* Song Request and Poll Cards */}
                      <div className="space-y-6">
                          {/* Song Request Section */}
                          <div>
                            {/* Song Request Header - Outside Card */}
                            <div className="flex items-center mb-4">
                              <div className="w-12 h-12 bg-wildcats-maroon/10 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                                <Music className="h-6 w-6 text-wildcats-maroon" />
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold text-wildcats-maroon">Request a Song</h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                  Let the DJ know what you'd like to hear.
                                </p>
                              </div>
                            </div>
                            {/* Song Request Card */}
                            <Card className="border-none shadow-xl rounded-2xl flex flex-col h-full min-h-[300px] overflow-hidden">
                            <CardContent className="flex-1 flex flex-col justify-between">
                              {!currentUser ? (
                                <div className="text-center py-8">
                                  <p className="text-slate-600 dark:text-slate-400 mb-4">
                                    Login or create an account to request songs.
                                  </p>
                                  <div className="flex space-x-3 justify-center">
                                    <Button onClick={handleLoginRedirect} className="bg-wildcats-maroon text-white hover:bg-red-800 rounded-lg">
                                      <LogIn className="h-4 w-4 mr-2" />
                                      Login
                                    </Button>
                                    <Button onClick={handleRegisterRedirect} variant="outline" className="rounded-lg">
                                      <UserPlus className="h-4 w-4 mr-2" />
                                      Register
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                                                 <form onSubmit={handleSongRequestSubmit} className="space-y-4">
                                   <div className="grid grid-cols-1 gap-4">
                                     <div className="space-y-2 mt-4">
                                       <Label htmlFor="song-title" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Song Title *</Label>
                                      <Input
                                        id="song-title"
                                        type="text"
                                        value={songRequest.title}
                                        onChange={(e) => setSongRequest({ ...songRequest, title: e.target.value })}
                                        placeholder="e.g., Bohemian Rhapsody"
                                        className="h-10 border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700/50"
                                        required
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="artist" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Artist *</Label>
                                      <Input
                                        id="artist"
                                        type="text"
                                        value={songRequest.artist}
                                        onChange={(e) => setSongRequest({ ...songRequest, artist: e.target.value })}
                                        placeholder="e.g., Queen"
                                        className="h-10 border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700/50"
                                        required
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="dedication" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Dedication (Optional)</Label>
                                      <Textarea
                                        id="dedication"
                                        value={songRequest.dedication}
                                        onChange={(e) => setSongRequest({ ...songRequest, dedication: e.target.value })}
                                        placeholder="Add a personal message or dedication..."
                                        className="min-h-[80px] border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700/50 resize-none"
                                      />
                                    </div>
                                  </div>
                                  <div className="pt-2">
                                    <Button type="submit" className="bg-red-800 hover:bg-red-900 text-white shadow-lg px-6 h-10 rounded-lg font-semibold w-full">
                                      <Send className="h-4 w-4 mr-2" />
                                      Submit Request
                                    </Button>
                                  </div>
                                </form>
                              )}
                            </CardContent>
                          </Card>
                          </div>

                          {/* Poll Section */}
                          <div>
                            {/* Poll Header - Outside Card */}
                            <div className="flex items-center mb-4">
                              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                                <Vote className="h-6 w-6 text-blue-500" />
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold text-blue-800">Live Poll</h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                  Cast your vote on the current topic.
                                </p>
                              </div>
                            </div>
                            {/* Poll Card */}
                            <Card className="border-none shadow-xl rounded-2xl flex flex-col h-full min-h-[300px] overflow-hidden">
                            <CardContent className="flex-1 flex flex-col justify-between">
                              {pollLoading && !activePoll ? (
                                <div className="text-center py-8 text-muted-foreground animate-pulse">Loading polls...</div>
                              ) : activePoll ? (
                                <div>
                                  <div className="text-center mb-6">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                      {activePoll.question || activePoll.title}
                                    </h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                      {!currentUser ? 'Login to participate' : activePoll.userVoted ? 'Results are in!' : 'Cast your vote below'}
                                    </p>
                                  </div>
                                  <div className="space-y-3 mb-6">
                                    {activePoll.options.map((option) => {
                                      const percentage = (activePoll.totalVotes > 0) ? Math.round((option.votes / activePoll.totalVotes) * 100) || 0 : 0;
                                      const isSelected = selectedPollOption === option.id;
                                      const isUserChoice = activePoll.userVotedFor === option.id;
                                      const canInteract = currentUser && !activePoll.userVoted;
                                      return (
                                        <div key={option.id} className="relative">
                                          <Button
                                            variant="outline"
                                            className={cn(
                                              "w-full justify-start h-12 p-3 text-left rounded-lg transition-all duration-200 border-2",
                                              isSelected ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30" : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600",
                                              isUserChoice && "border-purple-500 bg-purple-50 dark:bg-purple-900/30 font-semibold",
                                              !canInteract && "cursor-default"
                                            )}
                                            onClick={() => canInteract && handlePollOptionSelect(option.id)}
                                            disabled={!canInteract}
                                          >
                                            <div className="flex items-center justify-between w-full">
                                              <span className="font-medium text-slate-800 dark:text-slate-200 text-sm">{option.optionText || option.text}</span>
                                              {activePoll.userVoted && currentUser && (
                                                <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">{percentage}%</span>
                                              )}
                                            </div>
                                          </Button>
                                          {activePoll.userVoted && currentUser && (
                                            <div className="absolute top-0 left-0 h-full rounded-lg bg-gradient-to-r from-blue-200 to-purple-200 dark:from-blue-800/50 dark:to-purple-800/50 -z-10 transition-all duration-500" style={{ width: `${percentage}%` }}></div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="pt-2">
                                    {!currentUser ? (
                                      <div className="text-center">
                                        <p className="text-sm text-muted-foreground mb-3">Login to participate in polls</p>
                                        <div className="flex space-x-2 justify-center">
                                          <Button onClick={handleLoginRedirect} className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg"><LogIn className="h-4 w-4 mr-2" />Login</Button>
                                          <Button onClick={handleRegisterRedirect} variant="secondary" className="rounded-lg"><UserPlus className="h-4 w-4 mr-2" />Register</Button>
                                        </div>
                                      </div>
                                    ) : activePoll.userVoted ? (
                                      <div className="text-center">
                                        <p className="text-sm text-muted-foreground mb-2">Total votes: {activePoll.totalVotes || 0}</p>
                                        <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 rounded-md">Voted</Badge>
                                      </div>
                                    ) : (
                                      <Button onClick={handlePollVote} disabled={!selectedPollOption || pollLoading} className="bg-blue-500 hover:bg-blue-600 text-white shadow-lg px-6 h-10 rounded-lg font-semibold w-full">
                                        {pollLoading ? 'Voting...' : 'Vote'}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-8">
                                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-slate-700 mx-auto mb-4">
                                    <Vote className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                                  </div>
                                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Active Polls</h3>
                                  <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">Polls will appear here during live broadcasts.</p>
                                                                </div>
                              )}
                            </CardContent>
                          </Card>
                          </div>
                         </div>
                    </div>

                    {/* Polls Card - REMOVED */}
                    
                  </>
                ) : (
                  <Card className="border-none shadow-xl rounded-2xl">
                    <CardContent className="p-8 text-center py-20">
                      <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-slate-700 mx-auto mb-6">
                        <Mic className="h-12 w-12 text-slate-400 dark:text-slate-500" />
                      </div>
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Station is Off Air</h3>
                      <p className="text-slate-600 dark:text-slate-400 mt-2">
                        Song requests and polls are only available during live broadcasts.
                      </p>
                      <Button 
                        onClick={() => setForceShowLive(true)} 
                        className="mt-6"
                        variant="secondary"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Show Live Preview (For Design)
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>

              {/* Right Column: Player */}
              <div className="w-80 lg:w-96 xl:w-[448px] mt-8" style={{ perspective: '1000px' }}>
                 <Card 
                    className="relative overflow-hidden border-none shadow-2xl rounded-2xl sticky top-8 bg-gradient-to-br from-[#800000] to-[#600000] min-h-[840px]"
                  >
                    <div className="absolute -top-24 -right-24 w-72 h-72 bg-white/10 rounded-full mix-blend-soft-light filter blur-3xl opacity-50 pointer-events-none"></div>
                    <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-red-400/10 rounded-full mix-blend-soft-light filter blur-3xl opacity-50 pointer-events-none"></div>
                    {(isLive || forceShowLive) ? (
                        <CardContent className="relative z-10 p-6 lg:p-8 xl:p-10 flex flex-col items-center text-center">
                          <div className="w-full flex items-center justify-between mb-10">
                             <Badge className="bg-white/10 text-white border-white/20 shadow-lg">
                                <span className="relative flex h-2 w-2 mr-2">
                                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400"></span>
                                </span>
                                LIVE
                              </Badge>
                              <div className="flex items-center space-x-2 text-sm text-red-200">
                                <div className="w-2 h-2 bg-green-400 rounded-full shadow-[0_0_5px_theme(colors.green.400)]"></div>
                                <span className="font-medium">{Math.max(listenerCount, localListenerCount)} listeners</span>
                              </div>
                          </div>

                          <div className="h-32 w-32 lg:h-40 lg:w-40 xl:h-48 xl:w-48 bg-black/20 rounded-full flex items-center justify-center mb-6 lg:mb-8 shadow-inner border border-white/10 ring-1 ring-white/10 p-3 lg:p-4">
                            <img src="/wildcat_logo.png" alt="WildCat Radio" className="w-24 h-24 lg:w-32 lg:h-32 xl:w-40 xl:h-40 object-contain ml-1 lg:ml-2" />
                          </div>

                          <p className="text-base font-semibold uppercase tracking-widest text-red-200 mb-2">NOW BROADCASTING</p>
                          <h2 className="text-4xl font-extrabold text-white tracking-tight [text-shadow:0_4px_10px_rgba(0,0,0,0.3)]">{currentBroadcast?.title || "..."}</h2>
                          <p className="text-red-200 mb-10 font-medium">
                            {currentBroadcast?.host?.name ? `with ${currentBroadcast.host.name}` : currentBroadcast?.dj?.name ? `with ${currentBroadcast.dj.name}` : "On Air"}
                          </p>

                          <button
                            onClick={(e) => { e.preventDefault(); togglePlay(); }}
                            disabled={!serverConfig}
                            className={cn(
                              "w-20 h-20 lg:w-24 lg:h-24 xl:w-28 xl:h-28 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center border-2 border-white/10 outline-none focus:outline-none focus:ring-4 focus:ring-red-400/50 focus:ring-offset-2 focus:ring-offset-red-950 transform hover:scale-105 mb-8 lg:mb-10",
                              localAudioPlaying 
                                ? "bg-black/20 text-white" 
                                : "bg-white/20 text-white"
                            )}
                            aria-label={localAudioPlaying ? 'Pause' : 'Play'}
                          >
                            {localAudioPlaying ? <Pause className="h-8 w-8 lg:h-10 lg:w-10 xl:h-12 xl:w-12 drop-shadow-lg" /> : <Play className="h-8 w-8 lg:h-10 lg:w-10 xl:h-12 xl:w-12 ml-1 drop-shadow-lg" />}
                          </button>
                          
                          <div className="w-full max-w-md bg-black/20 backdrop-blur-sm rounded-full p-2 border border-white/10 shadow-inner">
                            <div className="flex items-center space-x-3">
                              <Button onClick={handleMuteToggle} size="icon" variant="ghost" className="h-12 w-12 rounded-full flex-shrink-0 text-red-200 hover:bg-white/10 hover:text-white">
                                {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
                              </Button>
                              <Slider min={0} max={100} value={[volume]} onValueChange={(value) => updateVolume(value[0])} className="w-full [&>*]:bg-white/30 [&>*>*]:bg-white [&>*:last-child]:!border-0 [&>*:last-child]:!outline-0 [&>*:last-child]:!ring-0 [&>*:last-child]:bg-white [&>*:last-child]:rounded-full [&>*:last-child]:shadow-lg [&>*:last-child]:focus:!outline-0 [&>*:last-child]:focus:!ring-0 [&>*:last-child]:focus:!border-0 [&_[role=slider]]:!border-0 [&_[role=slider]]:!outline-0" />
                              <div className="text-base font-medium text-red-200 w-12 text-center tabular-nums">{volume}%</div>
                            </div>
                          </div>

                           {streamError && (
                            <div className="mt-8 w-full">
                              <div className="p-4 bg-red-900/20 border border-red-800/50 rounded-xl text-sm text-red-300 font-medium">
                                {streamError}
                              </div>
                            </div>
                          )}
                        </CardContent>
                    ) : (
                       <CardContent className="relative z-10 p-6 flex flex-col items-center text-center py-16">
                          <div className="relative inline-block mb-6">
                            <div className="h-48 w-48 bg-black/20 rounded-full flex items-center justify-center mb-8 shadow-inner border border-white/10 ring-1 ring-white/10 p-2">
                              <img src="/wildcat_logo.png" alt="WildCat Radio" className="w-44 h-44 object-contain opacity-40" />
                            </div>
                             <div className="absolute -top-1 -right-1 w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center shadow-md">
                              <span className="w-3 h-3 bg-slate-400 rounded-full"></span>
                            </div>
                          </div>
                          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                            Station is Off Air
                          </h2>
                           {nextBroadcast ? (
                            <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 inline-block shadow-sm text-xs">
                              <p className="text-blue-800 dark:text-blue-300 font-semibold">
                                Next: {nextBroadcast.title}
                              </p>
                              <p className="text-blue-600 dark:text-blue-400 mt-0.5">
                                {nextBroadcast.date} at {nextBroadcast.time}
                              </p>
                            </div>
                          ) : (
                            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
                              Check back soon!
                            </p>
                          )}
                       </CardContent>
                    )}
                 </Card>
              </div>
            </div>
          </main>

        {/* Desktop Right Column - Live Chat */}
        {(isLive || forceShowLive) && (
          <motion.aside 
            className="w-96 flex flex-col border-l bg-card h-[calc(100vh-4rem)]"
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            transition={{ 
              type: "spring",
              stiffness: 300,
              damping: 30,
              duration: 0.5
            }}
          >
            <Card className="flex flex-col rounded-none border-0 h-[calc(100vh-4rem)] bg-transparent shadow-none">
            <CardHeader className="flex flex-row items-center justify-between p-3 border-b">
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-5 w-5 text-wildcats-maroon fill-current" />
                <CardTitle className="text-lg">Live Chat</CardTitle>
              </div>
              {isLive && <Badge variant="outline">{Math.max(listenerCount, localListenerCount)} listeners</Badge>}
            </CardHeader>
            <CardContent className="flex-1 p-0 relative flex flex-col overflow-hidden">
              <ScrollArea className="flex-1 h-0" ref={chatContainerRef}>
                <div className="p-4 space-y-1">
                  {isLive ? (
                    chatMessages.length > 0 ? (
                      chatMessages
                        .slice()
                        .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
                        .map((msg, index) => (
                          <motion.div
                            key={msg.id || index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                          >
                            {renderSafeChatMessage(msg)}
                          </motion.div>
                        ))
                        .filter(Boolean)
                    ) : (
                      <div className="flex h-full min-h-[200px] items-center justify-center">
                        <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
                            <MessageSquare className="h-10 w-10 mb-2" />
                            <p className="font-medium">No messages yet</p>
                            <p className="text-sm">Be the first one to chat!</p>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="flex h-full min-h-[200px] items-center justify-center p-8">
                      <div className="flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                        <div className="relative mb-6">
                          <div className="w-16 h-16 bg-gradient-to-br from-wildcats-maroon/20 to-red-800/20 rounded-full flex items-center justify-center">
                            <MessageSquare className="h-8 w-8 text-wildcats-maroon" />
                          </div>
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                          </div>
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">Chat Offline</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Join the conversation when we go live! Chat will be available during broadcast sessions.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              {isLive && showScrollBottom && (
                <div className="absolute bottom-4 right-4 z-10">
                  <Button
                    onClick={scrollToBottom}
                    size="icon"
                    className="rounded-full"
                    aria-label="Scroll to bottom"
                  >
                    <ArrowDown className="h-5 w-5" />
                  </Button>
                </div>
              )}
            </CardContent>
            <CardFooter className="px-3 py-3 bg-white flex-shrink-0">
              {renderChatInput()}
            </CardFooter>
          </Card>
        </motion.aside>
        )}
      </div>
      
      {/* Mobile: Flex column layout */}
      <div className="flex flex-col space-y-6 lg:hidden container mx-auto px-4 mb-8 pt-6">
        {/* Mobile: Broadcast Stream */}
        <Card className="bg-card text-card-foreground overflow-hidden">
            <CardHeader className="relative p-4">
              {(isLive || forceShowLive) ? (
                <Badge variant="destructive" className="absolute top-4 left-4 z-10 w-auto">
                  <span className="relative flex h-2 w-2 mr-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                  LIVE ({Math.max(listenerCount, localListenerCount)} listeners)
                </Badge>
              ) : (
                <Badge variant="secondary" className="absolute top-4 left-4 z-10 w-auto">
                  OFF AIR
                </Badge>
              )}
               {streamError && (
                <div className="absolute top-12 left-4 right-4 p-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200 rounded-md text-xs">
                  {streamError}
                </div>
              )}
            </CardHeader>
            <CardContent className="p-4 flex flex-col justify-center">
              {(isLive || forceShowLive) ? (
                <>
                  <div className="flex">
                    <div className="w-24 h-24 bg-muted flex items-center justify-center text-muted-foreground text-2xl rounded-lg">
                      <Music className="h-10 w-10" />
                    </div>
                    <div className="ml-4 text-card-foreground flex-grow">
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
                        {_currentSong ? (
                          <>
                            <p className="text-sm font-medium">{_currentSong.title}</p>
                            <p className="text-xs opacity-70">{_currentSong.artist}</p>
                          </>
                        ) : (
                          <p className="text-sm opacity-70">No track information available</p>
                        )}
                      </div>
                    </div>
                    <div className="ml-auto flex flex-col items-center justify-center space-y-2">
                      <Button
                        onClick={togglePlay}
                        disabled={!serverConfig}
                        size="icon"
                        variant={localAudioPlaying ? 'secondary' : 'default'}
                        aria-label={localAudioPlaying ? 'Pause' : 'Play'}
                      >
                        {localAudioPlaying ? (
                          <Pause className="h-6 w-6" />
                        ) : (
                          <Play className="h-6 w-6" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center mt-4">
                    <Button onClick={handleMuteToggle} size="icon" variant="ghost" className="mr-2">
                      {isMuted ? (
                        <VolumeX className="h-5 w-5" />
                      ) : (
                        <Volume2 className="h-5 w-5" />
                      )}
                    </Button>
                    <Slider
                      min={0}
                      max={100}
                      value={[volume]}
                      onValueChange={(value) => updateVolume(value[0])}
                      className="w-full"
                    />
                    <div className="ml-2 text-xs w-7 text-right">{volume}%</div>
                  </div>
                   {forceShowLive && !isLive && (
                    <Button 
                      onClick={() => setForceShowLive(false)} 
                      variant="outline"
                      size="sm"
                      className="mt-4 w-full border-dashed"
                    >
                      <EyeOff className="mr-2 h-4 w-4" />
                      Hide Live Preview
                    </Button>
                  )}
                </>
              ) : (
                <div className="text-center text-card-foreground py-8">
                  <h2 className="text-2xl font-bold mb-3">WildCats Radio</h2>
                  <p className="mb-2">No broadcast currently active</p>
                  {nextBroadcast ? (
                    <p className="text-sm opacity-70">
                      Next broadcast: {nextBroadcast.title} on {nextBroadcast.date} at {nextBroadcast.time}
                    </p>
                  ) : (
                    <p className="text-sm opacity-70">No upcoming broadcasts scheduled</p>
                  )}
                   <Button 
                    onClick={() => setForceShowLive(true)} 
                    variant="secondary"
                    className="mt-4"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Show Live Preview
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

        {/* Mobile: Live Chat */}
        {(isLive || forceShowLive) && (
          <motion.div 
            className="lg:col-span-1 flex flex-col"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            transition={{ 
              type: "spring",
              stiffness: 400,
              damping: 25,
              duration: 0.4
            }}
          >
            <Card className="flex-grow flex flex-col h-[400px]">
            <CardHeader className="flex flex-row items-center justify-between p-3 border-b">
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-5 w-5 text-wildcats-maroon fill-current" />
                <CardTitle className="text-lg">Live Chat</CardTitle>
              </div>
              {isLive && <Badge variant="outline">{Math.max(listenerCount, localListenerCount)} listeners</Badge>}
            </CardHeader>
            <CardContent className="flex-grow p-0 relative flex flex-col">
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-1">
                  {isLive ? (
                    chatMessages.length > 0 ? (
                      chatMessages
                        .slice()
                        .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
                        .map((msg, index) => (
                          <motion.div
                            key={msg.id || index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                          >
                            {renderSafeChatMessage(msg)}
                          </motion.div>
                        ))
                        .filter(Boolean)
                      ) : (
                      <div className="flex h-full min-h-[200px] items-center justify-center">
                        <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
                            <MessageSquare className="h-10 w-10 mb-2" />
                            <p className="font-medium">No messages yet</p>
                            <p className="text-sm">Be the first one to chat!</p>
                        </div>
                      </div>
                      )
                  ) : (
                    <div className="flex h-full min-h-[200px] items-center justify-center p-8">
                      <div className="flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                        <div className="relative mb-6">
                          <div className="w-16 h-16 bg-gradient-to-br from-wildcats-maroon/20 to-red-800/20 rounded-full flex items-center justify-center">
                            <MessageSquare className="h-8 w-8 text-wildcats-maroon" />
                          </div>
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                          </div>
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">Chat Offline</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Join the conversation when we go live! Chat will be available during broadcast sessions.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              {isLive && showScrollBottom && (
                <div className="absolute bottom-4 right-4 z-10">
                   <Button
                    onClick={scrollToBottom}
                    size="icon"
                    className="rounded-full"
                    aria-label="Scroll to bottom"
                  >
                    <ArrowDown className="h-5 w-5" />
                  </Button>
                </div>
              )}
            </CardContent>
            <CardFooter className="px-3 py-3 mt-auto bg-white">
              {renderChatInput()}
            </CardFooter>
          </Card>
        </motion.div>
        )}

        {/* Mobile: Song Request/Poll - only show when live */}
        {(isLive || forceShowLive) && (
          <motion.div 
            className="order-3"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ 
              type: "spring",
              stiffness: 350,
              damping: 25,
              duration: 0.6,
              delay: 0.1
            }}
          >
            <Tabs defaultValue="song" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="song">
                <Music className="h-5 w-5 mr-2" />
                Song Request
              </TabsTrigger>
              <TabsTrigger value="poll">
                <Vote className="h-5 w-5 mr-2" />
                Poll
              </TabsTrigger>
            </TabsList>
            <TabsContent value="song">
              <Card>
                <CardContent className="p-6">
                {(isLive || forceShowLive) ? (
                    <>
                      {!currentUser ? (
                        <div className="flex items-center justify-center h-full py-12">
                          <div className="text-center w-full">
                            <div className="flex items-center mb-6 justify-center">
                              <div className="bg-muted rounded-full p-3 mr-4">
                                <Music className="h-6 w-6 text-muted-foreground" />
                              </div>
                              <div>
                                <h3 className="font-medium text-lg">Request a Song</h3>
                                <p className="text-sm text-muted-foreground">Let the DJ know what you'd like to hear</p>
                              </div>
                            </div>
                            <p className="text-muted-foreground mb-4">
                              Login or create an account to request songs during live broadcasts
                            </p>
                            <div className="flex space-x-3 justify-center">
                              <Button onClick={handleLoginRedirect}>
                                <LogIn className="h-4 w-4 mr-2" />
                                Login
                              </Button>
                              <Button onClick={handleRegisterRedirect} variant="secondary">
                                <UserPlus className="h-4 w-4 mr-2" />
                                Register
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <form onSubmit={handleSongRequestSubmit} className="space-y-5">
                          <div>
                            <Label htmlFor="song-title-mobile">Song Title</Label>
                            <Input
                              id="song-title-mobile"
                              type="text"
                              value={songRequest.title}
                              onChange={(e) => setSongRequest({ ...songRequest, title: e.target.value })}
                              placeholder="Enter song title"
                              required
                            />
                          </div>

                          <div>
                            <Label htmlFor="artist-mobile">Artist</Label>
                            <Input
                              id="artist-mobile"
                              type="text"
                              value={songRequest.artist}
                              onChange={(e) => setSongRequest({ ...songRequest, artist: e.target.value })}
                              placeholder="Enter artist name"
                              required
                            />
                          </div>

                          <div className="flex-grow">
                            <Label htmlFor="dedication-mobile">Dedication (Optional)</Label>
                            <Textarea
                              id="dedication-mobile"
                              value={songRequest.dedication}
                              onChange={(e) => setSongRequest({ ...songRequest, dedication: e.target.value })}
                              placeholder="Add a message or dedication"
                              className="min-h-[120px]"
                            />
                          </div>

                          <div className="mt-auto flex justify-between items-center">
                            <p className="text-xs text-muted-foreground">
                              Song requests are subject to availability and DJ's playlist.
                            </p>
                            <Button type="submit">
                              Submit Request
                            </Button>
                          </div>
                        </form>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full py-12">
                      <div className="text-center w-full">
                        <div className="flex items-center mb-8 justify-center">
                          <div className="bg-muted rounded-full p-3 mr-4">
                            <Music className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <div>
                            <h3 className="font-medium text-lg">Request a Song</h3>
                            <p className="text-sm text-muted-foreground">Let us know what you'd like to hear next</p>
                          </div>
                        </div>
                        <p className="text-muted-foreground">Song requests are only available during live broadcasts</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="poll">
              <Card>
                <CardContent className="p-6">
                {(isLive || forceShowLive) ? (
                    <>
                      {pollLoading && !activePoll ? (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground animate-pulse">Loading polls...</p>
                        </div>
                      ) : activePoll ? (
                        <div>
                          <div className="mb-4">
                            <h3 className="text-lg font-semibold mb-2">
                              {activePoll.question || activePoll.title}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {!currentUser 
                                ? 'Login to participate in the poll'
                                : activePoll.userVoted 
                                  ? 'You have voted' 
                                  : 'Choose your answer and click Vote'
                              }
                            </p>
                          </div>

                          <div className="space-y-3 mb-6">
                            {activePoll.options.map((option) => {
                              const percentage = (activePoll.userVoted && currentUser) 
                                ? Math.round((option.votes / activePoll.totalVotes) * 100) || 0 
                                : 0;
                              const isSelected = selectedPollOption === option.id;
                              const isUserChoice = activePoll.userVotedFor === option.id;
                              const canInteract = currentUser && !activePoll.userVoted;

                              return (
                                <div key={option.id}>
                                  <Button
                                    variant={isSelected || isUserChoice ? "secondary" : "outline"}
                                    className="w-full justify-between h-auto"
                                    onClick={() => canInteract && handlePollOptionSelect(option.id)}
                                    disabled={!canInteract && !activePoll.userVoted}
                                  >
                                    <span>{option.optionText || option.text}</span>
                                    {(activePoll.userVoted && currentUser) && (
                                      <span className="text-xs text-muted-foreground">{option.votes || 0} votes</span>
                                    )}
                                  </Button>
                                  {(activePoll.userVoted && currentUser) && (
                                    <div className="mt-2 space-y-1">
                                      <Progress value={percentage} className="h-2" />
                                      <span className="text-xs text-muted-foreground">{percentage}%</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div className="mt-auto flex justify-center">
                            {!currentUser ? (
                              <div className="text-center">
                                <p className="text-sm text-muted-foreground mb-3">
                                  Login to participate in polls
                                </p>
                                <div className="flex space-x-2 justify-center">
                                  <Button onClick={handleLoginRedirect}>
                                    <LogIn className="h-4 w-4 mr-2" />
                                    Login
                                  </Button>
                                  <Button onClick={handleRegisterRedirect} variant="secondary">
                                    <UserPlus className="h-4 w-4 mr-2" />
                                    Register
                                  </Button>
                                </div>
                              </div>
                            ) : activePoll.userVoted ? (
                              <div className="text-center">
                                <p className="text-sm text-muted-foreground mb-2">
                                  Total votes: {activePoll.totalVotes || 0}
                                </p>
                                <Badge variant="secondary">
                                  Voted
                                </Badge>
                              </div>
                            ) : (
                              <Button
                                onClick={handlePollVote}
                                disabled={!selectedPollOption || pollLoading}
                              >
                                {pollLoading ? 'Voting...' : 'Vote'}
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <div>
                            <p className="text-muted-foreground mb-2">No active polls</p>
                            <p className="text-sm text-muted-foreground">Active polls will appear during live broadcasts</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full py-12">
                      <div className="text-center w-full">
                        <div className="mb-8">
                          <h3 className="text-xl font-medium">Vote</h3>
                          <p className="text-sm text-muted-foreground">Which do you prefer the most?</p>
                        </div>
                        <p className="text-muted-foreground">Polls are only available during live broadcasts</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
        )}
        {streamError && !streamError.includes('Audio playback error') && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Audio Playback Issue
                </h3>
                <div className="mt-1 text-sm text-red-700 dark:text-red-300">
                  <p>{streamError}</p>
                  {streamError.includes('format') && (
                    <div className="mt-2 space-y-1">
                      <p className="font-medium">Try these solutions:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Refresh the page and try again</li>
                        <li>Use Chrome, Firefox, or Edge browser</li>
                        <li>Check if the DJ is currently broadcasting</li>
                        <li>Ensure your internet connection is stable</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}