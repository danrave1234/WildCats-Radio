import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { broadcastService, streamService } from '../services/api';
import { useAuth } from './AuthContext';
import { useLocalBackend, config } from '../config';
import { createLogger } from '../services/logger';

const logger = createLogger('StreamingContext');

const StreamingContext = createContext();

export function useStreaming() {
  const context = useContext(StreamingContext);
  if (!context) {
    throw new Error('useStreaming must be used within a StreamingProvider');
  }
  return context;
}

// Storage keys for persisting state
const STORAGE_KEYS = {
  DJ_BROADCASTING_STATE: 'wildcats_dj_broadcasting_state',
  LISTENER_STATE: 'wildcats_listener_state',
  CURRENT_BROADCAST: 'wildcats_current_broadcast',
  STREAM_CONFIG: 'wildcats_stream_config'
};

export function StreamingProvider({ children }) {
  const { currentUser, isAuthenticated } = useAuth();

  // DJ State
  const [isLive, setIsLive] = useState(false);
  const [currentBroadcast, setCurrentBroadcast] = useState(null);
  const [listenerCount, setListenerCount] = useState(0);
  const [websocketConnected, setWebsocketConnected] = useState(false);

  // Listener State
  const [isListening, setIsListening] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('wildcats_volume');
    return saved ? parseInt(saved) : 80;
  });
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('wildcats_muted');
    return saved === 'true';
  });

  // Server Config
  const [serverConfig, setServerConfig] = useState(null);

  // WebSocket References
  const djWebSocketRef = useRef(null);
  const listenerWebSocketRef = useRef(null);
  const statusWebSocketRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioRef = useRef(null);

  // Reconnection management
  const djReconnectTimerRef = useRef(null);
  const listenerReconnectTimerRef = useRef(null);
  const statusReconnectTimerRef = useRef(null);

  // Add new audio source state
  const [audioSource, setAudioSource] = useState('microphone'); // 'microphone', 'desktop', 'both'
  const desktopStreamRef = useRef(null);

  // Add DJ audio controls
  const [isDJMuted, setIsDJMuted] = useState(false);
  const [djAudioGain, setDJAudioGain] = useState(1.0); // 0.0 to 1.0
  const audioContextRef = useRef(null);
  const gainNodeRef = useRef(null);

  // Add noise gate and audio monitoring
  const [noiseGateEnabled, setNoiseGateEnabled] = useState(false); // DISABLED by default for troubleshooting
  const [noiseGateThreshold, setNoiseGateThreshold] = useState(-60); // dB - more lenient threshold
  const [audioLevel, setAudioLevel] = useState(0);
  const analyserRef = useRef(null);
  const noiseGateRef = useRef(null);
  const audioLevelIntervalRef = useRef(null);
  const lastAudioAboveThresholdRef = useRef(0); // Track when audio was last above threshold

  // Add microphone boost control state
  const [microphoneBoost, setMicrophoneBoost] = useState(3.0); // Default 3x boost (~9.5dB)
  const microphoneBoostRef = useRef(null);

  // Load persisted state on startup
  useEffect(() => {
    loadPersistedState();
    loadServerConfig();
  }, []);

  // Persist state changes
  useEffect(() => {
    if (currentUser?.role === 'DJ' || currentUser?.role === 'ADMIN') {
      persistDJState();
    }
  }, [isLive, currentBroadcast, websocketConnected, currentUser]);

  useEffect(() => {
    persistListenerState();
  }, [isListening, audioPlaying, volume, isMuted]);

  // Auto-connect/reconnect when authenticated
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      if (currentUser.role === 'DJ' || currentUser.role === 'ADMIN') {
        // Check for existing broadcast and connect if needed
        checkAndRestoreDJState();
      } else {
        // Set up listener connections
        checkAndRestoreListenerState();
      }
      connectStatusWebSocket();
    } else {
      // Clean up all connections when logged out
      disconnectAll();
    }

    return () => {
      // Only disconnect on component unmount, not on every auth change
    };
  }, [isAuthenticated, currentUser?.id]);

  // Load persisted state from localStorage
  const loadPersistedState = () => {
    try {
      // Load DJ state
      const djState = localStorage.getItem(STORAGE_KEYS.DJ_BROADCASTING_STATE);
      if (djState) {
        const parsed = JSON.parse(djState);
        if (parsed.isLive && parsed.currentBroadcast) {
          setIsLive(parsed.isLive);
          setCurrentBroadcast(parsed.currentBroadcast);
          setWebsocketConnected(false); // Will reconnect
        }
      }

      // Load listener state
      const listenerState = localStorage.getItem(STORAGE_KEYS.LISTENER_STATE);
      if (listenerState) {
        const parsed = JSON.parse(listenerState);
        setIsListening(parsed.isListening || false);
        setAudioPlaying(parsed.audioPlaying || false);
      }

      // Load current broadcast
      const broadcast = localStorage.getItem(STORAGE_KEYS.CURRENT_BROADCAST);
      if (broadcast && !currentBroadcast) {
        setCurrentBroadcast(JSON.parse(broadcast));
      }
    } catch (error) {
      logger.error('Error loading persisted state:', error);
    }
  };

  const refreshStreamStatus = async () => {
    try {
      const response = await streamService.getStatus();
      if (response.data && response.data.success) {
        const { listenerCount, isLive } = response.data.data;
        setListenerCount(listenerCount);
        setIsLive(isLive);
        logger.info(`Refreshed stream status: isLive=${isLive}, listeners=${listenerCount}`);
      }
    } catch (error) {
      logger.error('Error refreshing stream status:', error);
    }
  };

  // Load server configuration
  const loadServerConfig = async () => {
    try {
      const cachedConfig = localStorage.getItem(STORAGE_KEYS.STREAM_CONFIG);
      if (cachedConfig) {
        setServerConfig(JSON.parse(cachedConfig));
      }

      // Always fetch fresh config
      const response = await streamService.getConfig();
      const config = response.data.data;
      setServerConfig(config);
      localStorage.setItem(STORAGE_KEYS.STREAM_CONFIG, JSON.stringify(config));
    } catch (error) {
      logger.error('Error loading server config:', error);
    }
  };

  // Persist DJ state
  const persistDJState = () => {
    const state = {
      isLive,
      currentBroadcast,
      websocketConnected,
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEYS.DJ_BROADCASTING_STATE, JSON.stringify(state));

    if (currentBroadcast) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_BROADCAST, JSON.stringify(currentBroadcast));
    }
  };

  // Persist listener state
  const persistListenerState = () => {
    const state = {
      isListening,
      audioPlaying,
      volume,
      isMuted,
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEYS.LISTENER_STATE, JSON.stringify(state));
    localStorage.setItem('wildcats_volume', volume.toString());
    localStorage.setItem('wildcats_muted', isMuted.toString());
  };

  // New function to get desktop audio
  const getDesktopAudioStream = async () => {
    try {
      // Check if getDisplayMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen capture not supported in this browser');
      }

      logger.debug('Attempting to get desktop audio stream...');

      // Check if we're in a secure context (HTTPS or localhost)
      if (!window.isSecureContext && window.location.protocol !== 'http:') {
        throw new Error('Desktop audio capture requires a secure connection (HTTPS). Please use HTTPS or localhost.');
      }

      logger.debug('Attempting to get desktop audio stream...');

      // Some browsers require video to be true even for audio-only capture
      // We'll request both but then extract only the audio track
      const desktopStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'screen',
          width: { max: 1 },
          height: { max: 1 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 2
        }
      });

      // Check if we got audio tracks
      const audioTracks = desktopStream.getAudioTracks();
      if (audioTracks.length === 0) {
        // Stop any video tracks we don't need
        desktopStream.getVideoTracks().forEach(track => track.stop());
        throw new Error('No audio track found in the selected source. Please select a source that includes audio (like a browser tab with music) or choose "System Audio" in the sharing dialog.');
      }

      // Create a new stream with only the audio track
      const audioOnlyStream = new MediaStream();
      audioTracks.forEach(track => audioOnlyStream.addTrack(track));

      // Stop any video tracks since we only need audio
      desktopStream.getVideoTracks().forEach(track => track.stop());

      logger.debug('Desktop audio stream obtained successfully with', audioTracks.length, 'audio track(s)');
      return audioOnlyStream;
    } catch (error) {
      logger.error('Error getting desktop audio stream:', error);

      // Provide user-friendly error messages
      if (error.name === 'NotSupportedError') {
        throw new Error('Desktop audio capture is not supported in this browser. Please try using Chrome, Edge, or Firefox, or switch to microphone-only mode.');
      } else if (error.name === 'NotAllowedError') {
        throw new Error('Permission denied for desktop audio capture. Please allow screen sharing and make sure to select a source with audio.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No audio source found. Please select a source that includes audio (like a browser tab with music playing).');
      } else if (error.name === 'AbortError') {
        throw new Error('Desktop audio capture was cancelled. Please try again and select a source with audio.');
      } else {
        throw new Error(error.message || 'Failed to capture desktop audio. Please try using microphone mode instead.');
      }
    }
  };

  // New function to get microphone audio
  const getMicrophoneAudioStream = async () => {
    try {
      // Use diagnostic approach to identify and fix silent microphone issues
      return await getDiagnosticMicrophoneAudioStream();
    } catch (error) {
      console.error('❌ Error getting microphone audio stream:', error);
      logger.error('Error getting microphone audio stream:', error);
      throw error;
    }
  };

  // Diagnostic microphone audio stream with comprehensive testing
  const getDiagnosticMicrophoneAudioStream = async () => {
    try {
      console.log('🔬 Starting diagnostic microphone audio capture...');
      
      // Step 1: Test basic microphone access
      const micStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 2
        }
      });

      console.log('✅ Diagnostic microphone stream obtained');
      
      // Step 2: Test audio levels directly from raw stream
      const testContext = new AudioContext({ sampleRate: 48000 });
      const testSource = testContext.createMediaStreamSource(micStream);
      const testAnalyser = testContext.createAnalyser();
      testAnalyser.fftSize = 256;
      testSource.connect(testAnalyser);

      // Step 3: Monitor raw audio for 2 seconds to ensure it's working
      const testData = new Uint8Array(testAnalyser.frequencyBinCount);
      let maxLevel = 0;
      let testCount = 0;

      console.log('🔬 Testing raw microphone audio levels for 2 seconds...');
      
      await new Promise((resolve) => {
        const testInterval = setInterval(() => {
          testAnalyser.getByteFrequencyData(testData);
          let sum = 0;
          for (let i = 0; i < testData.length; i++) {
            sum += testData[i] * testData[i];
          }
          const rms = Math.sqrt(sum / testData.length);
          const dB = rms > 0 ? 20 * Math.log10(rms / 255) : -100;
          
          if (rms > maxLevel) maxLevel = rms;
          testCount++;

          if (testCount % 10 === 0) {
            console.log(`🔬 Raw mic test ${testCount/10}/20: RMS=${rms.toFixed(2)}, dB=${dB.toFixed(1)}, Max=${maxLevel.toFixed(2)}`);
          }

          if (testCount >= 200) { // 2 seconds of testing
            clearInterval(testInterval);
            testContext.close();
            resolve();
          }
        }, 10);
      });

      // Step 4: Evaluate results
      if (maxLevel < 1) {
        console.warn('⚠️ Raw microphone levels extremely low, trying fallback capture method');
        micStream.getTracks().forEach(track => track.stop());
        return await getFallbackMicrophoneAudioStream();
      }

      console.log(`✅ Raw microphone working (max level: ${maxLevel.toFixed(2)}), proceeding with processing`);

      // Step 5: Try direct stream first (no processing) to test Chrome WebRTC issues
      console.log('🔧 Testing direct stream approach first...');
      try {
        // Test: return the raw stream directly without any processing
        // This will help identify if the issue is in the processing pipeline
        console.log('⚠️ Using DIRECT STREAM mode (no processing) for testing');
        
        // Set up basic references for audio level monitoring
        const testContext = new AudioContext({ sampleRate: 48000 });
        const testSource = testContext.createMediaStreamSource(micStream);
        const testAnalyser = testContext.createAnalyser();
        testSource.connect(testAnalyser);
        
        analyserRef.current = testAnalyser;
        audioContextRef.current = testContext;
        
        // Start basic monitoring
        startSimplifiedAudioLevelMonitoring();
        
        console.log('✅ Direct stream mode active - no audio processing applied');
        return micStream; // Return raw stream directly
        
      } catch (directError) {
        console.warn('⚠️ Direct stream failed, falling back to processing pipeline:', directError);
        
        // Step 5b: Create processing pipeline as fallback
        const audioContext = new AudioContext({
          sampleRate: 48000,
          latencyHint: 'interactive'
        });
        audioContextRef.current = audioContext;

        const processedStream = createSimplifiedAudioProcessingPipeline(micStream, audioContext);
        
        // DON'T stop original stream immediately - let processed stream establish first
        setTimeout(() => {
          console.log('🔧 Stopping original microphone stream after processed stream established');
          micStream.getTracks().forEach(track => track.stop());
        }, 1000);

        console.log('✅ Diagnostic microphone pipeline complete');
        return processedStream;
      }

    } catch (error) {
      console.error('❌ Error in diagnostic microphone capture:', error);
      throw error;
    }
  };

  // Fallback microphone audio stream with minimal processing
  const getFallbackMicrophoneAudioStream = async () => {
    try {
      console.log('🔄 Attempting fallback microphone capture...');
      
      // Try different audio constraints
      const constraints = [
        // Constraint 1: Minimal settings
        {
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: true, // Let browser handle gain
            sampleRate: 44100, // Standard rate
            channelCount: 1 // Mono for simplicity
          }
        },
        // Constraint 2: Default settings
        {
          audio: true
        },
        // Constraint 3: High quality settings
        {
          audio: {
            echoCancellation: true,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 48000,
            channelCount: 2,
            volume: 1.0
          }
        }
      ];

      for (let i = 0; i < constraints.length; i++) {
        try {
          console.log(`🔄 Trying fallback constraint ${i + 1}:`, constraints[i]);
          
          const stream = await navigator.mediaDevices.getUserMedia(constraints[i]);
          
          // Test this stream briefly
          const testCtx = new AudioContext();
          const testSrc = testCtx.createMediaStreamSource(stream);
          const testAna = testCtx.createAnalyser();
          testSrc.connect(testAna);
          
          // Quick test
          const testArr = new Uint8Array(testAna.frequencyBinCount);
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
          testAna.getByteFrequencyData(testArr);
          
          let sum = 0;
          for (let j = 0; j < testArr.length; j++) {
            sum += testArr[j];
          }
          const avgLevel = sum / testArr.length;
          
          testCtx.close();
          
          console.log(`🔄 Fallback constraint ${i + 1} average level: ${avgLevel.toFixed(2)}`);
          
          if (avgLevel > 0.5 || i === constraints.length - 1) { // Accept if any audio or last attempt
            console.log(`✅ Fallback constraint ${i + 1} accepted, using direct stream`);
            
            // Return the stream directly without complex processing
            return stream;
          } else {
            stream.getTracks().forEach(track => track.stop());
          }
          
        } catch (error) {
          console.warn(`⚠️ Fallback constraint ${i + 1} failed:`, error.message);
        }
      }

      throw new Error('All fallback microphone capture methods failed');
    } catch (error) {
      console.error('❌ Error in fallback microphone capture:', error);
      throw error;
    }
  };

  // New function to mix audio streams
  const mixAudioStreams = async (micStream, desktopStream) => {
    try {
      const audioContext = new AudioContext({
        latencyHint: 'interactive' // Optimize for low latency
      });
      const destination = audioContext.createMediaStreamDestination();

      // Store audio context reference for later use
      audioContextRef.current = audioContext;

      // Create audio sources
      const micSource = audioContext.createMediaStreamSource(micStream);
      const desktopSource = audioContext.createMediaStreamSource(desktopStream);

      // Create gain nodes for volume control
      const micGain = audioContext.createGain();
      const desktopGain = audioContext.createGain();
      const masterGain = audioContext.createGain();

      // Store master gain reference for DJ controls
      gainNodeRef.current = masterGain;

      // Set initial gain levels (can be adjusted)
      micGain.gain.value = 1.0; // 100% microphone volume
      desktopGain.gain.value = 0.8; // 80% desktop volume to prevent overwhelming
      masterGain.gain.value = isDJMuted ? 0.0 : djAudioGain;

      // Connect the audio graph
      micSource.connect(micGain);
      desktopSource.connect(desktopGain);
      micGain.connect(masterGain);
      desktopGain.connect(masterGain);
      masterGain.connect(destination);

      logger.debug('Audio streams mixed successfully');
      return destination.stream;
    } catch (error) {
      logger.error('Error mixing audio streams:', error);
      throw error;
    }
  };

  // DJ Audio Control Functions
  const toggleDJMute = () => {
    const newMutedState = !isDJMuted;
    setIsDJMuted(newMutedState);

    // Apply mute to gain node if available
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = newMutedState ? 0.0 : djAudioGain;
    }

    logger.debug('DJ mute toggled:', newMutedState);
  };

  const setDJAudioLevel = (level) => {
    // Clamp level between 0 and 1
    const clampedLevel = Math.max(0, Math.min(1, level));
    setDJAudioGain(clampedLevel);

    // Apply gain to gain node if available and not muted
    if (gainNodeRef.current && !isDJMuted) {
      gainNodeRef.current.gain.value = clampedLevel;
    }

    logger.debug('DJ audio level set to:', clampedLevel);
  };

  // Microphone Boost Control Function
  const setMicrophoneBoostLevel = (boostMultiplier) => {
    // Clamp boost between 0.1 and 10.0 (equivalent to -20dB to +20dB)
    const clampedBoost = Math.max(0.1, Math.min(10.0, boostMultiplier));
    setMicrophoneBoost(clampedBoost);

    // Apply boost to microphone gain node if available
    if (microphoneBoostRef.current) {
      microphoneBoostRef.current.gain.value = clampedBoost;
      console.log(`🎤 Microphone boost set to ${clampedBoost.toFixed(1)}x (~${(20 * Math.log10(clampedBoost)).toFixed(1)}dB)`);
    }

    logger.debug('Microphone boost level set to:', clampedBoost);
  };

  // Seamless function to switch audio source during broadcast without disconnecting
  const switchAudioSourceLive = async (newSource) => {
    if (!isLive || !mediaRecorderRef.current) {
      logger.warn('Cannot switch audio source: not live or no media recorder');
      setAudioSource(newSource);
      return;
    }

    try {
      logger.info('Switching audio source seamlessly from', audioSource, 'to', newSource);

      // Don't stop MediaRecorder or WebSocket - we'll switch streams seamlessly

      // 1. Get new audio stream
      const newStream = await getAudioStream(newSource);

      // 2. Stop current audio level monitoring
      stopAudioLevelMonitoring();

      // 3. Stop current audio streams (but not MediaRecorder)
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (desktopStreamRef.current) {
        desktopStreamRef.current.getTracks().forEach(track => track.stop());
        desktopStreamRef.current = null;
      }

      // 4. Create new MediaRecorder with new stream, but keep it connected to same WebSocket
      const currentMediaRecorder = mediaRecorderRef.current;

      // Stop current recorder gracefully
      if (currentMediaRecorder.state === 'recording') {
        currentMediaRecorder.stop();
      }

      // Wait a brief moment for the stop to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // 5. Create new MediaRecorder with new stream
      const newMediaRecorder = new MediaRecorder(newStream, {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 96000 // Lower bitrate for better compatibility
      });

      // 6. Set up data handling with existing WebSocket (no reconnection needed)
      newMediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && djWebSocketRef.current && djWebSocketRef.current.readyState === WebSocket.OPEN) {
          event.data.arrayBuffer().then(buffer => {
            // Double check WebSocket is still available before sending
            if (djWebSocketRef.current && djWebSocketRef.current.readyState === WebSocket.OPEN) {
              djWebSocketRef.current.send(buffer);
            }
          }).catch(error => {
            console.error('Error sending audio data:', error);
          });
        }
      };

      // 7. Start new recorder immediately
      newMediaRecorder.start(500);

      // 8. Update references
      mediaRecorderRef.current = newMediaRecorder;
      audioStreamRef.current = newStream;

      // 9. Update audio source state
      setAudioSource(newSource);

      logger.info('Audio source switched seamlessly to:', newSource, '- WebSocket remained connected');

    } catch (error) {
      logger.error('Error during seamless audio source switch:', error);

      // If seamless switch fails, try to restore previous state
      logger.debug('Attempting to restore previous audio source...');
      try {
        const fallbackStream = await getAudioStream(audioSource);

        const fallbackRecorder = new MediaRecorder(fallbackStream, {
          mimeType: "audio/webm;codecs=opus",
          audioBitsPerSecond: 96000 // Lower bitrate for better compatibility
        });

        fallbackRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && djWebSocketRef.current && djWebSocketRef.current.readyState === WebSocket.OPEN) {
            event.data.arrayBuffer().then(buffer => {
              djWebSocketRef.current.send(buffer);
            });
          }
        };

        fallbackRecorder.start(500);
        mediaRecorderRef.current = fallbackRecorder;
        audioStreamRef.current = fallbackStream;

        logger.info('Restored to previous audio source');
      } catch (restoreError) {
        logger.error('Failed to restore audio source:', restoreError);
        throw new Error(`Audio switch failed and could not restore: ${error.message}`);
      }

      throw error;
    }
  };

  // Enhanced function to get audio stream based on selected source
  const getAudioStream = async (source = audioSource) => {
    try {
      console.log('Getting audio stream for source:', source);

      switch (source) {
        case 'microphone':
          return await getMicrophoneAudioStream();

        case 'desktop':
          try {
            const desktopStream = await getDesktopAudioStream();
            desktopStreamRef.current = desktopStream;
            return desktopStream;
          } catch (error) {
            console.warn('Desktop audio capture failed, falling back to microphone:', error.message);
            // Show user-friendly message about the fallback
            const fallbackMessage = `Desktop audio capture failed: ${error.message}\n\nFalling back to microphone only. You can change the audio source in the settings above.`;
            console.log('Fallback message:', fallbackMessage);

            // Set audio source back to microphone
            setAudioSource('microphone');

            // Throw the original error with fallback info
            throw new Error(fallbackMessage);
          }

        case 'both':
          try {
            const micStream = await getMicrophoneAudioStream();
            const deskStream = await getDesktopAudioStream();
            desktopStreamRef.current = deskStream;
            return await mixAudioStreams(micStream, deskStream);
          } catch (error) {
            console.warn('Mixed audio capture failed, falling back to microphone:', error.message);

            // If desktop part failed, fall back to microphone only
            if (error.message.includes('Desktop audio') || error.message.includes('Screen sharing') || error.message.includes('NotSupported')) {
              console.log('Desktop audio part failed, trying microphone only');
              setAudioSource('microphone');

              const fallbackMessage = `Mixed audio setup failed: ${error.message}\n\nFalling back to microphone only. You can try again with desktop audio once you've resolved the issue.`;
              throw new Error(fallbackMessage);
            }

            throw error;
          }

        default:
          console.warn('Unknown audio source:', source, 'defaulting to microphone');
          return await getMicrophoneAudioStream();
      }
    } catch (error) {
      console.error('Error getting audio stream:', error);
      throw error;
    }
  };

  // Enhanced restore DJ streaming function
  const restoreDJStreaming = async () => {
    if (!isLive || !currentBroadcast) {
      console.log('Cannot restore DJ streaming: not live or no current broadcast');
      return false;
    }

    try {
      console.log('Attempting to restore DJ streaming...');

      // Get audio stream based on selected source
      const stream = await getAudioStream();

      audioStreamRef.current = stream;

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 96000 // Lower bitrate for better compatibility
      });

      mediaRecorderRef.current = mediaRecorder;

      // Ensure WebSocket is connected
      if (!djWebSocketRef.current || djWebSocketRef.current.readyState !== WebSocket.OPEN) {
        console.log('WebSocket not connected, connecting...');
        connectDJWebSocket();

        // Wait for WebSocket to connect
        return new Promise((resolve) => {
          const checkConnection = () => {
            if (djWebSocketRef.current && djWebSocketRef.current.readyState === WebSocket.OPEN) {
              setupMediaRecorderConnection();
              resolve(true);
            } else {
              setTimeout(checkConnection, 100);
            }
          };
          checkConnection();
        });
      } else {
        setupMediaRecorderConnection();
        return true;
      }

      function setupMediaRecorderConnection() {
        // Helper function to safely send audio data through WebSocket
        const safelySendAudioData = (buffer) => {
          if (djWebSocketRef.current && 
              djWebSocketRef.current.readyState === WebSocket.OPEN) {
            try {
              djWebSocketRef.current.send(buffer);
              return true;
            } catch (error) {
              console.error('Error sending audio data through WebSocket:', error);
              return false;
            }
          }
          return false;
        };

        let lastChunkTime = Date.now();
        let chunkCount = 0;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && djWebSocketRef.current && djWebSocketRef.current.readyState === WebSocket.OPEN) {
            const currentTime = Date.now();
            const timeSinceLastChunk = currentTime - lastChunkTime;
            chunkCount++;

            // Log timing info every 10th chunk to track regularity
            if (chunkCount % 10 === 0) {
              console.log(`🎵 Audio chunk #${chunkCount}: ${event.data.size} bytes, ${timeSinceLastChunk}ms since last chunk`);
            }

            lastChunkTime = currentTime;

            event.data.arrayBuffer().then(buffer => {
              safelySendAudioData(buffer);
            }).catch(error => {
              console.error('Error processing audio data:', error);
            });
          }
        };

        mediaRecorder.start(500);
        setIsLive(true);
        console.log('DJ streaming restored successfully');
      }

    } catch (error) {
      console.error('Error restoring DJ streaming:', error);
      return false;
    }
  };

  // Check and restore DJ state
  const checkAndRestoreDJState = async () => {
    try {
      // First check if there's an active broadcast on the server
      const activeBroadcast = await broadcastService.getActiveBroadcast();

      if (activeBroadcast) {
        console.log('Found active broadcast on server, restoring state:', activeBroadcast);
        setCurrentBroadcast(activeBroadcast);
        setIsLive(true);

        // Check local storage to see if this user was the one broadcasting
        const djState = localStorage.getItem(STORAGE_KEYS.DJ_BROADCASTING_STATE);
        if (djState) {
          const parsed = JSON.parse(djState);
          // If local state shows this user was broadcasting and the broadcast matches
          if (parsed.isLive && parsed.currentBroadcast?.id === activeBroadcast.id) {
            console.log('Restoring DJ streaming connection for active broadcast');

            // Reconnect DJ WebSocket for streaming
            connectDJWebSocket();

            // Note: MediaRecorder cannot be restored automatically after page refresh
            // due to browser security - microphone access requires user interaction
            // The DJ will need to manually start streaming again by clicking the start button
            console.log('MediaRecorder requires manual restart due to browser security');
          } else {
            console.log('Active broadcast found but this user was not the broadcaster');
            // This user is viewing someone else's active broadcast
            setWebsocketConnected(false);
          }
        } else {
          console.log('No local DJ state found, user is viewing active broadcast');
          setWebsocketConnected(false);
        }
      } else {
        console.log('No active broadcast found on server');
        // No active broadcast on server, clear local state
        setIsLive(false);
        setCurrentBroadcast(null);
        setWebsocketConnected(false);
        localStorage.removeItem(STORAGE_KEYS.DJ_BROADCASTING_STATE);
        localStorage.removeItem(STORAGE_KEYS.CURRENT_BROADCAST);
      }
    } catch (error) {
      console.error('Error checking DJ state:', error);
      // Clear potentially stale state
      setIsLive(false);
      setCurrentBroadcast(null);
      setWebsocketConnected(false);
      localStorage.removeItem(STORAGE_KEYS.DJ_BROADCASTING_STATE);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_BROADCAST);
    }
  };

  // Check and restore listener state
  const checkAndRestoreListenerState = async () => {
    try {
      const listenerState = localStorage.getItem(STORAGE_KEYS.LISTENER_STATE);
      if (listenerState) {
        const parsed = JSON.parse(listenerState);

        // Only restore listening state if it was recently active (within 1 hour)
        const oneHour = 60 * 60 * 1000;
        if (parsed.timestamp && (Date.now() - parsed.timestamp) < oneHour) {
          if (parsed.isListening) {
            // Restore listening state
            connectListenerWebSocket();

            if (parsed.audioPlaying && serverConfig?.streamUrl) {
              // Attempt to restore audio playback
              setTimeout(() => {
                restoreAudioPlayback();
              }, 1000);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error restoring listener state:', error);
    }
  };

  // Restore audio playback
  const restoreAudioPlayback = () => {
    if (!audioRef.current && serverConfig?.streamUrl) {
      audioRef.current = new Audio();

      // Improve URL handling and add fallback formats
      let streamUrl = serverConfig.streamUrl;

      // Ensure proper protocol
      if (!streamUrl.startsWith('http')) {
        streamUrl = `http://${streamUrl}`;
      }

      // Set CORS mode for external streams
      audioRef.current.crossOrigin = 'anonymous';
      audioRef.current.preload = 'none';
      audioRef.current.src = streamUrl;
      audioRef.current.volume = isMuted ? 0 : volume / 100;

      // Add error handling for format issues
      audioRef.current.addEventListener('error', (e) => {
        console.error('Audio restore error:', e);
        const error = audioRef.current.error;
        if (error && error.code === error.MEDIA_ERR_SRC_NOT_SUPPORTED && streamUrl.includes('.ogg')) {
          console.log('OGG format not supported during restore, trying fallback...');
          const fallbackUrl = streamUrl.replace('.ogg', '');
          audioRef.current.src = fallbackUrl;
          audioRef.current.load();
        }
      });

      audioRef.current.play().then(() => {
        setAudioPlaying(true);
        console.log('Audio playback restored successfully');
      }).catch(error => {
        console.log('Could not auto-restore audio playback (user interaction required):', error);
        setAudioPlaying(false);

        // Try fallback format if it's a format issue
        if (error.name === 'NotSupportedError' && streamUrl.includes('.ogg')) {
          console.log('Trying fallback format for restoration...');
          const fallbackUrl = streamUrl.replace('.ogg', '');
          audioRef.current.src = fallbackUrl;
          audioRef.current.load();
        }
      });
    }
  };

  // Connect DJ WebSocket for streaming
  const connectDJWebSocket = useCallback(() => {
    // Prevent duplicate connections - use better check for connection state
    if (djWebSocketRef.current) {
      // Check if the connection is already established or in process
      if (djWebSocketRef.current.readyState === WebSocket.CONNECTING || 
          djWebSocketRef.current.readyState === WebSocket.OPEN) {
        console.log('DJ WebSocket connection already exists, not creating a new one');
        return;
      } else if (djWebSocketRef.current.readyState !== WebSocket.CLOSED) {
        // If the connection is closing but not fully closed, wait for it
        console.log('DJ WebSocket is in the process of closing, waiting to reconnect');
        setTimeout(() => connectDJWebSocket(), 500);
        return;
      }
    }

    try {
      // Use the getWebSocketUrl function to get the proper WebSocket URL
      const wsUrl = getWebSocketUrl('live');

      console.log('Connecting DJ WebSocket:', wsUrl);

      // Before creating a new connection, ensure old one is properly cleaned up
      if (djWebSocketRef.current) {
        try {
          djWebSocketRef.current.onclose = null; // Remove old handlers
          djWebSocketRef.current.onerror = null;
          djWebSocketRef.current.close();
        } catch (e) {
          console.warn('Error cleaning up old WebSocket:', e);
        }
      }

      const websocket = new WebSocket(wsUrl);
      websocket.binaryType = "arraybuffer";
      djWebSocketRef.current = websocket;

      websocket.onopen = () => {
        console.log('DJ WebSocket connected successfully');
        setWebsocketConnected(true);

        if (djReconnectTimerRef.current) {
          clearTimeout(djReconnectTimerRef.current);
          djReconnectTimerRef.current = null;
        }

        // If we have an existing MediaRecorder that was recording (after reconnection),
        // we need to re-establish the data flow to the new WebSocket connection
        if (mediaRecorderRef.current && audioStreamRef.current && isLive) {
          console.log('Reconnecting existing MediaRecorder to new WebSocket connection');

          // Check if MediaRecorder is still recording
          if (mediaRecorderRef.current.state === 'recording') {
            console.log('MediaRecorder is still recording, re-establishing data flow');

            // Helper function to safely send audio data through WebSocket
            const safelySendAudioData = (buffer) => {
              if (djWebSocketRef.current && 
                  djWebSocketRef.current.readyState === WebSocket.OPEN) {
                try {
                  djWebSocketRef.current.send(buffer);
                  console.log('Audio data sent through reconnected WebSocket, size:', buffer.byteLength);
                  return true;
                } catch (error) {
                  console.error('Error sending audio data through reconnected WebSocket:', error);
                  return false;
                }
              }
              return false;
            };

            // Re-establish the ondataavailable handler for the new WebSocket
            mediaRecorderRef.current.ondataavailable = (event) => {
              if (event.data.size > 0 && djWebSocketRef.current && djWebSocketRef.current.readyState === WebSocket.OPEN) {
                event.data.arrayBuffer().then(buffer => {
                  safelySendAudioData(buffer);
                }).catch(error => {
                  console.error('Error processing audio data:', error);
                });
              }
            };

            // The MediaRecorder is already running, so we don't need to restart it
            console.log('MediaRecorder reconnected successfully to new WebSocket');
          } else if (mediaRecorderRef.current.state === 'inactive' && audioStreamRef.current.active) {
            console.log('MediaRecorder was stopped, restarting for reconnected WebSocket');

            // Helper function to safely send audio data through WebSocket
            const safelySendAudioDataRestart = (buffer) => {
              if (djWebSocketRef.current && 
                  djWebSocketRef.current.readyState === WebSocket.OPEN) {
                try {
                  djWebSocketRef.current.send(buffer);
                  console.log('Audio data sent through restarted WebSocket, size:', buffer.byteLength);
                  return true;
                } catch (error) {
                  console.error('Error sending audio data through restarted WebSocket:', error);
                  return false;
                }
              }
              return false;
            };

            // Set up the data handler first
            mediaRecorderRef.current.ondataavailable = (event) => {
              if (event.data.size > 0 && djWebSocketRef.current && djWebSocketRef.current.readyState === WebSocket.OPEN) {
                event.data.arrayBuffer().then(buffer => {
                  safelySendAudioDataRestart(buffer);
                }).catch(error => {
                  console.error('Error processing audio data:', error);
                });
              }
            };

            // Restart the MediaRecorder
            try {
              mediaRecorderRef.current.start(500);
              console.log('MediaRecorder restarted successfully');
            } catch (error) {
              console.error('Failed to restart MediaRecorder:', error);
            }
          } else if (!audioStreamRef.current.active) {
            console.warn('Audio stream is no longer active, cannot reconnect MediaRecorder');
          }
        } else if (isLive && !mediaRecorderRef.current) {
          console.log('WebSocket reconnected but no MediaRecorder found. This may require manual intervention.');
        }
      };

      websocket.onerror = (error) => {
        console.error('DJ WebSocket error:', error);
        setWebsocketConnected(false);
      };

      websocket.onclose = (event) => {
        console.log('DJ WebSocket disconnected:', event.code, event.reason);
        setWebsocketConnected(false);

        // Clear MediaRecorder handler to prevent errors after WebSocket is closed
        if (mediaRecorderRef.current && mediaRecorderRef.current.ondataavailable) {
          console.log('Clearing MediaRecorder handler due to WebSocket disconnect');
          mediaRecorderRef.current.ondataavailable = null;
        }

        // Don't null out the ref until we're ready to replace it
        // This helps prevent race conditions
        if (djWebSocketRef.current === websocket) {
          djWebSocketRef.current = null;
        }

        // Only auto-reconnect if this was an unexpected disconnect and we should still be live
        if (isLive && event.code !== 1000 && event.code !== 1001) {
          // Add random jitter to prevent all clients reconnecting simultaneously
          const jitter = Math.floor(Math.random() * 1000);
          const reconnectDelay = 3000 + jitter;

          console.log(`Scheduling DJ WebSocket reconnection in ${reconnectDelay}ms`);

          djReconnectTimerRef.current = setTimeout(() => {
            if (isLive) {
              console.log('Attempting DJ WebSocket reconnection...');
              connectDJWebSocket();
            }
          }, reconnectDelay);
        }
      };
    } catch (error) {
      console.error('Error creating DJ WebSocket:', error);
      setWebsocketConnected(false);
    }
  }, [isLive]);

  // Connect listener WebSocket for status updates
  const connectListenerWebSocket = useCallback(() => {
    // Prevent duplicate connections with better connection state checks
    if (listenerWebSocketRef.current) {
      // Check if the connection is already established or in process
      if (listenerWebSocketRef.current.readyState === WebSocket.CONNECTING || 
          listenerWebSocketRef.current.readyState === WebSocket.OPEN) {
        console.log('Listener WebSocket connection already exists, not creating a new one');
        return;
      } else if (listenerWebSocketRef.current.readyState !== WebSocket.CLOSED) {
        // If the connection is closing but not fully closed, wait for it
        console.log('Listener WebSocket is in the process of closing, waiting to reconnect');
        setTimeout(() => connectListenerWebSocket(), 500);
        return;
      }
    }

    try {
      // Use the getWebSocketUrl function to get the proper WebSocket URL
      const wsUrl = getWebSocketUrl('listener');

      console.log('Connecting Listener WebSocket:', wsUrl);

      // Before creating a new connection, ensure old one is properly cleaned up
      if (listenerWebSocketRef.current) {
        try {
          listenerWebSocketRef.current.onclose = null; // Remove old handlers
          listenerWebSocketRef.current.onerror = null;
          listenerWebSocketRef.current.close();
        } catch (e) {
          console.warn('Error cleaning up old Listener WebSocket:', e);
        }
      }

      const websocket = new WebSocket(wsUrl);
      listenerWebSocketRef.current = websocket;

      websocket.onopen = () => {
        console.log('Listener WebSocket connected successfully');
        setIsListening(true);

        if (listenerReconnectTimerRef.current) {
          clearTimeout(listenerReconnectTimerRef.current);
          listenerReconnectTimerRef.current = null;
        }
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'STREAM_STATUS') {
            console.log('Stream status update received via Listener WebSocket:', data);
            setListenerCount(data.listenerCount || 0);

            // Update broadcast status for listeners
            if (data.isLive !== undefined) {
              setIsLive(data.isLive);
            }
          }
        } catch (error) {
          console.error('Error parsing listener WebSocket message:', error);
        }
      };

      websocket.onerror = (error) => {
        console.error('Listener WebSocket error:', error);
      };

      websocket.onclose = (event) => {
        console.log('Listener WebSocket disconnected:', event.code, event.reason);

        // Don't null out the ref until we're ready to replace it
        // This helps prevent race conditions
        if (listenerWebSocketRef.current === websocket) {
          listenerWebSocketRef.current = null;
        }

        setIsListening(false);

        // Only auto-reconnect if not a clean close and connection wasn't replaced
        if (event.code !== 1000 && event.code !== 1001) {
          // Add random jitter to prevent all clients reconnecting simultaneously
          const jitter = Math.floor(Math.random() * 1000);
          const reconnectDelay = 3000 + jitter;

          console.log(`Scheduling Listener WebSocket reconnection in ${reconnectDelay}ms`);

          listenerReconnectTimerRef.current = setTimeout(() => {
            console.log('Attempting Listener WebSocket reconnection...');
            connectListenerWebSocket();
          }, reconnectDelay);
        }
      };
    } catch (error) {
      console.error('Error creating Listener WebSocket:', error);
    }
  }, []);

  // Connect status WebSocket (used by both DJs and listeners)
  const connectStatusWebSocket = useCallback(() => {
    // Prevent duplicate connections with better connection state checks
    if (statusWebSocketRef.current) {
      // Check if the connection is already established or in process
      if (statusWebSocketRef.current.readyState === WebSocket.CONNECTING || 
          statusWebSocketRef.current.readyState === WebSocket.OPEN) {
        console.log('Status WebSocket connection already exists, not creating a new one');
        return;
      } else if (statusWebSocketRef.current.readyState !== WebSocket.CLOSED) {
        // If the connection is closing but not fully closed, wait for it
        console.log('Status WebSocket is in the process of closing, waiting to reconnect');
        setTimeout(() => connectStatusWebSocket(), 500);
        return;
      }
    }

    try {
      // Use the getWebSocketUrl function to get the proper WebSocket URL
      const wsUrl = getWebSocketUrl('listener');

      console.log('Connecting Status WebSocket:', wsUrl);

      // Before creating a new connection, ensure old one is properly cleaned up
      if (statusWebSocketRef.current) {
        try {
          statusWebSocketRef.current.onclose = null; // Remove old handlers
          statusWebSocketRef.current.onerror = null;
          statusWebSocketRef.current.close();
        } catch (e) {
          console.warn('Error cleaning up old Status WebSocket:', e);
        }
      }

      const websocket = new WebSocket(wsUrl);
      statusWebSocketRef.current = websocket;

      websocket.onopen = () => {
        console.log('Status WebSocket connected successfully');

        if (statusReconnectTimerRef.current) {
          clearTimeout(statusReconnectTimerRef.current);
          statusReconnectTimerRef.current = null;
        }
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'STREAM_STATUS') {
            console.log('Stream status update received via Status WebSocket:', data);
            setListenerCount(data.listenerCount || 0);

            // Update live status if provided
            if (data.isLive !== undefined) {
              setIsLive(data.isLive);
            }
          }
        } catch (error) {
          console.error('Error parsing status WebSocket message:', error);
        }
      };

      websocket.onerror = (error) => {
        console.error('Status WebSocket error:', error);
      };

      websocket.onclose = (event) => {
        console.log('Status WebSocket disconnected:', event.code, event.reason);

        // Don't null out the ref until we're ready to replace it
        // This helps prevent race conditions
        if (statusWebSocketRef.current === websocket) {
          statusWebSocketRef.current = null;
        }

        // Only auto-reconnect if not a clean close and connection wasn't replaced
        if (event.code !== 1000 && event.code !== 1001) {
          // Add random jitter to prevent all clients reconnecting simultaneously
          const jitter = Math.floor(Math.random() * 1000);
          const reconnectDelay = 5000 + jitter;

          console.log(`Scheduling Status WebSocket reconnection in ${reconnectDelay}ms`);

          statusReconnectTimerRef.current = setTimeout(() => {
            console.log('Attempting Status WebSocket reconnection...');
            connectStatusWebSocket();
          }, reconnectDelay);
        }
      };
    } catch (error) {
      console.error('Error creating Status WebSocket:', error);
    }
  }, []);

  // Start broadcasting (for DJs)
  const startBroadcast = async (broadcastData) => {
    try {
      console.log('Starting broadcast with data:', broadcastData);

      // Ensure scheduledStart and scheduledEnd are included
      const broadcastDataWithSchedule = { ...broadcastData };

      // If scheduledStart or scheduledEnd are not provided, generate them
      if (!broadcastDataWithSchedule.scheduledStart || !broadcastDataWithSchedule.scheduledEnd) {
        const now = new Date();
        // Add 30 seconds buffer to account for network latency and processing time
        const bufferedStart = new Date(now.getTime() + 30 * 1000);
        const endTime = new Date(bufferedStart.getTime() + 2 * 60 * 60 * 1000); // Default 2 hours duration

        // Format dates as ISO strings
        const formatLocalTimeAsISO = (date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

          return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
        };

        if (!broadcastDataWithSchedule.scheduledStart) {
          broadcastDataWithSchedule.scheduledStart = formatLocalTimeAsISO(bufferedStart);
        }

        if (!broadcastDataWithSchedule.scheduledEnd) {
          broadcastDataWithSchedule.scheduledEnd = formatLocalTimeAsISO(endTime);
        }

        console.log('Added schedule to broadcast data:', {
          scheduledStart: broadcastDataWithSchedule.scheduledStart,
          scheduledEnd: broadcastDataWithSchedule.scheduledEnd
        });
      }

      // Create broadcast on server
      const response = await broadcastService.create(broadcastDataWithSchedule);
      const createdBroadcast = response.data;
      setCurrentBroadcast(createdBroadcast);

      // Start the broadcast
      await broadcastService.start(createdBroadcast.id);

      // Get audio stream based on selected source
      const stream = await getAudioStream();

      audioStreamRef.current = stream;

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 96000 // Lower bitrate for better compatibility
      });

      mediaRecorderRef.current = mediaRecorder;

      // Connect WebSocket
      connectDJWebSocket();

      // Set up MediaRecorder when WebSocket connects
      const setupRecording = () => {
        if (djWebSocketRef.current && djWebSocketRef.current.readyState === WebSocket.OPEN) {
          
          // Helper function to safely send audio data through WebSocket
          const safelySendAudioData = (buffer) => {
            if (djWebSocketRef.current && 
                djWebSocketRef.current.readyState === WebSocket.OPEN) {
              try {
                djWebSocketRef.current.send(buffer);
                return true;
              } catch (error) {
                console.error('Error sending audio data through WebSocket:', error);
                return false;
              }
            }
            return false;
          };

          let lastChunkTime = Date.now();
          let chunkCount = 0;

          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0 && djWebSocketRef.current && djWebSocketRef.current.readyState === WebSocket.OPEN) {
              const currentTime = Date.now();
              const timeSinceLastChunk = currentTime - lastChunkTime;
              chunkCount++;

              // Log timing info every 10th chunk to track regularity
              if (chunkCount % 10 === 0) {
                console.log(`🎵 Audio chunk #${chunkCount}: ${event.data.size} bytes, ${timeSinceLastChunk}ms since last chunk`);
              }

              lastChunkTime = currentTime;

              event.data.arrayBuffer().then(buffer => {
                safelySendAudioData(buffer);
              }).catch(error => {
                console.error('Error processing audio data:', error);
              });
            }
          };

          mediaRecorder.start(500);
          setIsLive(true);
          console.log('Broadcasting started successfully');
        } else {
          // Wait for WebSocket to connect
          setTimeout(setupRecording, 100);
        }
      };

      setupRecording();

      return createdBroadcast;
    } catch (error) {
      console.error('Error starting broadcast:', error);
      throw error;
    }
  };

  // Stop broadcasting (for DJs)
  const stopBroadcast = async () => {
    try {
      console.log('Stopping broadcast');

      // Stop audio level monitoring
      stopAudioLevelMonitoring();

      // End broadcast on server
      if (currentBroadcast) {
        await broadcastService.end(currentBroadcast.id);
      }

      // Stop MediaRecorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }

      // Close DJ WebSocket
      if (djWebSocketRef.current) {
        djWebSocketRef.current.close(1000, 'Broadcast ended');
        djWebSocketRef.current = null;
      }

      // Close audio context
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }

      // Stop audio stream
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }

      // Stop desktop stream if it exists
      if (desktopStreamRef.current) {
        desktopStreamRef.current.getTracks().forEach(track => track.stop());
        desktopStreamRef.current = null;
      }

      // Clear audio processing references
      analyserRef.current = null;
      noiseGateRef.current = null;
      gainNodeRef.current = null;

      // Clear reconnection timer
      if (djReconnectTimerRef.current) {
        clearTimeout(djReconnectTimerRef.current);
        djReconnectTimerRef.current = null;
      }

      // Reset state
      setIsLive(false);
      setWebsocketConnected(false);
      setCurrentBroadcast(null);
      setListenerCount(0);
      setAudioLevel(0);

      // Clear persisted state
      localStorage.removeItem(STORAGE_KEYS.DJ_BROADCASTING_STATE);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_BROADCAST);

      console.log('Broadcast stopped successfully');
    } catch (error) {
      console.error('Error stopping broadcast:', error);
    }
  };

  // Start listening (for listeners)
  const startListening = async () => {
    if (isListening || !serverConfig?.streamUrl) return;

    logger.info('Attempting to start listening...');
    setIsListening(true);
    setAudioPlaying(true); // Optimistically set to true

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = 'anonymous';
      audioRef.current.preload = 'auto';
    }

    try {
      const streamUrl = `${serverConfig.streamUrl}?_=${Date.now()}`;
      audioRef.current.src = streamUrl;
      await audioRef.current.play();
      logger.info('Audio playback started successfully.');
      connectListenerWebSocket();
      await refreshStreamStatus();
    } catch (error) {
      logger.error('Failed to start audio playback:', error);
      setIsListening(false);
      setAudioPlaying(false);
    }
  };

  // Stop listening (for listeners)
  const stopListening = () => {
    if (!isListening) return;

    logger.info('Attempting to stop listening...');
    setIsListening(false);
    setAudioPlaying(false);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }

    disconnectListenerWebSocket();
    refreshStreamStatus();
  };

  // Toggle audio playback for listeners
  const toggleAudio = () => {
    if (audioPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setAudioPlaying(false);
      if (listenerWebSocketRef.current && listenerWebSocketRef.current.readyState === WebSocket.OPEN) {
        listenerWebSocketRef.current.send(JSON.stringify({ type: 'LISTENER_STATUS', action: 'STOP_LISTENING' }));
      }
    } else {
      if (audioRef.current) {
        audioRef.current.play().catch(e => logger.error("Error resuming playback:", e));
      }
      setAudioPlaying(true);
      if (listenerWebSocketRef.current && listenerWebSocketRef.current.readyState === WebSocket.OPEN) {
        listenerWebSocketRef.current.send(JSON.stringify({ type: 'LISTENER_STATUS', action: 'START_LISTENING' }));
      }
    }
  };

  // Update volume
  const updateVolume = (newVolume) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : newVolume / 100;
    }
  };

  // Toggle mute
  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (audioRef.current) {
      audioRef.current.volume = newMuted ? 0 : volume / 100;
    }
  };

  // Disconnect all WebSockets
  const disconnectAll = () => {
    console.log('Disconnecting all WebSocket connections');

    // Helper function to safely close a WebSocket connection
    const safelyCloseWebSocket = (wsRef, name) => {
      if (wsRef && wsRef.current) {
        try {
          console.log(`Closing ${name} WebSocket connection`);
          // Remove event handlers first to prevent reconnection attempts
          wsRef.current.onclose = null;
          wsRef.current.onerror = null;
          wsRef.current.onmessage = null;
          wsRef.current.onopen = null;

          // Check if connection is already closed
          if (wsRef.current.readyState !== WebSocket.CLOSED && 
              wsRef.current.readyState !== WebSocket.CLOSING) {
            wsRef.current.close(1000, 'User initiated disconnect');
          }
        } catch (error) {
          console.error(`Error closing ${name} WebSocket:`, error);
        } finally {
          wsRef.current = null;
        }
      }
    };

    // Safely close all WebSocket connections
    safelyCloseWebSocket(djWebSocketRef, 'DJ');
    safelyCloseWebSocket(listenerWebSocketRef, 'Listener');
    safelyCloseWebSocket(statusWebSocketRef, 'Status');

    // Clear timers
    [djReconnectTimerRef, listenerReconnectTimerRef, statusReconnectTimerRef].forEach(timer => {
      if (timer.current) {
        console.log('Clearing reconnect timer');
        clearTimeout(timer.current);
        timer.current = null;
      }
    });

    // Stop audio
    if (audioRef.current) {
      try {
        console.log('Stopping audio playback');
        audioRef.current.pause();
        audioRef.current.src = '';
      } catch (error) {
        console.error('Error stopping audio playback:', error);
      }
    }

    // Stop media streams
    if (audioStreamRef.current) {
      try {
        console.log('Stopping audio stream');
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      } catch (error) {
        console.error('Error stopping audio stream:', error);
      }
    }

    // Stop desktop stream if it exists
    if (desktopStreamRef.current) {
      try {
        console.log('Stopping desktop stream');
        desktopStreamRef.current.getTracks().forEach(track => track.stop());
        desktopStreamRef.current = null;
      } catch (error) {
        console.error('Error stopping desktop stream:', error);
      }
    }

    // Reset state
    setWebsocketConnected(false);
    setIsListening(false);
    setAudioPlaying(false);
    console.log('All connections closed and state reset');
  };

  // Get streaming URLs
  const getStreamUrl = () => serverConfig?.streamUrl;
  const getWebSocketUrl = (type = 'listener') => {
    const wsBaseUrl = config.wsBaseUrl;
    return `${wsBaseUrl}/ws/${type}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectAll();
    };
  }, []);

  // Add page visibility handling to prevent disconnections when tab becomes inactive
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Page became hidden, maintaining WebSocket connections...');
        // Don't disconnect WebSockets when page becomes hidden
        // Just log the state change
      } else {
        console.log('Page became visible, checking connection status...');
        // When page becomes visible again, check if we need to reconnect
        if (isAuthenticated && currentUser) {
          if (currentUser.role === 'DJ' || currentUser.role === 'ADMIN') {
            // Check if DJ should still be connected
            if (isLive && !websocketConnected) {
              console.log('Reconnecting DJ WebSocket after page visibility change');
              connectDJWebSocket();
            }
          }
          // Always ensure status WebSocket is connected
          if (!statusWebSocketRef.current || statusWebSocketRef.current.readyState !== WebSocket.OPEN) {
            console.log('Reconnecting status WebSocket after page visibility change');
            connectStatusWebSocket();
          }
        }
      }
    };

    const handleBeforeUnload = (event) => {
      // Only show warning if actively broadcasting
      if (isLive && websocketConnected) {
        const message = 'You are currently broadcasting. Leaving this page will end your broadcast. Are you sure you want to leave?';
        event.preventDefault();
        event.returnValue = message;
        return message;
      }
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isAuthenticated, currentUser, isLive, websocketConnected]);

  // Function to create noise gate and audio processing pipeline
  const createAudioProcessingPipeline = (inputStream, audioContext) => {
    try {
      console.log('🎛️ Creating audio processing pipeline...');
      
      // Create audio processing nodes
      const source = audioContext.createMediaStreamSource(inputStream);
      const analyser = audioContext.createAnalyser();
      const micBoostNode = audioContext.createGain(); // NEW: Microphone boost stage
      const noiseGate = audioContext.createGain();
      const masterGain = audioContext.createGain();
      const destination = audioContext.createMediaStreamDestination();

      // Configure analyser for audio level monitoring
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      // Store references
      analyserRef.current = analyser;
      noiseGateRef.current = noiseGate;
      gainNodeRef.current = masterGain;
      microphoneBoostRef.current = micBoostNode; // Store microphone boost reference

      // Set initial values with microphone boost
      micBoostNode.gain.value = microphoneBoost; // Use state value
      noiseGate.gain.value = 1.0; // Will be controlled by noise gate logic  
      masterGain.gain.value = isDJMuted ? 0.0 : djAudioGain;
      
      console.log('🎛️ Audio pipeline initial settings:', {
        microphoneBoost: micBoostNode.gain.value,
        noiseGateValue: noiseGate.gain.value,
        masterGainValue: masterGain.gain.value,
        isDJMuted,
        djAudioGain,
        noiseGateEnabled,
        noiseGateThreshold
      });

      // Connect audio pipeline: Source -> Analyser -> MicBoost -> NoiseGate -> MasterGain -> Destination
      source.connect(analyser);
      analyser.connect(micBoostNode);
      micBoostNode.connect(noiseGate);
      noiseGate.connect(masterGain);
      masterGain.connect(destination);

      // Start audio level monitoring and noise gate
      startAudioLevelMonitoring();

      console.log('✅ Audio processing pipeline created with microphone boost and noise gate');
      return destination.stream;
    } catch (error) {
      console.error('❌ Error creating audio processing pipeline:', error);
      throw error;
    }
  };

  // Simplified audio processing pipeline to avoid timing issues  
  const createSimplifiedAudioProcessingPipeline = (inputStream, audioContext) => {
    try {
      console.log('🎛️ Creating simplified audio processing pipeline...');
      
      // Create minimal processing nodes to avoid timing issues
      const source = audioContext.createMediaStreamSource(inputStream);
      const analyser = audioContext.createAnalyser();
      const micBoostNode = audioContext.createGain();
      const masterGain = audioContext.createGain();
      const destination = audioContext.createMediaStreamDestination();

      // Configure analyser with less aggressive settings
      analyser.fftSize = 128; // Smaller FFT to reduce processing overhead
      analyser.smoothingTimeConstant = 0.9; // More smoothing

      // Store references
      analyserRef.current = analyser;
      gainNodeRef.current = masterGain;
      microphoneBoostRef.current = micBoostNode;
      noiseGateRef.current = null; // Disable noise gate temporarily to avoid timing issues

      // Set initial values - simplified gain staging
      micBoostNode.gain.value = microphoneBoost; // Apply microphone boost
      masterGain.gain.value = isDJMuted ? 0.0 : djAudioGain;
      
      console.log('🎛️ Simplified audio pipeline settings:', {
        microphoneBoost: micBoostNode.gain.value,
        masterGainValue: masterGain.gain.value,
        isDJMuted,
        djAudioGain,
        noiseGateEnabled: false // Disabled to prevent timing issues
      });

      // Connect simplified pipeline: Source -> Analyser -> MicBoost -> MasterGain -> Destination
      source.connect(analyser);
      analyser.connect(micBoostNode);
      micBoostNode.connect(masterGain);
      masterGain.connect(destination);

      // DEBUG: Test each stage of the pipeline
      console.log('🔧 Testing audio pipeline stages...');
      
      // Test raw source audio levels
      const sourceAnalyser = audioContext.createAnalyser();
      sourceAnalyser.fftSize = 256;
      source.connect(sourceAnalyser);
      
      // Test final destination audio levels  
      const destAnalyser = audioContext.createAnalyser();
      destAnalyser.fftSize = 256;
      masterGain.connect(destAnalyser);
      
      // Monitor both for 3 seconds
      let debugCount = 0;
      const debugInterval = setInterval(() => {
        const sourceData = new Uint8Array(sourceAnalyser.frequencyBinCount);
        const destData = new Uint8Array(destAnalyser.frequencyBinCount);
        
        sourceAnalyser.getByteFrequencyData(sourceData);
        destAnalyser.getByteFrequencyData(destData);
        
        const sourceRMS = Math.sqrt(sourceData.reduce((sum, val) => sum + val*val, 0) / sourceData.length);
        const destRMS = Math.sqrt(destData.reduce((sum, val) => sum + val*val, 0) / destData.length);
        
        console.log(`🔧 Pipeline debug ${debugCount}: Source RMS=${sourceRMS.toFixed(2)}, Dest RMS=${destRMS.toFixed(2)}, Boost=${micBoostNode.gain.value}x, Master=${masterGain.gain.value}`);
        
        debugCount++;
        if (debugCount >= 30) { // 3 seconds
          clearInterval(debugInterval);
          console.log('🔧 Pipeline debugging complete');
        }
      }, 100);

      // Start simplified audio level monitoring
      startSimplifiedAudioLevelMonitoring();

      console.log('✅ Simplified audio processing pipeline created without noise gate');
      return destination.stream;
    } catch (error) {
      console.error('❌ Error creating simplified audio processing pipeline:', error);
      throw error;
    }
  };

  // Minimal processing for fallback streams - just basic volume control
  const createFallbackAudioProcessingPipeline = (inputStream) => {
    try {
      console.log('🎛️ Creating fallback audio processing pipeline...');
      
      // Create minimal audio context for basic processing
      const audioContext = new AudioContext({
        sampleRate: inputStream.getAudioTracks()[0].getSettings().sampleRate || 44100,
        latencyHint: 'interactive'
      });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(inputStream);
      const micBoostNode = audioContext.createGain();
      const destination = audioContext.createMediaStreamDestination();

      // Store essential references
      microphoneBoostRef.current = micBoostNode;
      gainNodeRef.current = micBoostNode; // Use boost as master gain for simplicity

      // Apply basic microphone boost
      micBoostNode.gain.value = microphoneBoost * (isDJMuted ? 0.0 : djAudioGain);
      
      console.log('🎛️ Fallback audio pipeline settings:', {
        microphoneBoost: microphoneBoost,
        isDJMuted,
        djAudioGain,
        totalGain: micBoostNode.gain.value
      });

      // Simple connection: Source -> MicBoost -> Destination
      source.connect(micBoostNode);
      micBoostNode.connect(destination);

      console.log('✅ Fallback audio processing pipeline created with minimal processing');
      return destination.stream;
    } catch (error) {
      console.error('❌ Error creating fallback audio processing pipeline:', error);
      // Return original stream if processing fails
      return inputStream;
    }
  };

  // Audio level monitoring and noise gate logic
  const startAudioLevelMonitoring = () => {
    if (!analyserRef.current || audioLevelIntervalRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    const HOLD_TIME_MS = 500; // Hold gate open for 500ms after sound drops below threshold

    console.log('🎵 Starting audio level monitoring with noise gate:', {
      noiseGateEnabled,
      noiseGateThreshold,
      holdTimeMs: HOLD_TIME_MS
    });

    audioLevelIntervalRef.current = setInterval(() => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArray);

      // Calculate RMS (Root Mean Square) for audio level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);

      // Convert to dB scale (0-255 -> -∞ to 0 dB)
      const dB = rms > 0 ? 20 * Math.log10(rms / 255) : -100;
      setAudioLevel(Math.max(-60, dB)); // Clamp to reasonable range

      // Log audio levels more frequently during initial setup (every 1 second instead of 2)
      if (Date.now() % 1000 < 50) {
        console.log('🎵 Audio levels:', {
          rms: rms.toFixed(2),
          dB: dB.toFixed(1),
          threshold: noiseGateThreshold,
          aboveThreshold: dB >= noiseGateThreshold,
          gateEnabled: noiseGateEnabled,
          micBoostApplied: true
        });
      }

      // Apply noise gate with hold time (only if enabled)
      if (noiseGateEnabled && noiseGateRef.current) {
        const now = Date.now();

        // If audio is above threshold, update the timestamp
        if (dB >= noiseGateThreshold) {
          lastAudioAboveThresholdRef.current = now;
        }

        // Check if we're within the hold time
        const isWithinHoldTime = (now - lastAudioAboveThresholdRef.current) < HOLD_TIME_MS;

        if (dB >= noiseGateThreshold || isWithinHoldTime) {
          // Above threshold or within hold time - keep audio on
          if (noiseGateRef.current.gain.value < 0.9) {
            console.log('🔊 Noise gate OPENING (audio detected)');
          }
          noiseGateRef.current.gain.exponentialRampToValueAtTime(
            1.0,
            audioContextRef.current.currentTime + 0.01
          );
        } else {
          // Below threshold and past hold time - gradually reduce to silence
          if (noiseGateRef.current.gain.value > 0.1) {
            console.log('🔇 Noise gate CLOSING (audio below threshold)');
          }
          noiseGateRef.current.gain.exponentialRampToValueAtTime(
            0.001, // Very small value instead of 0 to prevent Math errors
            audioContextRef.current.currentTime + 0.2 // Slower fade out (200ms)
          );
        }
      } else {
        // Noise gate disabled - ensure full volume
        if (noiseGateRef.current && noiseGateRef.current.gain.value < 0.9) {
          console.log('🔊 Noise gate DISABLED - setting full volume');
          noiseGateRef.current.gain.value = 1.0;
        }
      }
    }, 25); // Faster refresh rate (every 25ms) for more responsive audio level indicator
  };

  // Simplified audio level monitoring without noise gate to avoid timing issues
  const startSimplifiedAudioLevelMonitoring = () => {
    if (!analyserRef.current || audioLevelIntervalRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

    console.log('🎵 Starting simplified audio level monitoring (no noise gate)');

    audioLevelIntervalRef.current = setInterval(() => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArray);

      // Calculate RMS (Root Mean Square) for audio level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);

      // Convert to dB scale (0-255 -> -∞ to 0 dB)
      const dB = rms > 0 ? 20 * Math.log10(rms / 255) : -100;
      setAudioLevel(Math.max(-60, dB)); // Clamp to reasonable range

      // Less frequent logging to reduce console noise
      if (Date.now() % 2000 < 100) {
        console.log('🎵 Audio levels (simplified):', {
          rms: rms.toFixed(2),
          dB: dB.toFixed(1),
          micBoostApplied: microphoneBoostRef.current?.gain.value.toFixed(1) + 'x'
        });
      }
    }, 50); // Slower refresh rate (every 50ms) to reduce processing overhead
  };

  // Stop audio level monitoring
  const stopAudioLevelMonitoring = () => {
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
  };

  const value = {
    // State
    isLive,
    currentBroadcast,
    listenerCount,
    websocketConnected,
    isListening,
    audioPlaying,
    volume,
    isMuted,
    serverConfig,
    audioSource,
    isDJMuted,
    djAudioGain,
    noiseGateEnabled,
    noiseGateThreshold,
    audioLevel,
    microphoneBoost,

    // DJ Functions
    startBroadcast,
    stopBroadcast,
    connectDJWebSocket,
    restoreDJStreaming,

    // Listener Functions  
    startListening,
    stopListening,
    toggleAudio,
    updateVolume,
    toggleMute,
    connectListenerWebSocket,

    // Audio Source Functions
    setAudioSource,
    getAudioStream,
    getDesktopAudioStream,
    getMicrophoneAudioStream,
    mixAudioStreams,

    // DJ Audio Control Functions
    toggleDJMute,
    setDJAudioLevel,
    setMicrophoneBoostLevel,
    switchAudioSourceLive,
    setNoiseGateEnabled,
    setNoiseGateThreshold,

    // Shared Functions
    connectStatusWebSocket,
    disconnectAll,
    getStreamUrl,
    getWebSocketUrl,
    refreshStreamStatus,

    // Refs (for direct access when needed)
    djWebSocketRef,
    listenerWebSocketRef,
    statusWebSocketRef,
    audioRef,
    mediaRecorderRef,
    audioStreamRef,
    desktopStreamRef
  };

  return (
    <StreamingContext.Provider value={value}>
      {children}
    </StreamingContext.Provider>
  );
} 
