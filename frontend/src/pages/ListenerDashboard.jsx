"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/solid"
import { streamService } from "../services/api"

export default function ListenerDashboard() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(80)
  const [isLive, setIsLive] = useState(false)
  const [streamError, setStreamError] = useState(null)
  const [serverConfig, setServerConfig] = useState(null)
  const [listenerCount, setListenerCount] = useState(0)

  const audioRef = useRef(null)
  const statusCheckInterval = useRef(null)
  const wsRef = useRef(null)
  const wsConnectingRef = useRef(false)
  const heartbeatInterval = useRef(null)

  // Send player status to server using useCallback to ensure consistent reference
  const sendPlayerStatus = useCallback((isPlaying) => {
    try {
      // Check if WebSocket exists and is open
      if (!wsRef.current) {
        console.warn('WebSocket not initialized, cannot send player status')
        return
      }

      if (wsRef.current.readyState !== WebSocket.OPEN) {
        console.warn(`WebSocket not open (state: ${wsRef.current.readyState}), cannot send player status`)
        return
      }

      // Prepare message
      const message = {
        type: "PLAYER_STATUS",
        isPlaying: isPlaying
      }

      // Send message
      wsRef.current.send(JSON.stringify(message))
      console.log('Sent player status to server:', isPlaying ? 'playing' : 'paused')
    } catch (error) {
      // Handle any errors that might occur
      console.error('Error sending player status:', error)

      // Don't throw the error further to prevent component crashes
      // Just log it and continue
    }
  }, []) // Remove wsRef dependency to prevent re-renders

  // Initialize server configuration and audio element
  useEffect(() => {
    const fetchServerConfig = async () => {
      try {
        const config = await streamService.getConfig()
        // Backend returns { success: true, data: { serverIp, webSocketUrl, etc. } }
        // So we need to access the nested data property
        setServerConfig(config.data.data)
        console.log("Server config loaded:", config.data.data)
      } catch (error) {
        console.error("Error fetching server config:", error)
        setStreamError("Failed to get server configuration")
      }
    }

    fetchServerConfig()

    // Add a beforeunload handler to prevent accidental navigation
    const handleBeforeUnload = (e) => {
      if (isPlaying) {
        // This will show a confirmation dialog in most browsers
        // when the user tries to navigate away while playing
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

  // Split the audio element setup into two effects:
  // 1. Create and configure the audio element only once when serverConfig is available
  // 2. Update the audio element's volume and handle cleanup separately

  // Effect 1: Create and configure audio element (runs only once when serverConfig is available)
  useEffect(() => {
    if (!serverConfig) return

    // Create and configure audio element if it doesn't exist
    if (!audioRef.current) {
      console.log('Creating new audio element')
      audioRef.current = new Audio()

      // Configure audio element for Icecast streaming
      audioRef.current.crossOrigin = "anonymous"
      audioRef.current.preload = "none"
      audioRef.current.volume = volume / 100

      // Add event listeners with better error details
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
        // Notify server that playback has stopped
        sendPlayerStatus(false)
      })

      audioRef.current.addEventListener('error', (e) => {
        // Prevent default behavior to avoid potential navigation
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
            case 1: // MEDIA_ERR_ABORTED
              errorMessage += 'Stream loading was aborted.'
              break
            case 2: // MEDIA_ERR_NETWORK
              errorMessage += 'Network error occurred.'
              break
            case 3: // MEDIA_ERR_DECODE
              errorMessage += 'Stream format not supported.'
              break
            case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
              errorMessage += 'Stream source not supported.'
              break
            default:
              errorMessage += 'Unknown error occurred.'
          }
        }
        errorMessage += ' Please try refreshing or check if the stream is live.'

        // Check if the src has changed to an invalid URL and reset it to the correct stream URL
        if (serverConfig && audioRef.current) {
          const currentSrc = audioRef.current.src
          if (!currentSrc.startsWith('http') || currentSrc.includes('localhost:5173') || currentSrc.startsWith('blob:')) {
            console.warn('Audio src changed to invalid URL, resetting to stream URL')

            try {
              // Ensure the URL is absolute
              const streamUrl = serverConfig.streamUrl.startsWith('http') 
                ? serverConfig.streamUrl 
                : `http://${serverConfig.streamUrl}`

              // Reset immediately, don't use timeout
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

        // Notify server that playback has stopped due to error
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

      // Set the stream URL immediately when config is available
      // Ensure the URL is absolute by checking if it starts with http
      const streamUrl = serverConfig.streamUrl.startsWith('http') 
        ? serverConfig.streamUrl 
        : `http://${serverConfig.streamUrl}`
      audioRef.current.src = streamUrl
      console.log('Stream URL set:', streamUrl)
    }
  }, [serverConfig]) // Only depend on serverConfig for initial setup

  // Effect 2: Handle cleanup when component unmounts (only on actual unmount)
  useEffect(() => {
    return () => {
      console.log('Component unmounting, cleaning up resources')

      // Clean up audio element when component unmounts
      try {
        if (audioRef.current) {
          console.log('Cleaning up audio element')

          // Pause and clear the audio element
          try {
            audioRef.current.pause()
            // Set to about:blank to prevent navigation
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

      // Clear interval timers
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
  }, []) // Empty dependency array - only run on actual component unmount

  // Set up WebSocket connection for real-time updates with better reconnection handling
  useEffect(() => {
    if (!serverConfig) return

    let reconnectTimer = null
    let isReconnecting = false
    let wsInstance = wsRef.current

    const connectWebSocket = () => {
      // Clear any existing reconnect timer
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }

      // Don't try to reconnect if we're already connecting
      if (isReconnecting || wsConnectingRef.current) return
      isReconnecting = true
      wsConnectingRef.current = true

      const wsUrl = `ws://${serverConfig.serverIp}:8080/ws/listener`
      console.log('Connecting to WebSocket:', wsUrl)

      // Close existing connection if it exists
      if (wsInstance) {
        try {
          // Only close if it's not already closing or closed
          if (wsInstance.readyState !== WebSocket.CLOSING && 
              wsInstance.readyState !== WebSocket.CLOSED) {
            wsInstance.close()
          }
        } catch (e) {
          console.warn('Error closing existing WebSocket:', e)
        }
      }

      // Create new WebSocket connection
      try {
        wsInstance = new WebSocket(wsUrl)
        wsRef.current = wsInstance

        wsInstance.onopen = () => {
          console.log('WebSocket connected for listener updates')
          isReconnecting = false
          wsConnectingRef.current = false
          
          // Send current player status immediately when WebSocket connects
          // This ensures the server knows if we're still playing after a reconnection
          setTimeout(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              // Get current playing state from audio element to ensure accuracy
              const currentlyPlaying = audioRef.current && !audioRef.current.paused
              sendPlayerStatus(currentlyPlaying)
              console.log('Sent initial player status on WebSocket connect:', currentlyPlaying)
            }
          }, 100) // Small delay to ensure WebSocket is fully ready

          // Set up heartbeat to periodically send player status while playing
          // This helps maintain accurate listener counts
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
          }, 15000) // Send heartbeat every 15 seconds while playing
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

          // Clear heartbeat interval when WebSocket closes
          if (heartbeatInterval.current) {
            clearInterval(heartbeatInterval.current)
            heartbeatInterval.current = null
          }

          // Don't reconnect if this was a normal closure (code 1000)
          if (event.code !== 1000) {
            console.log('Attempting to reconnect WebSocket in 3 seconds...')
            // Reconnect after 3 seconds
            reconnectTimer = setTimeout(connectWebSocket, 3000)
          }
        }

        wsInstance.onerror = (error) => {
          console.error('WebSocket error:', error)
          // Don't set isReconnecting to false here, let onclose handle it
        }
      } catch (error) {
        console.error('Error creating WebSocket:', error)
        isReconnecting = false
        wsConnectingRef.current = false

        // Try to reconnect after a delay
        reconnectTimer = setTimeout(connectWebSocket, 3000)
      }
    }

    connectWebSocket()

    // Clean up function
    return () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }

      // Clear heartbeat interval
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current)
        heartbeatInterval.current = null
      }

      // Only close the WebSocket if we're intentionally unmounting the component
      if (wsInstance) {
        // Use code 1000 to indicate normal closure
        try {
          console.log('Closing WebSocket due to component unmount')
          wsInstance.close(1000, 'Component unmounting')
        } catch (e) {
          console.warn('Error closing WebSocket during cleanup:', e)
        }
      }
    }
  }, [serverConfig]) // Only depend on serverConfig

  // Send player status when playing state changes or WebSocket connects
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      sendPlayerStatus(isPlaying)
    }
  }, [isPlaying, sendPlayerStatus])

  // Fallback: Set up stream status checking via polling (as backup)
  useEffect(() => {
    if (!serverConfig) return

    const checkStatus = () => {
      // Use backend API instead of directly accessing Icecast to avoid CORS issues
      streamService.getStatus()
        .then(response => {
          console.log("Backend stream status:", response.data)

          if (response.data && response.data.data) {
            const statusData = response.data.data
            setIsLive(statusData.live || false)

            // Get listener count from backend
            streamService.getHealth()
              .then(healthResponse => {
                console.log("Health status:", healthResponse.data)
                // The listener count will come via WebSocket, but this is a fallback
              })
              .catch(error => {
                console.log("Health check failed:", error)
              })
          }
        })
        .catch(error => {
          console.error('Error checking status:', error)
          // Don't set isLive to false here if WebSocket is working
        })
    }

    // Check status immediately and set up interval as fallback
    checkStatus()
    statusCheckInterval.current = setInterval(checkStatus, 5000) // Check every 5 seconds

    return () => {
      if (statusCheckInterval.current) {
        clearInterval(statusCheckInterval.current)
      }
    }
  }, [serverConfig])

  // Handle volume changes without recreating audio element
  useEffect(() => {
    if (audioRef.current) {
      const newVolume = isMuted ? 0 : volume / 100
      audioRef.current.volume = newVolume
      console.log('Volume updated to:', newVolume)
    }
  }, [volume, isMuted])

  // Toggle play/pause
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
        // Notify server that playback has stopped
        sendPlayerStatus(false)
      } else {
        console.log('Starting playback')
        // Only reload if the source is different or not set
        const currentSrc = audioRef.current.src
        // Ensure the URL is absolute by checking if it starts with http
        const expectedSrc = serverConfig.streamUrl.startsWith('http') 
          ? serverConfig.streamUrl 
          : `http://${serverConfig.streamUrl}`

        if (!currentSrc || currentSrc !== expectedSrc || currentSrc.includes('localhost:5173') || currentSrc.startsWith('blob:') || currentSrc === 'about:blank') {
          console.log('Setting new stream URL:', expectedSrc)
          audioRef.current.src = expectedSrc
          audioRef.current.load()
        }

        // Play with proper promise handling
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
              // Notify server that playback has started
              sendPlayerStatus(true)
            })
            .catch(error => {
              console.error("Playback failed:", error)

              // Provide specific error messages
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

              // Check if the src has changed to an invalid URL and reset it
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
    setIsMuted(!isMuted)
    }

  // Handle volume change with debouncing to prevent excessive updates
  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value, 10)
    setVolume(newVolume)

    // Handle mute state based on volume
    if (newVolume === 0) {
      setIsMuted(true)
    } else if (isMuted && newVolume > 0) {
      setIsMuted(false)
    }
  }

  // Refresh stream
  const refreshStream = () => {
    if (audioRef.current && serverConfig) {
      console.log('Refreshing stream...')

      // If currently playing, notify server that playback has stopped
      if (isPlaying) {
        sendPlayerStatus(false)
      }

      try {
        // Pause the audio first
        audioRef.current.pause()

        // Ensure the URL is absolute by checking if it starts with http
        const streamUrl = serverConfig.streamUrl.startsWith('http') 
          ? serverConfig.streamUrl 
          : `http://${serverConfig.streamUrl}`

        console.log('Setting new stream URL during refresh:', streamUrl)

        // Set the source and load
        audioRef.current.src = streamUrl
        audioRef.current.load()

        // Reset state
        setStreamError(null)
        setIsPlaying(false)

        console.log('Stream refreshed successfully')
      } catch (error) {
        console.error('Error refreshing stream:', error)
        setStreamError(`Error refreshing stream: ${error.message}. Please try again.`)

        // Make sure the audio element is in a clean state
        try {
          audioRef.current.pause()
          // Ensure the URL is absolute
          const streamUrl = serverConfig.streamUrl.startsWith('http') 
            ? serverConfig.streamUrl 
            : `http://${serverConfig.streamUrl}`
          audioRef.current.src = streamUrl
        } catch (cleanupError) {
          console.error('Error cleaning up audio element:', cleanupError)
        }
      }
    } else {
      console.warn('Cannot refresh stream: audio element or server config not available')
    }
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
        Listener Dashboard
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-8">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
            WildCats Radio Player
          </h2>

          <div className="relative">
            {/* Stream Status */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <span className={`h-3 w-3 rounded-full mr-2 ${
                  isLive ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`}></span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {isLive ? `Live Broadcasting (${listenerCount} listeners)` : 'Offline'}
                </span>
              </div>

              {serverConfig && (
                <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 py-1 px-2 rounded-full">
                  {serverConfig.streamUrl}
                </span>
              )}
            </div>

            {/* Stream Error */}
            {streamError && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200 rounded-md text-sm">
                {streamError}
              </div>
            )}

            {/* Audio Visualization Placeholder */}
            <div className="h-24 mb-6">
              <div className="w-full h-full bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {isLive ? (isPlaying ? 'Playing Live Stream' : 'Click play to start listening') : 'No broadcast currently available'}
                </p>
              </div>
            </div>

            {/* Player Controls */}
            <div className="flex items-center justify-between">
              <button
                onClick={togglePlay}
                disabled={!serverConfig}
                className={`p-3 rounded-full ${
                  !serverConfig
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                    : isPlaying
                    ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:hover:bg-yellow-800'
                    : 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800'
                }`}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <PauseIcon className="h-8 w-8" />
                ) : (
                  <PlayIcon className="h-8 w-8" />
                )}
              </button>

              <div className="flex-1 mx-4">
                <div className="flex items-center">
                  <button
                    onClick={toggleMute}
                    className="p-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
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
                    className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-blue-500"
                    aria-label="Volume"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 min-w-[2.5rem] text-right">
                    {volume}%
                  </span>
                </div>
              </div>

              <button
                onClick={refreshStream}
                className="p-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                aria-label="Refresh Stream"
              >
                <ArrowPathIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Network Information */}
      {serverConfig && (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
              Stream Information
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

            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/30 rounded-md">
              <p className="text-sm text-green-700 dark:text-green-200">
                <strong>Status:</strong> {isLive ? `Stream is currently live with ${listenerCount} listener${listenerCount !== 1 ? 's' : ''}!` : 'Waiting for DJ to go live...'}
                {isLive && ' Click the play button above to start listening.'}
                            </p>
                          </div>
          </div>
        </div>
      )}
    </div>
  )
}
