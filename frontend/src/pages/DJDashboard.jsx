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
import { streamService, broadcastService, authService } from "../services/api"
import { useAuth } from "../context/AuthContext"

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

  // Check for existing active broadcast on component mount
  useEffect(() => {
    const checkActiveBroadcast = async () => {
      try {
        const activeBroadcast = await broadcastService.getActiveBroadcast()
        if (activeBroadcast) {
          setCurrentBroadcast(activeBroadcast)
          setWorkflowState(WORKFLOW_STATES.STREAMING_LIVE)
          setIsLive(true)
        }
      } catch (error) {
        console.error("Error checking for active broadcast:", error)
      }
    }

    if (currentUser) {
      checkActiveBroadcast()
    }
  }, [currentUser])

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBroadcast()
      if (statusWsRef.current) {
        statusWsRef.current.close()
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
      
      const broadcastData = {
        title: broadcastForm.title.trim(),
        description: broadcastForm.description.trim(),
        scheduledStart: bufferedStart.toISOString(),
        scheduledEnd: endTime.toISOString()
      }
      
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

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
        DJ Dashboard
      </h1>

      {/* Workflow Progress Indicator */}
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

      {/* Error Display */}
      {streamError && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200 rounded-md">
          {streamError}
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

      {/* Step 3: Live Streaming Controls */}
      {workflowState === WORKFLOW_STATES.STREAMING_LIVE && currentBroadcast && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-8">
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 border-b pb-2 border-gray-200 dark:border-gray-700">
              Live Streaming
            </h2>

            {/* Current Broadcast Info */}
            <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-red-900 dark:text-red-100 mb-1">
                    {currentBroadcast.title}
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-200">
                    {currentBroadcast.description}
                  </p>
                </div>
                <div className="flex items-center">
                  <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse mr-2"></span>
                  <span className="text-red-600 dark:text-red-400 font-medium">LIVE</span>
                </div>
              </div>
              
              {/* Test Mode Indicator */}
              <div className="mt-3 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-md">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 flex items-center">
                  <span className="h-2 w-2 rounded-full bg-yellow-500 mr-2"></span>
                  Broadcasting in Test Mode (Server checks bypassed)
                </p>
              </div>
            </div>

            {/* Connection Status */}
            <div className="flex items-center justify-center space-x-6 mb-6">
              <div className="flex items-center">
                <span className={`h-3 w-3 rounded-full mr-2 ${
                  websocketConnected ? 'bg-green-500' : 'bg-red-500'
                }`}></span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {websocketConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              
              <div className="flex items-center">
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400 mr-2">
                  {listenerCount}
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Listener{listenerCount !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* End Broadcast Button */}
            <div className="flex justify-center">
              <button
                onClick={stopBroadcast}
                className="flex items-center px-8 py-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors text-lg font-medium"
              >
                <StopIcon className="h-6 w-6 mr-3" />
                End Broadcast
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stream Preview Controls - Available during streaming */}
      {(workflowState === WORKFLOW_STATES.STREAMING_LIVE || workflowState === WORKFLOW_STATES.READY_TO_STREAM) && (
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

      {/* Network Information */}
      {serverConfig && (
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
  )
} 
