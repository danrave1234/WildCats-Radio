"use client"

import { useState, useEffect, useRef } from "react"
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
  
  const audioRef = useRef(null)
  const statusCheckInterval = useRef(null)

  // Initialize server configuration and audio element
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

  // Set up audio element when server config is available
  useEffect(() => {
    if (!serverConfig) return

    // Create and configure audio element
    if (!audioRef.current) {
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
      })

      audioRef.current.addEventListener('error', (e) => {
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
        
        setStreamError(errorMessage)
        setIsPlaying(false)
      })

      audioRef.current.addEventListener('stalled', () => {
        console.warn('Stream stalled')
      })

      audioRef.current.addEventListener('waiting', () => {
        console.log('Stream buffering')
      })
    }

    // Set the stream URL immediately when config is available
    if (audioRef.current && serverConfig.streamUrl) {
      audioRef.current.src = serverConfig.streamUrl
      console.log('Stream URL set:', serverConfig.streamUrl)
    }

    return () => {
      // Clean up audio element when component unmounts
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
      if (statusCheckInterval.current) {
        clearInterval(statusCheckInterval.current)
      }
    }
  }, [serverConfig, volume])

  // Set up stream status checking based on prototype
  useEffect(() => {
    if (!serverConfig) return

    const checkStatus = () => {
      // Use Icecast's status-json.xsl endpoint like in the prototype
      fetch(`${serverConfig.icecastUrl}/status-json.xsl`)
        .then(response => response.json())
        .then(data => {
          console.log("Icecast status:", data)
          let isStreamLive = false

          if (data.icestats && data.icestats.source) {
            // Handle both array and single object responses
            if (Array.isArray(data.icestats.source)) {
              isStreamLive = data.icestats.source.some(source => 
                source.mount === '/live.ogg'
              )
            } else {
              // Fix: Properly check if the single source is the live stream
              isStreamLive = data.icestats.source.mount === '/live.ogg'
            }
          }

          setIsLive(isStreamLive)
          console.log('Stream live status:', isStreamLive)
        })
        .catch(error => {
          console.error('Error checking status:', error)
          setIsLive(false)
        })
    }

    // Check status immediately and set up interval
    checkStatus()
    statusCheckInterval.current = setInterval(checkStatus, 10000) // Check every 10 seconds

    return () => {
      if (statusCheckInterval.current) {
        clearInterval(statusCheckInterval.current)
      }
    }
  }, [serverConfig])

  // Update volume when it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100
    }
  }, [volume, isMuted])

  // Toggle play/pause
  const togglePlay = () => {
    if (!audioRef.current || !serverConfig) {
      setStreamError("Audio player not ready. Please wait...")
      return
    }

    try {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        // Ensure we have the correct stream URL
        if (!audioRef.current.src || audioRef.current.src !== serverConfig.streamUrl) {
          audioRef.current.src = serverConfig.streamUrl
          audioRef.current.load()
        }

        // Play with proper promise handling
        const playPromise = audioRef.current.play()

        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true)
              setStreamError(null)
              console.log('Playback started successfully')
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
            })
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
    if (audioRef.current) {
      audioRef.current.volume = !isMuted ? 0 : volume / 100
    }
  }

  // Handle volume change
  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value, 10)
    setVolume(newVolume)

    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100
    }

    if (newVolume === 0) {
      setIsMuted(true)
    } else if (isMuted) {
      setIsMuted(false)
    }
  }

  // Refresh stream
  const refreshStream = () => {
    if (audioRef.current && serverConfig) {
      console.log('Refreshing stream...')
      audioRef.current.pause()
      audioRef.current.src = serverConfig.streamUrl
      audioRef.current.load()
      setStreamError(null)
      setIsPlaying(false)
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
                  {isLive ? 'Live Broadcasting' : 'Offline'}
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
              <div className="md:col-span-2">
                <span className="font-medium text-gray-700 dark:text-gray-300">Stream URL:</span>
                <code className="ml-2 text-gray-900 dark:text-white">{serverConfig.streamUrl}</code>
                                      </div>
                                    </div>
            
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/30 rounded-md">
              <p className="text-sm text-green-700 dark:text-green-200">
                <strong>Status:</strong> {isLive ? 'Stream is currently live!' : 'Waiting for DJ to go live...'}
                {isLive && ' Click the play button above to start listening.'}
                            </p>
                          </div>
          </div>
        </div>
      )}
    </div>
  )
}
