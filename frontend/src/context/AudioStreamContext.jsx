import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { streamService } from '../services/api';
import { throttle, shallowEqual } from '../utils/throttle';
import { createStompClient } from '../services/websocket';

// Environment-based logging
const isDevelopment = process.env.NODE_ENV === 'development';

const AudioStreamContext = createContext();

export const useAudioStream = () => {
  const context = useContext(AudioStreamContext);
  if (!context) {
    throw new Error('useAudioStream must be used within an AudioStreamProvider');
  }
  return context;
};

export const AudioStreamProvider = ({ children }) => {
  // Audio stream state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isLive, setIsLive] = useState(false);
  const [streamError, setStreamError] = useState(null);
  const [serverConfig, setServerConfig] = useState(null);
  const [currentStream, setCurrentStream] = useState(null);
  const [isStreamBarVisible, setIsStreamBarVisible] = useState(false);
  
  // Store previous status to avoid unnecessary updates
  const prevStatusRef = useRef(null);

  // Audio refs
  const audioRef = useRef(null);
  const statusCheckInterval = useRef(null);
  const reconnectAttempts = useRef(0);
  const stompClientRef = useRef(null);
  const subscriptionRef = useRef(null);

  // Development-only logger
  const devLog = useCallback((message, ...args) => {
    if (isDevelopment) {
      console.log(message, ...args);
    }
  }, []);

  // Set up WebSocket connection for stream status updates
  const setupWebSocketForStreamStatus = useCallback(() => {
    // Clean up any existing connection
    if (stompClientRef.current) {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      if (stompClientRef.current.connected) {
        stompClientRef.current.deactivate();
      }
      stompClientRef.current = null;
    }
    
    // Create a new STOMP client
    try {
      const stompClient = createStompClient('/ws-radio');
      stompClientRef.current = stompClient;
      
      stompClient.onConnect = () => {
        devLog('Connected to stream status WebSocket');
        
        // Subscribe to stream status updates
        subscriptionRef.current = stompClient.subscribe('/topic/stream/status', (message) => {
          try {
            const status = JSON.parse(message.body);
            devLog('Received stream status update:', status);
            
            // Only update state if status has changed
            if (!prevStatusRef.current || !shallowEqual(prevStatusRef.current, status)) {
              prevStatusRef.current = status;
              setIsLive(status.live);
              
              // If server is up but we're not connected, try to reconnect
              if (status.server === 'UP' && status.live && !isPlaying && audioRef.current && !audioRef.current.src) {
                devLog('Server is UP and stream is live, setting up audio source');
                if (serverConfig) {
                  const streamUrl = serverConfig.streamUrl;
                  audioRef.current.src = streamUrl;
                  audioRef.current.load();
                }
              }
            }
          } catch (error) {
            console.error('Error parsing stream status:', error);
          }
        });
        
        // Get initial status after connection
        performStatusCheck();
      };
      
      stompClient.onStompError = (frame) => {
        console.error('STOMP error:', frame);
      };
      
      stompClient.onWebSocketError = (event) => {
        console.error('WebSocket error:', event);
      };
      
      // Activate the client
      stompClient.activate();
      
    } catch (error) {
      console.error('Failed to set up WebSocket for stream status:', error);
    }
  }, [devLog, isPlaying, serverConfig]);

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = "anonymous";
      audioRef.current.preload = "none";
      audioRef.current.volume = volume / 100;

      // Audio event listeners
      audioRef.current.addEventListener('loadstart', () => {
        devLog('Stream loading started');
      });

      audioRef.current.addEventListener('canplay', () => {
        devLog('Stream can start playing');
        setStreamError(null);
        reconnectAttempts.current = 0;
      });

      audioRef.current.addEventListener('playing', () => {
        setIsPlaying(true);
        setStreamError(null);
        setIsStreamBarVisible(true);
        devLog('Stream is playing');
        
        // Save stream state to localStorage
        localStorage.setItem('persistentStream', JSON.stringify({
          isPlaying: true,
          currentTime: audioRef.current.currentTime,
          streamUrl: audioRef.current.src,
          volume: volume
        }));
      });

      audioRef.current.addEventListener('pause', () => {
        setIsPlaying(false);
        devLog('Stream is paused');
        
        // Update localStorage
        localStorage.setItem('persistentStream', JSON.stringify({
          isPlaying: false,
          currentTime: audioRef.current.currentTime,
          streamUrl: audioRef.current.src,
          volume: volume
        }));
      });

      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false);
        setIsStreamBarVisible(false);
        devLog('Stream ended');
        localStorage.removeItem('persistentStream');
      });

      audioRef.current.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        setStreamError('Error loading stream. Please try again.');
        setIsPlaying(false);

        // Attempt to reconnect
        if (reconnectAttempts.current < 3 && isLive && serverConfig) {
          setTimeout(() => {
            reconnectAttempts.current += 1;
            devLog(`Reconnection attempt ${reconnectAttempts.current}`);
            
            const streamUrl = serverConfig.streamUrl.startsWith('http') 
              ? serverConfig.streamUrl 
              : `http://${serverConfig.streamUrl}`;
            
            audioRef.current.src = streamUrl;
            audioRef.current.load();
            audioRef.current.play().catch(e => console.error("Autoplay prevented:", e));
          }, 3000);
        }
      });

      audioRef.current.addEventListener('timeupdate', () => {
        // Save current time to localStorage periodically
        if (isPlaying) {
          localStorage.setItem('persistentStream', JSON.stringify({
            isPlaying: true,
            currentTime: audioRef.current.currentTime,
            streamUrl: audioRef.current.src,
            volume: volume
          }));
        }
      });
    }

    // Clean up event listeners and intervals when component unmounts
    return () => {
      if (statusCheckInterval.current) {
        clearInterval(statusCheckInterval.current);
        statusCheckInterval.current = null;
      }
      
      // Clean up WebSocket connection
      if (stompClientRef.current) {
        if (subscriptionRef.current) {
          subscriptionRef.current.unsubscribe();
          subscriptionRef.current = null;
        }
        if (stompClientRef.current.connected) {
          stompClientRef.current.deactivate();
          stompClientRef.current = null;
        }
      }
      
      // Clean up audio element if it exists
      if (audioRef.current) {
        // Remove all event listeners to prevent memory leaks
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load();
      }
    };
  }, [volume, isPlaying, isLive, devLog]);

  // Restore stream state on mount
  useEffect(() => {
    const savedStream = localStorage.getItem('persistentStream');
    if (savedStream) {
      try {
        const streamData = JSON.parse(savedStream);
        if (streamData.isPlaying && streamData.streamUrl) {
          setVolume(streamData.volume || 80);
          setIsStreamBarVisible(true);
          
          // Fetch current server config and resume stream
          fetchServerConfig().then(() => {
            if (audioRef.current && serverConfig) {
              audioRef.current.src = streamData.streamUrl;
              audioRef.current.currentTime = streamData.currentTime || 0;
              audioRef.current.volume = (streamData.volume || 80) / 100;
              
              // Don't auto-resume - let user decide
              devLog('Stream state restored from localStorage');
            }
          });
        }
      } catch (error) {
        console.error('Error restoring stream state:', error);
        localStorage.removeItem('persistentStream');
      }
    }
  }, []);

  // Fetch server configuration
  const fetchServerConfig = useCallback(async () => {
    try {
      const response = await streamService.getConfig();
      if (response.data.success) {
        setServerConfig(response.data.data);
        return response.data.data;
      }
    } catch (error) {
      console.error('Error fetching server config:', error);
    }
    return null;
  }, []);

  // Check stream status with throttle to avoid excessive calls
  const performStatusCheck = useCallback(async () => {
    try {
      // Use simpler endpoint that doesn't trigger preflight OPTIONS
      const newStatus = await streamService.getSimpleStatus();
      
      // Only update state if status has changed
      if (!prevStatusRef.current || !shallowEqual(prevStatusRef.current, newStatus)) {
        const { live, server } = newStatus;
        setIsLive(live);
        
        // Store the new status for future comparison
        prevStatusRef.current = newStatus;
        
        // Only log status changes in development 
        if (isDevelopment) {
          console.log('Stream status changed:', newStatus);
        }
        
        // If server is up but we're not connected, try to reconnect
        if (server === 'UP' && live && !isPlaying && audioRef.current && !audioRef.current.src) {
          devLog('Server is UP and stream is live, setting up audio source');
          if (serverConfig) {
            const streamUrl = serverConfig.streamUrl;
            audioRef.current.src = streamUrl;
            audioRef.current.load();
          }
        }
      }
      return newStatus;
    } catch (error) {
      console.error('Error checking stream status:', error);
      setIsLive(false);
    }
    return null;
  }, [isPlaying, serverConfig, devLog]);
  
  // Throttled version of status check - only runs at most once per 5 seconds
  // even if it's called multiple times in that period
  const throttledStatusCheck = useCallback(
    throttle(performStatusCheck, 5000),
    [performStatusCheck]
  );

  // Initialize server config and status checking
  useEffect(() => {
    fetchServerConfig();
    
    // Run initial status check without throttling
    performStatusCheck();
    
    // Set up WebSocket connection for real-time status updates
    setupWebSocketForStreamStatus();
    
    // Set up periodic status checking with increased interval as fallback
    // Use different intervals based on tab visibility to save resources
    const handleVisibilityChange = () => {
      if (statusCheckInterval.current) {
        clearInterval(statusCheckInterval.current);
      }
      
      const interval = document.hidden ? 120000 : 60000; // 2 min when hidden, 1 min when visible
      statusCheckInterval.current = setInterval(() => {
        throttledStatusCheck();
      }, interval);
      
      // Check status immediately when tab becomes visible again
      if (!document.hidden) {
        throttledStatusCheck();
      }
    };
    
    // Initial setup
    handleVisibilityChange();
    
    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      if (statusCheckInterval.current) {
        clearInterval(statusCheckInterval.current);
        statusCheckInterval.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchServerConfig, performStatusCheck, throttledStatusCheck, setupWebSocketForStreamStatus]);

  // Update audio source when server config changes
  useEffect(() => {
    if (serverConfig && audioRef.current) {
      const streamUrl = serverConfig.streamUrl.startsWith('http') 
        ? serverConfig.streamUrl 
        : `http://${serverConfig.streamUrl}`;
      
      // Only update if URL is different
      if (audioRef.current.src !== streamUrl) {
        audioRef.current.src = streamUrl;
        devLog('Stream URL updated:', streamUrl);
      }
    }
  }, [serverConfig, devLog]);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  // Play/pause toggle
  const togglePlayback = useCallback(async () => {
    if (!audioRef.current || !serverConfig) {
      console.warn('Audio element or server config not available');
      return;
    }

    try {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        const streamUrl = serverConfig.streamUrl.startsWith('http') 
          ? serverConfig.streamUrl 
          : `http://${serverConfig.streamUrl}`;

        // Ensure we have the correct source
        if (audioRef.current.src !== streamUrl) {
          audioRef.current.src = streamUrl;
          audioRef.current.load();
        }

        await audioRef.current.play();
        setCurrentStream({
          title: 'WildCats Radio Live',
          url: streamUrl
        });
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
      setStreamError(`Error ${isPlaying ? 'pausing' : 'starting'} playback: ${error.message}`);
    }
  }, [isPlaying, serverConfig]);

  // Volume controls
  const handleVolumeChange = useCallback((newVolume) => {
    setVolume(newVolume);
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted && newVolume > 0) {
      setIsMuted(false);
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Stop stream completely
  const stopStream = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current.load();
    }
    setIsPlaying(false);
    setIsStreamBarVisible(false);
    setCurrentStream(null);
    localStorage.removeItem('persistentStream');
  }, []);

  // Hide stream bar
  const hideStreamBar = useCallback(() => {
    setIsStreamBarVisible(false);
  }, []);

  // Show stream bar
  const showStreamBar = useCallback(() => {
    if (isPlaying || currentStream) {
      setIsStreamBarVisible(true);
    }
  }, [isPlaying, currentStream]);

  // Force a reconnect to the WebSocket - useful when network conditions change
  const reconnectWebSocket = useCallback(() => {
    setupWebSocketForStreamStatus();
  }, [setupWebSocketForStreamStatus]);

  const value = {
    // State
    isPlaying,
    isMuted,
    volume,
    isLive,
    streamError,
    serverConfig,
    currentStream,
    isStreamBarVisible,
    
    // Actions
    togglePlayback,
    handleVolumeChange,
    toggleMute,
    stopStream,
    hideStreamBar,
    showStreamBar,
    fetchServerConfig,
    checkStreamStatus: throttledStatusCheck, // Expose the throttled version
    reconnectWebSocket, // Expose the reconnect function
    
    // Audio ref for advanced usage
    audioRef
  };

  return (
    <AudioStreamContext.Provider value={value}>
      {children}
    </AudioStreamContext.Provider>
  );
}; 