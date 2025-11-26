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
import { UserIcon, ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import Toast from "../components/Toast";
import { broadcastService, chatService, songRequestService, pollService, streamService, authService, radioService } from "../services/api/index.js";
import { broadcastApi } from "../services/api/broadcastApi";
import { format, formatDistanceToNow } from 'date-fns';
import { useAuth } from "../context/AuthContext";
import { useStreaming } from "../context/StreamingContext";
import { useLocalBackend, config } from "../config";
import { createLogger } from "../services/logger";
import stompClientManager from '../services/stompClientManager';
import SpotifyPlayer from '../components/SpotifyPlayer';
import SEO from '../components/SEO';
import { generateRadioStationData, generateBroadcastEventData } from '../utils/structuredData';

const logger = createLogger('ListenerDashboard');

export default function ListenerDashboard() {
  const { id: broadcastIdParam } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isSpecificBroadcast = location.pathname.startsWith('/broadcast/');

  // Get streaming context
  const { 
    isLive: streamContextIsLive,
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

  // Toast notification state (UI only)
  const [toast, setToast] = useState({ visible: false, message: "", type: "success" });
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
  // Local last-sent timestamp to prevent rapid sends even before the backend responds
  const [lastChatSentAt, setLastChatSentAt] = useState(null);

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
  const [recoveryNotification, setRecoveryNotification] = useState(null);
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

  // Current active DJ state
  const [currentActiveDJ, setCurrentActiveDJ] = useState(null);

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
  const broadcastEndedRef = useRef(false); // Track if broadcast was explicitly ended

  // Add this with other state declarations
  const [broadcastSession, setBroadcastSession] = useState(0);

  // Radio server state (Liquidsoap status)
  const [radioServerState, setRadioServerState] = useState("running"); // "running" | "stopped" | "unknown" - assume running initially
  const radioStatusPollRef = useRef(null);
  const isFetchingRadioStatusRef = useRef(false); // Prevent concurrent API calls
  const isFetchingBroadcastInfoRef = useRef(false); // Prevent concurrent broadcast API calls

  // Compute actual "isLive" state: requires BOTH broadcast to be live AND radio server to be running
  // This prevents showing "live" UI when Liquidsoap is stopped
  // Allow 'unknown' state to be treated as potentially live (don't block on uncertainty)
  const isLive = streamContextIsLive && radioServerState !== 'stopped';

  // Radio Server Status Check (fallback only - WebSocket provides real-time updates)
  const fetchRadioStatus = async () => {
    // Prevent concurrent API calls to avoid spamming
    if (isFetchingRadioStatusRef.current) {
      logger.debug('Radio status fetch already in progress, skipping');
      return;
    }

    isFetchingRadioStatusRef.current = true;
    try {
      const response = await radioService.status();
      const data = response?.data || {};
      const state = data.state || "unknown";

      logger.debug('Radio status fetched (Listener Dashboard fallback):', {
        state,
        fullResponse: data,
        timestamp: new Date().toISOString()
      });

      setRadioServerState(state);
    } catch (error) {
      logger.error('Failed to fetch radio server status (Listener Dashboard fallback):', error);
      setRadioServerState("unknown");
    } finally {
      isFetchingRadioStatusRef.current = false;
    }
  };

  // Minimal fallback polling - only if listener WebSocket is NOT connected
  // WebSocket (ListenerStatusHandler) already provides real-time updates for radio server status.
  useEffect(() => {
    // If listener WebSocket is connected, rely entirely on WebSocket data (no HTTP polling)
    if (listenerWsConnected) {
      if (radioStatusPollRef.current) {
        clearInterval(radioStatusPollRef.current);
        radioStatusPollRef.current = null;
      }
      return;
    }

    // Initial check immediately to avoid delays when WebSocket is unavailable
    fetchRadioStatus();

    // Set up minimal polling interval as ultimate fallback
    radioStatusPollRef.current = setInterval(fetchRadioStatus, 300000); // 5 minutes

    return () => {
      if (radioStatusPollRef.current) {
        clearInterval(radioStatusPollRef.current);
        radioStatusPollRef.current = null;
      }
    };
  }, [listenerWsConnected]);

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

  // Fetch current active DJ when broadcast is live
  useEffect(() => {
    const fetchCurrentActiveDJ = async () => {
      if (currentBroadcast?.status === 'LIVE' && currentBroadcast?.id) {
        try {
          const response = await broadcastApi.getCurrentActiveDJ(currentBroadcast.id);
          setCurrentActiveDJ(response.data);
        } catch (error) {
          logger.error('Error fetching current active DJ:', error);
          // Fallback to startedBy if available
          if (currentBroadcast?.startedBy) {
            setCurrentActiveDJ(currentBroadcast.startedBy);
          }
        }
      } else {
        setCurrentActiveDJ(null);
      }
    };

    fetchCurrentActiveDJ();
    // Refresh every 30 seconds
    const interval = setInterval(fetchCurrentActiveDJ, 30000);
    return () => clearInterval(interval);
  }, [currentBroadcast?.id, currentBroadcast?.status]);

  // Clear current active DJ when broadcast ends (real-time via WebSocket)
  useEffect(() => {
    if (currentBroadcast && currentBroadcast.status !== 'LIVE') {
      setCurrentActiveDJ(null);
    }
  }, [currentBroadcast?.status]);

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

    // Audio element is managed by StreamingContext - just ensure URL is set
    if (!audioRef.current) {
      logger.debug('Audio element not yet created by StreamingContext');
      return; // Wait for StreamingContext to create the element
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

  // Volume is managed by StreamingContext

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
              // Always scroll if it's the current user's message
              const isOwnMessage = currentUser && newMessage.userId === currentUser.id;

              // Use spread operator for a new array and sort properly
              const updated = [...prev, newMessage].sort((a, b) =>
                  new Date(a.createdAt) - new Date(b.createdAt)
              );

              // Auto-scroll logic:
              // - Always scroll if it's the user's own message
              // - Only scroll if user was already at bottom for other messages
              if (isOwnMessage || wasAtBottom) {
                setTimeout(() => {
                  scrollToBottom();
                  setShowScrollBottom(false);
                }, 50);
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
                  // Set poll immediately for real-time display (optimistic update)
                  setActivePoll({
                    ...p,
                    userVoted: false,
                    userVotedFor: null
                  });
                  
                  // Check user vote status in background (non-blocking)
                  if (currentUser) {
                    pollService.getUserVote(p.id)
                      .then(userVoteResponse => {
                        setActivePoll(prev => (
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
                        logger.debug('Could not fetch user vote status for new poll:', error);
                        // Keep poll displayed, vote status will remain false
                      });
                  }
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
                  // Keep showing poll even if ended - show results
                  // Only clear if poll has no votes and is not active
                  const hasVotes = p.options?.some(opt => (opt.votes || 0) > 0) || p.totalVotes > 0;
                  if (p.active || hasVotes) {
                    // Set poll immediately for real-time display (optimistic update)
                    setActivePoll(prev => {
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
                    if (currentUser) {
                      pollService.getUserVote(p.id)
                        .then(userVoteResponse => {
                          setActivePoll(prev => (
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
                          logger.debug('Could not fetch user vote status for updated poll:', error);
                          // Keep poll displayed, vote status will remain as-is
                        });
                    }
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
              broadcastEndedRef.current = true; // Mark broadcast as explicitly ended
              // Fresh clear
              resetForNewBroadcast(null);
              // Clear current active DJ immediately when broadcast ends
              setCurrentActiveDJ(null);
              break;

            case 'LISTENER_COUNT_UPDATE':
              logger.debug('Listener count updated via WebSocket:', message.data?.listenerCount || 0);
              if (message.data?.listenerCount !== undefined) {
                setLocalListenerCount(message.data.listenerCount);
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

            case 'BROADCAST_RECOVERY':
              logger.info('Listener Dashboard: Broadcast recovery notification:', message);

              // Show recovery notification to listeners
              setRecoveryNotification({
                message: message.message || 'Broadcast recovered after brief interruption',
                timestamp: message.timestamp
              });

              if (message.broadcast) {
                setCurrentBroadcast(message.broadcast);
              }

              // Hide notification after 5 seconds
              setTimeout(() => {
                setRecoveryNotification(null);
              }, 5000);
              break;

            case 'BROADCAST_UPDATED':
              logger.debug('Listener Dashboard: Broadcast updated via WebSocket:', message);
              if (message.broadcast && (!currentBroadcastId || message.broadcast.id === currentBroadcastId)) {
                setCurrentBroadcast(message.broadcast);
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

    // Setup Handover WebSocket for current DJ updates
    const setupHandoverWebSocket = async () => {
      try {
        const subscribedBroadcastId = currentBroadcastId;
        
        // Subscribe to current DJ updates
        const currentDJSubscription = await stompClientManager.subscribe(
          `/topic/broadcast/${subscribedBroadcastId}/current-dj`,
          (message) => {
            try {
              const data = JSON.parse(message.body);
              if (data.type === "CURRENT_DJ_UPDATE" && data.broadcastId === subscribedBroadcastId) {
                logger.info('Listener Dashboard: Current DJ update received:', data);
                if (data.currentDJ) {
                  setCurrentActiveDJ(data.currentDJ);
                }
              }
            } catch (error) {
              logger.error('Error parsing current DJ message:', error);
            }
          }
        );

        // Subscribe to handover events
        const handoverSubscription = await stompClientManager.subscribe(
          `/topic/broadcast/${subscribedBroadcastId}/handover`,
          (message) => {
            try {
              const data = JSON.parse(message.body);
              if (data.type === "DJ_HANDOVER" && data.broadcastId === subscribedBroadcastId) {
                logger.info('Listener Dashboard: Handover event received:', data);
                // Update current active DJ
                if (data.handover?.newDJ) {
                  setCurrentActiveDJ(data.handover.newDJ);
                }
              }
            } catch (error) {
              logger.error('Error parsing handover message:', error);
            }
          }
        );

        // Store subscriptions for cleanup
        if (!broadcastWsRef.current) {
          broadcastWsRef.current = {};
        }
        broadcastWsRef.current.handoverSubscriptions = { currentDJSubscription, handoverSubscription };
        logger.debug('Listener Dashboard: Handover WebSocket connected successfully for broadcast:', currentBroadcastId);
      } catch (error) {
        logger.error('Listener Dashboard: Failed to connect handover WebSocket:', error);
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
      setupHandoverWebSocket();
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
        // Clean up handover subscriptions if they exist
        if (broadcastWsRef.current.handoverSubscriptions) {
          if (broadcastWsRef.current.handoverSubscriptions.currentDJSubscription?.unsubscribe) {
            broadcastWsRef.current.handoverSubscriptions.currentDJSubscription.unsubscribe();
          }
          if (broadcastWsRef.current.handoverSubscriptions.handoverSubscription?.unsubscribe) {
            broadcastWsRef.current.handoverSubscriptions.handoverSubscription.unsubscribe();
          }
        }
        if (typeof broadcastWsRef.current.disconnect === 'function') {
          broadcastWsRef.current.disconnect();
        }
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
  // Scroll detection: Show/hide scroll-to-bottom button
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setShowScrollBottom(!isAtBottom(container));
    };

    container.addEventListener('scroll', handleScroll);
    // Check initial state
    handleScroll();

    return () => container.removeEventListener('scroll', handleScroll);
  }, [chatMessages.length]); // Re-check when messages change

  // Auto-scroll to bottom on initial load
  useEffect(() => {
    if (chatMessages.length > 0) {
      setTimeout(() => {
        scrollToBottom();
        setShowScrollBottom(false);
      }, 100);
    }
  }, [currentBroadcastId]); // Scroll when broadcast changes

  // Slow mode countdown: decrement remaining wait seconds each second, then clear
  useEffect(() => {
    if (typeof slowModeWaitSeconds !== "number" || slowModeWaitSeconds <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setSlowModeWaitSeconds((prev) => {
        if (typeof prev !== "number") return prev;
        const next = prev - 1;
        return next > 0 ? next : null;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [slowModeWaitSeconds]);

  // Handle chat submission
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      handleLoginRedirect();
      return;
    }
    let broadcastIdToUse = currentBroadcastId || currentBroadcast?.id;
    if (!chatMessage.trim()) return;

    // Local slow mode check: if we've sent a message recently and slow mode is enabled,
    // prevent another send and show the remaining seconds inline.
    if (slowModeEnabled && slowModeSeconds > 0 && lastChatSentAt) {
      const now = Date.now();
      const elapsedSeconds = (now - lastChatSentAt) / 1000;
      if (elapsedSeconds < slowModeSeconds) {
        const remaining = Math.ceil(slowModeSeconds - elapsedSeconds);
        setSlowModeWaitSeconds(remaining);
        return;
      }
    }

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

      // Clear any previous slow-mode wait notice and record send time on successful send
      setSlowModeWaitSeconds(null);
      setLastChatSentAt(Date.now());

      // Refresh messages to reflect the sent message immediately
      const updatedMessages = await chatService.getMessages(broadcastIdToUse);
      setChatMessages(updatedMessages.data);
      // Always scroll to bottom after sending message
      setTimeout(() => {
      scrollToBottom();
        setShowScrollBottom(false);
      }, 100);
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
          // When slow mode is active, use the configured interval for a clearer UX
          // and let the backend remain the source of truth for actual enforcement.
          const waitSec = slowModeSeconds || null;
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
    // Prevent concurrent API calls to avoid spamming
    if (isFetchingBroadcastInfoRef.current) {
      logger.debug('Broadcast info fetch already in progress, skipping');
      return;
    }

    isFetchingBroadcastInfoRef.current = true;
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
      isFetchingBroadcastInfoRef.current = false;
    }
  };

  // Check if a broadcast is live (one-time HTTP bootstrap, then rely on WebSockets)
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

    // Single bootstrap check; afterwards, rely on WebSocket updates
    checkBroadcastStatus();

    // No recurring polling here; WebSockets handle real-time updates.
    return () => {};
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
        const connection = await broadcastService.subscribeToGlobalBroadcastStatus((message) => {
          logger.debug('Global broadcast update received:', message);

          switch (message.type) {
            case 'BROADCAST_STARTED':
              logger.debug('New broadcast started via global WebSocket');
              broadcastEndedRef.current = false; // Reset ended flag for new broadcast
              // Update state but don't fetch broadcast info - let listener WS handle this
              if (message.broadcast) {
                logger.debug('Updating to new broadcast from global WebSocket:', message.broadcast);
                logger.debug('Updating broadcast ID from', currentBroadcastId, 'to', message.broadcast.id, 'via global WebSocket');
                setCurrentBroadcast(message.broadcast);
                setCurrentBroadcastId(message.broadcast.id);
                // This will immediately trigger WebSocket setup for chat and song requests
                logger.debug('Broadcast ID updated, WebSocket connections will be established immediately');
                setBroadcastSession((s) => s + 1); // <--- increment session when broadcast starts
              }
              break;

            case 'BROADCAST_ENDED':
              logger.debug('Broadcast ended via global WebSocket');
              broadcastEndedRef.current = true; // Mark broadcast as explicitly ended
              // Only clear state if it matches the current broadcast
              if (!message.broadcast || message.broadcast.id === currentBroadcastId) {
                setCurrentBroadcast(null);
                setCurrentBroadcastId(null);
                logger.debug('Cleared current broadcast state');
              }
              break;

            case 'BROADCAST_RECOVERY':
              logger.info('Listener Dashboard: Broadcast recovery notification via global WebSocket:', message);
              
              // Show recovery notification to listeners
              if (message.broadcast) {
                setRecoveryNotification({
                  message: message.message || 'Broadcast recovered after brief interruption',
                  timestamp: message.timestamp
                });
                
                // Update broadcast state if it matches current broadcast
                if (!currentBroadcastId || message.broadcast.id === currentBroadcastId) {
                  setCurrentBroadcast(message.broadcast);
                  setCurrentBroadcastId(message.broadcast.id);
                }
                
                // Hide notification after 5 seconds
                setTimeout(() => {
                  setRecoveryNotification(null);
                }, 5000);
              }
              break;

            case 'BROADCAST_UPDATED':
              logger.debug('Listener Dashboard: Broadcast updated via global WebSocket:', message);
              if (message.broadcast && (!currentBroadcastId || message.broadcast.id === currentBroadcastId)) {
                setCurrentBroadcast(message.broadcast);
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

  // Load polls (active or ended with votes) once on broadcast/session change; subsequent updates arrive via WebSocket
  useEffect(() => {
    const loadInitialPoll = async () => {
      if (!currentBroadcastId) {
        setActivePoll(null);
        return;
      }
      try {
        // First try to get active polls
        const activeResponse = await pollService.getActivePollsForBroadcast(currentBroadcastId);
        if (activeResponse.data && activeResponse.data.length > 0) {
          const firstActive = activeResponse.data[0];
          // Fetch results for active poll
          try {
            const resultsResponse = await pollService.getPollResults(firstActive.id);
            // Check if user has already voted
            let userVoted = false;
            let userVotedFor = null;
            if (currentUser) {
              try {
                const userVoteResponse = await pollService.getUserVote(firstActive.id);
                userVoted = !!userVoteResponse.data;
                userVotedFor = userVoteResponse.data || null;
              } catch (error) {
                // If getUserVote fails, assume user hasn't voted
                logger.debug('Could not fetch user vote status:', error);
              }
            }
            setActivePoll({
              ...firstActive,
              options: resultsResponse.data.options || firstActive.options,
              totalVotes: resultsResponse.data.totalVotes || firstActive.options.reduce((sum, option) => sum + (option.votes || 0), 0),
              userVoted,
              userVotedFor
            });
          } catch (error) {
            // Fallback if results fetch fails
            // Still check user vote status
            let userVoted = false;
            let userVotedFor = null;
            if (currentUser) {
              try {
                const userVoteResponse = await pollService.getUserVote(firstActive.id);
                userVoted = !!userVoteResponse.data;
                userVotedFor = userVoteResponse.data || null;
              } catch (error) {
                logger.debug('Could not fetch user vote status:', error);
              }
            }
            setActivePoll({
              ...firstActive,
              totalVotes: firstActive.options.reduce((sum, option) => sum + (option.votes || 0), 0),
              userVoted,
              userVotedFor
            });
          }
          return;
        }
        
        // If no active poll, try to get most recent ended poll with votes
        const allPollsResponse = await pollService.getPollsForBroadcast(currentBroadcastId);
        if (allPollsResponse.data && allPollsResponse.data.length > 0) {
          // Get ended polls with votes
          const endedPolls = await Promise.all(
            allPollsResponse.data
              .filter(p => !p.active)
              .map(async (poll) => {
                try {
                  const resultsResponse = await pollService.getPollResults(poll.id);
                  return {
                    ...poll,
                    options: resultsResponse.data.options || poll.options,
                    totalVotes: resultsResponse.data.totalVotes || 0
                  };
                } catch (error) {
                  return poll;
                }
              })
          );
          
          const endedWithVotes = endedPolls
            .filter(p => p.totalVotes > 0)
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
          
          if (endedWithVotes.length > 0) {
            const pollToShow = endedWithVotes[0];
            // Check if user voted
            try {
              if (currentUser) {
                const userVoteResponse = await pollService.getUserVote(pollToShow.id);
                setActivePoll({
                  ...pollToShow,
                  userVoted: !!userVoteResponse.data,
                  userVotedFor: userVoteResponse.data || null
                });
              } else {
                setActivePoll(pollToShow);
              }
            } catch (error) {
              setActivePoll(pollToShow);
            }
            return;
          }
        }
        
        setActivePoll(null);
      } catch (e) {
        logger.error('Error loading initial poll:', e);
      }
    };

    loadInitialPoll();
  }, [currentBroadcastId, broadcastSession, currentUser]);

  // Audio playback is managed by StreamingContext

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
        setToast({ visible: true, message: 'Song request sent to the DJ', type: 'success' });
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
    // Allow voting only if poll is active
    if (!activePoll || !selectedPollOption || activePoll.userVoted || !activePoll.active || currentBroadcast?.status !== 'LIVE') return;

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

  // Safe chat message renderer - matching DJDashboard design
  const renderSafeChatMessage = (msg) => {
    try {
      // Validate message data
      if (!msg || !msg.sender || !msg.id || !msg.content) {
        return null;
      }

      // Construct name from firstname and lastname fields (backend sends these, not a single 'name' field)
      const firstName = msg.sender?.firstname || "";
      const lastName = msg.sender?.lastname || "";
      const fullName = `${firstName} ${lastName}`.trim();
      const senderName = fullName || msg.sender?.email || "Unknown User";

      // Check if user is a DJ based on their role or name
      const isDJ =
        (msg.sender?.role && msg.sender.role.includes("DJ")) ||
        senderName.includes("DJ") ||
        firstName.includes("DJ") ||
        lastName.includes("DJ");

      const initials = (() => {
        try {
          return (
            senderName
              .split(" ")
              .map((part) => part[0] || "")
              .join("")
              .toUpperCase()
              .slice(0, 2) || "U"
          );
        } catch (error) {
          return "U";
        }
      })();

      // Handle date parsing more robustly (same as ListenerDashboard)
      let messageDate;
      try {
        const ts = msg.createdAt || msg.timestamp || msg.sentAt || msg.time || msg.date;
        messageDate = ts ? new Date(ts) : null;
      } catch (error) {
        logger.error('Error parsing message date:', error);
        messageDate = new Date();
      }

      const formattedTime = (() => {
        try {
          return messageDate && !isNaN(messageDate.getTime())
        ? format(messageDate, 'hh:mm a')
            : "";
        } catch (error) {
          return "";
        }
      })();

      return (
        <div key={msg.id} className="flex items-start space-x-2 sm:space-x-3 mb-3">
          <div
            className={`flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm text-white font-bold ${
              isDJ ? "bg-maroon-600" : "bg-gray-500"
            }`}
          >
            {isDJ ? "DJ" : initials}
            </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-1 sm:gap-2 mb-1">
              <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                {senderName}
              </span>
              {formattedTime && (
                <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {formattedTime}
                </span>
              )}
              {currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'MODERATOR') && msg.sender?.id !== currentUser.id && msg.sender?.role !== 'ADMIN' && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleBanUserPrompt(msg.sender); }}
                  title="Ban user"
                  className="text-xs px-2.5 py-1 rounded-md bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 transition-colors"
                >
                  Ban
                </button>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 break-words">{msg.content || 'No content'}</p>
          </div>
        </div>
      );
    } catch (error) {
      logger.error('Error rendering chat message:', error, msg);
      return null;
    }
  };

  // Render chat messages - matching DJDashboard structure
  const renderChatMessages = () => (
    <div className="h-full min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 custom-scrollbar chat-messages-container" ref={chatContainerRef}>
      {chatMessages.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8 sm:py-12">
          <ChatBubbleLeftRightIcon className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-3 opacity-30" />
          <p className="text-sm sm:text-base">No messages yet</p>
          <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 mt-1">Start the conversation!</p>
        </div>
      ) : (
        chatMessages
          .slice()
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
          .map(renderSafeChatMessage)
          .filter(Boolean) // Remove any null values from failed renders
      )}
    </div>
  );

  // Render chat input
  const renderChatInput = () => {
    if (!currentUser) {
      return (
                    <div className="p-4 bg-gradient-to-br from-slate-50 to-white dark:from-slate-700/50 dark:to-slate-800/50 border-t border-slate-200/50 dark:border-slate-600/50 rounded-b-lg">
                      <div className="text-center">
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 font-medium">
                          Join the conversation! Login or create an account to chat with other listeners.
                        </p>
                        <div className="flex space-x-3 justify-center">
                          <button
                            onClick={handleLoginRedirect}
                            className="flex items-center px-5 py-2.5 bg-gradient-to-r from-radio-600 to-ocean-600 hover:from-radio-700 hover:to-ocean-700 text-white text-sm font-semibold rounded-xl transition-all shadow-radio hover:shadow-glow hover:scale-105"
                          >
                            <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                            Login
                          </button>
                          <button
                            onClick={handleRegisterRedirect}
                            className="flex items-center px-5 py-2.5 bg-gradient-to-r from-sunset-500 to-sunset-600 hover:from-sunset-600 hover:to-sunset-700 text-white text-sm font-semibold rounded-xl transition-all shadow-lg hover:shadow-glow hover:scale-105"
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
        {isSongRequestMode && (
          <div className="mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border-l-2 border-yellow-500 rounded">
            <p className="text-xs text-yellow-800 dark:text-yellow-300 flex items-center gap-1.5 font-medium">
              <MusicalNoteIcon className="h-3.5 w-3.5" />
              Song Request Mode — Type the song title and click Send
            </p>
          </div>
        )}
        {slowModeEnabled && slowModeSeconds > 0 && (
          <p className="text-[11px] text-amber-700 dark:text-amber-400 mb-1">
            Slow Mode is enabled.{" "}
            {typeof slowModeWaitSeconds === "number" && slowModeWaitSeconds > 0 ? (
              <>
                You can chat in {slowModeWaitSeconds} second
                {slowModeWaitSeconds === 1 ? "" : "s"} from now.
              </>
            ) : (
              <>
                Messages may be delayed by up to {slowModeSeconds} second
                {slowModeSeconds === 1 ? "" : "s"}.
              </>
            )}
          </p>
        )}
        <form onSubmit={handleChatSubmit} className="flex flex-col sm:flex-row sm:items-center gap-2 w-full min-w-0">
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
          placeholder={isSongRequestMode ? "e.g., Shape of You - Ed Sheeran" : "Type your message..."}
          className={`flex-1 min-w-0 max-w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all text-sm ${
            isSongRequestMode 
              ? "border-yellow-400 bg-yellow-50/50 dark:bg-yellow-900/10 dark:border-yellow-500 focus:ring-yellow-400 focus:border-yellow-400" 
              : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-maroon-500 focus:border-maroon-500"
          }`}
          disabled={
            currentBroadcast?.status !== "LIVE" ||
            !(currentBroadcastId || currentBroadcast?.id)
          }
          maxLength={1500}
        />

        {/* Request Song button on the left, Send button on the right */}
        {isSongRequestMode ? (
          <>
            <button
              type="button"
              onClick={handleSongRequest}
              disabled={currentBroadcast?.status !== 'LIVE' || !(currentBroadcastId || currentBroadcast?.id) || !songRequestText.trim()}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 shadow-sm whitespace-nowrap w-full sm:w-auto ${
                currentBroadcast?.status === 'LIVE' && songRequestText.trim() 
                  ? 'bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 text-white hover:shadow-md' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }`}
              aria-label="Send song request"
            >
              <MusicalNoteIcon className="h-4 w-4" />
              Send Request
            </button>
            <button
              type="button"
              onClick={handleCancelSongRequest}
              disabled={currentBroadcast?.status !== 'LIVE' || !(currentBroadcastId || currentBroadcast?.id)}
              className="flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-all text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap w-full sm:w-auto"
              aria-label="Cancel song request"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleSongRequest}
              disabled={currentBroadcast?.status !== 'LIVE' || !(currentBroadcastId || currentBroadcast?.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 shadow-sm whitespace-nowrap w-full sm:w-auto ${
                isLive 
                  ? 'bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 text-white hover:shadow-md' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }`}
              aria-label="Request a song"
            >
              <MusicalNoteIcon className="h-4 w-4" />
              Request
            </button>
            <button
              type="submit"
              disabled={
                currentBroadcast?.status !== "LIVE" ||
                !(currentBroadcastId || currentBroadcast?.id) ||
                !chatMessage.trim() ||
                (typeof slowModeWaitSeconds === "number" && slowModeWaitSeconds > 0)
              }
              className={`flex-shrink-0 p-2 rounded-lg transition-all w-full sm:w-auto flex items-center justify-center ${
                currentBroadcast?.status === 'LIVE' && chatMessage.trim()
                  ? "bg-maroon-600 hover:bg-maroon-700 active:bg-maroon-800 text-white shadow-sm hover:shadow-md"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              }`}
              aria-label="Send message"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
              <span className="sr-only">Send message</span>
            </button>
          </>
        )}
      </form>
      </div>
    );
  };

  // Subscribe to listener status via STOMP (replaces raw WebSocket)
  useEffect(() => {
    let subscription = null;

    const setupSTOMPSubscription = async () => {
      try {
        subscription = await stompClientManager.subscribe(
          '/topic/listener-status',
          (message) => {
            try {
              const data = JSON.parse(message.body);
              logger.debug('ListenerDashboard: Stream status updated via STOMP:', data);
              
              if (data.type === 'STREAM_STATUS') {
                logger.debug('ListenerDashboard: Stream status updated via STOMP:', data.isLive);
                
                setListenerWsConnected(stompClientManager.isConnected());
                
                if (data.listenerCount !== undefined) {
                  logger.debug('ListenerDashboard: Updating listener count to:', data.listenerCount);
                  setLocalListenerCount(data.listenerCount);
                }

                // CRITICAL: Update radio server state immediately from STOMP health data
                // This eliminates the 30-second delay by replacing HTTP polling
                if (data.health) {
                  const health = data.health;
                  logger.debug('ListenerDashboard: Updating radio server state from STOMP health:', health);

                  // Determine server state from health data
                  let serverState = 'unknown';
                  if (health.radioServerState) {
                    // Use the direct radioServerState if provided
                    serverState = health.radioServerState;
                  } else if (health.broadcastLive === true) {
                    if (health.healthy === true) {
                      serverState = 'running'; // Server is healthy and broadcasting
                    } else if (health.recovering === true) {
                      serverState = 'running'; // Server is recovering but still broadcasting
                    } else {
                      serverState = 'stopped'; // Server is broadcasting but unhealthy
                    }
                  } else {
                    serverState = 'stopped'; // No broadcast active
                  }

                  logger.debug('ListenerDashboard: Computed server state from STOMP:', serverState);
                  setRadioServerState(serverState);
                }

                // Detect live status transitions and react immediately
                if (typeof data.isLive === 'boolean') {
                  const prev = lastIsLiveRef.current;
                  lastIsLiveRef.current = data.isLive;

                  // When stream just went live, immediately fetch current broadcast and refresh session
                  if (data.isLive && prev !== true) {
                    logger.debug('ListenerDashboard: Detected live transition via STOMP');
                    broadcastEndedRef.current = false; // Reset ended flag for new live broadcast
                    // Fresh start: clear all and re-subscribe with the new ID
                    if (data.broadcastId) {
                      logger.debug('ListenerDashboard: Using broadcastId from STOMP:', data.broadcastId);
                      resetForNewBroadcast(data.broadcastId);
                    } else {
                      // No id included; still force a reset and let fetch resolve the id
                      resetForNewBroadcast(null);
                    }
                    // Fetch complete current broadcast info in background
                    fetchCurrentBroadcastInfo().catch((e) => logger.error('Error fetching current broadcast after live transition:', e));
                  }

                  // When stream ended, clear current broadcast (but only if broadcast wasn't explicitly ended)
                  if (!data.isLive && prev !== false && !broadcastEndedRef.current) {
                    logger.debug('ListenerDashboard: Detected end of stream via STOMP, clearing current broadcast');
                    resetForNewBroadcast(null);
                  }
                }
              }
            } catch (error) {
              logger.error('Error parsing STOMP message:', error);
            }
          }
        );

        setListenerWsConnected(stompClientManager.isConnected());
        logger.info('ListenerDashboard: STOMP subscription established');

        // Send initial START_LISTENING message if audio is playing
        if (audioRef.current && !audioRef.current.paused && localAudioPlaying && currentBroadcastId) {
          try {
            await stompClientManager.publish('/app/listener/status', {
              action: 'START_LISTENING',
              broadcastId: currentBroadcastId,
              userId: currentUser?.id || null,
              userName: currentUser?.firstName || currentUser?.name || 'Anonymous Listener'
            });
            logger.debug('Sent initial listener status via STOMP: listening');
          } catch (e) {
            logger.warn('Failed to send initial START_LISTENING message:', e);
          }
        }
      } catch (error) {
        logger.error('Failed to subscribe to listener status via STOMP:', error);
        setListenerWsConnected(false);
      }
    };

    setupSTOMPSubscription();

    return () => {
      if (subscription) {
        try {
          subscription.unsubscribe();
        } catch (e) {
          logger.warn('Error unsubscribing from listener status STOMP:', e);
        }
      }
      setListenerWsConnected(false);
    };
  }, [currentBroadcastId, currentUser, localAudioPlaying]);

  // Generate SEO data based on current broadcast
  const broadcastTitle = currentBroadcast 
    ? `${currentBroadcast.title || 'Live Broadcast'} | Wildcat Radio`
    : 'Wildcat Radio | Live Campus Radio';
  
  const broadcastDescription = currentBroadcast && currentBroadcast.description
    ? currentBroadcast.description
    : 'Wildcat Radio streams live campus radio. Listen live, chat with the community, and explore broadcast history and schedules.';
  
  const structuredData = currentBroadcast
    ? generateBroadcastEventData(currentBroadcast)
    : generateRadioStationData();

  return (
    <>
      <SEO
        title={broadcastTitle}
        description={broadcastDescription}
        url={location.pathname}
        type={currentBroadcast ? "article" : "website"}
        structuredData={structuredData}
        keywords={currentBroadcast 
          ? `wildcat radio, ${currentBroadcast.title || ''}, live broadcast, campus radio`
          : 'wildcat radio, campus radio, live streaming, online radio'
        }
      />
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 mb-8 space-y-6">
        <div className="pt-2 sm:pt-3">
          <h2 className="text-xl sm:text-2xl font-semibold text-maroon-700 dark:text-maroon-400 mb-1">Broadcast Stream</h2>
          <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm">Tune in to live broadcasts and connect with listeners</p>
        </div>

        {/* Recovery Notification Banner */}
        {recoveryNotification && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="text-blue-800 dark:text-blue-200 text-sm font-medium">
                {recoveryNotification.message}
              </span>
            </div>
          </div>
        )}

      {/* Desktop layout */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Desktop Left Column - Broadcast + Poll */}
        <div className="lg:col-span-2 space-y-6">
          {/* Spotify-style Music Player */}
          <SpotifyPlayer broadcast={currentBroadcast} currentDJ={currentActiveDJ} />

          {/* Desktop Poll section */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex-grow">
            {/* Tab header */}
            <div className="flex border-b border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setActiveTab("poll")}
                className={`flex-1 py-4 px-6 text-center text-sm font-semibold transition-all duration-200 ${
                  activeTab === "poll"
                    ? "border-b-2 border-maroon-600 text-maroon-600 dark:border-maroon-500 dark:text-maroon-400 bg-maroon-50/50 dark:bg-maroon-900/20"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
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
            <div className="bg-white dark:bg-slate-800 flex-grow flex flex-col min-h-[360px] md:min-h-[420px] lg:min-h-[460px]">
              {activeTab === "poll" && (
                <div className="p-8 flex-grow flex flex-col h-full">
                  {currentBroadcast?.status === 'LIVE' ? (
                    <>
                      {pollLoading && !activePoll ? (
                        <div className="text-center py-8 flex-grow flex items-center justify-center">
                          <p className="text-gray-500 dark:text-gray-400 animate-pulse">Loading polls...</p>
                        </div>
                      ) : activePoll ? (
                        <div className="flex-grow flex flex-col">
                          {/* Poll Question */}
                          <div className="mb-6">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 font-montserrat">
                              {activePoll.question || activePoll.title}
                            </h3>
                            <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                              {!activePoll.active ? (
                                <span className="text-orange-600 dark:text-orange-400 font-semibold">Poll has ended - View results below</span>
                              ) : !currentUser 
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
                              // Show percentages if poll is ended OR user has voted
                              const showResults = !activePoll.active || (activePoll.userVoted && currentUser);
                              const percentage = (activePoll.totalVotes > 0 && showResults)
                                ? Math.round((option.votes / activePoll.totalVotes) * 100) || 0 
                                : 0;
                              const isSelected = selectedPollOption === option.id;
                              const isUserChoice = activePoll.userVotedFor === option.id;
                              const canInteract = currentUser && !activePoll.userVoted && activePoll.active;

                              return (
                                <div key={option.id} className="space-y-2">
                                  <div 
                                    className={`w-full border-2 rounded-lg overflow-hidden transition-all duration-200 ${
                                      !currentUser
                                        ? 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 cursor-not-allowed opacity-75'
                                        : activePoll.userVoted 
                                          ? isUserChoice
                                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 shadow-md'
                                            : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700'
                                          : isSelected
                                            ? 'border-maroon-500 bg-maroon-50 dark:bg-maroon-900/20 cursor-pointer shadow-md'
                                            : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-maroon-300 dark:hover:border-maroon-600 hover:bg-maroon-50/50 dark:hover:bg-maroon-900/20 cursor-pointer transition-all'
                                    }`}
                                    onClick={() => canInteract && handlePollOptionSelect(option.id)}
                                  >
                                    <div className="p-4">
                                      <div className="flex items-center justify-between">
                                        <span className="text-base font-semibold text-slate-900 dark:text-white">
                                          {option.optionText || option.text}
                                        </span>
                                        <div className="flex items-center">
                                          {showResults && (
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

                                      {/* Progress bar - show for ended polls or when user has voted */}
                                      {showResults && (
                                        <div className="mt-3">
                                          <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2.5 overflow-hidden">
                                            <div 
                                              className={`h-2.5 rounded-full transition-all duration-300 ${
                                                isUserChoice ? 'bg-emerald-500' : 'bg-slate-400'
                                              }`}
                                              style={{ width: `${percentage}%` }}
                                            />
                                          </div>
                                          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1.5">
                                            {percentage}% • {option.votes || 0} {option.votes === 1 ? 'vote' : 'votes'}
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
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 font-medium">
                                  Login to participate in polls
                                </p>
                                <div className="flex space-x-3 justify-center">
                                  <button
                                    onClick={handleLoginRedirect}
                                    className="flex items-center px-5 py-2.5 bg-maroon-600 hover:bg-maroon-700 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg hover:scale-105"
                                  >
                                    <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                                    Login
                                  </button>
                                  <button
                                    onClick={handleRegisterRedirect}
                                    className="flex items-center px-5 py-2.5 bg-gold-500 hover:bg-gold-600 text-maroon-900 text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg hover:scale-105"
                                  >
                                    <UserPlusIcon className="h-4 w-4 mr-2" />
                                    Register
                                  </button>
                                </div>
                              </div>
                            ) : activePoll.userVoted ? (
                              <div className="text-center">
                                <div className="text-sm text-slate-600 dark:text-slate-400 mb-3 font-semibold">
                                  Total votes: {activePoll.totalVotes || 0}
                                </div>
                                <span className="inline-flex items-center px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg shadow-md font-semibold transition-colors">
                                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                  You have voted
                                </span>
                              </div>
                            ) : !activePoll.active ? (
                              <div className="text-center">
                                <div className="text-sm text-slate-600 dark:text-slate-400 mb-3 font-semibold">
                                  Total votes: {activePoll.totalVotes || 0}
                                </div>
                                <span className="inline-flex items-center px-6 py-3 bg-orange-500 text-white rounded-lg shadow-md font-semibold">
                                  Poll Ended
                                </span>
                              </div>
                            ) : (
                              <button
                                onClick={handlePollVote}
                                disabled={!selectedPollOption || pollLoading || !activePoll.active}
                                className={`px-10 py-3 rounded-lg font-semibold transition-all duration-200 shadow-md ${
                                  selectedPollOption && !pollLoading && activePoll.active
                                    ? 'bg-gold-500 hover:bg-gold-600 text-maroon-900 hover:shadow-lg hover:scale-105' 
                                    : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                                }`}
                              >
                                {pollLoading ? (
                                  <span className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-maroon-900 border-t-transparent rounded-full animate-spin"></div>
                                    Voting...
                                  </span>
                                ) : 'Vote'}
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center w-full px-4">
                            <div className="mb-8">
                              <div className="w-20 h-20 mx-auto mb-6 rounded-xl bg-gradient-to-br from-maroon-600 to-maroon-700 flex items-center justify-center shadow-lg border border-maroon-500">
                                <svg className="w-10 h-10 text-gold-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                              </div>
                              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 font-montserrat">No Poll Available</h3>
                              <p className="text-base text-slate-600 dark:text-slate-400 mb-2 font-medium">
                                Waiting for the DJ to create a poll
                              </p>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                Polls will appear here automatically when created
                              </p>
                            </div>
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
          <div className="bg-maroon-700 dark:bg-maroon-800 text-white p-4 rounded-t-xl shadow-md border-b border-maroon-800 dark:border-maroon-900">
            <h3 className="font-bold text-lg mb-1 font-montserrat">Live Chat</h3>
            <p className="text-xs opacity-90 font-medium">{Math.max(listenerCount, localListenerCount)} listeners online</p>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-t-0 border-slate-200 dark:border-slate-700 rounded-b-xl flex-grow flex flex-col min-h-[420px] md:min-h-[480px] lg:min-h-[520px] max-h-[80vh] shadow-lg">
            {currentBroadcast?.status === 'LIVE' ? (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-hidden flex-shrink-0 min-h-0 relative">
                  {renderChatMessages()}

                  {/* Scroll to bottom button - Minimalist design matching DJDashboard */}
                {showScrollBottom && (
                    <div className="absolute bottom-4 right-4 z-10">
                    <button
                      onClick={scrollToBottom}
                        className="bg-maroon-600 hover:bg-maroon-700 text-white rounded-full w-10 h-10 shadow-lg hover:shadow-xl transition-all duration-200 ease-in-out flex items-center justify-center hover:scale-110 border border-maroon-500"
                      aria-label="Scroll to bottom"
                        title="Scroll to latest messages"
                    >
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-5 w-5" 
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                      >
                        <path 
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>
                )}
                </div>
                <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 mt-auto bg-white dark:bg-slate-800 overflow-hidden">
                  {!currentUser ? (
                    <div className="p-4 text-center">
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 font-medium">
                        Join the conversation! Login or create an account to chat.
                      </p>
                      <div className="flex space-x-3 justify-center">
                        <button
                          onClick={handleLoginRedirect}
                          className="flex items-center px-5 py-2.5 bg-maroon-600 hover:bg-maroon-700 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg hover:scale-105"
                        >
                          <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                          Login
                        </button>
                        <button
                          onClick={handleRegisterRedirect}
                          className="flex items-center px-5 py-2.5 bg-gold-500 hover:bg-gold-600 text-maroon-900 text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg hover:scale-105"
                        >
                          <UserPlusIcon className="h-4 w-4 mr-2" />
                          Register
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {slowModeEnabled && slowModeSeconds > 0 && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 mb-1">
                          Slow Mode is enabled.{" "}
                          {typeof slowModeWaitSeconds === "number" && slowModeWaitSeconds > 0 ? (
                            <>
                              You can chat in {slowModeWaitSeconds} second
                              {slowModeWaitSeconds === 1 ? "" : "s"} from now.
                            </>
                          ) : (
                            <>
                              Messages may be delayed by up to {slowModeSeconds} second
                              {slowModeSeconds === 1 ? "" : "s"}.
                            </>
                          )}
                        </p>
                      )}
                    <form onSubmit={handleChatSubmit} className="flex flex-wrap md:flex-nowrap items-center gap-2 w-full min-w-0 overflow-hidden p-4">
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
                        placeholder={isSongRequestMode ? "Song title - optional artist" : "Type your message..."}
                        className={`flex-1 min-w-0 max-w-full px-3 py-2.5 border rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 text-sm ${
                          isSongRequestMode 
                            ? "border-gold-400 bg-gold-50 dark:bg-gold-900/20 dark:border-gold-500 focus:ring-gold-500 shadow-md" 
                            : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-maroon-500"
                        }`}
                        disabled={currentBroadcast?.status !== "LIVE"}
                        maxLength={1500}
                      />

                      {/* Request Song button on the left, Send button on the right */}
                      {isSongRequestMode ? (
                        <>
                          <button
                            type="button"
                            onClick={handleSongRequest}
                            disabled={currentBroadcast?.status !== 'LIVE' || !songRequestText.trim()}
                            className={`flex-shrink-0 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 shadow-md whitespace-nowrap w-full sm:w-auto ${
                              currentBroadcast?.status === 'LIVE' && songRequestText.trim() 
                                ? 'bg-gold-500 hover:bg-gold-600 text-maroon-900 hover:shadow-lg hover:scale-105' 
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                            }`}
                            aria-label="Send song request"
                          >
                            <MusicalNoteIcon className="h-4 w-4" />
                            Send Request
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelSongRequest}
                            disabled={currentBroadcast?.status !== 'LIVE'}
                          className="flex-shrink-0 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap w-full sm:w-auto"
                            aria-label="Cancel song request"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={handleSongRequest}
                            disabled={
                              currentBroadcast?.status !== "LIVE" ||
                              (typeof slowModeWaitSeconds === "number" && slowModeWaitSeconds > 0)
                            }
                            className={`flex-shrink-0 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 shadow-sm whitespace-nowrap w-full sm:w-auto ${
                              isLive && !(typeof slowModeWaitSeconds === "number" && slowModeWaitSeconds > 0)
                                ? 'bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 text-white hover:shadow-md' 
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                            }`}
                            aria-label="Request a song"
                          >
                            <MusicalNoteIcon className="h-4 w-4" />
                            Request
                          </button>
                          <button
                            type="submit"
                            disabled={
                              !isLive ||
                              !chatMessage.trim() ||
                              (typeof slowModeWaitSeconds === "number" && slowModeWaitSeconds > 0)
                            }
                            className={`flex-shrink-0 p-2.5 rounded-lg transition-all w-full sm:w-auto flex items-center justify-center ${
                              currentBroadcast?.status === "LIVE" &&
                              chatMessage.trim() &&
                              !(typeof slowModeWaitSeconds === "number" && slowModeWaitSeconds > 0)
                                ? "bg-maroon-600 hover:bg-maroon-700 text-white shadow-sm hover:shadow-md"
                                : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                            }`}
                            aria-label="Send message"
                          >
                            <PaperAirplaneIcon className="h-5 w-5" />
                            <span className="sr-only">Send message</span>
                          </button>
                        </>
                      )}
                    </form>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-maroon-700 flex items-center justify-center shadow-lg mb-4 border border-maroon-600">
                    <svg className="w-8 h-8 text-gold-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 font-medium">Live chat is only available during broadcasts</p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Mobile & Tablet layout */}
      <div className="lg:hidden space-y-6">
        {/* Mobile Spotify-style Music Player */}
        <SpotifyPlayer broadcast={currentBroadcast} />

        {/* Mobile Recovery Notification Banner */}
        {recoveryNotification && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="text-blue-800 dark:text-blue-200 text-sm font-medium">
                {recoveryNotification.message}
              </span>
            </div>
          </div>
        )}

        {/* Mobile Tabs */}
        <div className="card-modern overflow-hidden">
          {/* Tab headers */}
          <div className="flex border-b border-slate-200/50 dark:border-slate-700/50">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 py-4 px-4 text-center text-sm font-semibold transition-all duration-200 ${
                activeTab === "chat"
                  ? "border-b-2 border-radio-600 text-radio-600 dark:border-radio-400 dark:text-radio-400 bg-gradient-to-b from-radio-50 to-transparent dark:from-radio-950/30"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
              }`}
            >
              Live Chat
            </button>
            <button
              onClick={() => setActiveTab("poll")}
              className={`flex-1 py-4 px-4 text-center text-sm font-semibold transition-all duration-200 ${
                activeTab === "poll"
                  ? "border-b-2 border-radio-600 text-radio-600 dark:border-radio-400 dark:text-radio-400 bg-gradient-to-b from-radio-50 to-transparent dark:from-radio-950/30"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
              }`}
            >
              Poll
            </button>
          </div>

          {/* Mobile Tab content */}
          <div className="bg-white dark:bg-slate-800 flex-grow flex flex-col min-h-[360px] max-h-[80vh]">
            {activeTab === "chat" && (
              <div className="animate-fade-in flex flex-col h-full">
                <div className="flex-1 overflow-hidden flex-shrink-0 min-h-0 relative">
                {renderChatMessages()}

                  {/* Scroll to bottom button - Minimalist design */}
                  {showScrollBottom && (
                    <div className="absolute bottom-4 right-4 z-10">
                      <button
                        onClick={scrollToBottom}
                        className="bg-maroon-600 hover:bg-maroon-700 text-white rounded-full w-10 h-10 shadow-lg hover:shadow-xl transition-all duration-200 ease-in-out flex items-center justify-center hover:scale-110 border border-maroon-500"
                        aria-label="Scroll to bottom"
                        title="Scroll to latest messages"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 mt-auto bg-white dark:bg-slate-800">
                {renderChatInput()}
                </div>
              </div>
            )}
            {activeTab === "poll" && (
              <div className="animate-fade-in p-6 flex flex-col h-full">
                {currentBroadcast?.status === 'LIVE' ? (
                  <>
                    {pollLoading && !activePoll ? (
                      <div className="text-center py-8 flex-grow flex items-center justify-center">
                        <p className="text-gray-500 dark:text-gray-400 animate-pulse">Loading polls...</p>
                      </div>
                    ) : activePoll ? (
                      <div className="flex-grow flex flex-col">
                        {/* Poll Question */}
                        <div className="mb-6">
                          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 font-montserrat">
                            {activePoll.question || activePoll.title}
                          </h3>
                          <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                            {!activePoll.active ? (
                              <span className="text-orange-600 dark:text-orange-400 font-semibold">Poll has ended - View results below</span>
                            ) : !currentUser 
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
                            const showResults = !activePoll.active || (activePoll.userVoted && currentUser);
                            const percentage = (activePoll.totalVotes > 0 && showResults)
                              ? Math.round((option.votes / activePoll.totalVotes) * 100) || 0 
                              : 0;
                            const isSelected = selectedPollOption === option.id;
                            const isUserChoice = activePoll.userVotedFor === option.id;
                            const canInteract = currentUser && !activePoll.userVoted && activePoll.active;

                            return (
                              <div key={option.id} className="space-y-2">
                                <div 
                                  className={`w-full border-2 rounded-lg overflow-hidden transition-all duration-200 ${
                                    !currentUser
                                      ? 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 cursor-not-allowed opacity-75'
                                      : activePoll.userVoted 
                                        ? isUserChoice
                                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 shadow-md'
                                          : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700'
                                        : isSelected
                                          ? 'border-maroon-500 bg-maroon-50 dark:bg-maroon-900/20 cursor-pointer shadow-md'
                                          : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-maroon-300 dark:hover:border-maroon-600 hover:bg-maroon-50/50 dark:hover:bg-maroon-900/20 cursor-pointer transition-all'
                                  }`}
                                  onClick={() => canInteract && handlePollOptionSelect(option.id)}
                                >
                                  <div className="p-4">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {option.optionText || option.text}
                                      </span>
                                      <div className="flex items-center">
                                        {showResults && (
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

                                    {/* Progress bar */}
                                    {showResults && (
                                      <div className="mt-3">
                                        <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2.5 overflow-hidden">
                                          <div 
                                            className={`h-2.5 rounded-full transition-all duration-300 ${
                                              isUserChoice ? 'bg-emerald-500' : 'bg-slate-400'
                                            }`}
                                            style={{ width: `${percentage}%` }}
                                          />
                                        </div>
                                        <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1.5">
                                          {percentage}% • {option.votes || 0} {option.votes === 1 ? 'vote' : 'votes'}
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
                              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 font-medium">
                                Login to participate in polls
                              </p>
                              <div className="flex space-x-3 justify-center">
                                <button
                                  onClick={handleLoginRedirect}
                                  className="flex items-center px-5 py-2.5 bg-maroon-600 hover:bg-maroon-700 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg hover:scale-105"
                                >
                                  <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                                  Login
                                </button>
                                <button
                                  onClick={handleRegisterRedirect}
                                  className="flex items-center px-5 py-2.5 bg-gold-500 hover:bg-gold-600 text-maroon-900 text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg hover:scale-105"
                                >
                                  <UserPlusIcon className="h-4 w-4 mr-2" />
                                  Register
                                </button>
                              </div>
                            </div>
                          ) : activePoll.userVoted ? (
                            <div className="text-center">
                              <div className="text-sm text-slate-600 dark:text-slate-400 mb-3 font-semibold">
                                Total votes: {activePoll.totalVotes || 0}
                              </div>
                              <span className="inline-flex items-center px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg shadow-md font-semibold transition-colors">
                                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                You have voted
                              </span>
                            </div>
                          ) : !activePoll.active ? (
                            <div className="text-center">
                              <div className="text-sm text-slate-600 dark:text-slate-400 mb-3 font-semibold">
                                Total votes: {activePoll.totalVotes || 0}
                              </div>
                              <span className="inline-flex items-center px-6 py-3 bg-orange-500 text-white rounded-lg shadow-md font-semibold">
                                Poll Ended
                              </span>
                            </div>
                          ) : (
                            <button
                              onClick={handlePollVote}
                              disabled={!selectedPollOption || pollLoading || !activePoll.active}
                              className={`px-10 py-3 rounded-lg font-semibold transition-all duration-200 shadow-md ${
                                selectedPollOption && !pollLoading && activePoll.active
                                  ? 'bg-gold-500 hover:bg-gold-600 text-maroon-900 hover:shadow-lg hover:scale-105' 
                                  : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              {pollLoading ? (
                                <span className="flex items-center gap-2">
                                  <div className="w-4 h-4 border-2 border-maroon-900 border-t-transparent rounded-full animate-spin"></div>
                                  Voting...
                                </span>
                              ) : 'Vote'}
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center w-full px-4">
                          <div className="mb-8">
                            <div className="w-20 h-20 mx-auto mb-6 rounded-xl bg-gradient-to-br from-maroon-600 to-maroon-700 flex items-center justify-center shadow-lg border border-maroon-500">
                              <svg className="w-10 h-10 text-gold-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 font-montserrat">No Poll Available</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 font-medium">
                              Waiting for the DJ to create a poll
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Polls will appear here automatically when created
                            </p>
                          </div>
                          <div className="inline-flex items-center px-4 py-2 rounded-lg bg-maroon-50 dark:bg-maroon-900/20 border border-maroon-200 dark:border-maroon-700">
                            <svg className="w-5 h-5 text-maroon-600 dark:text-maroon-400 mr-2 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-xs font-medium text-maroon-700 dark:text-maroon-300">Live broadcast active</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center w-full px-4">
                      <div className="mb-8">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Vote</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Select which you prefer the most?</p>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Polls are only available during live broadcasts</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    {/* Toast (fixed position) */}
    {toast.visible && (
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, visible: false }))}
        position="bottom-right"
      />
    )}
      </div>
    </>
  );
}

// Bare-bones note: ListenerDashboard component kept as-is for stability.
