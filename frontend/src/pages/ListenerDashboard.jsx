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
import { broadcastService, chatService, songRequestService, pollService, streamService, authService } from "../services/api/index.js";
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from "../context/AuthContext";
import { useStreaming } from "../context/StreamingContext";
import { useLocalBackend, config } from "../config";
import { createLogger } from "../services/logger";
import { globalWebSocketService } from '../services/globalWebSocketService';
import SpotifyPlayer from '../components/SpotifyPlayer';
import AdSense from '../components/ads/AdSense';

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
    serverConfig,
    audioRef
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

  // Slow mode display state (synced from current broadcast)
  const [slowModeEnabled, setSlowModeEnabled] = useState(false);
  const [slowModeSeconds, setSlowModeSeconds] = useState(0);
  // If a send was blocked by slow mode, we store the suggested wait time for a gentle notice
  const [slowModeWaitSeconds, setSlowModeWaitSeconds] = useState(null);

  // Song request state
  const [isSongRequestMode, setIsSongRequestMode] = useState(false);
  const [songRequestText, setSongRequestText] = useState('');

  // Relative time tick for auto-refreshing "x mins ago" labels
  const [relativeTimeTick, setRelativeTimeTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setRelativeTimeTick((prev) => prev + 1);
    }, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  // Poll state
  const [activePoll, setActivePoll] = useState(null);
  const [userVotes, setUserVotes] = useState({});

  // UI state
  const [activeTab, setActiveTab] = useState("poll");
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [_currentSong, _setCurrentSong] = useState(null);
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [isPlaybackLoading, setIsPlaybackLoading] = useState(false);

  // Local audio state for the dashboard player (separate from streaming context)
  const [localAudioPlaying, setLocalAudioPlaying] = useState(false);

  // Sync local audio state with global streaming context
  useEffect(() => {
    setLocalAudioPlaying(audioPlaying);
  }, [audioPlaying]);

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
  const pollWsRef = useRef(null);
  // Instrumentation: track which broadcastId each WS is using
  const chatWsBroadcastIdRef = useRef(null);
  const pollWsBroadcastIdRef = useRef(null);
  const songWsBroadcastIdRef = useRef(null);
  const broadcastWsBroadcastIdRef = useRef(null);
  const globalBroadcastWsRef = useRef(null); // For general broadcast status updates
  const wsConnectingRef = useRef(false); // Prevent duplicate WebSocket connections

  // UI refs
  const chatContainerRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Audio refs from ListenerDashboard2.jsx

  // Add state for listener WebSocket connection
  const [listenerWsConnected, setListenerWsConnected] = useState(false);
  const lastIsLiveRef = useRef(null);
  const lastStreamUrlRef = useRef(null);

  // Add this with other state declarations
  const [broadcastSession, setBroadcastSession] = useState(0);

  // Sync slow mode config from the current broadcast for display
  useEffect(() => {
    if (currentBroadcast) {
      setSlowModeEnabled(!!currentBroadcast.slowModeEnabled);
      setSlowModeSeconds(
        typeof currentBroadcast.slowModeSeconds === 'number'
          ? currentBroadcast.slowModeSeconds
          : 0
      );
    } else {
      setSlowModeEnabled(false);
      setSlowModeSeconds(0);
    }
  }, [currentBroadcast?.id, currentBroadcast?.slowModeEnabled, currentBroadcast?.slowModeSeconds]);

  // Utility to perform a clean fresh-start when a new broadcast goes live
  const resetForNewBroadcast = (newBroadcastId) => {
    try {
      // Clear UI/state that belongs to previous broadcast
      setChatMessages([]);
      setActivePoll(null);
      setSelectedPollOption(null);
      setUserVotes({});

      // Tear down all per-broadcast sockets
      if (chatWsRef.current) { chatWsRef.current.disconnect(); chatWsRef.current = null; }
      if (songRequestWsRef.current) { songRequestWsRef.current.disconnect(); songRequestWsRef.current = null; }
      if (broadcastWsRef.current) { broadcastWsRef.current.disconnect(); broadcastWsRef.current = null; }
      if (pollWsRef.current) { pollWsRef.current.disconnect(); pollWsRef.current = null; }

      // Apply new broadcast id and bump session to trigger clean re-subscribe
      if (newBroadcastId) {
        setCurrentBroadcastId(newBroadcastId);
      }
      setBroadcastSession((s) => s + 1);
    } catch (e) {
      logger.error('Error during resetForNewBroadcast:', e);
    }
  };

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

  // Initialize audio element and apply stream URL only when it changes — do not interrupt active playback
  useEffect(() => {
    logger.debug('Audio init/update effect:', {
      hasServerConfig: !!serverConfig,
      hasAudioEl: !!audioRef.current,
      streamUrl: serverConfig?.streamUrl,
      lastStreamUrl: lastStreamUrlRef.current
    });

    const resolvedUrl = serverConfig?.streamUrl || config.icecastUrl;

    // Create audio element once
    if (!audioRef.current) {
      logger.debug('Creating shared audio element');
      audioRef.current = new Audio();
      audioRef.current.preload = 'none';
      audioRef.current.volume = isMuted ? 0 : volume / 100;

      // Only set initial src if we have a URL and not already playing
      if (resolvedUrl) {
        audioRef.current.src = resolvedUrl;
        lastStreamUrlRef.current = resolvedUrl;
        logger.debug('Initialized audio source to:', resolvedUrl);
      }

      // Attach diagnostic listeners once
      audioRef.current.onloadstart = () => logger.debug('Audio loading started');
      audioRef.current.oncanplay = () => logger.debug('Audio can start playing');
      audioRef.current.onplay = () => logger.debug('Audio play event fired');
      audioRef.current.onpause = () => logger.debug('Audio pause event fired');
      audioRef.current.onerror = (e) => {
        const isEmptySrcError = e.target?.error?.code === 4 && e.target?.error?.message?.includes('Empty src attribute');
        if (isEmptySrcError || e.target?.error?.message?.includes('MEDIA_ELEMENT_ERROR')) {
          logger.debug('Ignoring expected audio error:', e.target?.error?.message);
          return;
        }
        logger.error('Audio error:', e);
      };
      return; // element created; do not proceed further in this tick
    }

    // If URL changed, only update src when not actively playing to avoid cutting audio
    if (resolvedUrl && lastStreamUrlRef.current !== resolvedUrl) {
      if (audioRef.current.paused) {
        audioRef.current.src = resolvedUrl;
        lastStreamUrlRef.current = resolvedUrl;
        logger.debug('Applied new audio source (paused):', resolvedUrl);
      } else {
        logger.debug('Skipping audio src update while playing to avoid interruption');
      }
    }
  }, [serverConfig?.streamUrl]);





  // Removed periodic HTTP status checks; rely entirely on WebSocket updates

  // Handle volume changes (non-disruptive)
  useEffect(() => {
    if (audioRef.current) {
      const newVolume = isMuted ? 0 : volume / 100;
      if (audioRef.current.volume !== newVolume) {
        audioRef.current.volume = newVolume;
        logger.debug('Volume updated to:', newVolume);
      }
    }
  }, [volume, isMuted]);

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
      // Capture the broadcast ID for which this request is made
      const requestBroadcastId = currentBroadcastId;
      try {
        // Cancel any previous request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        // Create new abort controller for this request
        abortControllerRef.current = new AbortController();

        // Clear old messages immediately when switching broadcasts
        setChatMessages([]);

        const response = await chatService.getMessages(requestBroadcastId);

        // Double-check that the response is for the current broadcast
        const newMessages = response.data.filter(msg => msg.broadcastId === requestBroadcastId);

        // Check if we're at the bottom before updating messages
        const container = chatContainerRef.current;
        const wasAtBottom = isAtBottom(container);

        // Update messages only if still the same broadcast
        if (currentBroadcastId === requestBroadcastId) {
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

    // When switching to a different broadcast, clear existing messages immediately
    setChatMessages([]);
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
  }, [currentBroadcastId, broadcastSession]); // Add broadcastSession as a dependency

  // Setup WebSocket connections for real-time updates after initial data is loaded
  // This replaces most HTTP polling with real-time WebSocket communication:
  // - Chat messages: Real-time via WebSocket
  // - Song requests: Real-time via WebSocket  
  // - Poll updates: Real-time via WebSocket
  // - Broadcast status: Real-time via WebSocket
  // - Listener count: Real-time via WebSocket
  // 
  // CRITICAL: We depend on both currentBroadcastId and broadcastSession
  // - currentBroadcastId: When switching to a different broadcast (each broadcast has unique ID)
  // - broadcastSession: When the same broadcast goes live (DJ starts streaming)
  //   This ensures WebSocket connections are refreshed when the DJ goes live
  // 
  // IMPORTANT: WebSocket connections should be established immediately when a broadcast goes live,
  // regardless of whether the user is playing audio or not. This ensures chat and song requests
  // work even if the user hasn't started listening yet.
  useEffect(() => {
    // Guard: Only setup WebSockets if we have a valid broadcast ID
    // We allow unauthenticated users to connect to WebSockets for listening to chat/polls
    if (!currentBroadcastId || currentBroadcastId <= 0) {
      logger.debug('Listener Dashboard: No valid broadcast ID, cleaning up WebSocket connections');
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
      if (pollWsRef.current) {
        pollWsRef.current.disconnect();
        pollWsRef.current = null;
      }
      // Note: Keep poll WebSocket connected even without active broadcast
      // Polls might be created and updated independently of broadcast status
      return;
    }

    logger.debug('Listener Dashboard: Setting up WebSocket connections for broadcast:', currentBroadcastId, 'session:', broadcastSession);
    logger.debug('Listener Dashboard: Note: WebSocket connections are independent of audio playback - they work even if user is not listening');

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
        const subscribedBroadcastId = currentBroadcastId;
        const connection = await chatService.subscribeToChatMessages(subscribedBroadcastId, (newMessage) => {
          // Instrumentation: log message broadcast alignment
          try {
            logger.info('[ChatDebug] recv', {
              msgId: newMessage?.id,
              msgBroadcastId: newMessage?.broadcastId,
              chatWsBroadcastId: chatWsBroadcastIdRef.current,
              stateBroadcastId: currentBroadcastId,
              subscribedBroadcastId,
            });
          } catch(_) { /* no-op: debug logging only */ }
          // Set connection status to true on first message - this confirms WebSocket is working
          if (!wsConnected) {
            setWsConnected(true);
            logger.debug('Listener Dashboard: WebSocket confirmed working');
          }

          // Double-check the message is for the current broadcast
          if (newMessage.broadcastId === subscribedBroadcastId) {
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
        chatWsBroadcastIdRef.current = subscribedBroadcastId;
        logger.info('[ChatDebug] chat WS connected', { usingBroadcastId: chatWsBroadcastIdRef.current });
        logger.debug('Listener Dashboard: Chat WebSocket connected successfully for broadcast:', currentBroadcastId, 'session:', broadcastSession);
      } catch (error) {
        logger.error('Listener Dashboard: Failed to connect chat WebSocket:', error);

        // No polling fallback: rely on HTTP send/fetch upon user action only
        chatWsRef.current = {
          disconnect: () => {},
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

        const subscribedBroadcastId = currentBroadcastId;
        const connection = await songRequestService.subscribeToSongRequests(subscribedBroadcastId, (newRequest) => {
          // Double-check the request is for the current broadcast
          if (newRequest.broadcastId === subscribedBroadcastId) {
            // You can add notification logic here if needed
          }
        });
        songRequestWsRef.current = connection;
        songWsBroadcastIdRef.current = subscribedBroadcastId;
        logger.debug('Listener Dashboard: Song request WebSocket connected successfully for broadcast:', currentBroadcastId, 'session:', broadcastSession);
      } catch (error) {
        logger.error('Listener Dashboard: Failed to connect song request WebSocket:', error);
      }
    };

    // Setup Poll WebSocket for poll updates (no HTTP polling)
    const setupPollWebSocket = async () => {
      try {
        if (pollWsRef.current) {
          logger.debug('Listener Dashboard: Cleaning up existing poll WebSocket');
          pollWsRef.current.disconnect();
          pollWsRef.current = null;
        }

        const subscribedBroadcastId = currentBroadcastId;
        const connection = await pollService.subscribeToPolls(subscribedBroadcastId, (pollUpdate) => {
          try {
            switch (pollUpdate.type) {
              case 'NEW_POLL': {
                const p = pollUpdate.poll;
                if (p && p.active) {
                  setActivePoll(p);
                }
                break;
              }
              case 'POLL_RESULTS': {
                const results = pollUpdate.results;
                const pollId = pollUpdate.pollId;
                if (results && pollId) {
                  setActivePoll(prev => (
                    prev && prev.id === pollId
                      ? { ...prev, options: results.options || prev.options, totalVotes: results.totalVotes ?? prev.totalVotes }
                      : prev
                  ));
                }
                break;
              }
              case 'POLL_UPDATED': {
                const p = pollUpdate.poll;
                if (p) {
                  if (p.active) {
                    setActivePoll(p);
                  } else {
                    setActivePoll(null);
                  }
                }
                break;
              }
              case 'POLL_DELETED': {
                const deletedPollId = pollUpdate.pollId || pollUpdate.id || null;
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
            logger.error('Listener Dashboard: Error handling poll update:', e);
          }
        });

        pollWsRef.current = connection;
        pollWsBroadcastIdRef.current = subscribedBroadcastId;
        logger.debug('Listener Dashboard: Poll WebSocket connected successfully for broadcast:', currentBroadcastId, 'session:', broadcastSession);
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
        const subscribedBroadcastId = currentBroadcastId;
        const connection = await broadcastService.subscribeToBroadcastUpdates(subscribedBroadcastId, (message) => {
          logger.debug('Listener Dashboard: Broadcast WebSocket message received:', message);

          switch (message.type) {
            case 'BROADCAST_STARTED':
              logger.debug('Stream started via WebSocket');
              if (message.broadcast) {
                logger.debug('Broadcast information included in message:', message.broadcast);
                logger.debug('Resetting state for new broadcast ID', message.broadcast.id, 'from', currentBroadcastId);
                // Fresh start for new broadcast
                resetForNewBroadcast(message.broadcast.id);
                setCurrentBroadcast(message.broadcast);
              } else {
                // No payload; still perform a reset to be safe
                resetForNewBroadcast(null);
              }
              logger.debug('Fetching complete broadcast information after BROADCAST_STARTED');
              fetchCurrentBroadcastInfo();
              break;

            case 'BROADCAST_ENDED':
              logger.debug('Stream ended via WebSocket');
              // Fresh clear
              resetForNewBroadcast(null);
              break;

            case 'LISTENER_COUNT_UPDATE':
              logger.debug('Listener count updated via WebSocket:', message.data?.listenerCount || 0);
              if (message.data?.listenerCount !== undefined) {
                setLocalListenerCount(message.data.listenerCount);
              }
              break;

            case 'BROADCAST_STATUS_UPDATE':
              logger.debug('Broadcast status updated via WebSocket:', message.broadcast?.status === 'LIVE');
              if (message.broadcast) {
                if (message.broadcast.status === 'LIVE') {
                  // Fresh start when status flips to LIVE (and ID may change)
                  resetForNewBroadcast(message.broadcast.id);
                  setCurrentBroadcast(message.broadcast);
                  logger.debug('Fetching complete broadcast information after status update to LIVE');
                  fetchCurrentBroadcastInfo();
                } else {
                  // Non-live; clear
                  resetForNewBroadcast(null);
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
        broadcastWsBroadcastIdRef.current = subscribedBroadcastId;
        logger.debug('Listener Dashboard: Broadcast WebSocket connected successfully for broadcast:', currentBroadcastId, 'session:', broadcastSession);
      } catch (error) {
        logger.error('Listener Dashboard: Failed to connect broadcast WebSocket:', error);
      }
    };

    // Setup WebSockets immediately - no delay needed with proper guards
    logger.debug('Listener Dashboard: Setting up WebSocket connections for broadcast:', currentBroadcastId, 'session:', broadcastSession);
    
    // Ensure we have a valid broadcast ID before setting up WebSockets
    if (currentBroadcastId && currentBroadcastId > 0) {
      // Check if we already have WebSocket connections for this broadcast ID
      const hasExistingConnections = chatWsRef.current || songRequestWsRef.current || broadcastWsRef.current || pollWsRef.current;
      
      if (hasExistingConnections) {
        logger.debug('Listener Dashboard: Cleaning up existing WebSocket connections before setting up new ones');
        // Clean up existing connections first
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
        if (pollWsRef.current) {
          pollWsRef.current.disconnect();
          pollWsRef.current = null;
        }
      }
      
      // Set up WebSocket connections immediately when broadcast ID is available
      // These connections work independently of audio playback
      setupChatWebSocket();
      setupSongRequestWebSocket();
      setupBroadcastWebSocket();
      setupPollWebSocket();
    } else {
      logger.warn('Listener Dashboard: Skipping WebSocket setup - invalid broadcast ID:', currentBroadcastId);
    }

    return () => {
      logger.debug('Listener Dashboard: Cleaning up WebSocket connections for broadcast:', currentBroadcastId, 'session:', broadcastSession);
      
      // Clean up all WebSocket connections
      if (chatWsRef.current) {
        logger.debug('Listener Dashboard: Disconnecting chat WebSocket');
        chatWsRef.current.disconnect();
        chatWsRef.current = null;
        chatWsBroadcastIdRef.current = null;
      }
      if (songRequestWsRef.current) {
        logger.debug('Listener Dashboard: Disconnecting song request WebSocket');
        songRequestWsRef.current.disconnect();
        songRequestWsRef.current = null;
        songWsBroadcastIdRef.current = null;
      }
      if (broadcastWsRef.current) {
        logger.debug('Listener Dashboard: Disconnecting broadcast WebSocket');
        broadcastWsRef.current.disconnect();
        broadcastWsRef.current = null;
        broadcastWsBroadcastIdRef.current = null;
      }
      if (pollWsRef.current) {
        logger.debug('Listener Dashboard: Disconnecting poll WebSocket');
        pollWsRef.current.disconnect();
        pollWsRef.current = null;
        pollWsBroadcastIdRef.current = null;
      }
    };
  }, [currentBroadcastId, broadcastSession]); // Depend on currentBroadcastId and broadcastSession

  // Track broadcast ID changes for debugging
  useEffect(() => {
    logger.debug('Listener Dashboard: Broadcast ID changed to:', currentBroadcastId, 'session:', broadcastSession);
    
    // If we have a valid broadcast ID, ensure WebSocket connections are set up
    if (currentBroadcastId && currentBroadcastId > 0) {
      logger.debug('Listener Dashboard: Valid broadcast ID detected, ensuring WebSocket connections are active');
    }
  }, [currentBroadcastId, broadcastSession]);


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
    let broadcastIdToUse = currentBroadcastId || currentBroadcast?.id;
    if (!chatMessage.trim()) return;

    // If we still don't have a broadcast ID at send time, try to resolve it immediately
    if (!broadcastIdToUse) {
      // Prefer broadcastId from latest listener WS payload if present on window
      const wsState = window.__wildcats_stream_state__;
      if (wsState?.broadcastId && Number.isFinite(wsState.broadcastId)) {
        broadcastIdToUse = wsState.broadcastId;
        setCurrentBroadcastId(broadcastIdToUse);
      } else {
        try {
          logger.debug('No broadcastId at send time; resolving current broadcast before sending...');
          await fetchCurrentBroadcastInfo();
          broadcastIdToUse = currentBroadcastId || currentBroadcast?.id;
        } catch (e2) {
          logger.error('Failed to resolve current broadcast before sending message:', e2);
        }
        if (!broadcastIdToUse) {
          alert('Chat is not connected to an active broadcast yet. Please wait a moment and try again.');
          setChatMessage(messageToSend);
          return;
        }
      }
    }

    // Validate message length
    if (chatMessage.length > 1500) {
      alert("Message cannot exceed 1500 characters");
      return;
    }

    const messageToSend = chatMessage.trim();
    setChatMessage(''); // Clear input immediately for better UX

    try {
      // Always send via HTTP to guarantee authentication; use WS for receiving only
      const messageData = { content: messageToSend };
      logger.info('[ChatDebug] send', {
        sendingToBroadcastId: broadcastIdToUse,
        chatWsBroadcastId: chatWsBroadcastIdRef.current,
        stateBroadcastId: currentBroadcastId,
        wsStateBroadcastId: (window.__wildcats_stream_state__ || {}).broadcastId || null,
      });
      await chatService.sendMessage(broadcastIdToUse, messageData);

      // Clear any previous slow-mode wait notice on successful send
      setSlowModeWaitSeconds(null);

      // Refresh messages to reflect the sent message immediately
      const updatedMessages = await chatService.getMessages(broadcastIdToUse);
      setChatMessages(updatedMessages.data);
      scrollToBottom();
    } catch (error) {
      logger.error("Error sending chat message:", error);
      if (error.response?.data?.message?.includes("1500 characters")) {
        alert("Message cannot exceed 1500 characters");
      } else {
        const apiStatus = error.response?.status;
        if (apiStatus === 401) {
          alert('Your session expired. Please log in again.');
          handleLoginRedirect();
        } else if (apiStatus === 429) {
          const headers = error.response?.headers || {};
          const retryAfter = headers['retry-after'] || headers['Retry-After'] || headers['Retry-after'];
          const sec = parseInt(retryAfter, 10);
          // Store suggested wait seconds for gentle inline notice (fallback to configured slow mode seconds)
          const waitSec = Number.isFinite(sec) ? sec : (slowModeSeconds || null);
          setSlowModeWaitSeconds(waitSec);
          // No alert popup – inline text will inform the user
        } else {
          alert("Failed to send message. Please try again.");
        }
      }
      setChatMessage(messageToSend); // Restore the message if sending failed
    }
  };

  // Instrumentation: Poll and log the broadcastId being used across layers
  useEffect(() => {
    let last = {};
    const logIfChanged = (label, value) => {
      if (last[label] !== value) {
        last[label] = value;
        logger.info('[ChatDebug] state', { label, value });
      }
    };
    const interval = setInterval(() => {
      const wsState = (window.__wildcats_stream_state__ || {});
      logIfChanged('state.currentBroadcastId', currentBroadcastId || null);
      logIfChanged('ws.listener.broadcastId', wsState.broadcastId || null);
      logIfChanged('chat.ws.broadcastId', chatWsBroadcastIdRef.current || null);
      logIfChanged('poll.ws.broadcastId', pollWsBroadcastIdRef.current || null);
      logIfChanged('song.ws.broadcastId', songWsBroadcastIdRef.current || null);
      logIfChanged('broadcast.ws.broadcastId', broadcastWsBroadcastIdRef.current || null);
    }, 3000);
    return () => clearInterval(interval);
  }, [currentBroadcastId]);

  // Watchdog: if listener WS reports a different live broadcastId than our state, force a reset
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const wsState = (window.__wildcats_stream_state__ || {});
        const wsBroadcastId = wsState.broadcastId || null;
        const wsLive = !!wsState.isLive;

        if (wsLive && wsBroadcastId && wsBroadcastId !== currentBroadcastId) {
          logger.warn('[ChatDebug] mismatch detected, forcing reset', {
            wsBroadcastId,
            stateBroadcastId: currentBroadcastId,
            chatWsBroadcastId: chatWsBroadcastIdRef.current,
          });
          resetForNewBroadcast(wsBroadcastId);
          fetchCurrentBroadcastInfo().catch(() => {});
        }
      } catch (_) { /* no-op: periodic check */ }
    }, 1000);
    return () => clearInterval(interval);
  }, [currentBroadcastId]);

  // Helper function to fetch current broadcast info
  const fetchCurrentBroadcastInfo = async () => {
    setBroadcastLoading(true);
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
    } finally {
      setBroadcastLoading(false);
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
                logger.debug('Updating broadcast ID from', currentBroadcastId, 'to', message.broadcast.id, 'via global WebSocket');
                setCurrentBroadcast(message.broadcast);
                setCurrentBroadcastId(message.broadcast.id);
                // This will immediately trigger WebSocket setup for chat and song requests
                logger.debug('Broadcast ID updated, WebSocket connections will be established immediately');
              }
              // Always fetch complete details to ensure UI is up-to-date
              logger.debug('Fetching complete broadcast information via global WebSocket after BROADCAST_STARTED');
              fetchCurrentBroadcastInfo();
              setBroadcastSession((s) => s + 1); // <--- increment session when broadcast starts
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
                logger.debug('Updating broadcast ID from', currentBroadcastId, 'to', message.broadcast.id, 'via global status update');
                setCurrentBroadcast(message.broadcast);
                setCurrentBroadcastId(message.broadcast.id);
                // This will immediately trigger WebSocket setup for chat and song requests
                logger.debug('Broadcast went live, WebSocket connections will be established immediately');
                // Fetch complete details for the new live broadcast
                logger.debug('Fetching complete broadcast information for newly live broadcast');
                fetchCurrentBroadcastInfo();
                setBroadcastSession((s) => s + 1); // <--- increment session when broadcast goes live
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

  // Load active poll once on broadcast/session change; subsequent updates arrive via WebSocket
  useEffect(() => {
    const loadInitialPoll = async () => {
      if (!currentBroadcastId) {
        setActivePoll(null);
        return;
      }
      try {
        const response = await pollService.getActivePollsForBroadcast(currentBroadcastId);
        if (response.data && response.data.length > 0) {
          const firstActive = response.data[0];
          setActivePoll({
            ...firstActive,
            totalVotes: firstActive.options.reduce((sum, option) => sum + option.votes, 0),
            userVoted: false
          });
        } else {
          setActivePoll(null);
        }
      } catch (e) {
        logger.error('Error loading initial active poll:', e);
      }
    };

    loadInitialPoll();
  }, [currentBroadcastId, broadcastSession]);

  // Toggle play/pause with enhanced logic from ListenerDashboard2.jsx
  const togglePlay = async () => {
    logger.debug('Toggle play called, current state:', { 
      localAudioPlaying, 
      wsReadyState: listenerWsConnected,
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
        if (listenerWsConnected) {
          const message = {
            type: 'LISTENER_STATUS',
            action: 'STOP_LISTENING',
            broadcastId: currentBroadcastId,
            userId: currentUser?.id || null,
            userName: currentUser?.firstName || currentUser?.name || 'Anonymous Listener',
            timestamp: Date.now()
          };
          globalWebSocketService.sendListenerStatusMessage(JSON.stringify(message));
          logger.debug('Sent listener stop message to server:', message);
        }
      } else {
        logger.debug('Starting playback');

        // Clear any previous errors
        setFilteredStreamError(null);

        // Improved URL handling with format fallbacks
        let streamUrl = serverConfig.streamUrl;

        // Ensure proper protocol (force HTTPS for listener stream)
        if (!/^https?:\/\//i.test(streamUrl)) {
          streamUrl = `https://${streamUrl}`;
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
                if (listenerWsConnected) {
                  const message = {
                    type: 'LISTENER_STATUS',
                    action: 'START_LISTENING',
                    broadcastId: currentBroadcastId,
                    userId: currentUser?.id || null,
                    userName: currentUser?.firstName || currentUser?.name || 'Anonymous Listener',
                    timestamp: Date.now()
                  };
                  globalWebSocketService.sendListenerStatusMessage(JSON.stringify(message));
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
                if (listenerWsConnected) {
                  const message = {
                    type: 'LISTENER_STATUS',
                    action: 'STOP_LISTENING',
                    broadcastId: currentBroadcastId,
                    userId: currentUser?.id || null,
                    userName: currentUser?.firstName || currentUser?.name || 'Anonymous Listener',
                    timestamp: Date.now()
                  };
                  globalWebSocketService.sendListenerStatusMessage(JSON.stringify(message));
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
  const handleSongRequest = async () => {
    if (!currentUser) {
      handleLoginRedirect();
      return;
    }
    const broadcastIdToUse = currentBroadcastId || currentBroadcast?.id;
    if (!broadcastIdToUse) return;

    if (!isSongRequestMode) {
      // Enter song request mode
      setIsSongRequestMode(true);
      setSongRequestText('');
    } else {
      // Submit the song request
      if (!songRequestText.trim()) return;

      try {
        await songRequestService.createRequest(broadcastIdToUse, { songTitle: songRequestText.trim() });
        // Reset to normal chat mode after successful submission
        setIsSongRequestMode(false);
        setSongRequestText('');
      } catch (error) {
        logger.error('Error submitting song request:', error);
      }
    }
  };

  const handleCancelSongRequest = () => {
    setIsSongRequestMode(false);
    setSongRequestText('');
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

  // Moderation: prompt-based user ban for ADMIN/MODERATOR
  const handleBanUserPrompt = async (targetUser) => {
    try {
      if (!currentUser || !targetUser || !targetUser.id) return;
      const role = currentUser.role;
      const canModerate = role === 'ADMIN' || role === 'MODERATOR';
      if (!canModerate) return;
      if (targetUser.id === currentUser.id) {
        alert('You cannot ban yourself.');
        return;
      }
      if (targetUser.role === 'ADMIN') {
        alert('You cannot ban an ADMIN.');
        return;
      }

      const unitInput = (window.prompt('Enter ban duration unit (DAYS, WEEKS, YEARS, PERMANENT):', 'DAYS') || '').toUpperCase().trim();
      if (!unitInput) return;
      if (!['DAYS', 'WEEKS', 'YEARS', 'PERMANENT'].includes(unitInput)) {
        alert('Invalid unit. Use DAYS, WEEKS, YEARS, or PERMANENT.');
        return;
      }
      let amount = null;
      if (unitInput !== 'PERMANENT') {
        const amtStr = window.prompt(`Enter amount for ${unitInput.toLowerCase()} (positive integer):`, '1');
        if (amtStr == null) return; // cancelled
        const parsed = parseInt(amtStr, 10);
        if (!(parsed > 0)) {
          alert('Amount must be a positive integer.');
          return;
        }
        amount = parsed;
      }
      const reason = window.prompt('Enter reason for the ban (optional):', '') || null;

      const payload = { unit: unitInput, amount, reason };
      await authService.banUser(targetUser.id, payload);
      alert(`User ${targetUser.firstname || ''} ${targetUser.lastname || ''} has been banned${unitInput === 'PERMANENT' ? ' permanently' : ` for ${amount} ${unitInput.toLowerCase()}`}.`);
    } catch (err) {
      console.error('Failed to ban user:', err);
      const msg = err?.response?.status === 403 ? 'Forbidden: You do not have permission.' : 'Failed to ban user.';
      alert(msg);
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
        messageDate = msg.createdAt
          ? new Date(typeof msg.createdAt === 'string' && !msg.createdAt.endsWith('Z') ? msg.createdAt + 'Z' : msg.createdAt)
          : null;
      } catch (error) {
        logger.error('Error parsing message date:', error);
        messageDate = new Date();
      }

      // Format relative time
      const timeAgo = messageDate && !isNaN(messageDate.getTime()) 
        ? formatDistanceToNow(messageDate, { addSuffix: false }) 
        : 'just now';

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
            <div className="ml-2 overflow-hidden flex items-center gap-2">
              <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{senderName}</span>
              {currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'MODERATOR') && msg.sender?.id !== currentUser.id && msg.sender?.role !== 'ADMIN' && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleBanUserPrompt(msg.sender); }}
                  title="Ban user"
                  className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                >
                  Ban
                </button>
              )}
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
      <div>
        {(slowModeEnabled && slowModeSeconds > 0) && (
          <p className="text-[11px] text-gray-600 dark:text-gray-300 mb-1">Slow mode: {slowModeSeconds} second{slowModeSeconds === 1 ? '' : 's'}</p>
        )}
        {(typeof slowModeWaitSeconds === 'number' && slowModeWaitSeconds > 0) && (
          <p className="text-[11px] text-amber-700 dark:text-amber-400 mb-1">Please wait {slowModeWaitSeconds} second{slowModeWaitSeconds === 1 ? '' : 's'} before sending another message.</p>
        )}
        <form onSubmit={handleChatSubmit} className="flex items-center space-x-2">
        <input
          type="text"
          value={isSongRequestMode ? songRequestText : chatMessage}
          onChange={(e) => {
            // Limit input to 1500 characters
            if (e.target.value.length <= 1500) {
              if (isSongRequestMode) {
                setSongRequestText(e.target.value);
              } else {
                setChatMessage(e.target.value);
              }
            }
          }}
          placeholder={isSongRequestMode ? "Enter song title..." : "Type your message..."}
          className={`flex-1 p-2 border rounded-l-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-300 ease-in-out ${
            isSongRequestMode 
              ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-500 focus:ring-yellow-500 animate-pulse" 
              : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-maroon-500"
          }`}
          disabled={!isLive || !(currentBroadcastId || currentBroadcast?.id)}
          maxLength={1500}
        />

        {/* Request Song button on the left, Send button on the right */}
        {isSongRequestMode ? (
          <>
            <button
              type="button"
              onClick={handleSongRequest}
              disabled={!isLive || !(currentBroadcastId || currentBroadcast?.id) || !songRequestText.trim()}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                isLive && songRequestText.trim() ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Request
            </button>
            <button
              type="button"
              onClick={handleCancelSongRequest}
              disabled={!isLive || !(currentBroadcastId || currentBroadcast?.id)}
              className="px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 bg-red-500 hover:bg-red-600 text-white"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleSongRequest}
              disabled={!isLive || !(currentBroadcastId || currentBroadcast?.id)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                isLive ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Request Song
            </button>
            <button
              type="submit"
              disabled={!isLive || !(currentBroadcastId || currentBroadcast?.id) || !chatMessage.trim()}
              className={`p-2 rounded-r-md transition-all duration-300 ${
                isLive && chatMessage.trim()
                  ? "bg-maroon-700 hover:bg-maroon-800 text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          </>
        )}
      </form>
      </div>
    );
  };

  useEffect(() => {
    if (!serverConfig?.wsBaseUrl) return;
    const wsUrl = `${serverConfig.wsBaseUrl}/ws/listener`;
    globalWebSocketService.connectListenerStatusWebSocket(wsUrl);

    // Register callbacks
    const handleOpen = () => {
      setListenerWsConnected(true);
      logger.info('Listener WebSocket connected (via global service)');
      // Optionally send initial status message
      if (audioRef.current && !audioRef.current.paused && localAudioPlaying) {
        const message = {
          type: 'LISTENER_STATUS',
          action: 'START_LISTENING',
          broadcastId: currentBroadcastId,
          userId: currentUser?.id || null,
          userName: currentUser?.firstName || currentUser?.name || 'Anonymous Listener',
          timestamp: Date.now()
        };
        globalWebSocketService.sendListenerStatusMessage(JSON.stringify(message));
        logger.debug('Sent initial listener status on WebSocket connect: listening', message);
      }
    };
    globalWebSocketService.onListenerStatusOpen(handleOpen);

    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        logger.debug('Listener WebSocket message received:', data);
        if (data.type === 'STREAM_STATUS') {
          logger.debug('ListenerDashboard: Stream status updated via WebSocket:', data.isLive);
          if (data.listenerCount !== undefined) {
            logger.debug('ListenerDashboard: Updating listener count to:', data.listenerCount);
            setLocalListenerCount(data.listenerCount);
          }

          // Detect live status transitions and react immediately
          if (typeof data.isLive === 'boolean') {
            const prev = lastIsLiveRef.current;
            lastIsLiveRef.current = data.isLive;

            // When stream just went live, immediately fetch current broadcast and refresh session
            if (data.isLive && prev !== true) {
              logger.debug('ListenerDashboard: Detected live transition');
              // Fresh start: clear all and re-subscribe with the new ID
              if (data.broadcastId) {
                logger.debug('ListenerDashboard: Using broadcastId from WS:', data.broadcastId);
                resetForNewBroadcast(data.broadcastId);
              } else {
                // No id included; still force a reset and let fetch resolve the id
                resetForNewBroadcast(null);
              }
              // Fetch complete current broadcast info in background
              fetchCurrentBroadcastInfo().catch((e) => logger.error('Error fetching current broadcast after live transition:', e));
            }

            // When stream ended, clear current broadcast
            if (!data.isLive && prev !== false) {
              logger.debug('ListenerDashboard: Detected end of stream, clearing current broadcast');
              resetForNewBroadcast(null);
            }
          }
        }
      } catch (error) {
        logger.error('Error parsing WebSocket message:', error);
      }
    };
    globalWebSocketService.onListenerStatusMessage(handleMessage);

    const handleClose = (event) => {
      setListenerWsConnected(false);
      logger.info(`Listener WebSocket disconnected (via global service): ${event.code}, reason: ${event.reason}`);
    };
    globalWebSocketService.onListenerStatusClose(handleClose);

    const handleError = (error) => {
      logger.error('Listener WebSocket error (via global service):', error);
    };
    globalWebSocketService.onListenerStatusError(handleError);

    return () => {
      // Optionally disconnect on unmount
      globalWebSocketService.disconnectListenerStatusWebSocket();
    };
  }, [serverConfig?.wsBaseUrl, currentBroadcastId, currentUser, localAudioPlaying]);

  return (
    <div className="container mx-auto px-4 mb-8 bg-gray-100 dark:bg-gray-900">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 pt-6">Broadcast Stream</h2>

      {/* Desktop: Grid layout */}
      <div className="hidden lg:grid lg:grid-cols-3 lg:gap-6">
        {/* Desktop Left Column - Broadcast + Poll */}
        <div className="lg:col-span-2 space-y-6">
          {/* Spotify-style Music Player */}
          <SpotifyPlayer />

          {/* Desktop Poll section */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex-grow">
            {/* Tab header */}
            <div className="flex">
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
                          className="flex items-center px-3 py-2 bg-maroon-600 hover:bg-maroon-700 text-white text-sm font-medium rounded-md transition-colors"
                        >
                          <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                          Login
                        </button>
                        <button
                          onClick={handleRegisterRedirect}
                          className="flex items-center px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-black text-sm font-medium rounded-md transition-colors"
                        >
                          <UserPlusIcon className="h-4 w-4 mr-2" />
                          Register
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {(slowModeEnabled && slowModeSeconds > 0) && (
                        <p className="text-[11px] text-gray-600 dark:text-gray-300 mb-1">Slow mode: {slowModeSeconds} second{slowModeSeconds === 1 ? '' : 's'}</p>
                      )}
                      {(typeof slowModeWaitSeconds === 'number' && slowModeWaitSeconds > 0) && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 mb-1">Please wait {slowModeWaitSeconds} second{slowModeWaitSeconds === 1 ? '' : 's'} before sending another message.</p>
                      )}
                    <form onSubmit={handleChatSubmit} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={isSongRequestMode ? songRequestText : chatMessage}
                        onChange={(e) => {
                          // Limit input to 1500 characters
                          if (e.target.value.length <= 1500) {
                            if (isSongRequestMode) {
                              setSongRequestText(e.target.value);
                            } else {
                              setChatMessage(e.target.value);
                            }
                          }
                        }}
                        placeholder={isSongRequestMode ? "Enter song title..." : "Type your message..."}
                        className={`flex-1 p-2 border rounded-l-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-300 ease-in-out ${
                          isSongRequestMode 
                            ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-500 focus:ring-yellow-500 animate-pulse" 
                            : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-maroon-500"
                        }`}
                        disabled={!isLive}
                        maxLength={1500}
                      />

                      {/* Request Song button on the left, Send button on the right */}
                      {isSongRequestMode ? (
                        <>
                          <button
                            type="button"
                            onClick={handleSongRequest}
                            disabled={!isLive || !songRequestText.trim()}
                            className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                              isLive && songRequestText.trim() ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            Request
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelSongRequest}
                            disabled={!isLive}
                            className="px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 bg-red-500 hover:bg-red-600 text-white"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={handleSongRequest}
                            disabled={!isLive}
                            className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                              isLive ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            Request Song
                          </button>
                          <button
                            type="submit"
                            disabled={!isLive || !chatMessage.trim()}
                            className={`p-2 rounded-r-md transition-all duration-300 ${
                              isLive && chatMessage.trim()
                                ? "bg-maroon-700 hover:bg-maroon-800 text-white"
                                : "bg-gray-300 text-gray-500 cursor-not-allowed"
                            }`}
                          >
                            <PaperAirplaneIcon className="h-5 w-5" />
                          </button>
                        </>
                      )}
                    </form>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 dark:text-gray-400">Live chat is only available during broadcasts</p>
              </div>
            )}
          </div>
        </div>

        {/* Sponsored Ad - Desktop only */}
        <div className="mt-4 hidden lg:block">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Sponsored</div>
            <AdSense
              slot={import.meta.env.VITE_ADSENSE_SLOT_LISTENER || '0000000000'}
              format="auto"
              responsive="true"
              style={{ display: 'block', minHeight: '90px' }}
            />
          </div>
        </div>
      </div>

      {/* Mobile: Single column layout */}
      <div className="lg:hidden space-y-6">
        {/* Mobile Spotify-style Music Player */}
        <SpotifyPlayer />

        {/* Mobile Tabs */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {/* Tab headers */}
          <div className="flex">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 py-3 px-4 text-center text-sm font-medium ${
                activeTab === "chat"
                  ? "border-b-2 border-maroon-700 text-maroon-700 dark:border-maroon-500 dark:text-maroon-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 border-b border-gray-200 dark:border-gray-700"
              }`}
            >
              Live Chat
            </button>
            <button
              onClick={() => setActiveTab("poll")}
              className={`flex-1 py-3 px-4 text-center text-sm font-medium ${
                activeTab === "poll"
                  ? "border-b-2 border-maroon-700 text-maroon-700 dark:border-maroon-500 dark:text-maroon-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 border-b border-gray-200 dark:border-gray-700"
              }`}
            >
              Poll
            </button>
          </div>

          {/* Mobile Tab content */}
          <div className="bg-white dark:bg-gray-800 p-4">
            {activeTab === "chat" && (
              <div>
                {renderChatMessages()}
                {renderChatInput()}
              </div>
            )}
            {activeTab === "poll" && (
              <div>
                {/* Poll content */}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Bare-bones note: ListenerDashboard component kept as-is for stability.
