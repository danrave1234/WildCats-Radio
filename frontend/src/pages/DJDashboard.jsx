"use client"

import { useState, useEffect, useRef } from "react"
import { 
  PlayIcon, 
  PauseIcon,
  MicrophoneIcon,
  StopIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
} from "@heroicons/react/24/solid"
import { streamService } from "../services/api"

export default function DJDashboard() {
  // Core streaming state
  const [isLive, setIsLive] = useState(false)
  const [streamError, setStreamError] = useState(null)
  const [websocketConnected, setWebsocketConnected] = useState(false)
  
  // Network configuration
  const [serverConfig, setServerConfig] = useState(null)
  
  // WebSocket and MediaRecorder refs
  const websocketRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioStreamRef = useRef(null)
  
  // Audio preview state
  const [previewEnabled, setPreviewEnabled] = useState(false)
  const [volume, setVolume] = useState(80)
  const [isMuted, setIsMuted] = useState(false)
  const audioPreviewRef = useRef(null)
  
  // Constants from prototype
  const MAX_MESSAGE_SIZE = 60000

  // Initialize server configuration
  useEffect(() => {
    const fetchServerConfig = async () => {
      try {
        const config = await streamService.getConfig()
        setServerConfig(config.data)
        console.log("Server config loaded:", config.data)
    } catch (error) {
        console.error("Error fetching server config:", error)
        setStreamError("Failed to get server configuration")
      }
    }

    fetchServerConfig()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBroadcast()
    }
  }, [])

  const startBroadcast = async () => {
    try {
      setStreamError(null)
      
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
        console.log("Broadcasting started")
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

  const stopBroadcast = () => {
    console.log("Stopping broadcast")
    
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
    
    // Reset state
    setIsLive(false)
    setWebsocketConnected(false)
    setStreamError(null)
    
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

      {/* Broadcasting Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-8">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
            Broadcasting Status
          </h2>

          {/* Status Indicator */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <span className={`h-4 w-4 rounded-full mr-3 ${
                isLive ? 'bg-red-500 animate-pulse' : 'bg-gray-400'
              }`}></span>
              <span className="text-lg font-medium text-gray-700 dark:text-gray-300">
                {isLive ? 'LIVE' : 'Offline'}
              </span>
            </div>

            {websocketConnected && (
              <span className="text-sm bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 py-1 px-3 rounded-full">
                Connected
                </span>
              )}
          </div>

          {/* Error Display */}
          {streamError && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200 rounded-md text-sm">
              {streamError}
                  </div>
          )}

          {/* Broadcasting Controls */}
          <div className="flex items-center justify-center space-x-4">
            {!isLive ? (
                      <button
                onClick={startBroadcast}
                disabled={!serverConfig}
                className="flex items-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <MicrophoneIcon className="h-5 w-5 mr-2" />
                Go Live
                      </button>
                    ) : (
                        <button
                onClick={stopBroadcast}
                className="flex items-center px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                <StopIcon className="h-5 w-5 mr-2" />
                Stop Live
                        </button>
            )}
                </div>

          {/* Stream Preview Controls */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Stream Preview</h3>
            
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
                        </div>

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
                <strong>Instructions:</strong> Click "Go Live" to start broadcasting. Make sure to allow microphone access when prompted.
                The stream will be available at the Stream URL above for listeners to tune in.
              </p>
                            </div>
                                </div>
                            </div>
                              )}
                            </div>
  )
} 
