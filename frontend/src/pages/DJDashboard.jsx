"use client"

import { useState, useEffect, useRef } from "react"
import { 
  PlayIcon, 
  PauseIcon,
  MicrophoneIcon,
  StopIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  PlusIcon,
  CheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid"
import { 
  ChatBubbleLeftRightIcon,
  MusicalNoteIcon,
  ChartBarIcon,
  PaperAirplaneIcon,
  UserIcon,
  HeartIcon,
} from "@heroicons/react/24/outline"
import { streamService, broadcastService, authService, chatService, songRequestService, pollService } from "../services/api"
import { useAuth } from "../context/AuthContext"
import { useStreaming } from "../context/StreamingContext"
import { formatDistanceToNow } from 'date-fns'
import AudioSourceSelector from "../components/AudioSourceSelector"
import DJAudioControls from "../components/DJAudioControls"
import { EnhancedScrollArea } from "../components/ui/enhanced-scroll-area"
import { createLogger } from "../services/logger"

const logger = createLogger('DJDashboard');

// Broadcast workflow states
const WORKFLOW_STATES = {
  CREATE_BROADCAST: 'CREATE_BROADCAST',
  READY_TO_STREAM: 'READY_TO_STREAM', 
  STREAMING_LIVE: 'STREAMING_LIVE'
}

export default function DJDashboard() {
  // Authentication context
  const { currentUser } = useAuth()

  // Streaming context
  const { 
    isLive, 
    currentBroadcast: streamingBroadcast, 
    websocketConnected,
    listenerCount,
    startBroadcast: startStreamingBroadcast,
    stopBroadcast: stopStreamingBroadcast,
    restoreDJStreaming,
    serverConfig,
    mediaRecorderRef,
    audioStreamRef
  } = useStreaming()

  // Core workflow state
  const [workflowState, setWorkflowState] = useState(WORKFLOW_STATES.CREATE_BROADCAST)
  const [currentBroadcast, setCurrentBroadcast] = useState(null)

  // Broadcast creation form state (simplified - no scheduling)
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    description: ''
  })
  const [formErrors, setFormErrors] = useState({})
  const [isCreatingBroadcast, setIsCreatingBroadcast] = useState(false)

  // Core streaming state
  const [streamError, setStreamError] = useState(null)
  const [isRestoringAudio, setIsRestoringAudio] = useState(false)

  // WebSocket and MediaRecorder refs
  const websocketRef = useRef(null)
  const statusWsRef = useRef(null)

  // Audio preview state
  const [previewEnabled, setPreviewEnabled] = useState(false)
  const [volume, setVolume] = useState(80)
  const [isMuted, setIsMuted] = useState(false)
  const audioPreviewRef = useRef(null)

  // Constants from prototype
  const MAX_MESSAGE_SIZE = 60000

  // No longer needed - interactions are directly in main dashboard when live

  // Chat State
  const [chatMessages, setChatMessages] = useState([])
  const [chatMessage, setChatMessage] = useState('')

  // Song Requests State  
  const [songRequests, setSongRequests] = useState([])

  // Poll Creation State
  const [newPoll, setNewPoll] = useState({
    question: '',
    options: ['', '']
  })
  const [isCreatingPoll, setIsCreatingPoll] = useState(false)

  // Polls Display State
  const [polls, setPolls] = useState([])
  const [activePoll, setActivePoll] = useState(null)
  const [showPollCreation, setShowPollCreation] = useState(false)

  // WebSocket References for interactions
  const chatWsRef = useRef(null)
  const songRequestWsRef = useRef(null)
  const pollWsRef = useRef(null)

  // Add abort controller ref for managing HTTP requests
  const abortControllerRef = useRef(null)

  // Analytics State
  const [broadcastStartTime, setBroadcastStartTime] = useState(null)
  const [totalInteractions, setTotalInteractions] = useState(0)
  const [peakListeners, setPeakListeners] = useState(0)
  const [totalSongRequests, setTotalSongRequests] = useState(0)
  const [totalPolls, setTotalPolls] = useState(0)
  const [durationTick, setDurationTick] = useState(0)

  // Chat timestamp update state
  const [chatTimestampTick, setChatTimestampTick] = useState(0)

  // Update duration display every second when live
  useEffect(() => {
    let interval = null
    if (workflowState === WORKFLOW_STATES.STREAMING_LIVE && broadcastStartTime) {
      interval = setInterval(() => {
        // Force re-render by updating a tick counter
        setDurationTick(prev => prev + 1)
      }, 1000)
    } else {
      setDurationTick(0)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [workflowState, broadcastStartTime])

  // Sync local state with streaming context
  useEffect(() => {
    if (streamingBroadcast) {
      setCurrentBroadcast(streamingBroadcast);
      setWorkflowState(WORKFLOW_STATES.STREAMING_LIVE);
    }
  }, [streamingBroadcast]);

  // Check for existing active broadcast on component mount
  useEffect(() => {
    const checkActiveBroadcast = async () => {
      try {
        const activeBroadcast = await broadcastService.getActiveBroadcast()
        if (activeBroadcast) {
          setCurrentBroadcast(activeBroadcast)
          setWorkflowState(WORKFLOW_STATES.STREAMING_LIVE)
          setBroadcastStartTime(new Date())
        }
      } catch (error) {
        logger.error("Error checking for active broadcast:", error)
      }
    }

    if (currentUser && !streamingBroadcast) {
      checkActiveBroadcast()
    }
  }, [currentUser, streamingBroadcast])

  // Track analytics when streaming starts
  useEffect(() => {
    if (workflowState === WORKFLOW_STATES.STREAMING_LIVE && !broadcastStartTime) {
      setBroadcastStartTime(new Date())
    }
  }, [workflowState, broadcastStartTime])

  // Track peak listeners
  useEffect(() => {
    if (listenerCount > peakListeners) {
      setPeakListeners(listenerCount)
    }
  }, [listenerCount, peakListeners])

  // Track total interactions
  useEffect(() => {
    setTotalInteractions(chatMessages.length + songRequests.length + totalPolls)
  }, [chatMessages.length, songRequests.length, totalPolls])

  // Track song requests count
  useEffect(() => {
    setTotalSongRequests(songRequests.length)
  }, [songRequests.length])

  // Update chat timestamps every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setChatTimestampTick(prev => prev + 1);
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Replace the connectStatusWebSocket useEffect with a simpler version that doesn't create its own WebSocket
  useEffect(() => {
    logger.debug('DJ Dashboard: Using global streaming context for WebSocket connections');
    return () => {
      logger.debug('DJ Dashboard: Cleaning up, global streaming context will maintain connections');
    }
  }, []);

  // Fetch initial data when broadcast becomes available
  useEffect(() => {
    // Guard: Only fetch if we have a valid broadcast and are in streaming state
    if (workflowState !== WORKFLOW_STATES.STREAMING_LIVE || !currentBroadcast || !currentBroadcast.id) {
      // Clear interaction data when not live or no valid broadcast
      setChatMessages([]);
      setSongRequests([]);
      setPolls([]);
      setActivePoll(null);
      return;
    }

    const fetchInitialData = async () => {
      try {
        // Cancel any previous request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        // Create new abort controller for this request
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        logger.debug('DJ Dashboard: Fetching initial interaction data for broadcast:', currentBroadcast.id);

        // Clear old data immediately when switching broadcasts
        setChatMessages([]);
        setSongRequests([]);
        setPolls([]);
        setActivePoll(null);

        // Fetch chat messages
        const chatResponse = await chatService.getMessages(currentBroadcast.id);
        logger.debug('DJ Dashboard: Loaded initial chat messages:', chatResponse.data?.length || 0);

        // Double-check response is for current broadcast before setting state
        if (currentBroadcast.id === currentBroadcast.id && !signal.aborted) {
          setChatMessages(chatResponse.data || []);
        }

        // Fetch song requests
        const requestsResponse = await songRequestService.getRequests(currentBroadcast.id);
        logger.debug('DJ Dashboard: Loaded initial song requests:', requestsResponse.data?.length || 0);

        if (currentBroadcast.id === currentBroadcast.id && !signal.aborted) {
          setSongRequests(requestsResponse.data || []);
        }

        // Fetch polls
        const pollsResponse = await pollService.getPollsForBroadcast(currentBroadcast.id);
        logger.debug('DJ Dashboard: Loaded initial polls:', pollsResponse.data?.length || 0);

        if (currentBroadcast.id === currentBroadcast.id && !signal.aborted) {
          setPolls(pollsResponse.data || []);

          // Set active poll (most recent one)
          if (pollsResponse.data && pollsResponse.data.length > 0) {
            setActivePoll(pollsResponse.data[0]);
          }
        }
      } catch (error) {
        // Ignore aborted requests
        if (error.name === 'AbortError') {
          logger.debug('DJ Dashboard: Initial data fetch aborted for broadcast:', currentBroadcast.id);
          return;
        }
        logger.error('DJ Dashboard: Error fetching initial interaction data:', error);
      }
    };

    fetchInitialData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [workflowState, currentBroadcast?.id]); // Use currentBroadcast?.id to avoid running when currentBroadcast is null

  // Setup interaction WebSockets after initial data is loaded
  useEffect(() => {
    // Guard: Only setup WebSockets if we have a valid broadcast and are in streaming state
    if (workflowState !== WORKFLOW_STATES.STREAMING_LIVE || !currentBroadcast || !currentBroadcast.id) {
      return;
    }

    logger.debug('DJ Dashboard: Setting up WebSocket connections for broadcast:', currentBroadcast.id);

    // Setup Chat WebSocket
    const setupChatWebSocket = async () => {
      try {
        // Clean up any existing connection first
        if (chatWsRef.current) {
          logger.debug('DJ Dashboard: Cleaning up existing chat WebSocket');
          chatWsRef.current.disconnect();
          chatWsRef.current = null;
        }

        logger.debug('DJ Dashboard: Setting up chat WebSocket for broadcast:', currentBroadcast.id);
        const connection = await chatService.subscribeToChatMessages(currentBroadcast.id, (newMessage) => {
          // Double-check the message is for the current broadcast
          if (newMessage.broadcastId === currentBroadcast.id) {
            logger.debug('DJ Dashboard: Received new chat message:', newMessage);
            setChatMessages(prev => {
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) {
                logger.debug('DJ Dashboard: Message already exists, skipping');
                return prev;
              }
              const updated = [...prev, newMessage].sort((a, b) => 
                new Date(a.createdAt) - new Date(b.createdAt)
              );
              logger.debug('DJ Dashboard: Updated chat messages count:', updated.length);
              return updated;
            });
          } else {
            logger.debug('DJ Dashboard: Ignoring message for different broadcast:', newMessage.broadcastId);
          }
        });
        chatWsRef.current = connection;
        logger.debug('DJ Dashboard: Chat WebSocket connected successfully');
      } catch (error) {
        logger.error('DJ Dashboard: Failed to connect chat WebSocket:', error);
      }
    };

    // Setup Song Request WebSocket
    const setupSongRequestWebSocket = async () => {
      try {
        // Clean up any existing connection first
        if (songRequestWsRef.current) {
          logger.debug('DJ Dashboard: Cleaning up existing song request WebSocket');
          songRequestWsRef.current.disconnect();
          songRequestWsRef.current = null;
        }

        logger.debug('DJ Dashboard: Setting up song request WebSocket for broadcast:', currentBroadcast.id);
        const connection = await songRequestService.subscribeToSongRequests(currentBroadcast.id, (message) => {
          // Check if this is a deletion notification
          if (message.type === 'SONG_REQUEST_DELETED') {
            logger.debug('DJ Dashboard: Received song request deletion notification:', message);
            // Remove the deleted request from the state
            setSongRequests(prev => prev.filter(req => req.id !== message.requestId));
            return;
          }

          // Handle new song request
          // Double-check the request is for the current broadcast
          if (message.broadcastId === currentBroadcast.id) {
            logger.debug('DJ Dashboard: Received new song request:', message);
            setSongRequests(prev => {
              const exists = prev.some(req => req.id === message.id);
              if (exists) return prev;
              return [message, ...prev];
            });
          } else {
            logger.debug('DJ Dashboard: Ignoring song request for different broadcast:', message.broadcastId);
          }
        });
        songRequestWsRef.current = connection;
        logger.debug('DJ Dashboard: Song request WebSocket connected successfully');
      } catch (error) {
        logger.error('DJ Dashboard: Failed to connect song request WebSocket:', error);
      }
    };

    // Setup Poll WebSocket
    const setupPollWebSocket = async () => {
      try {
        // Clean up any existing connection first
        if (pollWsRef.current) {
          logger.debug('DJ Dashboard: Cleaning up existing poll WebSocket');
          pollWsRef.current.disconnect();
          pollWsRef.current = null;
        }

        logger.debug('DJ Dashboard: Setting up poll WebSocket for broadcast:', currentBroadcast.id);
        const connection = await pollService.subscribeToPolls(currentBroadcast.id, (pollUpdate) => {
          logger.debug('DJ Dashboard: Received poll update:', pollUpdate);

          switch (pollUpdate.type) {
            case 'POLL_VOTE':
              logger.debug('DJ Dashboard: Processing poll vote update for poll:', pollUpdate.pollId);
              // Update existing poll with new vote data
              setPolls(prev => prev.map(poll => 
                poll.id === pollUpdate.pollId 
                  ? { 
                      ...poll, 
                      options: pollUpdate.poll?.options || poll.options,
                      totalVotes: pollUpdate.poll?.totalVotes || poll.totalVotes
                    }
                  : poll
              ));

              // Update active poll if it's the one being voted on
              setActivePoll(prev => 
                prev && prev.id === pollUpdate.pollId 
                  ? { 
                      ...prev, 
                      options: pollUpdate.poll?.options || prev.options,
                      totalVotes: pollUpdate.poll?.totalVotes || prev.totalVotes
                    }
                  : prev
              );
              break;

            case 'NEW_POLL':
              logger.debug('DJ Dashboard: Processing new poll:', pollUpdate.poll);
              // Add new poll to the list
              setPolls(prev => {
                const exists = prev.some(poll => poll.id === pollUpdate.poll.id);
                if (exists) return prev;
                return [pollUpdate.poll, ...prev];
              });
              setActivePoll(pollUpdate.poll);
              break;

            case 'POLL_UPDATED':
              logger.debug('DJ Dashboard: Processing poll update:', pollUpdate.poll);
              if (pollUpdate.poll && !pollUpdate.poll.isActive) {
                // Poll ended
                setActivePoll(prev => prev?.id === pollUpdate.poll.id ? null : prev);
              }
              break;

            case 'POLL_RESULTS':
              logger.debug('DJ Dashboard: Processing poll results update:', pollUpdate.results);
              if (pollUpdate.pollId && pollUpdate.results) {
                setPolls(prev => prev.map(poll => 
                  poll.id === pollUpdate.pollId 
                    ? { 
                        ...poll, 
                        options: pollUpdate.results.options,
                        totalVotes: pollUpdate.results.totalVotes
                      }
                    : poll
                ));

                setActivePoll(prev => 
                  prev && prev.id === pollUpdate.pollId 
                    ? { 
                        ...prev, 
                        options: pollUpdate.results.options,
                        totalVotes: pollUpdate.results.totalVotes
                      }
                    : prev
                );
              }
              break;

            default:
              logger.debug('DJ Dashboard: Unknown poll update type:', pollUpdate.type);
          }
        });
        pollWsRef.current = connection;
        logger.debug('DJ Dashboard: Poll WebSocket connected successfully');
      } catch (error) {
        logger.error('DJ Dashboard: Failed to connect poll WebSocket:', error);
      }
    };

    // Setup WebSockets immediately - no delay needed with proper guards
    setupChatWebSocket();
    setupSongRequestWebSocket();
    setupPollWebSocket();

    return () => {
      logger.debug('DJ Dashboard: Cleaning up WebSocket connections for broadcast:', currentBroadcast.id);
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
  }, [workflowState, currentBroadcast?.id]); // Removed unnecessary dependencies to prevent re-runs

  // Setup 3-second interval for poll results fetching alongside WebSocket
  useEffect(() => {
    // Guard: Only setup interval if we have a valid broadcast and are in streaming state
    if (workflowState !== WORKFLOW_STATES.STREAMING_LIVE || !currentBroadcast || !currentBroadcast.id) {
      return;
    }

    logger.debug('DJ Dashboard: Setting up 3-second poll results interval for broadcast:', currentBroadcast.id);

    const fetchPollResults = async () => {
      try {
        // Fetch current polls for the broadcast
        const pollsResponse = await pollService.getPollsForBroadcast(currentBroadcast.id);
        if (pollsResponse.data && pollsResponse.data.length > 0) {
          logger.debug('DJ Dashboard: Interval fetched poll results:', pollsResponse.data.length);

          // Update polls state with fresh data
          setPolls(prevPolls => {
            const updatedPolls = pollsResponse.data.map(fetchedPoll => {
              const existingPoll = prevPolls.find(p => p.id === fetchedPoll.id);
              // Only update if there are actual changes to avoid unnecessary re-renders
              if (existingPoll &&
                  existingPoll.totalVotes === fetchedPoll.totalVotes &&
                  JSON.stringify(existingPoll.options) === JSON.stringify(fetchedPoll.options)) {
                return existingPoll;
              }
              return fetchedPoll;
            });
            return updatedPolls;
          });

          // Update active poll if it exists in the fetched data
          setActivePoll(prevActivePoll => {
            if (!prevActivePoll) return prevActivePoll;
            const updatedActivePoll = pollsResponse.data.find(p => p.id === prevActivePoll.id);
            if (updatedActivePoll &&
                (prevActivePoll.totalVotes !== updatedActivePoll.totalVotes ||
                 JSON.stringify(prevActivePoll.options) !== JSON.stringify(updatedActivePoll.options))) {
              logger.debug('DJ Dashboard: Interval updated active poll results');
              return updatedActivePoll;
            }
            return prevActivePoll;
          });
        }
      } catch (error) {
        logger.error('DJ Dashboard: Error fetching poll results via interval:', error);
      }
    };

    // Set up the interval
    const intervalId = setInterval(fetchPollResults, 3000); // 3 seconds

    // Cleanup function
    return () => {
      logger.debug('DJ Dashboard: Cleaning up poll results interval');
      clearInterval(intervalId);
    };
  }, [workflowState, currentBroadcast?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // DON'T automatically stop broadcast on unmount - let it persist for navigation
      // The global StreamingContext handles broadcast state persistence
      // Only cleanup component-specific WebSocket connections
      if (statusWsRef.current) {
        statusWsRef.current.close()
      }
      if (chatWsRef.current) {
        chatWsRef.current.disconnect();
      }
      if (songRequestWsRef.current) {
        songRequestWsRef.current.disconnect();
      }
      if (pollWsRef.current) {
        pollWsRef.current.disconnect();
      }
    }
  }, [])

  // Form handling functions
  const handleFormChange = (e) => {
    const { name, value } = e.target
    setBroadcastForm(prev => ({
      ...prev,
      [name]: value
    }))

    // Clear error for this field when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const validateForm = () => {
    const errors = {}

    if (!broadcastForm.title.trim()) {
      errors.title = 'Title is required'
    }

    if (!broadcastForm.description.trim()) {
      errors.description = 'Description is required'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Helper function to format local date/time as ISO string without timezone conversion
  const formatLocalTimeAsISO = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0')

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`
  }

  const createBroadcast = async () => {
    if (!validateForm()) {
      return
    }

    setIsCreatingBroadcast(true)
    setStreamError(null)

    try {
      // Create broadcast content only (no scheduling)
      // Use current time + buffer as scheduled times for the API compatibility
      const now = new Date()
      // Add 30 seconds buffer to account for network latency and processing time
      const bufferedStart = new Date(now.getTime() + 30 * 1000)
      const endTime = new Date(bufferedStart.getTime() + 2 * 60 * 60 * 1000) // Default 2 hours duration

      // Send times in local timezone (Philippines time) directly
      const broadcastData = {
        title: broadcastForm.title.trim(),
        description: broadcastForm.description.trim(),
        scheduledStart: formatLocalTimeAsISO(bufferedStart),
        scheduledEnd: formatLocalTimeAsISO(endTime)
      }

      logger.debug("DJ Dashboard: Creating broadcast with Philippines local time:", {
        currentTime: now.toLocaleString('en-PH'),
        localStart: bufferedStart.toLocaleString('en-PH'),
        localEnd: endTime.toLocaleString('en-PH'),
        sentStart: broadcastData.scheduledStart,
        sentEnd: broadcastData.scheduledEnd
      })

      const response = await broadcastService.create(broadcastData)
      const createdBroadcast = response.data

      setCurrentBroadcast(createdBroadcast)
      setWorkflowState(WORKFLOW_STATES.READY_TO_STREAM)

      // Reset form
      setBroadcastForm({
        title: '',
        description: ''
      })

      logger.debug("Broadcast created successfully:", createdBroadcast)
    } catch (error) {
      logger.error("Error creating broadcast:", error)
      setStreamError(error.response?.data?.message || "Failed to create broadcast")
    } finally {
      setIsCreatingBroadcast(false)
    }
  }

  const startBroadcast = async () => {
    if (!currentBroadcast) {
      setStreamError("No broadcast instance found")
      return
    }

    try {
      setStreamError(null)

      // Use the global streaming context to start the broadcast
      await startStreamingBroadcast({
        id: currentBroadcast.id,
        title: currentBroadcast.title,
        description: currentBroadcast.description
      });

      setWorkflowState(WORKFLOW_STATES.STREAMING_LIVE);
      setBroadcastStartTime(new Date());

    } catch (error) {
      logger.error("Error starting broadcast:", error)

      // Provide user-friendly error messages based on the error type
      let errorMessage = error.message || "Unknown error occurred";

      if (errorMessage.includes('Desktop audio capture failed') || errorMessage.includes('NotSupported')) {
        setStreamError(
          `Desktop Audio Issue: ${errorMessage}\n\n` +
          "💡 Suggestions:\n" +
          "• Switch to 'Microphone Only' mode above\n" +
          "• Make sure you're using Chrome, Firefox, or Edge\n" +
          "• Ensure you're on HTTPS (or localhost)\n" +
          "• When prompted, select a source with audio (like a browser tab playing music)"
        );
      } else if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowed')) {
        setStreamError(
          `Permission Error: ${errorMessage}\n\n` +
          "💡 Please:\n" +
          "• Allow microphone/screen sharing access when prompted\n" +
          "• Check your browser's permission settings\n" +
          "• Try refreshing the page and allowing permissions"
        );
      } else if (errorMessage.includes('Mixed audio setup failed')) {
        setStreamError(
          `Mixed Audio Error: ${errorMessage}\n\n` +
          "💡 Try:\n" +
          "• Using 'Microphone Only' mode instead\n" +
          "• Ensuring desktop audio is working in other apps\n" +
          "• Using a supported browser (Chrome, Firefox, Edge)"
        );
      } else {
        setStreamError(`Error starting broadcast: ${errorMessage}`);
      }
    }
  }

  const stopBroadcast = async () => {
    try {
      logger.debug("Stopping broadcast")

      // Use the global streaming context to stop the broadcast
      await stopStreamingBroadcast();

      // Reset state back to create new broadcast
      setWorkflowState(WORKFLOW_STATES.CREATE_BROADCAST)

      // Reset analytics
      setBroadcastStartTime(null)
      setTotalInteractions(0)
      setPeakListeners(0)
      setTotalSongRequests(0)
      setTotalPolls(0)
      setChatMessages([])
      setSongRequests([])
      setPolls([])
      setActivePoll(null)

    } catch (error) {
      logger.error("Error stopping broadcast:", error)
      setStreamError(`Error stopping broadcast: ${error.message}`)
    }
  }

  const cancelBroadcast = async () => {
    if (!currentBroadcast) {
      setStreamError("No broadcast instance found")
      return
    }

    try {
      setStreamError(null)
      logger.debug("Canceling broadcast:", currentBroadcast.id)

      // Delete the broadcast from the backend
      await broadcastService.delete(currentBroadcast.id)

      // Reset state back to create new broadcast
      setCurrentBroadcast(null)
      setWorkflowState(WORKFLOW_STATES.CREATE_BROADCAST)

      logger.debug("Broadcast canceled successfully")
    } catch (error) {
      logger.error("Error canceling broadcast:", error)
      setStreamError(error.response?.data?.message || "Failed to cancel broadcast")
    }
  }

  const handleRestoreAudio = async () => {
    setIsRestoringAudio(true);
    setStreamError(null);

    try {
      const success = await restoreDJStreaming();
      if (success) {
        logger.debug('Audio streaming restored successfully');
      } else {
        setStreamError('Failed to restore audio streaming. Please try again.');
      }
    } catch (error) {
      logger.error('Error restoring audio streaming:', error);
      setStreamError(`Error restoring audio: ${error.message}`);
    } finally {
      setIsRestoringAudio(false);
    }
  }

  const togglePreview = async () => {
    if (previewEnabled) {
      // Stop preview
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause()
        audioPreviewRef.current.src = ""
      }
      setPreviewEnabled(false)
    } else {
      // Start preview
      if (serverConfig?.streamUrl) {
        if (!audioPreviewRef.current) {
          audioPreviewRef.current = new Audio()
        }
        audioPreviewRef.current.src = serverConfig.streamUrl
        audioPreviewRef.current.volume = isMuted ? 0 : volume / 100

        try {
          await audioPreviewRef.current.play()
          setPreviewEnabled(true)
        } catch (error) {
          logger.error("Error playing audio preview:", error)
          setStreamError("Could not play audio preview. Please try again.")
        }
      } else {
        setStreamError("Stream URL not available")
      }
    }
  }

  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value, 10)
    setVolume(newVolume)

    if (audioPreviewRef.current) {
      audioPreviewRef.current.volume = isMuted ? 0 : newVolume / 100
    }

    if (newVolume === 0) {
      setIsMuted(true)
    } else if (isMuted) {
      setIsMuted(false)
    }
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
    if (audioPreviewRef.current) {
      audioPreviewRef.current.volume = !isMuted ? 0 : volume / 100
    }
  }

  // Interaction Panel Handlers
  const handleChatSubmit = async (e) => {
    e.preventDefault()
    if (!chatMessage.trim() || !currentBroadcast) return

    try {
      const messageData = { content: chatMessage.trim() }
      await chatService.sendMessage(currentBroadcast.id, messageData)
      setChatMessage('')
    } catch (error) {
      logger.error('Error sending chat message:', error)
    }
  }

  const handleDeleteSongRequest = async (requestId) => {
    if (!currentBroadcast) return

    try {
      logger.debug('Deleting song request:', requestId)
      await songRequestService.deleteRequest(currentBroadcast.id, requestId)

      // Remove the deleted request from the state
      setSongRequests(prev => prev.filter(request => request.id !== requestId))

      logger.debug('Song request deleted successfully')
    } catch (error) {
      logger.error('Error deleting song request:', error)
      alert('Failed to delete song request. Please try again.')
    }
  }

  const handlePollSubmit = async (e) => {
    e.preventDefault()
    if (!newPoll.question.trim() || !currentBroadcast) return

    const validOptions = newPoll.options.filter(option => option.trim())
    if (validOptions.length < 2) {
      return
    }

    try {
      setIsCreatingPoll(true)
      const pollData = {
        question: newPoll.question.trim(),
        broadcastId: currentBroadcast.id,
        options: validOptions
      }

      const response = await pollService.createPoll(pollData)
      const createdPoll = response.data

      logger.debug('DJ Dashboard: Poll created successfully:', createdPoll);

      // Add poll to local state
      setPolls(prev => {
        const exists = prev.some(poll => poll.id === createdPoll.id);
        if (exists) return prev;
        return [createdPoll, ...prev];
      });
      setActivePoll(createdPoll)

      // Track poll creation
      setTotalPolls(prev => prev + 1)

      // Reset form and close creation panel
      setNewPoll({ question: '', options: ['', ''] })
      setShowPollCreation(false)
    } catch (error) {
      logger.error('Error creating poll:', error)
    } finally {
      setIsCreatingPoll(false)
    }
  }

  const addPollOption = () => {
    if (newPoll.options.length < 5) {
      setNewPoll(prev => ({
        ...prev,
        options: [...prev.options, '']
      }))
    }
  }

  const removePollOption = (index) => {
    if (newPoll.options.length > 2) {
      setNewPoll(prev => ({
        ...prev,
        options: prev.options.filter((_, i) => i !== index)
      }))
    }
  }

  const updatePollOption = (index, value) => {
    setNewPoll(prev => ({
      ...prev,
      options: prev.options.map((option, i) => i === index ? value : option)
    }))
  }

  // Helper function to get broadcast duration
  const getBroadcastDuration = () => {
    if (!broadcastStartTime) return "00:00:00"

    const now = new Date()
    const diff = now - broadcastStartTime
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="relative min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
          DJ Dashboard
        </h1>

        {/* Live Streaming Bar - Fixed at top when live */}
        {workflowState === WORKFLOW_STATES.STREAMING_LIVE && currentBroadcast && (
          <div className="bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg shadow-lg overflow-hidden mb-6 sticky top-4 z-50">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center bg-white bg-opacity-20 rounded-full px-4 py-2">
                    <span className="h-3 w-3 rounded-full bg-white animate-pulse mr-3"></span>
                    <span className="font-bold text-lg">LIVE</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{currentBroadcast.title}</h2>
                    <div className="flex items-center space-x-6 mt-1 text-sm opacity-90">
                      <div className="flex items-center">
                        <span className={`h-2 w-2 rounded-full mr-2 ${
                          websocketConnected ? 'bg-green-300' : 'bg-yellow-300'
                        }`}></span>
                        <span>{websocketConnected ? 'Connected' : 'Disconnected'}</span>
                      </div>
                      <div className="flex items-center">
                        <span className={`h-2 w-2 rounded-full mr-2 ${
                          mediaRecorderRef.current && audioStreamRef.current && mediaRecorderRef.current.state === 'recording' ? 'bg-green-300' : 'bg-orange-300'
                        }`}></span>
                        <span>{mediaRecorderRef.current && audioStreamRef.current && mediaRecorderRef.current.state === 'recording' ? 'Audio Streaming' : 'Audio Disconnected'}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-semibold mr-1">{listenerCount}</span>
                        <span>listener{listenerCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {/* Audio Restoration Button - Show when audio is not streaming */}
                  {(!mediaRecorderRef.current || !audioStreamRef.current || mediaRecorderRef.current.state !== 'recording') && (
                    <button
                      onClick={handleRestoreAudio}
                      disabled={isRestoringAudio}
                      className="flex items-center px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black rounded-lg transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <MicrophoneIcon className="h-4 w-4 mr-2" />
                      {isRestoringAudio ? 'Restoring...' : 'Restore Audio'}
                    </button>
                  )}

                  <button
                    onClick={stopBroadcast}
                    className="flex items-center px-6 py-3 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-all duration-200 font-semibold"
                  >
                    <StopIcon className="h-5 w-5 mr-2" />
                    End Broadcast
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Workflow Progress Indicator - Hidden when live */}
        {workflowState !== WORKFLOW_STATES.STREAMING_LIVE && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-8">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                Broadcast Workflow
              </h2>

              <div className="flex items-center justify-between">
                {/* Step 1: Create Broadcast Content */}
                <div className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    workflowState === WORKFLOW_STATES.CREATE_BROADCAST 
                      ? 'border-blue-500 bg-blue-500 text-white' 
                      : workflowState === WORKFLOW_STATES.READY_TO_STREAM || workflowState === WORKFLOW_STATES.STREAMING_LIVE
                      ? 'border-green-500 bg-green-500 text-white'
                      : 'border-gray-300 text-gray-500'
                  }`}>
                    {workflowState === WORKFLOW_STATES.CREATE_BROADCAST ? (
                      <PlusIcon className="h-5 w-5" />
                    ) : (
                      <CheckIcon className="h-5 w-5" />
                    )}
                  </div>
                  <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">
                    Create Broadcast
                  </span>
                </div>

                {/* Arrow */}
                <div className="flex-1 h-0.5 bg-gray-300 dark:bg-gray-600 mx-4"></div>

                {/* Step 2: Ready to Stream */}
                <div className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    workflowState === WORKFLOW_STATES.READY_TO_STREAM 
                      ? 'border-blue-500 bg-blue-500 text-white' 
                      : workflowState === WORKFLOW_STATES.STREAMING_LIVE
                      ? 'border-green-500 bg-green-500 text-white'
                      : 'border-gray-300 text-gray-500'
                  }`}>
                    {workflowState === WORKFLOW_STATES.STREAMING_LIVE ? (
                      <CheckIcon className="h-5 w-5" />
                    ) : (
                      <ClockIcon className="h-5 w-5" />
                    )}
                  </div>
                  <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">
                    Ready to Stream
                  </span>
                </div>

                {/* Arrow */}
                <div className="flex-1 h-0.5 bg-gray-300 dark:bg-gray-600 mx-4"></div>

                {/* Step 3: Live Streaming */}
                <div className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    workflowState === WORKFLOW_STATES.STREAMING_LIVE 
                      ? 'border-red-500 bg-red-500 text-white' 
                      : 'border-gray-300 text-gray-500'
                  }`}>
                    <MicrophoneIcon className="h-5 w-5" />
                  </div>
                  <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">
                    Live Streaming
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {streamError && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200 rounded-md border border-red-300 dark:border-red-800">
            <div className="flex items-start space-x-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">Broadcast Error</h3>
                <div className="text-sm whitespace-pre-line">{streamError}</div>
              </div>
            </div>
          </div>
        )}

        {/* Audio Restoration Notice - Show when live but audio not streaming */}
        {workflowState === WORKFLOW_STATES.STREAMING_LIVE && (!mediaRecorderRef.current || !audioStreamRef.current || mediaRecorderRef.current.state !== 'recording') && (
          <div className="mb-6 p-4 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200 rounded-md border-l-4 border-yellow-500">
            <div className="flex items-center">
              <MicrophoneIcon className="h-5 w-5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="font-semibold">Audio Streaming Disconnected</h3>
                <p className="text-sm mt-1">
                  Your broadcast is live, but audio streaming has been disconnected.
                  Click "Restore Audio" in the live bar above to reconnect your microphone and resume audio streaming.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Live Interactive Dashboard - When streaming live */}
        {workflowState === WORKFLOW_STATES.STREAMING_LIVE && currentBroadcast && (
          <div className="grid grid-cols-12 gap-6 mb-6">
            {/* Chat Section - Wider for more messages */}
            <div className="col-span-12 lg:col-span-5 bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
              <div className="bg-maroon-600 text-white px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2" />
                    <h3 className="font-semibold">Live Chat</h3>
                  </div>
                  <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full">
                    {chatMessages.length} messages
                  </span>
                </div>
              </div>
              <div className="h-[600px] flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {chatMessages.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                      No messages yet
                    </div>
                  ) : (
                    chatMessages
                      .slice()
                      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                      .map((msg) => {
                        if (!msg || !msg.sender) return null;

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

                        let messageDate;
                        try {
                          messageDate = msg.createdAt ? new Date(msg.createdAt.endsWith('Z') ? msg.createdAt : msg.createdAt + 'Z') : null;
                        } catch (error) {
                          messageDate = new Date();
                        }

                        // Format relative time (updated every minute due to chatTimestampTick)
                        const timeAgo = messageDate && !isNaN(messageDate.getTime()) 
                          ? formatDistanceToNow(messageDate, { addSuffix: true }) 
                          : 'Just now';

                        return (
                          <div key={msg.id} className="flex items-start space-x-3">
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs text-white font-medium ${
                              isDJ ? 'bg-maroon-600' : 'bg-gray-500'
                            }`}>
                              {isDJ ? 'DJ' : initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {senderName}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {timeAgo}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 dark:text-gray-300 break-words">
                                {msg.content || 'No content'}
                              </p>
                            </div>
                          </div>
                        );
                      })
                      .filter(Boolean)
                  )}
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                  <form onSubmit={handleChatSubmit} className="flex space-x-2">
                    <input
                      type="text"
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      maxLength={1500}
                    />
                    <button
                      type="submit"
                      disabled={!chatMessage.trim()}
                      className="px-3 py-2 bg-maroon-600 text-white rounded-md hover:bg-maroon-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      <PaperAirplaneIcon className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {/* Song Requests, DJ Controls & Polls */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
              {/* DJ Audio Controls */}
              <DJAudioControls />

              {/* Song Requests Section */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <div className="bg-yellow-600 text-white px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <MusicalNoteIcon className="h-5 w-5 mr-2" />
                      <h3 className="font-semibold">Song Requests</h3>
                    </div>
                    <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full">
                      {songRequests.length}
                    </span>
                  </div>
                </div>
                <EnhancedScrollArea className="h-72">
                  <div className="p-4 space-y-3">
                    {songRequests.length === 0 ? (
                      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                        No requests yet
                      </div>
                    ) : (
                      songRequests.map((request) => (
                        <div key={request.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0">
                              <div className="w-6 h-6 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
                                <MusicalNoteIcon className="w-3 h-3 text-white" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start">
                                <div className="mb-1">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white block">
                                    {request.songTitle}
                                  </span>
                                  <span className="text-xs text-gray-600 dark:text-gray-300">
                                    by {request.artist}
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleDeleteSongRequest(request.id)}
                                  className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                                  title="Delete request"
                                >
                                  <XMarkIcon className="h-4 w-4" />
                                </button>
                              </div>

                              {request.dedication && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 italic mb-1">
                                  "{request.dedication}"
                                </p>
                              )}

                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {request.requestedBy?.firstName && request.requestedBy?.lastName 
                                  ? `${request.requestedBy.firstName} ${request.requestedBy.lastName}`
                                  : request.requestedBy?.firstName || request.requestedBy?.name || 'Anonymous'} 
                                • {formatDistanceToNow(new Date(request.createdAt || request.timestamp), { addSuffix: true })}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </EnhancedScrollArea>
              </div>

              {/* Polls Results Section */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <div className="bg-blue-600 text-white px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <ChartBarIcon className="h-5 w-5 mr-2" />
                      <h3 className="font-semibold">Polls & Results</h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full">
                        {polls.length}
                      </span>
                      <button
                        onClick={() => setShowPollCreation(!showPollCreation)}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200 ${
                          showPollCreation 
                            ? 'bg-white text-blue-600 rotate-45' 
                            : 'bg-white bg-opacity-20 hover:bg-opacity-30 text-white'
                        }`}
                        title="Create new poll"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Poll Creation Form - Expandable */}
                {showPollCreation && (
                  <div className="border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20 p-4">
                    <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-3">Create New Poll</h4>
                    <form onSubmit={handlePollSubmit} className="space-y-3">
                      <input
                        type="text"
                        value={newPoll.question}
                        onChange={(e) => setNewPoll(prev => ({ ...prev, question: e.target.value }))}
                        placeholder="Ask your listeners a question..."
                        className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                      <div className="space-y-2">
                        {newPoll.options.map((option, index) => (
                          <div key={index} className="flex space-x-2">
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => updatePollOption(index, e.target.value)}
                              placeholder={`Option ${index + 1}`}
                              className="flex-1 px-3 py-2 text-sm border border-blue-300 dark:border-blue-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            {newPoll.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => removePollOption(index)}
                                className="px-2 py-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between">
                        {newPoll.options.length < 5 && (
                          <button
                            type="button"
                            onClick={addPollOption}
                            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            + Add Option
                          </button>
                        )}

                        <div className="flex space-x-2 ml-auto">
                          <button
                            type="button"
                            onClick={() => setShowPollCreation(false)}
                            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isCreatingPoll || !newPoll.question.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
                          >
                            {isCreatingPoll ? 'Creating...' : 'Create Poll'}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                )}

                <EnhancedScrollArea className="h-72">
                  {polls.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      No polls created yet
                    </div>
                  ) : (
                    <div className="p-4 space-y-4">
                      {polls.map((poll) => {
                        const totalVotes = poll.options?.reduce((sum, option) => sum + (option.votes || 0), 0) || 0;
                        return (
                          <div key={poll.id} className={`rounded-lg border-2 p-3 ${
                            activePoll?.id === poll.id 
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                              : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                          }`}>
                            <div className="mb-3">
                              <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                                {poll.question}
                              </h4>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  Total votes: {totalVotes}
                                </span>
                                {activePoll?.id === poll.id && (
                                  <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-2 py-1 rounded-full">
                                    Active
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              {poll.options?.map((option, index) => {
                                const percentage = totalVotes > 0 ? Math.round((option.votes || 0) / totalVotes * 100) : 0;
                                return (
                                  <div key={index} className="text-xs">
                                    <div className="flex justify-between mb-1">
                                      <span className="text-gray-700 dark:text-gray-300">{option.text}</span>
                                      <span className="text-gray-600 dark:text-gray-400">{option.votes || 0} ({percentage}%)</span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                      <div 
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${percentage}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </EnhancedScrollArea>
              </div>
            </div>

            {/* Analytics Dashboard */}
            <div className="col-span-12 lg:col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-3">
                <div className="flex items-center">
                  <ChartBarIcon className="h-5 w-5 mr-2" />
                  <h3 className="font-semibold">Broadcast Analytics</h3>
                </div>
              </div>
              <div className="h-[600px] overflow-y-auto p-4 custom-scrollbar">
                <div className="space-y-4">
                  {/* Broadcast Duration */}
                  <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-green-700 dark:text-green-300">Duration</span>
                      <ClockIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="text-2xl font-bold text-green-800 dark:text-green-200">
                      {getBroadcastDuration()}
                    </div>
                  </div>

                  {/* Current Listeners */}
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Live Listeners</span>
                      <UserIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                      {listenerCount}
                    </div>
                  </div>

                  {/* Peak Listeners */}
                  <div className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-orange-700 dark:text-orange-300">Peak Listeners</span>
                      <svg className="h-4 w-4 text-orange-600 dark:text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 2L13.09 8.26L20 9.27L15 14.14L16.18 21.02L10 17.77L3.82 21.02L5 14.14L0 9.27L6.91 8.26L10 2Z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="text-2xl font-bold text-orange-800 dark:text-orange-200">
                      {peakListeners}
                    </div>
                  </div>

                  {/* Total Messages */}
                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Chat Messages</span>
                      <ChatBubbleLeftRightIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="text-2xl font-bold text-purple-800 dark:text-purple-200">
                      {chatMessages.length}
                    </div>
                  </div>

                  {/* Song Requests */}
                  <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Song Requests</span>
                      <MusicalNoteIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">
                      {totalSongRequests}
                    </div>
                  </div>

                  {/* Polls Created */}
                  <div className="bg-gradient-to-r from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-800/20 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-teal-700 dark:text-teal-300">Polls Created</span>
                      <ChartBarIcon className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div className="text-2xl font-bold text-teal-800 dark:text-teal-200">
                      {totalPolls}
                    </div>
                  </div>

                  {/* Total Interactions */}
                  <div className="bg-gradient-to-r from-rose-50 to-rose-100 dark:from-rose-900/20 dark:to-rose-800/20 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-rose-700 dark:text-rose-300">Total Interactions</span>
                      <HeartIcon className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div className="text-2xl font-bold text-rose-800 dark:text-rose-200">
                      {totalInteractions}
                    </div>
                  </div>

                  {/* Engagement Rate */}
                  <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Engagement Rate</span>
                      <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="text-2xl font-bold text-indigo-800 dark:text-indigo-200">
                      {listenerCount > 0 ? Math.round((totalInteractions / listenerCount) * 100) : 0}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Create Broadcast Content */}
        {workflowState === WORKFLOW_STATES.CREATE_BROADCAST && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-8">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 border-b pb-2 border-gray-200 dark:border-gray-700">
                Create New Broadcast
              </h2>

              <div className="space-y-6">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Broadcast Title *
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={broadcastForm.title}
                    onChange={handleFormChange}
                    className="form-input"
                    placeholder="Enter a title for your broadcast"
                    disabled={isCreatingBroadcast}
                  />
                  {formErrors.title && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.title}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Description *
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={broadcastForm.description}
                    onChange={handleFormChange}
                    rows={4}
                    className="form-input"
                    placeholder="Describe what your broadcast is about"
                    disabled={isCreatingBroadcast}
                  />
                  {formErrors.description && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.description}</p>
                  )}
                </div>

                {/* Audio Source Selection */}
                <AudioSourceSelector disabled={isCreatingBroadcast} />

                {/* About Scheduling Info */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <ClockIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800 dark:text-blue-300">
                      <p className="font-medium mb-1">About Scheduling</p>
                      <p>This creates your broadcast content. To schedule broadcasts for specific times, use the Schedule page.</p>
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={createBroadcast}
                    disabled={isCreatingBroadcast}
                    className="btn-primary"
                  >
                    {isCreatingBroadcast ? (
                      <>
                        <span className="mr-2">Creating...</span>
                        <span className="animate-spin">⏳</span>
                      </>
                    ) : (
                      'Create Broadcast'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Ready to Stream */}
        {workflowState === WORKFLOW_STATES.READY_TO_STREAM && currentBroadcast && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-8">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 border-b pb-2 border-gray-200 dark:border-gray-700">
                Ready to Stream
              </h2>

              {/* Broadcast Details */}
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-2">
                  {currentBroadcast.title}
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-200 mb-3">
                  {currentBroadcast.description}
                </p>
                <div className="text-sm">
                  <span className="font-medium text-blue-900 dark:text-blue-100">Status:</span>
                  <span className="ml-2 text-blue-700 dark:text-blue-200">
                    Ready to broadcast live
                  </span>
                </div>
              </div>

              {/* Audio Source Selection */}
              <div className="mb-6">
                <AudioSourceSelector />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center space-x-4">
                <button
                  onClick={cancelBroadcast}
                  className="flex items-center px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium"
                >
                  <XMarkIcon className="h-5 w-5 mr-2" />
                  Cancel Broadcast
                </button>

                <button
                  onClick={startBroadcast}
                  disabled={!serverConfig}
                  className="flex items-center px-8 py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-lg font-medium"
                >
                  <MicrophoneIcon className="h-6 w-6 mr-3" />
                  Go Live
                </button>
              </div>

              <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-4">
                Make sure to allow audio source access when prompted (microphone and/or screen sharing)
              </p>
            </div>
          </div>
        )}

        {/* Stream Preview Controls - Only available when ready to stream */}
        {workflowState === WORKFLOW_STATES.READY_TO_STREAM && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-8">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
                Stream Preview
              </h2>

              <div className="flex items-center justify-between">
                <button
                  onClick={togglePreview}
                  disabled={!serverConfig?.streamUrl}
                  className={`flex items-center px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed transition-colors ${
                    previewEnabled
                      ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 focus:ring-yellow-500'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200 focus:ring-gray-500'
                  }`}
                >
                  {previewEnabled ? (
                    <>
                      <PauseIcon className="h-4 w-4 mr-2" />
                      Stop Preview
                    </>
                  ) : (
                    <>
                      <PlayIcon className="h-4 w-4 mr-2" />
                      Start Preview
                    </>
                  )}
                </button>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={toggleMute}
                    className="p-2 text-gray-700 dark:text-gray-300 hover:text-yellow-600 dark:hover:text-yellow-400"
                  >
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
                    className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 min-w-[2.5rem] text-right">
                    {volume}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Network Information - Hidden when live */}
        {serverConfig && workflowState !== WORKFLOW_STATES.STREAMING_LIVE && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
                Network Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Server IP:</span>
                  <code className="ml-2 text-gray-900 dark:text-white">{serverConfig.serverIp}</code>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Server Port:</span>
                  <code className="ml-2 text-gray-900 dark:text-white">{serverConfig.serverPort}</code>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">WebSocket URL:</span>
                  <code className="ml-2 text-gray-900 dark:text-white">{serverConfig.webSocketUrl}</code>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Icecast URL:</span>
                  <code className="ml-2 text-gray-900 dark:text-white">{serverConfig.icecastUrl}</code>
                </div>
                <div className="md:col-span-2">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Stream URL:</span>
                  <code className="ml-2 text-gray-900 dark:text-white">{serverConfig.streamUrl}</code>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-md">
                <p className="text-sm text-blue-700 dark:text-blue-200">
                  <strong>Current Status:</strong> {workflowState === WORKFLOW_STATES.CREATE_BROADCAST ? 'Ready to create broadcast' : 
                  workflowState === WORKFLOW_STATES.READY_TO_STREAM ? 'Broadcast created, ready to go live' : 
                  'Broadcasting live'} 
                  {workflowState === WORKFLOW_STATES.STREAMING_LIVE && listenerCount > 0 && 
                  ` • ${listenerCount} listener${listenerCount !== 1 ? 's' : ''} tuned in`}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 
