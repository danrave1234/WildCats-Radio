"use client"

import { useState, useEffect, useRef, useCallback } from "react";
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

export default function ListenerDashboard() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isLive, setIsLive] = useState(false);
  const [streamError, setStreamError] = useState(null);
  const [serverConfig, setServerConfig] = useState(null);
  const [listenerCount, setListenerCount] = useState(0);

  // Audio refs from ListenerDashboard2.jsx
  const audioRef = useRef(null);
  const statusCheckInterval = useRef(null);
  const wsRef = useRef(null);
  const wsConnectingRef = useRef(false);
  const heartbeatInterval = useRef(null);

  // Original states from ListenerDashboard.jsx
  const [nextBroadcast, setNextBroadcast] = useState(null);
  const [currentBroadcastId, setCurrentBroadcastId] = useState(null);
  const [currentBroadcast, setCurrentBroadcast] = useState(null);

  // WebSocket references for real-time updates
  const chatWsRef = useRef(null);
  const songRequestWsRef = useRef(null);
  const pollWsRef = useRef(null);

  // Add abort controller ref for managing HTTP requests
  const abortControllerRef = useRef(null);

  // Chat state
  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([]);

  // Song request state
  const [songRequest, setSongRequest] = useState({ song: "", artist: "", dedication: "" });

  // Poll state
  const [currentPoll, setCurrentPoll] = useState({
    id: 1,
    question: "Which song should we play next?",
    options: [
      { id: 1, text: "Song Title 1", votes: 10 },
      { id: 2, text: "Song Title 2", votes: 15 },
      { id: 3, text: "Song Title 3", votes: 25 }
    ],
    totalVotes: 50,
    userVoted: false
  });
  const [userVote, setUserVote] = useState(null);
  const [pollLoading, setPollLoading] = useState(false);

  // Tabs state for interaction section
  const [activeTab, setActiveTab] = useState("song");

  // Currently playing song
  const [currentSong, setCurrentSong] = useState(null);

  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const chatContainerRef = useRef(null);

  // Send player status to server using useCallback from ListenerDashboard2.jsx
  const sendPlayerStatus = useCallback((isPlaying) => {
    try {
      if (!wsRef.current) {
        console.warn('WebSocket not initialized, cannot send player status')
        return
      }

      if (wsRef.current.readyState !== WebSocket.OPEN) {
        console.warn(`WebSocket not open (state: ${wsRef.current.readyState}), cannot send player status`)
        return
      }

      const message = {
        type: "PLAYER_STATUS",
        isPlaying: isPlaying
      }

      wsRef.current.send(JSON.stringify(message))
      console.log('Sent player status to server:', isPlaying ? 'playing' : 'paused')
    } catch (error) {
      console.error('Error sending player status:', error)
    }
  }, [])

  // Initialize server configuration from ListenerDashboard2.jsx
  useEffect(() => {
    const fetchServerConfig = async () => {
      try {
        const config = await streamService.getConfig()
        setServerConfig(config.data.data)
        console.log("Server config loaded:", config.data.data)
      } catch (error) {
        console.error("Error fetching server config:", error)
        setStreamError("Failed to get server configuration")
      }
    }

    fetchServerConfig()

    const handleBeforeUnload = (e) => {
      if (isPlaying) {
        const message = "Audio is currently playing. Are you sure you want to leave?"
        e.returnValue = message
        return message
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isPlaying])

  // Audio element setup from ListenerDashboard2.jsx
  useEffect(() => {
    if (!serverConfig) return

    if (!audioRef.current) {
      console.log('Creating new audio element')
      audioRef.current = new Audio()

      audioRef.current.crossOrigin = "anonymous"
      audioRef.current.preload = "none"
      audioRef.current.volume = volume / 100

      audioRef.current.addEventListener('loadstart', () => {
        console.log('Stream loading started')
      })

      audioRef.current.addEventListener('canplay', () => {
        console.log('Stream can start playing')
        setStreamError(null)
      })

      audioRef.current.addEventListener('playing', () => {
        setIsPlaying(true)
        setStreamError(null)
        console.log('Stream is playing')
      })

      audioRef.current.addEventListener('pause', () => {
        setIsPlaying(false)
        console.log('Stream is paused')
      })

      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false)
        console.log('Stream ended')
        sendPlayerStatus(false)
      })

      audioRef.current.addEventListener('error', (e) => {
        e.preventDefault();

        console.error('Audio error:', e)
        console.error('Audio error details:', {
          error: audioRef.current?.error,
          networkState: audioRef.current?.networkState,
          readyState: audioRef.current?.readyState,
          src: audioRef.current?.src
        })

        let errorMessage = 'Error loading stream. '
        if (audioRef.current?.error) {
          switch (audioRef.current.error.code) {
            case 1:
              errorMessage += 'Stream loading was aborted.'
              break
            case 2:
              errorMessage += 'Network error occurred.'
              break
            case 3:
              errorMessage += 'Stream format not supported.'
              break
            case 4:
              errorMessage += 'Stream source not supported.'
              break
            default:
              errorMessage += 'Unknown error occurred.'
          }
        }
        errorMessage += ' Please try refreshing or check if the stream is live.'

        if (serverConfig && audioRef.current) {
          const currentSrc = audioRef.current.src
          if (!currentSrc.startsWith('http') || currentSrc.includes('localhost:5173') || currentSrc.startsWith('blob:')) {
            console.warn('Audio src changed to invalid URL, resetting to stream URL')

            try {
              const streamUrl = serverConfig.streamUrl.startsWith('http') 
                ? serverConfig.streamUrl 
                : `https://${serverConfig.streamUrl}`

              if (audioRef.current) {
                console.log('Resetting audio src to:', streamUrl)
                audioRef.current.src = streamUrl
                audioRef.current.load()
              }
            } catch (urlError) {
              console.error('Error resetting audio src:', urlError)
            }
          }
        }

        setStreamError(errorMessage)
        setIsPlaying(false)

        try {
          sendPlayerStatus(false)
        } catch (statusError) {
          console.error('Error sending player status after audio error:', statusError)
        }
      })

      audioRef.current.addEventListener('stalled', () => {
        console.warn('Stream stalled')
      })

      audioRef.current.addEventListener('waiting', () => {
        console.log('Stream buffering')
      })

      const streamUrl = serverConfig.streamUrl.startsWith('http') 
        ? serverConfig.streamUrl 
        : `https://${serverConfig.streamUrl}`
      audioRef.current.src = streamUrl
      console.log('Stream URL set:', streamUrl)
    }
  }, [serverConfig])

  // Cleanup from ListenerDashboard2.jsx
  useEffect(() => {
    return () => {
      console.log('Component unmounting, cleaning up resources')

      try {
        if (audioRef.current) {
          console.log('Cleaning up audio element')

          try {
            audioRef.current.pause()
            audioRef.current.src = 'about:blank'
            audioRef.current.load()
            console.log('Audio element paused and source cleared')
          } catch (audioError) {
            console.error('Error cleaning up audio element:', audioError)
          }
        }
      } catch (error) {
        console.error('Error in audio cleanup:', error)
      }

      try {
        if (statusCheckInterval.current) {
          clearInterval(statusCheckInterval.current)
          statusCheckInterval.current = null
          console.log('Status check interval cleared')
        }

        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current)
          heartbeatInterval.current = null
          console.log('Heartbeat interval cleared')
        }
      } catch (timerError) {
        console.error('Error clearing interval:', timerError)
      }

      console.log('Component cleanup completed')
    }
  }, [])

  // WebSocket connection from ListenerDashboard2.jsx
  useEffect(() => {
    if (!serverConfig) return

    let reconnectTimer = null
    let isReconnecting = false
    let wsInstance = wsRef.current

    const connectWebSocket = async () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }

      if (isReconnecting || wsConnectingRef.current) return
      isReconnecting = true
      wsConnectingRef.current = true

      // Simple WebSocket URL construction using environment variable
      const wsProtocol = 'wss';

      // Always use the environment variable directly
      const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL;
      // Simple clean - just remove any protocol if present
      const cleanHost = wsBaseUrl.replace(/^(https?:\/\/|wss?:\/\/)/, '');
      const listenerWsUrl = `${wsProtocol}://${cleanHost}/ws/listener`;

      console.log('Using WebSocket URL:', listenerWsUrl);

      try {
        console.log('Listener Dashboard connecting to WebSocket:', listenerWsUrl)

        if (wsInstance) {
          try {
            if (wsInstance.readyState !== WebSocket.CLOSING && 
                wsInstance.readyState !== WebSocket.CLOSED) {
              wsInstance.close()
            }
          } catch (e) {
            console.warn('Error closing existing WebSocket:', e)
          }
        }

        wsInstance = new WebSocket(listenerWsUrl)
        wsRef.current = wsInstance

        wsInstance.onopen = () => {
          console.log('WebSocket connected for listener updates')
          isReconnecting = false
          wsConnectingRef.current = false

          setTimeout(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              const currentlyPlaying = audioRef.current && !audioRef.current.paused
              sendPlayerStatus(currentlyPlaying)
              console.log('Sent initial player status on WebSocket connect:', currentlyPlaying)
            }
          }, 100)

          if (heartbeatInterval.current) {
            clearInterval(heartbeatInterval.current)
          }

          heartbeatInterval.current = setInterval(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && audioRef.current) {
              const currentlyPlaying = !audioRef.current.paused
              if (currentlyPlaying) {
                sendPlayerStatus(true)
                console.log('Heartbeat: Sent player status (playing)')
              }
            }
          }, 15000)
        }

        wsInstance.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            console.log('WebSocket message received:', data)

            if (data.type === 'STREAM_STATUS') {
              setIsLive(data.isLive)
              setListenerCount(data.listenerCount || 0)
              console.log('Stream status updated via WebSocket:', data.isLive)
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error)
          }
        }

        wsInstance.onclose = (event) => {
          console.log(`WebSocket disconnected with code ${event.code}, reason: ${event.reason}`)
          isReconnecting = false
          wsConnectingRef.current = false

          if (heartbeatInterval.current) {
            clearInterval(heartbeatInterval.current)
            heartbeatInterval.current = null
          }

          if (event.code !== 1000) {
            console.log('Attempting to reconnect WebSocket in 3 seconds...')
            reconnectTimer = setTimeout(connectWebSocket, 3000)
          }
        }

        wsInstance.onerror = (error) => {
          console.error('WebSocket error:', error)
        }
      } catch (error) {
        console.error('Error creating WebSocket:', error)
        isReconnecting = false
        wsConnectingRef.current = false

        reconnectTimer = setTimeout(connectWebSocket, 3000)
      }
    }

    connectWebSocket()

    return () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }

      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current)
        heartbeatInterval.current = null
      }

      if (wsInstance) {
        try {
          console.log('Closing WebSocket due to component unmount')
          wsInstance.close(1000, 'Component unmounting')
        } catch (e) {
          console.warn('Error closing WebSocket during cleanup:', e)
        }
      }
    }
  }, [serverConfig])

  // Send player status when playing state changes
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      sendPlayerStatus(isPlaying)
    }
  }, [isPlaying, sendPlayerStatus])

  // Stream status checking from ListenerDashboard2.jsx
  useEffect(() => {
    if (!serverConfig) return

    const checkStatus = () => {
      streamService.getStatus()
        .then(response => {
          console.log("Backend stream status:", response.data)

          if (response.data && response.data.data) {
            const statusData = response.data.data
            setIsLive(statusData.live || false)

            streamService.getHealth()
              .then(healthResponse => {
                console.log("Health status:", healthResponse.data)
              })
              .catch(error => {
                console.log("Health check failed:", error)
              })
          }
        })
        .catch(error => {
          console.error('Error checking status:', error)
        })
    }

    checkStatus()
    statusCheckInterval.current = setInterval(checkStatus, 5000)

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

        console.log('Listener Dashboard: Fetching initial chat messages for broadcast:', currentBroadcastId);

        // Clear old messages immediately when switching broadcasts
        setChatMessages([]);

        const response = await chatService.getMessages(currentBroadcastId);

        // Double-check that the response is for the current broadcast
        const newMessages = response.data.filter(msg => msg.broadcastId === currentBroadcastId);

        console.log('Listener Dashboard: Loaded initial chat messages:', newMessages.length);

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
          console.log('Chat fetch aborted for broadcast:', currentBroadcastId);
          return;
        }
        console.error("Listener Dashboard: Error fetching chat messages:", error);
      }
    };

    fetchChatMessages();

    // Only use polling as fallback if not live
    if (!isLive) {
      const interval = setInterval(() => {
        // Check if broadcast ID is still valid before polling
        if (currentBroadcastId && currentBroadcastId > 0) {
          fetchChatMessages();
        }
      }, 5000);

      return () => {
        clearInterval(interval);
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        setChatMessages([]);
      };
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setChatMessages([]);
    };
  }, [currentBroadcastId, isLive]);

  // Setup WebSocket connections for real-time updates after initial data is loaded
  useEffect(() => {
    // Guard: Only setup WebSockets if we have a valid broadcast ID and are live
    if (!currentBroadcastId || currentBroadcastId <= 0 || !isLive) {
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

        console.log('Listener Dashboard: Setting up chat WebSocket for broadcast:', currentBroadcastId);

        // Add connection status tracking
        let wsConnected = false;

        const connection = await chatService.subscribeToChatMessages(currentBroadcastId, (newMessage) => {
          // Set connection status to true on first message - this confirms WebSocket is working
          if (!wsConnected) {
            wsConnected = true;
            console.log('Listener Dashboard: WebSocket confirmed working');
          }

          // Double-check the message is for the current broadcast
          if (newMessage.broadcastId === currentBroadcastId) {
            console.log('Listener Dashboard: Received new chat message:', newMessage);

            // Important: Use functional update with proper immutability
            setChatMessages(prev => {
              // Check if message already exists to avoid duplicates
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) {
                console.log('Listener Dashboard: Message already exists, skipping');
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

              // Make this more visible in logs
              console.log('Listener Dashboard: WEBSOCKET UPDATE - New message count:', updated.length);
              return updated;
            });
          } else {
            console.log('Listener Dashboard: Ignoring message for different broadcast:', newMessage.broadcastId);
          }
        });

        // Add a connection status check
        setTimeout(() => {
          if (!wsConnected) {
            console.warn('Listener Dashboard: WebSocket not confirmed working after 3 seconds, refreshing messages');
            // Fallback - fetch messages again if WebSocket isn't working
            chatService.getMessages(currentBroadcastId).then(response => {
              setChatMessages(response.data);
            }).catch(error => {
              console.error('Listener Dashboard: Error fetching messages during fallback:', error);
            });
          }
        }, 3000);

        chatWsRef.current = connection;
        console.log('Listener Dashboard: Chat WebSocket connected successfully');
      } catch (error) {
        console.error('Listener Dashboard: Failed to connect chat WebSocket:', error);

        // Important: Fallback to polling on WebSocket failure
        const pollInterval = setInterval(() => {
          if (currentBroadcastId) {
            console.log('Listener Dashboard: Polling for messages due to WebSocket failure');
            chatService.getMessages(currentBroadcastId)
                .then(response => {
                  setChatMessages(response.data);
                })
                .catch(error => {
                  console.error('Listener Dashboard: Error polling messages:', error);
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
          console.log('Listener Dashboard: Cleaning up existing song request WebSocket');
          songRequestWsRef.current.disconnect();
          songRequestWsRef.current = null;
        }

        console.log('Listener Dashboard: Setting up song request WebSocket for broadcast:', currentBroadcastId);
        const connection = await songRequestService.subscribeToSongRequests(currentBroadcastId, (newRequest) => {
          // Double-check the request is for the current broadcast
          if (newRequest.broadcastId === currentBroadcastId) {
            console.log('Listener Dashboard: New song request received:', newRequest);
            // You can add notification logic here if needed
          } else {
            console.log('Listener Dashboard: Ignoring song request for different broadcast:', newRequest.broadcastId);
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

        console.log('Listener Dashboard: Setting up poll WebSocket for broadcast:', currentBroadcastId);
        const connection = await pollService.subscribeToPolls(currentBroadcastId, (data) => {
          console.log('Listener Dashboard: Received poll update:', data);
          switch (data.type) {
            case 'NEW_POLL':
              if (data.poll && data.poll.isActive) {
                setCurrentPoll({
                  ...data.poll,
                  totalVotes: data.poll.options.reduce((sum, option) => sum + option.votes, 0),
                  userVoted: false
                });
              }
              break;

            case 'POLL_UPDATED':
              if (data.poll && !data.poll.isActive && currentPoll?.id === data.poll.id) {
                setCurrentPoll(null);
              }
              break;

            case 'POLL_RESULTS':
              if (data.pollId === currentPoll?.id && data.results) {
                setCurrentPoll(prev => prev ? {
                  ...prev,
                  options: data.results.options,
                  totalVotes: data.results.totalVotes
                } : null);
              }
              break;
          }
        });
        pollWsRef.current = connection;
        console.log('Listener Dashboard: Poll WebSocket connected successfully');
      } catch (error) {
        console.error('Listener Dashboard: Failed to connect poll WebSocket:', error);
      }
    };

    // Setup WebSockets immediately - no delay needed with proper guards
    setupChatWebSocket();
    setupSongRequestWebSocket();
    setupPollWebSocket();

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
    };
  }, [currentBroadcastId, isLive]); // Removed chatMessages.length and currentPoll?.id dependencies to prevent unnecessary re-runs

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
      const response = await chatService.sendMessage(currentBroadcastId, messageData);

      // Important: Always fetch messages after sending to ensure consistency
      const updatedMessages = await chatService.getMessages(currentBroadcastId);

      // Update local state with fresh data from server
      setChatMessages(updatedMessages.data);

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
      try {
        // Fetch live broadcasts from API
        const response = await broadcastService.getLive();
        const liveBroadcasts = response.data;

        // If there are any live broadcasts, set isLive to true
        if (liveBroadcasts && liveBroadcasts.length > 0) {
          setIsLive(true);
          // Set the first live broadcast as the current one
          const currentBroadcast = liveBroadcasts[0];
          setCurrentBroadcastId(currentBroadcast.id);
          setCurrentBroadcast(currentBroadcast);

          // Set current song if available
          if (currentBroadcast.currentSong) {
            setCurrentSong({
              title: currentBroadcast.currentSong.title,
              artist: currentBroadcast.currentSong.artist
            });
          } else {
            // Fallback to default if no song data
            setCurrentSong(null);
          }

          console.log("Live broadcast:", currentBroadcast);
        } else {
          setIsLive(false);
          setCurrentBroadcast(null);
          setCurrentSong(null);
          // If no live broadcasts, check for upcoming broadcasts
          try {
            const upcomingResponse = await broadcastService.getUpcoming();
            const upcomingBroadcasts = upcomingResponse.data;

            if (upcomingBroadcasts && upcomingBroadcasts.length > 0) {
              // Set the next broadcast
              const next = upcomingBroadcasts[0];
              setNextBroadcast({
                title: next.title,
                date: new Date(next.scheduledStart).toLocaleDateString(),
                time: new Date(next.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              });
            } else {
              setNextBroadcast(null);
            }
          } catch (error) {
            console.error("Error fetching upcoming broadcasts:", error);
          }
        }
      } catch (error) {
        console.error("Error checking broadcast status:", error);
        setIsLive(false);
      }
    }

    checkBroadcastStatus();
    const interval = setInterval(checkBroadcastStatus, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  // Fetch active polls for the current broadcast
  useEffect(() => {
    if (currentBroadcastId && isLive) {
      const fetchActivePolls = async () => {
        try {
          setPollLoading(true);
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
                setUserVote(userVoteResponse.data);

                // Get poll results
                const resultsResponse = await pollService.getPollResults(activePoll.id);

                // Combine poll data with results
                setCurrentPoll({
                  ...activePoll,
                  options: resultsResponse.data.options,
                  totalVotes: resultsResponse.data.totalVotes,
                  userVoted: true,
                  userVotedFor: userVoteResponse.data.optionId
                });
              } else {
                // User hasn't voted
                setCurrentPoll({
                  ...activePoll,
                  totalVotes: activePoll.options.reduce((sum, option) => sum + option.votes, 0),
                  userVoted: false
                });
              }
            } catch (error) {
              console.error("Error checking user vote:", error);
              setCurrentPoll({
                ...activePoll,
                totalVotes: activePoll.options.reduce((sum, option) => sum + option.votes, 0),
                userVoted: false
              });
            }
          } else {
            setCurrentPoll(null);
          }
        } catch (error) {
          console.error("Error fetching active polls:", error);
        } finally {
          setPollLoading(false);
        }
      };

      fetchActivePolls();

      // Set up interval to periodically check for new polls
      const interval = setInterval(fetchActivePolls, 10000); // Check every 10 seconds

      return () => clearInterval(interval);
    } else {
      // Reset poll when no broadcast is live
      setCurrentPoll(null);
    }
  }, [currentBroadcastId, isLive]);

  // Toggle play/pause with enhanced logic from ListenerDashboard2.jsx
  const togglePlay = () => {
    console.log('Toggle play called, current state:', { isPlaying, wsReadyState: wsRef.current?.readyState })

    if (!audioRef.current || !serverConfig) {
      setStreamError("Audio player not ready. Please wait...")
      return
    }

    try {
      if (isPlaying) {
        console.log('Pausing playback')
        audioRef.current.pause()
        setIsPlaying(false)
        sendPlayerStatus(false)
      } else {
        console.log('Starting playback')
        const currentSrc = audioRef.current.src
        const expectedSrc = serverConfig.streamUrl.startsWith('http')
          ? serverConfig.streamUrl
          : `https://${serverConfig.streamUrl}`

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
              setIsPlaying(true)
              setStreamError(null)
              sendPlayerStatus(true)
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
              setIsPlaying(false)

              if (audioRef.current) {
                const srcAfterError = audioRef.current.src
                if (!srcAfterError.startsWith('http') || srcAfterError.includes('localhost:5173') || srcAfterError.startsWith('blob:')) {
                  console.warn('Audio src changed to invalid URL after error, resetting to stream URL')
                  audioRef.current.src = expectedSrc
                  audioRef.current.load()
                }
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

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
  }

  // Handle volume change with enhanced logic
  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value, 10);
    setVolume(newVolume);

    // Handle mute state based on volume
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted && newVolume > 0) {
      setIsMuted(false);
    }
  }

  // Refresh stream from ListenerDashboard2.jsx
  const refreshStream = () => {
    if (audioRef.current && serverConfig) {
      console.log('Refreshing stream...')

      if (isPlaying) {
        sendPlayerStatus(false)
      }

      try {
        audioRef.current.pause()

        const streamUrl = serverConfig.streamUrl.startsWith('http') 
          ? serverConfig.streamUrl 
          : `https://${serverConfig.streamUrl}`

        console.log('Setting new stream URL during refresh:', streamUrl)

        audioRef.current.src = streamUrl
        audioRef.current.load()

        setStreamError(null)
        setIsPlaying(false)

        console.log('Stream refreshed successfully')
      } catch (error) {
        console.error('Error refreshing stream:', error)
        setStreamError(`Error refreshing stream: ${error.message}. Please try again.`)

        try {
          audioRef.current.pause()
          const streamUrl = serverConfig.streamUrl.startsWith('http')
            ? serverConfig.streamUrl
            : `https://${serverConfig.streamUrl}`
          audioRef.current.src = streamUrl
        } catch (cleanupError) {
          console.error('Error cleaning up audio element:', cleanupError)
        }
      }
    } else {
      console.warn('Cannot refresh stream: audio element or server config not available')
    }
  }

  // Handle song request submission
  const handleSongRequestSubmit = async (e) => {
    e.preventDefault();
    if (!songRequest.song.trim() || !songRequest.artist.trim() || !currentBroadcastId) return;

    try {
      // Create song request object to send to the server
      const requestData = {
        songTitle: songRequest.song,
        artist: songRequest.artist,
        dedication: songRequest.dedication
      };

      // Send song request to the server
      await songRequestService.createRequest(currentBroadcastId, requestData);

      // Show success message
      alert(`Song request submitted: "${songRequest.song}" by ${songRequest.artist}`);

      // Reset the form
      setSongRequest({ song: "", artist: "", dedication: "" });
    } catch (error) {
      console.error("Error submitting song request:", error);
      alert("Failed to submit song request. Please try again.");
    }
  };

  // Handle poll vote
  const handlePollVote = async (optionId) => {
    if (!currentPoll || currentPoll.userVoted || !isLive) return;

    try {
      setPollLoading(true);

      // Send vote to backend
      const voteData = {
        pollId: currentPoll.id,
        optionId: optionId
      };

      await pollService.vote(currentPoll.id, voteData);

      // Get updated poll results
      const resultsResponse = await pollService.getPollResults(currentPoll.id);

      // Update user vote
      const userVoteResponse = await pollService.getUserVote(currentPoll.id);
      setUserVote(userVoteResponse.data);

      // Update current poll with results
      setCurrentPoll(prev => ({
        ...prev,
        options: resultsResponse.data.options,
        totalVotes: resultsResponse.data.totalVotes,
        userVoted: true,
        userVotedFor: optionId
      }));

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

            // Format relative time
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
          <div className="bg-maroon-700 rounded-lg overflow-hidden mb-6 h-[200px] flex flex-col justify-center">
            {/* Live indicator */}
            <div className="absolute p-2 px-4">
              {isLive ? (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-600 text-white">
                  <span className="h-2 w-2 rounded-full bg-white mr-1 animate-pulse"></span>
                  LIVE ({listenerCount} listeners)
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
                          : isPlaying
                          ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                          : 'bg-green-100 text-green-800 hover:bg-green-200'
                      }`}
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? (
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
                  <button onClick={toggleMute} className="text-white mr-2">
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
                          value={songRequest.song}
                          onChange={(e) => setSongRequest({ ...songRequest, song: e.target.value })}
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
                      {pollLoading && !currentPoll ? (
                        <div className="text-center py-8 flex-grow flex items-center justify-center">
                          <p className="text-gray-500 dark:text-gray-400 animate-pulse">Loading polls...</p>
                        </div>
                      ) : currentPoll ? (
                        <div className="flex-grow flex flex-col">
                          <div className="space-y-6 mb-6 flex-grow">
                            {currentPoll.options.map((option) => {
                              const percentage = Math.round((option.votes / currentPoll.totalVotes) * 100) || 0;
                              return (
                                <div key={option.id} className="space-y-1">
                                  <div className="text-sm font-medium mb-2 text-gray-900 dark:text-white">{option.text}</div>
                                  <div 
                                    className="w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md overflow-hidden cursor-pointer"
                                    onClick={() => !currentPoll.userVoted && handlePollVote(option.id)}
                                  >
                                    <div 
                                      className="h-8 bg-pink-200 dark:bg-maroon-900/30 flex items-center pl-3 text-xs text-gray-800 dark:text-gray-200"
                                      style={{ width: `${percentage}%` }}
                                    >
                                      {percentage}%
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="mt-auto flex justify-center">
                            <button
                              onClick={() => setCurrentPoll({ ...currentPoll, userVoted: true })}
                              disabled={currentPoll.userVoted}
                              className={`bg-yellow-500 hover:bg-yellow-600 text-black font-medium py-2 px-12 rounded ${
                                currentPoll.userVoted ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            >
                              Vote
                            </button>
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
            <p className="text-xs opacity-70">{listenerCount} listeners online</p>
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
                    const messageDate = msg.createdAt ? new Date(msg.createdAt + 'Z') : null;

                    // Format relative time
                    const timeAgo = messageDate ? formatDistanceToNow(messageDate, { addSuffix: false }) : 'Invalid Date';

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
