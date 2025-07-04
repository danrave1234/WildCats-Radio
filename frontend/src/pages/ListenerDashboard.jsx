"use client"

import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  PaperAirplaneIcon,
  MusicalNoteIcon,
  ArrowPathIcon,
  UserPlusIcon,
  ArrowRightOnRectangleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/solid";
import { broadcastService, chatService, songRequestService, pollService, streamService } from "../services/api";
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from "../context/AuthContext";
import { useStreaming } from "../context/StreamingContext";
import { useLocalBackend, config } from "../config";
import { createLogger } from "../services/logger";

const logger = createLogger('ListenerDashboard');

export default function ListenerDashboard() {
  const { id: broadcastIdParam } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isSpecificBroadcast = location.pathname.startsWith('/broadcast/');

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
      // Cleanup broadcast-specific connections when no valid broadcast
      if (chatWsRef.current) {
        chatWsRef.current.disconnect();
        chatWsRef.current = null;
      }
      if (songRequestWsRef.current) {
        songRequestWsRef.current.disconnect();
        songRequestWsRef.current = null;
      }
      if (broadcastWsRef.current) {
        broadcastWsRef.current.disconnect();
        broadcastWsRef.current = null;
      }
      // Note: Keep poll WebSocket connected even without active broadcast
      // Polls might be created and updated independently of broadcast status
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

    // Note: Poll WebSocket removed - using only 3-second HTTP polling as requested

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

      // 3-second HTTP polling as requested - WebSocket removed per user request
      // This ensures polls are updated frequently using only HTTP requests
      const pollInterval = 3000; // 3 seconds as requested
      const interval = setInterval(fetchActivePolls, pollInterval);

      logger.debug('Poll HTTP polling enabled: checking every 3 seconds (WebSocket disabled)');

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
      // Validate message data
      if (!msg || !msg.sender || !msg.id || !msg.content) {
        return null;
      }

      // Construct name from firstname and lastname fields (backend sends these, not a single 'name' field)
      const firstName = msg.sender.firstname || '';
      const lastName = msg.sender.lastname || '';
      const fullName = `${firstName} ${lastName}`.trim();
      const senderName = fullName || msg.sender.email || 'Unknown User';

      // Check if user is a DJ based on their role or name
      const isDJ = (msg.sender.role && msg.sender.role.includes("DJ")) || 
                   (senderName.includes("DJ")) ||
                   (firstName.includes("DJ")) ||
                   (lastName.includes("DJ"));

      const initials = senderName.split(' ').map(part => part[0] || '').join('').toUpperCase().slice(0, 2) || 'U';

      // Handle date parsing more robustly
      let messageDate;
      try {
        messageDate = msg.createdAt ? new Date(msg.createdAt.endsWith('Z') ? msg.createdAt : msg.createdAt + 'Z') : null;
      } catch (error) {
        logger.error('Error parsing message date:', error);
        messageDate = new Date();
      }

      // Format relative time
      const timeAgo = messageDate && !isNaN(messageDate.getTime()) 
        ? formatDistanceToNow(messageDate, { addSuffix: false }) 
        : 'Just now';

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
              <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{senderName}</span>
            </div>
          </div>
          <div className="ml-10 space-y-1">
            <div className={`rounded-lg p-3 message-bubble ${isDJ ? 'bg-maroon-100 dark:bg-maroon-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
              <p className="text-sm text-gray-800 dark:text-gray-200 chat-message" style={{ wordBreak: 'break-word', wordWrap: 'break-word', overflowWrap: 'break-word', maxWidth: '100%' }}>{msg.content || 'No content'}</p>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 pl-1">
              {formattedTimeAgo} ago
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
        <p className="text-center text-gray-500 dark:text-gray-400 py-4">No messages yet</p>
      ) : (
        chatMessages
          .slice()
          .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
          .map(renderSafeChatMessage)
          .filter(Boolean) // Remove any null values from failed renders
      )}
    </div>
  );

  // Render chat input
  const renderChatInput = () => {
    if (!currentUser) {
      return (
        <div className="p-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Join the conversation! Login or create an account to chat with other listeners.
            </p>
            <div className="flex space-x-2 justify-center">
              <button
                onClick={handleLoginRedirect}
                className="flex items-center px-4 py-2 bg-maroon-600 hover:bg-maroon-700 text-white text-sm font-medium rounded-md transition-colors"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                Login
              </button>
              <button
                onClick={handleRegisterRedirect}
                className="flex items-center px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black text-sm font-medium rounded-md transition-colors"
              >
                <UserPlusIcon className="h-4 w-4 mr-2" />
                Register
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
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
  };

  return (
    <div className="container mx-auto px-4 mb-8 bg-gray-100 dark:bg-gray-900">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 pt-6">Broadcast Stream</h2>

      {/* Desktop: Grid layout */}
      <div className="hidden lg:grid lg:grid-cols-3 lg:gap-6">
        {/* Desktop Left Column - Broadcast + Song Request/Poll */}
        <div className="lg:col-span-2 space-y-6">
          {/* Broadcast Stream Visualizer */}
          <div className="bg-maroon-700 rounded-lg overflow-hidden h-[200px] flex flex-col justify-center relative">
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

          {/* Desktop Song Request/Poll section */}
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

            {/* Desktop Tab content */}
            <div className="bg-white dark:bg-gray-800 flex-grow flex flex-col h-[450px]">
              {/* Song Request Tab */}
              {activeTab === "song" && (
                <div className="p-6 flex-grow flex flex-col h-full">
                  {isLive ? (
                    <>
                      {!currentUser ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center w-full">
                            <div className="flex items-center mb-6 justify-center">
                              <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-full p-3 mr-4">
                                <MusicalNoteIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                              </div>
                              <div>
                                <h3 className="font-medium text-gray-900 dark:text-white text-lg">Request a Song</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Let the DJ know what you'd like to hear</p>
                              </div>
                            </div>
                            <p className="text-gray-600 dark:text-gray-400 mb-4">
                              Login or create an account to request songs during live broadcasts
                            </p>
                            <div className="flex space-x-3 justify-center">
                              <button
                                onClick={handleLoginRedirect}
                                className="flex items-center px-4 py-2 bg-maroon-600 hover:bg-maroon-700 text-white text-sm font-medium rounded-md transition-colors"
                              >
                                <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                                Login
                              </button>
                              <button
                                onClick={handleRegisterRedirect}
                                className="flex items-center px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black text-sm font-medium rounded-md transition-colors"
                              >
                                <UserPlusIcon className="h-4 w-4 mr-2" />
                                Register
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
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
                      )}
                    </>
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

              {/* Desktop Poll Tab */}
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
                              {!currentUser 
                                ? 'Login to participate in the poll'
                                : activePoll.userVoted 
                                  ? 'You have voted' 
                                  : 'Choose your answer and click Vote'
                              }
                            </div>
                          </div>

                          {/* Poll Options */}
                          <div className="space-y-3 mb-6 flex-grow">
                            {activePoll.options.map((option) => {
                              const percentage = (activePoll.userVoted && currentUser) 
                                ? Math.round((option.votes / activePoll.totalVotes) * 100) || 0 
                                : 0;
                              const isSelected = selectedPollOption === option.id;
                              const isUserChoice = activePoll.userVotedFor === option.id;
                              const canInteract = currentUser && !activePoll.userVoted;

                              return (
                                <div key={option.id} className="space-y-1">
                                  <div 
                                    className={`w-full border-2 rounded-lg overflow-hidden transition-all duration-200 ${
                                      !currentUser
                                        ? 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 cursor-not-allowed opacity-75'
                                        : activePoll.userVoted 
                                          ? isUserChoice
                                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                            : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700'
                                          : isSelected
                                            ? 'border-maroon-500 bg-maroon-50 dark:bg-maroon-900/20 cursor-pointer'
                                            : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-maroon-300 cursor-pointer'
                                    }`}
                                    onClick={() => canInteract && handlePollOptionSelect(option.id)}
                                  >
                                    <div className="p-3">
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                                          {option.optionText || option.text}
                                        </span>
                                        <div className="flex items-center">
                                          {(activePoll.userVoted && currentUser) && (
                                            <span className="text-xs text-gray-600 dark:text-gray-400 mr-2">
                                              {option.votes || 0} votes
                                            </span>
                                          )}
                                          {isSelected && canInteract && (
                                            <div className="w-4 h-4 bg-maroon-500 rounded-full flex items-center justify-center">
                                              <div className="w-2 h-2 bg-white rounded-full"></div>
                                            </div>
                                          )}
                                          {isUserChoice && (activePoll.userVoted && currentUser) && (
                                            <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                              </svg>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Progress bar for voted polls */}
                                      {(activePoll.userVoted && currentUser) && (
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
                            {!currentUser ? (
                              <div className="text-center">
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                  Login to participate in polls
                                </p>
                                <div className="flex space-x-2 justify-center">
                                  <button
                                    onClick={handleLoginRedirect}
                                    className="flex items-center px-4 py-2 bg-maroon-600 hover:bg-maroon-700 text-white text-sm font-medium rounded-md transition-colors"
                                  >
                                    <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                                    Login
                                  </button>
                                  <button
                                    onClick={handleRegisterRedirect}
                                    className="flex items-center px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black text-sm font-medium rounded-md transition-colors"
                                  >
                                    <UserPlusIcon className="h-4 w-4 mr-2" />
                                    Register
                                  </button>
                                </div>
                              </div>
                            ) : activePoll.userVoted ? (
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

        {/* Desktop Right Column - Live Chat */}
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
                  {chatMessages
                    .slice()
                    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
                    .map(renderSafeChatMessage)
                    .filter(Boolean)}
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
                          d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                          clipRule="evenodd" 
                        />
                      </svg>
                    </button>
                  </div>
                )}

                <div className="p-2 border-t border-gray-200 dark:border-gray-700 mt-auto">
                  {!currentUser ? (
                    <div className="p-2 text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Join the conversation! Login or create an account to chat.
                      </p>
                      <div className="flex space-x-2 justify-center">
                        <button
                          onClick={handleLoginRedirect}
                          className="flex items-center px-3 py-1.5 bg-maroon-600 hover:bg-maroon-700 text-white text-xs font-medium rounded-md transition-colors"
                        >
                          <ArrowRightOnRectangleIcon className="h-3 w-3 mr-1" />
                          Login
                        </button>
                        <button
                          onClick={handleRegisterRedirect}
                          className="flex items-center px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-black text-xs font-medium rounded-md transition-colors"
                        >
                          <UserPlusIcon className="h-3 w-3 mr-1" />
                          Register
                        </button>
                      </div>
                    </div>
                  ) : (
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
                  )}
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

      {/* Mobile: Flex column layout with custom order */}
      <div className="flex flex-col space-y-6 lg:hidden">
        {/* Mobile: Broadcast Stream - First */}
        <div className="order-1">
          <div className="bg-maroon-700 rounded-lg overflow-hidden h-[200px] flex flex-col justify-center relative">
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
        </div>

        {/* Mobile: Live Chat - Second */}
        <div className="order-2">
          <div className="bg-maroon-700 text-white p-3 rounded-t-lg">
            <h3 className="font-medium">Live Chat</h3>
            <p className="text-xs opacity-70">{Math.max(listenerCount, localListenerCount)} listeners online</p>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-lg flex-grow flex flex-col h-[400px]">
            {isLive ? (
              <>
                <div 
                  ref={chatContainerRef}
                  className="flex-grow overflow-y-auto p-4 space-y-4 chat-messages-container relative"
                >
                  {chatMessages.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-4">No messages yet</p>
                  ) : (
                    chatMessages
                      .slice()
                      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
                      .map(renderSafeChatMessage)
                      .filter(Boolean) // Remove any null values from failed renders
                  )}
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
                          d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                          clipRule="evenodd" 
                        />
                      </svg>
                    </button>
                  </div>
                )}

                <div className="p-2 border-t border-gray-200 dark:border-gray-700 mt-auto">
                  {!currentUser ? (
                    <div className="p-2 text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Join the conversation! Login or create an account to chat.
                      </p>
                      <div className="flex space-x-2 justify-center">
                        <button
                          onClick={handleLoginRedirect}
                          className="flex items-center px-3 py-1.5 bg-maroon-600 hover:bg-maroon-700 text-white text-xs font-medium rounded-md transition-colors"
                        >
                          <ArrowRightOnRectangleIcon className="h-3 w-3 mr-1" />
                          Login
                        </button>
                        <button
                          onClick={handleRegisterRedirect}
                          className="flex items-center px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-black text-xs font-medium rounded-md transition-colors"
                        >
                          <UserPlusIcon className="h-3 w-3 mr-1" />
                          Register
                        </button>
                      </div>
                    </div>
                  ) : (
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
                  )}
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

        {/* Mobile: Song Request/Poll - Third */}
        <div className="order-3">
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

            {/* Mobile Tab content */}
            <div className="bg-white dark:bg-gray-800 flex-grow flex flex-col h-[350px]">
              {/* Song Request Tab */}
              {activeTab === "song" && (
                <div className="p-6 flex-grow flex flex-col h-full">
                  {isLive ? (
                    <>
                      {!currentUser ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center w-full">
                            <div className="flex items-center mb-6 justify-center">
                              <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-full p-3 mr-4">
                                <MusicalNoteIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                              </div>
                              <div>
                                <h3 className="font-medium text-gray-900 dark:text-white text-lg">Request a Song</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Let the DJ know what you'd like to hear</p>
                              </div>
                            </div>
                            <p className="text-gray-600 dark:text-gray-400 mb-4">
                              Login or create an account to request songs during live broadcasts
                            </p>
                            <div className="flex space-x-3 justify-center">
                              <button
                                onClick={handleLoginRedirect}
                                className="flex items-center px-4 py-2 bg-maroon-600 hover:bg-maroon-700 text-white text-sm font-medium rounded-md transition-colors"
                              >
                                <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                                Login
                              </button>
                              <button
                                onClick={handleRegisterRedirect}
                                className="flex items-center px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black text-sm font-medium rounded-md transition-colors"
                              >
                                <UserPlusIcon className="h-4 w-4 mr-2" />
                                Register
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
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
                      )}
                    </>
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

              {/* Mobile Poll Tab */}
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
                              {!currentUser 
                                ? 'Login to participate in the poll'
                                : activePoll.userVoted 
                                  ? 'You have voted' 
                                  : 'Choose your answer and click Vote'
                              }
                            </div>
                          </div>

                          {/* Poll Options */}
                          <div className="space-y-3 mb-6 flex-grow">
                            {activePoll.options.map((option) => {
                              const percentage = (activePoll.userVoted && currentUser) 
                                ? Math.round((option.votes / activePoll.totalVotes) * 100) || 0 
                                : 0;
                              const isSelected = selectedPollOption === option.id;
                              const isUserChoice = activePoll.userVotedFor === option.id;
                              const canInteract = currentUser && !activePoll.userVoted;

                              return (
                                <div key={option.id} className="space-y-1">
                                  <div 
                                    className={`w-full border-2 rounded-lg overflow-hidden transition-all duration-200 ${
                                      !currentUser
                                        ? 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 cursor-not-allowed opacity-75'
                                        : activePoll.userVoted 
                                          ? isUserChoice
                                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                            : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700'
                                          : isSelected
                                            ? 'border-maroon-500 bg-maroon-50 dark:bg-maroon-900/20 cursor-pointer'
                                            : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-maroon-300 cursor-pointer'
                                    }`}
                                    onClick={() => canInteract && handlePollOptionSelect(option.id)}
                                  >
                                    <div className="p-3">
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                                          {option.optionText || option.text}
                                        </span>
                                        <div className="flex items-center">
                                          {(activePoll.userVoted && currentUser) && (
                                            <span className="text-xs text-gray-600 dark:text-gray-400 mr-2">
                                              {option.votes || 0} votes
                                            </span>
                                          )}
                                          {isSelected && canInteract && (
                                            <div className="w-4 h-4 bg-maroon-500 rounded-full flex items-center justify-center">
                                              <div className="w-2 h-2 bg-white rounded-full"></div>
                                            </div>
                                          )}
                                          {isUserChoice && (activePoll.userVoted && currentUser) && (
                                            <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                              </svg>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Progress bar for voted polls */}
                                      {(activePoll.userVoted && currentUser) && (
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
                            {!currentUser ? (
                              <div className="text-center">
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                  Login to participate in polls
                                </p>
                                <div className="flex space-x-2 justify-center">
                                  <button
                                    onClick={handleLoginRedirect}
                                    className="flex items-center px-4 py-2 bg-maroon-600 hover:bg-maroon-700 text-white text-sm font-medium rounded-md transition-colors"
                                  >
                                    <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                                    Login
                                  </button>
                                  <button
                                    onClick={handleRegisterRedirect}
                                    className="flex items-center px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black text-sm font-medium rounded-md transition-colors"
                                  >
                                    <UserPlusIcon className="h-4 w-4 mr-2" />
                                    Register
                                  </button>
                                </div>
                              </div>
                            ) : activePoll.userVoted ? (
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

      {streamError && !streamError.includes('Audio playback error') && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
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
  );
}
