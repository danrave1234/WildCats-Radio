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
} from "@heroicons/react/24/solid"
import { 
  ChatBubbleLeftRightIcon,
  MusicalNoteIcon,
  ChartBarIcon,
  PaperAirplaneIcon,
  UserIcon,
  HeartIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import { streamService, broadcastService, authService, chatService, songRequestService, pollService } from "../services/api"
import { useAuth } from "../context/AuthContext"
import { formatDistanceToNow } from 'date-fns'

// Broadcast workflow states
const WORKFLOW_STATES = {
  CREATE_BROADCAST: 'CREATE_BROADCAST',
  READY_TO_STREAM: 'READY_TO_STREAM', 
  STREAMING_LIVE: 'STREAMING_LIVE'
}

export default function DJDashboard() {
  // Authentication context
  const { currentUser } = useAuth()
  
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
  const [isLive, setIsLive] = useState(false)
  const [streamError, setStreamError] = useState(null)
  const [websocketConnected, setWebsocketConnected] = useState(false)
  
  // Network configuration
  const [serverConfig, setServerConfig] = useState(null)
  
  // Listener metrics
  const [listenerCount, setListenerCount] = useState(0)
  const [statusWsConnected, setStatusWsConnected] = useState(false)
  
  // WebSocket and MediaRecorder refs
  const websocketRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioStreamRef = useRef(null)
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

  // Check for existing active broadcast on component mount
  useEffect(() => {
    const checkActiveBroadcast = async () => {
      try {
        const activeBroadcast = await broadcastService.getActiveBroadcast()
        if (activeBroadcast) {
          setCurrentBroadcast(activeBroadcast)
          setWorkflowState(WORKFLOW_STATES.STREAMING_LIVE)
          setIsLive(true)
          setBroadcastStartTime(new Date())
        }
      } catch (error) {
        console.error("Error checking for active broadcast:", error)
      }
    }

    if (currentUser) {
      checkActiveBroadcast()
    }
  }, [currentUser])

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

  // State for forcing duration updates
  const [durationTick, setDurationTick] = useState(0)

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

  // Initialize server configuration
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
  }, [])

  // Set up WebSocket connection for listener status updates
  useEffect(() => {
    if (!serverConfig) return

    const connectStatusWebSocket = () => {
      const wsUrl = `ws://${serverConfig.serverIp}:8080/ws/listener`
      console.log('DJ Dashboard connecting to status WebSocket:', wsUrl)
      
      statusWsRef.current = new WebSocket(wsUrl)

      statusWsRef.current.onopen = () => {
        console.log('DJ Dashboard status WebSocket connected')
        setStatusWsConnected(true)
      }

      statusWsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('DJ Dashboard status message received:', data)
          
          if (data.type === 'STREAM_STATUS') {
            setListenerCount(data.listenerCount || 0)
          }
          } catch (error) {
          console.error('Error parsing status WebSocket message:', error)
        }
      }

      statusWsRef.current.onclose = () => {
        console.log('DJ Dashboard status WebSocket disconnected, attempting to reconnect...')
        setStatusWsConnected(false)
        // Reconnect after 3 seconds
        setTimeout(connectStatusWebSocket, 3000)
      }

      statusWsRef.current.onerror = (error) => {
        console.error('DJ Dashboard status WebSocket error:', error)
      }
    }

    connectStatusWebSocket()

    return () => {
      if (statusWsRef.current) {
        statusWsRef.current.close()
      }
    }
  }, [serverConfig])

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

        console.log('DJ Dashboard: Fetching initial interaction data for broadcast:', currentBroadcast.id);
        
        // Clear old data immediately when switching broadcasts
        setChatMessages([]);
        setSongRequests([]);
        setPolls([]);
        setActivePoll(null);
        
        // Fetch chat messages
        const chatResponse = await chatService.getMessages(currentBroadcast.id);
        console.log('DJ Dashboard: Loaded initial chat messages:', chatResponse.data?.length || 0);
        
        if (currentBroadcast.id === currentBroadcast.id && !signal.aborted) {
          setChatMessages(chatResponse.data || []);
        }

        // Fetch song requests
        const requestsResponse = await songRequestService.getRequests(currentBroadcast.id);
        console.log('DJ Dashboard: Loaded initial song requests:', requestsResponse.data?.length || 0);
        
        if (currentBroadcast.id === currentBroadcast.id && !signal.aborted) {
          setSongRequests(requestsResponse.data || []);
        }

        // Fetch polls
        try {
          const pollsResponse = await pollService.getPollsForBroadcast(currentBroadcast.id);
          console.log('DJ Dashboard: Loaded initial polls:', pollsResponse.data?.length || 0);
          
          if (currentBroadcast.id === currentBroadcast.id && !signal.aborted) {
            setPolls(pollsResponse.data || []);
            
            // Set active poll (most recent one)
            if (pollsResponse.data && pollsResponse.data.length > 0) {
              setActivePoll(pollsResponse.data[0]);
            }
          }
        } catch (pollError) {
          console.warn('DJ Dashboard: Error fetching polls:', pollError);
          // Continue execution - we can still function without polls
        }
      } catch (error) {
        // Ignore aborted requests
        if (error.name === 'AbortError') {
          console.log('DJ Dashboard: Initial data fetch aborted for broadcast:', currentBroadcast.id);
          return;
        }
        console.error('DJ Dashboard: Error fetching initial interaction data:', error);
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

    console.log('DJ Dashboard: Setting up WebSocket connections for broadcast:', currentBroadcast.id);

    // Setup Chat WebSocket
    const setupChatWebSocket = async () => {
      try {
        // Clean up any existing connection first
        if (chatWsRef.current) {
          console.log('DJ Dashboard: Cleaning up existing chat WebSocket');
          chatWsRef.current.disconnect();
          chatWsRef.current = null;
        }

        console.log('DJ Dashboard: Setting up chat WebSocket for broadcast:', currentBroadcast.id);
        const connection = await chatService.subscribeToChatMessages(currentBroadcast.id, (newMessage) => {
          // Double-check the message is for the current broadcast
          if (newMessage.broadcastId === currentBroadcast.id) {
            console.log('DJ Dashboard: Received new chat message:', newMessage);
            setChatMessages(prev => {
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) {
                console.log('DJ Dashboard: Message already exists, skipping');
                return prev;
              }
              const updated = [...prev, newMessage].sort((a, b) => 
                new Date(a.createdAt) - new Date(b.createdAt)
              );
              console.log('DJ Dashboard: Updated chat messages count:', updated.length);
              return updated;
            });
          } else {
            console.log('DJ Dashboard: Ignoring message for different broadcast:', newMessage.broadcastId);
          }
        });
        chatWsRef.current = connection;
        console.log('DJ Dashboard: Chat WebSocket connected successfully');
      } catch (error) {
        console.error('DJ Dashboard: Failed to connect chat WebSocket:', error);
      }
    };

    // Setup Song Request WebSocket
    const setupSongRequestWebSocket = async () => {
      try {
        // Clean up any existing connection first
        if (songRequestWsRef.current) {
          console.log('DJ Dashboard: Cleaning up existing song request WebSocket');
          songRequestWsRef.current.disconnect();
          songRequestWsRef.current = null;
        }

        console.log('DJ Dashboard: Setting up song request WebSocket for broadcast:', currentBroadcast.id);
        const connection = await songRequestService.subscribeToSongRequests(currentBroadcast.id, (newRequest) => {
          // Double-check the request is for the current broadcast
          if (newRequest.broadcastId === currentBroadcast.id) {
            console.log('DJ Dashboard: Received new song request:', newRequest);
            setSongRequests(prev => {
              const exists = prev.some(req => req.id === newRequest.id);
              if (exists) return prev;
              return [newRequest, ...prev];
            });
          } else {
            console.log('DJ Dashboard: Ignoring song request for different broadcast:', newRequest.broadcastId);
          }
        });
        songRequestWsRef.current = connection;
        console.log('DJ Dashboard: Song request WebSocket connected successfully');
      } catch (error) {
        console.error('DJ Dashboard: Failed to connect song request WebSocket:', error);
      }
    };

    // Setup Poll WebSocket
    const setupPollWebSocket = async () => {
      try {
        // Clean up any existing connection first
        if (pollWsRef.current) {
          console.log('DJ Dashboard: Cleaning up existing poll WebSocket');
          pollWsRef.current.disconnect();
          pollWsRef.current = null;
        }

        console.log('DJ Dashboard: Setting up poll WebSocket for broadcast:', currentBroadcast.id);
        const connection = await pollService.subscribeToPolls(currentBroadcast.id, (pollUpdate) => {
          console.log('DJ Dashboard: Received poll update:', pollUpdate);
          if (pollUpdate.type === 'POLL_VOTE') {
            // Update existing poll with new vote data
            setPolls(prev => prev.map(poll => 
              poll.id === pollUpdate.pollId 
                ? { ...poll, ...pollUpdate.poll }
                : poll
            ));
            
            // Update active poll if it's the one being voted on
            setActivePoll(prev => 
              prev && prev.id === pollUpdate.pollId 
                ? { ...prev, ...pollUpdate.poll }
                : prev
            );
          } else if (pollUpdate.type === 'NEW_POLL') {
            // Add new poll to the list
            setPolls(prev => [pollUpdate.poll, ...prev]);
            setActivePoll(pollUpdate.poll);
          }
        });
        pollWsRef.current = connection;
        console.log('DJ Dashboard: Poll WebSocket connected successfully');
      } catch (error) {
        console.error('DJ Dashboard: Failed to connect poll WebSocket:', error);
      }
    };

    // Setup WebSockets immediately - no delay needed with proper guards
    setupChatWebSocket();
    setupSongRequestWebSocket();
    setupPollWebSocket();

    return () => {
      console.log('DJ Dashboard: Cleaning up WebSocket connections for broadcast:', currentBroadcast.id);
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBroadcast()
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
      
      console.log("DJ Dashboard: Creating broadcast with Philippines local time:", {
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
      
      console.log("Broadcast created successfully:", createdBroadcast)
    } catch (error) {
      console.error("Error creating broadcast:", error)
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
      
      // Use test mode to bypass server checks for development/testing
      // Change from broadcastService.start to broadcastService.startTest
      await broadcastService.startTest(currentBroadcast.id)
      
      // Get microphone access with specific constraints
      const stream = await navigator.mediaDevices.getUserMedia({ 
                  audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                  }
      })
      
      audioStreamRef.current = stream
      
      // Create MediaRecorder with explicit settings matching prototype
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 128000
      })
      
      mediaRecorderRef.current = mediaRecorder
      
      // Get WebSocket URL from server config
      const wsUrl = serverConfig?.webSocketUrl || await streamService.getStreamUrl()
      console.log(`Connecting to WebSocket: ${wsUrl}`)
      
      // Create WebSocket connection
      const websocket = new WebSocket(wsUrl)
      websocket.binaryType = "arraybuffer"
      websocketRef.current = websocket
      
      websocket.onopen = () => {
        console.log("WebSocket connected")
        setWebsocketConnected(true)
        
        // Set up MediaRecorder data handler
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && websocket.readyState === WebSocket.OPEN) {
            event.data.arrayBuffer().then(buffer => {
              if (buffer.byteLength > MAX_MESSAGE_SIZE) {
                console.warn("Audio chunk too large:", buffer.byteLength, "bytes")
              }
              websocket.send(buffer)
            })
          }
        }
        
        // Use smaller chunk size (250ms) to reduce message size - same as prototype
        mediaRecorder.start(250)
        setIsLive(true)
        setWorkflowState(WORKFLOW_STATES.STREAMING_LIVE)
        setBroadcastStartTime(new Date())
        console.log("Broadcasting started in test mode")
      }
      
      websocket.onerror = (error) => {
        console.error("WebSocket error:", error)
        setStreamError("Failed to connect to streaming server")
        stopBroadcast()
      }
      
      websocket.onclose = (event) => {
        console.log("WebSocket disconnected:", event.code, event.reason)
        setWebsocketConnected(false)
        if (isLive) {
          stopBroadcast()
        }
      }
      
          } catch (error) {
      console.error("Error starting broadcast:", error)
      setStreamError(`Error accessing microphone: ${error.message}`)
      stopBroadcast()
    }
  }

  const stopBroadcast = async () => {
    console.log("Stopping broadcast")
    
    try {
      // End the broadcast in the database first
      if (currentBroadcast) {
        await broadcastService.end(currentBroadcast.id)
        console.log("Broadcast ended in database")
      }
    } catch (error) {
      console.error("Error ending broadcast in database:", error)
    }
    
    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
    
    // Close WebSocket
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.close()
    }
    
    // Stop audio stream
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop())
    }
    
    // Reset state back to create new broadcast
    setIsLive(false)
    setWebsocketConnected(false)
    setStreamError(null)
    setCurrentBroadcast(null)
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
    
    // Clear refs
    websocketRef.current = null
    mediaRecorderRef.current = null
    audioStreamRef.current = null
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
          console.error("Error starting preview:", error)
          setStreamError("Could not start audio preview")
        }
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
      console.error('Error sending chat message:', error)
    }
  }

  const handlePollSubmit = async (e) => {
    e.preventDefault()
    if (!newPoll.question.trim() || !currentBroadcast) return

    const validOptions = newPoll.options.filter(option => option.trim())
    if (validOptions.length < 2) {
      alert('Please provide at least 2 poll options')
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
      
      // Add poll to local state
      setPolls(prev => [createdPoll, ...prev])
      setActivePoll(createdPoll)
      
      // Track poll creation
      setTotalPolls(prev => prev + 1)
      
      // Reset form and close creation panel
      setNewPoll({ question: '', options: ['', ''] })
      setShowPollCreation(false)
      alert('Poll created successfully!')
    } catch (error) {
      console.error('Error creating poll:', error)
      alert('Failed to create poll. Please try again.')
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
                        <span className="font-semibold mr-1">{listenerCount}</span>
                        <span>listener{listenerCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
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
          <div className="mb-6 p-4 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200 rounded-md">
              {streamError}
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

                        const isDJ = msg.sender && msg.sender.name && msg.sender.name.includes("DJ");
                        const senderName = msg.sender.name || 'Unknown User';
                        const initials = senderName.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2);
                        
                        let messageDate;
                        try {
                          messageDate = msg.createdAt ? new Date(msg.createdAt.endsWith('Z') ? msg.createdAt : msg.createdAt + 'Z') : null;
                        } catch (error) {
                          messageDate = new Date();
                        }
                        
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

            {/* Song Requests & Poll Creation */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
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
                <div className="h-72 overflow-y-auto p-4 custom-scrollbar">
                  <div className="space-y-3">
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
                              <div className="mb-1">
                                <span className="text-sm font-medium text-gray-900 dark:text-white block">
                                  {request.songTitle}
                                </span>
                                <span className="text-xs text-gray-600 dark:text-gray-300">
                                  by {request.artist}
                                </span>
                              </div>
                              
                              {request.dedication && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 italic mb-1">
                                  "{request.dedication}"
                                </p>
                              )}
                              
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {request.requestedBy?.firstName || 'Anonymous'} • {formatDistanceToNow(new Date(request.timestamp), { addSuffix: true })}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
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

                <div className="h-72 overflow-y-auto custom-scrollbar">
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
                                      <span className="text-gray-700 dark:text-gray-300">{option.optionText}</span>
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
                </div>
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
                {/* Title */}
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Broadcast Title *
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={broadcastForm.title}
                    onChange={handleFormChange}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                      formErrors.title ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="Enter broadcast title..."
                  />
                  {formErrors.title && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.title}</p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description *
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={broadcastForm.description}
                    onChange={handleFormChange}
                    rows={3}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                      formErrors.description ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="Describe your broadcast..."
                  />
                  {formErrors.description && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.description}</p>
                  )}
                </div>

                {/* Info about scheduling */}
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <ClockIcon className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        About Scheduling
                      </h3>
                      <div className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                        <p>This creates your broadcast content. To schedule broadcasts for specific times, use the Schedule page.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Create Button */}
                <div className="flex justify-center">
                  <button
                    onClick={createBroadcast}
                    disabled={isCreatingBroadcast}
                    className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {isCreatingBroadcast ? 'Creating...' : 'Create Broadcast'}
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

              {/* Go Live Button */}
              <div className="flex justify-center">
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
                Make sure to allow microphone access when prompted
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
