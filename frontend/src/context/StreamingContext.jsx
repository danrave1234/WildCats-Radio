import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { broadcastService, streamService } from '../services/api/index.js';
import { useAuth } from './AuthContext';
import { useLocalBackend, config } from '../config';
import { createLogger } from '../services/logger';
import { globalWebSocketService } from '../services/globalWebSocketService';

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
  const [peakListenerCount, setPeakListenerCount] = useState(0);
  const [websocketConnected, setWebsocketConnected] = useState(false);
  const [qualityError, setQualityError] = useState(null);

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
  const djWebSocketRef = useRef(null); // Still needed for MediaRecorder interaction
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioRef = useRef(null);
  const djReconnectTimerRef = useRef(null);

  // Flag to prevent auto-reconnection during pipeline resets
  const pipelineResetInProgressRef = useRef(false);

  // WebSocket message size limits (based on backend configuration)
  const MAX_MESSAGE_SIZE = 60000; // 60KB - safety margin below the 64KB server buffer for low latency

  // Add new audio source state
  const [audioSource, setAudioSource] = useState(() => {
    const saved = localStorage.getItem('wildcats_audio_source');
    return saved || 'desktop'; // Default to 'desktop' for DJ use
  });
  const desktopStreamRef = useRef(null);

  // Audio monitoring for status display
  const [audioLevel, setAudioLevel] = useState(0);
  const audioLevelIntervalRef = useRef(null);
  const analyserRef = useRef(null);

  // Audio source switching control
  const isAudioSourceSwitching = useRef(false);

  // Stream health state (backend recovery-first)
  const [streamHealth, setStreamHealth] = useState({ healthy: false, recovering: false, broadcastLive: false, listenerCount: 0, bitrate: 0, lastCheckedAt: null, errorMessage: null });
  const prevRecoveringRef = useRef(false);

  // Health check polling - FALLBACK ONLY when WebSocket is unavailable
  // Primary health updates come via WebSocket (STREAM_STATUS messages with health data)
  useEffect(() => {
    let cancelled = false;
    let intervalId;
    
    // Check if WebSocket is connected - if so, use it as primary source (no polling needed)
    // Use the state variable that tracks listener status WebSocket connection
    const isWebSocketConnected = globalWebSocketService.isListenerStatusWebSocketConnected();
    
    // Only poll if WebSocket is not available (fallback mode)
    if (isWebSocketConnected) {
      // WebSocket is connected - health updates come via WebSocket, no polling needed
      // Do an initial fetch to get current state, then rely on WebSocket
      const fetchInitialHealth = async () => {
        try {
          const res = await broadcastService.getLiveHealth();
          const data = res?.data || {};
          const healthy = !!data.healthy;
          const recovering = !!data.recovering;
          const broadcastLive = !!data.broadcastLive;
          const listenerCount = typeof data.listenerCount === 'number' ? data.listenerCount : streamHealth.listenerCount;
          const bitrate = typeof data.bitrate === 'number' ? data.bitrate : streamHealth.bitrate;
          const lastCheckedAt = data.lastCheckedAt || null;
          const errorMessage = data.errorMessage || null;

          if (!cancelled) {
            setStreamHealth({ healthy, recovering, broadcastLive, listenerCount, bitrate, lastCheckedAt, errorMessage });
            if (typeof listenerCount === 'number') {
              setListenerCount(listenerCount);
            }
          }
        } catch (e) {
          // Silent fail for initial fetch
        }
      };
      
      fetchInitialHealth();
      return () => { cancelled = true; };
    }
    
    // Fallback: WebSocket not available, use HTTP polling (but less frequently)
    const fetchHealth = async () => {
      try {
        const res = await broadcastService.getLiveHealth();
        const data = res?.data || {};
        const healthy = !!data.healthy;
        const recovering = !!data.recovering;
        const broadcastLive = !!data.broadcastLive;
        const listenerCount = typeof data.listenerCount === 'number' ? data.listenerCount : streamHealth.listenerCount;
        const bitrate = typeof data.bitrate === 'number' ? data.bitrate : streamHealth.bitrate;
        const lastCheckedAt = data.lastCheckedAt || null;
        const errorMessage = data.errorMessage || null;

        if (!cancelled) {
          setStreamHealth({ healthy, recovering, broadcastLive, listenerCount, bitrate, lastCheckedAt, errorMessage });
          // Keep listener count aligned when provided
          if (typeof listenerCount === 'number') {
            setListenerCount(listenerCount);
          }
          // Auto-resume playback when recovering -> healthy
          if (prevRecoveringRef.current && healthy && audioRef.current) {
            audioRef.current.play().catch(() => {});
          }
          prevRecoveringRef.current = recovering && broadcastLive;
        }
      } catch (e) {
        // Do not spam logs; keep previous snapshot
      }
    };

    // When WebSocket is unavailable, poll less frequently (60s) as fallback
    const pollInterval = 60000; // 60 seconds fallback polling

    fetchHealth();
    intervalId = setInterval(fetchHealth, pollInterval);
    
    return () => { 
      cancelled = true; 
      if (intervalId) clearInterval(intervalId);
    };
  }, [serverConfig?.streamUrl, isLive, isListening, streamHealth.broadcastLive, streamHealth.recovering, websocketConnected]);

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

  // Persist audio source changes
  useEffect(() => {
    localStorage.setItem('wildcats_audio_source', audioSource);
  }, [audioSource]);

  // Auto-connect/reconnect depending on authentication
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      if (currentUser.role === 'DJ' || currentUser.role === 'ADMIN') {
        // Check for existing broadcast and connect if needed
        checkAndRestoreDJState();
      } else {
        // Set up listener connections
        checkAndRestoreListenerState();
      }
      // Authenticated users also receive status updates
      connectListenerStatusWebSocket();
      // Also refresh status once immediately
      refreshStreamStatus();
    } else {
      // When unauthenticated, disconnect any DJ or poll connections,
      // but still connect to listener status WS and refresh status so guests can see live state
      disconnectAll();
      connectListenerStatusWebSocket();
      refreshStreamStatus();
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
      let desktopStream;
      try {
        desktopStream = await navigator.mediaDevices.getDisplayMedia({
          // Allow full picker with Entire Screen/Window/Tab options
          preferCurrentTab: false,
          video: {
            displaySurface: 'monitor',
            selfBrowserSurface: 'include',
            surfaceSwitching: 'include',
            frameRate: { max: 1 },
            width: { max: 1 },
            height: { max: 1 }
          },
          audio: {
            // Ask for system audio explicitly where supported (Chrome/Edge)
            systemAudio: 'include',
            suppressLocalAudioPlayback: false,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 48000,
            channelCount: 2
          }
        });
      } catch (e1) {
        // Do not degrade quality by switching to generic fallbacks; surface clear guidance instead
        logger.error('Desktop capture failed with high-quality constraints:', e1?.message || e1);
        throw new Error('Desktop audio capture failed. Please ensure: 1) You are on HTTPS or localhost, 2) You select a source with audio (e.g., a tab with sound or "System Audio"), 3) Use Chrome/Edge for best results.');
      }

      // Check if we got audio tracks
      const audioTracks = desktopStream.getAudioTracks();
      if (audioTracks.length === 0) {
        // Stop any video tracks we don't need
        desktopStream.getVideoTracks().forEach(track => track.stop());
        throw new Error('No audio track found in the selected source. Please select a source that includes audio (like a browser tab with music) or choose "System Audio" in the sharing dialog.');
      }

      // Create a new stream with only the audio track
      const audioOnlyStream = new MediaStream();
      audioTracks.forEach(track => {
        audioOnlyStream.addTrack(track);
        // Lifecycle listeners help detect when the user stops sharing or the system mutes
        track.addEventListener('ended', () => logger.warn('Desktop audio track ended'));
        track.addEventListener('mute', () => logger.warn('Desktop audio track muted'));
        track.addEventListener('unmute', () => logger.debug('Desktop audio track unmuted'));
      });

      // Quality gate: validate track settings if the browser exposes them
      try {
        const settings = typeof audioTracks[0].getSettings === 'function' ? audioTracks[0].getSettings() : {};
        const sr = settings.sampleRate;
        const ch = settings.channelCount;
        if ((typeof sr === 'number' && sr < 44100) || (typeof ch === 'number' && ch < 2)) {
          audioTracks.forEach(t => t.stop());
          desktopStream.getVideoTracks().forEach(t => t.stop());
          throw new Error(`Selected source audio quality too low (${sr || 'unknown'} Hz, ${ch || 'unknown'}ch). Please select a stereo source at 44.1kHz or 48kHz with system/tab audio.`);
        }
      } catch (e) {
        if (e && e.message && e.message.startsWith('Selected source audio quality too low')) {
          throw e;
        }
        // If settings are not available, continue — backend will enforce quality as a safeguard
      }

      // Keep a reference to the original desktop stream for cleanup elsewhere
      desktopStreamRef.current = desktopStream;

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
      console.error('[ERROR] Error getting microphone audio stream:', error);
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

      console.log('[SUCCESS] Diagnostic microphone stream obtained');

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
        console.warn('[WARNING] Raw microphone levels extremely low, trying fallback capture method');
        micStream.getTracks().forEach(track => track.stop());
        return await getFallbackMicrophoneAudioStream();
      }

      console.log(`[SUCCESS] Raw microphone working (max level: ${maxLevel.toFixed(2)}), proceeding with processing`);

      // Step 5: Try direct stream first (no processing) to test Chrome WebRTC issues
      console.log('[INFO] Testing direct stream approach first...');
      try {
        // Test: return the raw stream directly without any processing
        // This will help identify if the issue is in the processing pipeline
        console.log('[WARNING] Using DIRECT STREAM mode (no processing) for testing');

        // Set up basic references for audio level monitoring
        const testContext = new AudioContext({ sampleRate: 48000 });
        const testSource = testContext.createMediaStreamSource(micStream);
        const testAnalyser = testContext.createAnalyser();
        testSource.connect(testAnalyser);

        analyserRef.current = testAnalyser;

        // Start basic monitoring
        startAudioLevelMonitoring();

        console.log('[SUCCESS] Direct stream mode active - no audio processing applied');
        return micStream; // Return raw stream directly

      } catch (directError) {
        console.warn('[WARNING] Direct stream failed, falling back to processing pipeline:', directError);

        // Step 5b: Use direct stream as fallback
        console.log('Using direct microphone stream as fallback');
        const processedStream = micStream;

        // DON'T stop original stream immediately - let processed stream establish first
        setTimeout(() => {
          console.log('[INFO] Stopping original microphone stream after processed stream established');
          micStream.getTracks().forEach(track => track.stop());
        }, 1000);

        console.log('[SUCCESS] Diagnostic microphone pipeline complete');
        return processedStream;
      }

    } catch (error) {
      console.error('[ERROR] Error in diagnostic microphone capture:', error);
      throw error;
    }
  };

  // Fallback microphone audio stream with minimal processing
  const getFallbackMicrophoneAudioStream = async () => {
    try {
      console.log('[INFO] Attempting fallback microphone capture...');

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
          console.log(`[INFO] Trying fallback constraint ${i + 1}:`, constraints[i]);

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

          console.log(`[INFO] Fallback constraint ${i + 1} average level: ${avgLevel.toFixed(2)}`);

          if (avgLevel > 0.5 || i === constraints.length - 1) { // Accept if any audio or last attempt
            console.log(`[SUCCESS] Fallback constraint ${i + 1} accepted, using direct stream`);

            // Return the stream directly without complex processing
            return stream;
          } else {
            stream.getTracks().forEach(track => track.stop());
          }

        } catch (error) {
          console.warn(`[WARNING] Fallback constraint ${i + 1} failed:`, error.message);
        }
      }

      throw new Error('All fallback microphone capture methods failed');
    } catch (error) {
      console.error('[ERROR] Error in fallback microphone capture:', error);
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


      // Create audio sources
      const micSource = audioContext.createMediaStreamSource(micStream);
      const desktopSource = audioContext.createMediaStreamSource(desktopStream);

      // Create gain nodes for volume control
      const micGain = audioContext.createGain();
      const desktopGain = audioContext.createGain();
      const masterGain = audioContext.createGain();



      // Set initial gain levels (can be adjusted)
      micGain.gain.value = 1.0; // 100% microphone volume
      desktopGain.gain.value = 0.8; // 80% desktop volume to prevent overwhelming
      masterGain.gain.value = 1.0; // Full volume since controls are handled by third-party software

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



  // Helper function to validate and prepare audio stream for MediaRecorder
  const validateAndPrepareStream = async (stream, sourceType) => {
    try {
      logger.debug(`Validating ${sourceType} stream for MediaRecorder compatibility...`);

      // Check if stream has active audio tracks
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error(`No audio tracks found in ${sourceType} stream`);
      }

      // Check if tracks are active and ready
      const activeTracks = audioTracks.filter(track => track.readyState === 'live');
      if (activeTracks.length === 0) {
        throw new Error(`No active audio tracks found in ${sourceType} stream`);
      }

      logger.debug(`${sourceType} stream validation: ${activeTracks.length} active tracks found`);

      // Test MediaRecorder compatibility with this stream
      if (!MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        logger.warn('Opus codec not supported, trying webm fallback');
        if (!MediaRecorder.isTypeSupported("audio/webm")) {
          throw new Error('WebM audio recording not supported in this browser');
        }
      }

      // Create a test MediaRecorder to verify stream compatibility
      logger.debug(`Testing MediaRecorder compatibility with ${sourceType} stream...`);
      const testRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") 
          ? "audio/webm;codecs=opus" 
          : "audio/webm",
        audioBitsPerSecond: 96000
      });

      // Wait a brief moment to ensure the stream is fully established
      await new Promise(resolve => setTimeout(resolve, 100));

      // Test that we can actually start recording (but don't actually start)
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`${sourceType} stream validation timeout`));
        }, 2000);

        testRecorder.onstart = () => {
          clearTimeout(timeout);
          testRecorder.stop(); // Immediately stop the test
          logger.debug(`${sourceType} stream validation successful`);
          resolve(stream);
        };

        testRecorder.onerror = (event) => {
          clearTimeout(timeout);
          reject(new Error(`${sourceType} stream validation failed: ${event.error?.message || 'Unknown error'}`));
        };

        testRecorder.onstop = () => {
          // Clean up test recorder
          testRecorder.ondataavailable = null;
          testRecorder.onstart = null;
          testRecorder.onerror = null;
          testRecorder.onstop = null;
        };

        try {
          // Attempt to start test recording
          testRecorder.start();
        } catch (error) {
          clearTimeout(timeout);
          reject(new Error(`${sourceType} stream validation failed: ${error.message}`));
        }
      });

    } catch (error) {
      logger.error(`Stream validation failed for ${sourceType}:`, error);
      throw error;
    }
  };

  // Enhanced function to validate stream just before use (immediate validation)
  const validateStreamBeforeUse = (stream, sourceType) => {
    logger.debug(`Final validation of ${sourceType} stream before MediaRecorder use...`);

    if (!stream) {
      throw new Error(`${sourceType} stream is null or undefined`);
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error(`No audio tracks in ${sourceType} stream`);
    }

    const activeTracks = audioTracks.filter(track => track.readyState === 'live');
    if (activeTracks.length === 0) {
      throw new Error(`Audio stream became inactive before MediaRecorder could start`);
    }

    // Check if any tracks have ended
    const endedTracks = audioTracks.filter(track => track.readyState === 'ended');
    if (endedTracks.length > 0) {
      throw new Error(`Audio tracks have ended - this often happens when screen sharing is cancelled`);
    }

    logger.debug(`${sourceType} stream final validation passed: ${activeTracks.length} active tracks`);
    return true;
  };

  // Enhanced desktop audio stream acquisition with better lifecycle management
  const getDesktopAudioStreamWithLifecycleManagement = async () => {
    try {
      logger.debug('Getting desktop audio stream with enhanced lifecycle management...');

      // Check if getDisplayMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen capture not supported in this browser');
      }

      // Check if we're in a secure context (HTTPS or localhost)
      if (!window.isSecureContext && window.location.protocol !== 'http:') {
        throw new Error('Desktop audio capture requires a secure connection (HTTPS). Please use HTTPS or localhost.');
      }

      // Request desktop stream with enhanced constraints
      let desktopStream;
      try {
        desktopStream = await navigator.mediaDevices.getDisplayMedia({
          preferCurrentTab: false,
          video: {
            displaySurface: 'monitor',
            selfBrowserSurface: 'include',
            surfaceSwitching: 'include',
            frameRate: { max: 1 },
            width: { max: 1 },
            height: { max: 1 }
          },
          audio: {
            systemAudio: 'include',
            suppressLocalAudioPlayback: false,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 48000,
            channelCount: 2
          }
        });
      } catch (e1) {
        // Do not fall back to generic constraints; keep quality strict and inform the user
        logger.error('Desktop capture (lifecycle) failed with high-quality constraints:', e1?.message || e1);
        throw new Error('Desktop audio capture failed with strict settings. Use HTTPS/localhost and select a source with audio (tab with sound or System Audio). Chrome/Edge recommended.');
      }

      // Check if we got audio tracks
      const audioTracks = desktopStream.getAudioTracks();
      if (audioTracks.length === 0) {
        // Stop any video tracks we don't need
        desktopStream.getVideoTracks().forEach(track => track.stop());
        throw new Error('No audio track found in the selected source. Please select a source that includes audio (like a browser tab with music) or choose "System Audio" in the sharing dialog.');
      }

      // Create a new stream with only the audio track
      const audioOnlyStream = new MediaStream();
      audioTracks.forEach(track => {
        audioOnlyStream.addTrack(track);

        // Add lifecycle event listeners to track stream health
        track.addEventListener('ended', () => {
          logger.warn('Desktop audio track ended - user likely stopped screen sharing');
        });

        track.addEventListener('mute', () => {
          logger.warn('Desktop audio track muted');
        });

        track.addEventListener('unmute', () => {
          logger.debug('Desktop audio track unmuted');
        });
      });

      // Quality gate: validate track settings if exposed
      try {
        const settings = typeof audioTracks[0].getSettings === 'function' ? audioTracks[0].getSettings() : {};
        const sr = settings.sampleRate;
        const ch = settings.channelCount;
        if ((typeof sr === 'number' && sr < 44100) || (typeof ch === 'number' && ch < 2)) {
          audioTracks.forEach(t => t.stop());
          desktopStream.getVideoTracks().forEach(t => t.stop());
          throw new Error(`Selected source audio quality too low (${sr || 'unknown'} Hz, ${ch || 'unknown'}ch). Please select a stereo source at 44.1kHz or 48kHz with system/tab audio.`);
        }
      } catch (e) {
        if (e && e.message && e.message.startsWith('Selected source audio quality too low')) {
          throw e;
        }
        // Continue if the browser does not expose settings; backend enforces as a safeguard
      }

      // Stop any video tracks since we only need audio
      desktopStream.getVideoTracks().forEach(track => track.stop());

      // Add stream-level event listeners
      audioOnlyStream.addEventListener('addtrack', () => {
        logger.debug('Track added to desktop audio stream');
      });

      audioOnlyStream.addEventListener('removetrack', () => {
        logger.warn('Track removed from desktop audio stream');
      });

      logger.debug('Desktop audio stream obtained successfully with enhanced lifecycle management');
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


    

  // Enhanced function to get audio stream specifically for switching (with better lifecycle management)
  const getAudioStreamForSwitching = async (source = audioSource) => {
    try {
      console.log('Getting audio stream for switching to source:', source);

      switch (source) {
        case 'microphone':
          return await getMicrophoneAudioStream();

        case 'desktop':
          try {
            // Use the enhanced desktop audio stream function
            const desktopStream = await getDesktopAudioStreamWithLifecycleManagement();
            return desktopStream;
          } catch (error) {
            console.warn('Desktop audio capture failed, falling back to microphone:', error.message);
            
            // Set audio source back to microphone
            setAudioSource('microphone');

            // Throw the original error
            throw error;
          }

        case 'both':
          try {
            const micStream = await getMicrophoneAudioStream();
            const deskStream = await getDesktopAudioStreamWithLifecycleManagement();
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
      console.error('Error getting audio stream for switching:', error);
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
            
            // Set audio source back to microphone
            setAudioSource('microphone');

            // Throw the original error
            throw error;
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
        audioBitsPerSecond: 160000 // Higher quality; still safe for WS chunking
      });

      mediaRecorderRef.current = mediaRecorder;

      // Ensure WebSocket is connected
      if (!globalWebSocketService.isDJWebSocketConnected()) {
        console.log('WebSocket not connected, connecting...');
        connectDJWebSocket();

        // Wait for WebSocket to connect
        return new Promise((resolve) => {
          const checkConnection = () => {
            if (globalWebSocketService.isDJWebSocketConnected()) {
              // Update djWebSocketRef to point to the global service's WebSocket
              djWebSocketRef.current = globalWebSocketService.getDJWebSocket();
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
          return globalWebSocketService.sendDJBinaryData(buffer);
        };

        let lastChunkTime = Date.now();
        let chunkCount = 0;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && globalWebSocketService.isDJWebSocketConnected()) {
            // Check buffer size to prevent WebSocket message too large errors
            if (event.data.size > MAX_MESSAGE_SIZE) {
              console.warn(`Audio chunk too large (${event.data.size} bytes), skipping to prevent WebSocket disconnect`);
              return;
            }

            const currentTime = Date.now();
            const timeSinceLastChunk = currentTime - lastChunkTime;
            chunkCount++;

            // Log timing info every 10th chunk to track regularity
            if (chunkCount % 10 === 0) {
              console.log(`[AUDIO] Audio chunk #${chunkCount}: ${event.data.size} bytes, ${timeSinceLastChunk}ms since last chunk`);
            }

            lastChunkTime = currentTime;

            event.data.arrayBuffer().then(buffer => {
              // Double check buffer size before sending
              if (buffer.byteLength <= MAX_MESSAGE_SIZE) {
              safelySendAudioData(buffer);
              } else {
                console.warn('Skipping oversized buffer to prevent WebSocket disconnect');
              }
            }).catch(error => {
              console.error('Error processing audio data:', error);
            });
          }
        };

        mediaRecorder.start(250); // Smaller intervals to prevent buffer buildup
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
            connectListenerStatusWebSocket();

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
      attachAudioEventHandlers();

      // Improve URL handling and add fallback formats
      let streamUrl = serverConfig.streamUrl;

      // Ensure proper protocol (force HTTPS for listener stream)
      if (!/^https?:\/\//i.test(streamUrl)) {
        streamUrl = `https://${streamUrl}`;
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
    const wsUrl = getWebSocketUrl('live');
    globalWebSocketService.connectDJWebSocket(wsUrl);

    // Register callbacks to update local state
    globalWebSocketService.onDJOpen(() => {
      console.log('DJ WebSocket connected successfully (via global service)');
      setWebsocketConnected(true);

      // Update djWebSocketRef to point to the global service's WebSocket
      djWebSocketRef.current = globalWebSocketService.getDJWebSocket();

      // If we have an existing MediaRecorder that was recording (after reconnection),
      // we need to re-establish the data flow to the new WebSocket connection
      if (mediaRecorderRef.current && audioStreamRef.current && isLive) {
        console.log('Reconnecting existing MediaRecorder to new WebSocket connection');

        // Check if MediaRecorder is still recording
        if (mediaRecorderRef.current.state === 'recording') {
          console.log('MediaRecorder is still recording, re-establishing data flow');

          // Helper function to safely send audio data through WebSocket
          const safelySendAudioData = (buffer) => {
            const success = globalWebSocketService.sendDJBinaryData(buffer);
            if (success) {
              console.log('Audio data sent through reconnected WebSocket, size:', buffer.byteLength);
            } else {
              console.error('Error sending audio data through reconnected WebSocket');
            }
            return success;
          };

          // Re-establish the ondataavailable handler for the new WebSocket
          mediaRecorderRef.current.ondataavailable = (event) => {
            if (event.data.size > 0 && globalWebSocketService.isDJWebSocketConnected()) {
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
            const success = globalWebSocketService.sendDJBinaryData(buffer);
            if (success) {
              console.log('Audio data sent through restarted WebSocket, size:', buffer.byteLength);
            } else {
              console.error('Error sending audio data through restarted WebSocket');
            }
            return success;
          };

          // Set up the data handler first
          mediaRecorderRef.current.ondataavailable = (event) => {
            if (event.data.size > 0 && globalWebSocketService.isDJWebSocketConnected()) {
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
    });

    globalWebSocketService.onDJMessage((event) => {
      // Handle messages from DJ WebSocket (e.g., pong responses)
      if (typeof event.data === 'string' && event.data === 'pong') {
        // Pong handling is now internal to globalWebSocketService
      } else {
        // Process other messages if any
        logger.debug('Received unexpected message:', event.data);
      }
    });

    globalWebSocketService.onDJError((error) => {
      console.error('DJ WebSocket error (via global service):', error);
      setWebsocketConnected(false);
    });

    globalWebSocketService.onDJClose((event) => {
      console.log('DJ WebSocket disconnected (via global service):', event.code, event.reason);
      setWebsocketConnected(false);

      // If backend rejected due to low-quality input, surface a clear, actionable message
      if (event && event.code === 4000) {
        const msg = event.reason || 'Low-quality input audio detected (requires stereo and >= 44.1 kHz). Please select a source with system/tab audio at 44.1/48 kHz and try again.';
        console.warn('Server rejected stream due to quality:', msg);
        setQualityError(msg);
        setIsLive(false);
      }

      // Clear MediaRecorder handler to prevent errors after WebSocket is closed
      if (mediaRecorderRef.current && mediaRecorderRef.current.ondataavailable) {
        console.log('Clearing MediaRecorder handler due to WebSocket disconnect');
        mediaRecorderRef.current.ondataavailable = null;
      }

      // Clear the ref since the global service handles reconnection
      djWebSocketRef.current = null;
    });
  }, [isLive]);

  // Connect listener/status WebSocket
  const connectListenerStatusWebSocket = useCallback(() => {
    // Use the global service to manage the connection
    const wsUrl = getWebSocketUrl('listener'); // Assuming 'listener' endpoint handles both
    globalWebSocketService.connectListenerStatusWebSocket(wsUrl);

    // Register callbacks for messages, errors, and close events
    globalWebSocketService.onListenerStatusMessage((event) => {
      try {
        // Some servers send heartbeat 'pong' strings; ignore non-JSON frames
        if (typeof event.data === 'string' && event.data.trim() === 'pong') {
          return;
        }
        const data = JSON.parse(event.data);
        if (data.type === 'STREAM_STATUS') {
          console.log('Stream status update received via Listener/Status WebSocket:', data);
          setListenerCount(typeof data.listenerCount === 'number' ? data.listenerCount : 0);
          // Update peak from server if present; keep max to avoid regressions on out-of-order messages
          const incomingPeak = typeof data.peakListenerCount === 'number' ? data.peakListenerCount
                            : (typeof data.peakListeners === 'number' ? data.peakListeners : null);
          if (incomingPeak !== null) {
            setPeakListenerCount((prev) => Math.max(prev || 0, incomingPeak));
          }
          if (data.isLive !== undefined) {
            setIsLive(data.isLive);
          }
          
          // Update health status from WebSocket (replaces polling when available)
          if (data.health) {
            const health = data.health;
            const healthy = !!health.healthy;
            const recovering = !!health.recovering;
            const broadcastLive = !!health.broadcastLive;
            const bitrate = typeof health.bitrate === 'number' ? health.bitrate : streamHealth.bitrate;
            const errorMessage = health.errorMessage || null;
            
            setStreamHealth(prev => ({
              ...prev,
              healthy,
              recovering,
              broadcastLive,
              bitrate,
              errorMessage,
              lastCheckedAt: data.timestamp ? new Date(data.timestamp).toISOString() : null
            }));
            
            // Auto-resume playback when recovering -> healthy
            if (prevRecoveringRef.current && healthy && audioRef.current) {
              audioRef.current.play().catch(() => {});
            }
            prevRecoveringRef.current = recovering && broadcastLive;
          }
          
          // Expose last stream status globally for other components (read-only usage)
          try {
            window.__wildcats_stream_state__ = {
              isLive: !!data.isLive,
              broadcastId: data.broadcastId || null,
              peakListeners: incomingPeak,
              listenerCount: data.listenerCount || 0,
              timestamp: data.timestamp || Date.now()
            };
          } catch (_e) { /* noop for SSR safety */ }
        }
      } catch (error) {
        console.error('Error parsing listener/status WebSocket message:', error);
      }
    });

    globalWebSocketService.onListenerStatusError((error) => {
      console.error('Listener/Status WebSocket error:', error);
    });

    globalWebSocketService.onListenerStatusClose((event) => {
      console.log('Listener/Status WebSocket disconnected:', event.code, event.reason);
      setIsListening(false); // Assuming listener status implies listening
    });

    globalWebSocketService.onListenerStatusOpen(() => {
      console.log('Listener/Status WebSocket connected successfully');
      setIsListening(true);
    });
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

      // After starting, fetch updated broadcast to get actualStart and other live fields
      try {
        const refreshed = await broadcastService.getById(createdBroadcast.id);
        if (refreshed && refreshed.data) {
          setCurrentBroadcast(refreshed.data);
        }
      } catch (e) {
        console.warn('Failed to refresh broadcast after start:', e);
      }

      // Get audio stream based on selected source (only if not already available)
      let stream = audioStreamRef.current;
      if (!stream) {
        stream = await getAudioStream();
        audioStreamRef.current = stream;
      }

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
        if (globalWebSocketService.isDJWebSocketConnected()) {

          // Helper function to safely send audio data through WebSocket
          const safelySendAudioData = (buffer) => {
            return globalWebSocketService.sendDJBinaryData(buffer);
          };

          let lastChunkTime = Date.now();
          let chunkCount = 0;

          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0 && globalWebSocketService.isDJWebSocketConnected()) {
              // Check buffer size to prevent WebSocket message too large errors
              if (event.data.size > MAX_MESSAGE_SIZE) {
                console.warn(`Audio chunk too large (${event.data.size} bytes), skipping to prevent WebSocket disconnect`);
                return;
              }

              const currentTime = Date.now();
              const timeSinceLastChunk = currentTime - lastChunkTime;
              chunkCount++;

              // Log timing info every 10th chunk to track regularity
              if (chunkCount % 10 === 0) {
                console.log(`[AUDIO] Audio chunk #${chunkCount}: ${event.data.size} bytes, ${timeSinceLastChunk}ms since last chunk`);
              }

              lastChunkTime = currentTime;

              event.data.arrayBuffer().then(buffer => {
                // Double check buffer size before sending
                if (buffer.byteLength <= MAX_MESSAGE_SIZE) {
                safelySendAudioData(buffer);
                } else {
                  console.warn('Skipping oversized buffer to prevent WebSocket disconnect');
                }
              }).catch(error => {
                console.error('Error processing audio data:', error);
              });
            }
          };

          mediaRecorder.start(250); // Smaller intervals to prevent buffer buildup
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

  // Streaming playback recovery helpers
  const isStreamRecoveringRef = useRef(false);
  const [isStreamRecovering, setIsStreamRecovering] = useState(false);
  const retryAttemptRef = useRef(0);
  const audioHandlersAttachedRef = useRef(false);
  const MAX_RECOVERY_ATTEMPTS = 6;
  const recoveryTimerRef = useRef(null);
  const clearRecoveryTimer = () => {
    if (recoveryTimerRef.current) {
      clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
  };

  const getCacheBustedUrl = (base) => {
    if (!base) return base;
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}_=${Date.now()}&re=${retryAttemptRef.current}`;
  };

  const attemptStreamRecovery = useCallback(async () => {
    try {
      if (isStreamRecoveringRef.current) return;
      if (!isListening) return;
      if (!audioPlaying) return; // user paused explicitly
      const baseUrl = serverConfig?.streamUrl || config.icecastUrl;
      if (!baseUrl || !audioRef.current) return;
      // Only attempt if backend reports live or recovering
      if (!(streamHealth.broadcastLive || streamHealth.recovering)) return;

      isStreamRecoveringRef.current = true;
      setIsStreamRecovering(true);
      let attempt = retryAttemptRef.current;

      const tryOnce = async () => {
        const currentAttempt = attempt;
        const url = getCacheBustedUrl(baseUrl);
        try {
          audioRef.current.pause();
          audioRef.current.src = url;
          audioRef.current.load();
          await audioRef.current.play();
          // Success
          retryAttemptRef.current = 0;
          isStreamRecoveringRef.current = false;
          setIsStreamRecovering(false);
          clearRecoveryTimer();
          setAudioPlaying(true);
          return;
        } catch (e) {
          attempt = currentAttempt + 1;
          retryAttemptRef.current = attempt;
          if (!isListening || !audioPlaying) {
            // User stopped/paused meanwhile
            isStreamRecoveringRef.current = false;
            setIsStreamRecovering(false);
            clearRecoveryTimer();
            return;
          }
          if (attempt >= MAX_RECOVERY_ATTEMPTS) {
            // Give up for now; next online/health flip will re-trigger
            isStreamRecoveringRef.current = false;
            setIsStreamRecovering(false);
            clearRecoveryTimer();
            return;
          }
          const delay = Math.min(30000, 500 * Math.pow(2, currentAttempt));
          clearRecoveryTimer();
          recoveryTimerRef.current = setTimeout(tryOnce, delay);
        }
      };

      tryOnce();
    } catch (err) {
      isStreamRecoveringRef.current = false;
      setIsStreamRecovering(false);
      clearRecoveryTimer();
    }
  }, [isListening, audioPlaying, serverConfig?.streamUrl, streamHealth.broadcastLive, streamHealth.recovering]);

  const attachAudioEventHandlers = () => {
    if (!audioRef.current || audioHandlersAttachedRef.current) return;
    const a = audioRef.current;
    const onProblem = () => {
      if (!isListening || !audioPlaying) return;
      attemptStreamRecovery();
    };
    a.addEventListener('error', onProblem);
    a.addEventListener('stalled', onProblem);
    a.addEventListener('waiting', onProblem);
    a.addEventListener('suspend', onProblem);
    a.addEventListener('ended', onProblem);
    a.addEventListener('emptied', onProblem);
    a.addEventListener('canplay', () => {
      isStreamRecoveringRef.current = false;
      setIsStreamRecovering(false);
      retryAttemptRef.current = 0;
      setAudioPlaying(true);
    });
    audioHandlersAttachedRef.current = true;
  };

  // Start listening (for listeners)
  const startListening = async () => {
    if (isListening) return;

    const baseUrl = serverConfig?.streamUrl || config.icecastUrl;
    if (!baseUrl) return;

    logger.info('Attempting to start listening...');
    setIsListening(true);
    setAudioPlaying(true); // Optimistically set to true

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = 'anonymous';
      audioRef.current.preload = 'auto';
      attachAudioEventHandlers();
    }

    try {
      const streamUrl = `${baseUrl}?_=${Date.now()}`;
      audioRef.current.src = streamUrl;
      await audioRef.current.play();
      logger.info('Audio playback started successfully.');
      connectListenerStatusWebSocket();
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

    // Clear recovery attempts/timers
    clearRecoveryTimer();
    isStreamRecoveringRef.current = false;
    setIsStreamRecovering(false);
    retryAttemptRef.current = 0;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }

    globalWebSocketService.disconnectListenerStatusWebSocket();
    refreshStreamStatus();
  };

  // Toggle audio playback for listeners
  const toggleAudio = async () => {
    try {
      // If there's no audio element or no src yet, initialize listening first
      if (!audioRef.current || !audioRef.current.src) {
        await startListening();
        return;
      }

      if (audioPlaying) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        // Clear any pending recovery since user paused intentionally
        clearRecoveryTimer();
        isStreamRecoveringRef.current = false;
        setIsStreamRecovering(false);
        retryAttemptRef.current = 0;
        setAudioPlaying(false);
        if (globalWebSocketService.isListenerStatusWebSocketConnected()) {
          globalWebSocketService.sendListenerStatusMessage(
            JSON.stringify({ type: 'LISTENER_STATUS', action: 'STOP_LISTENING' })
          );
        }
      } else {
        if (audioRef.current) {
          await audioRef.current.play().catch(e => logger.error('Error resuming playback:', e));
        }
        setAudioPlaying(true);
        if (globalWebSocketService.isListenerStatusWebSocketConnected()) {
          globalWebSocketService.sendListenerStatusMessage(
            JSON.stringify({ type: 'LISTENER_STATUS', action: 'START_LISTENING' })
          );
        }
      }
    } catch (error) {
      logger.error('Error toggling audio:', error);
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
    globalWebSocketService.disconnectAll();

    // Clear recovery
    clearRecoveryTimer();
    isStreamRecoveringRef.current = false;
    setIsStreamRecovering(false);
    retryAttemptRef.current = 0;

    // Timer clearing is now handled by globalWebSocketService

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
          // Always ensure listener status WebSocket is connected
          if (!globalWebSocketService.isListenerStatusWebSocketConnected()) {
            console.log('Reconnecting listener status WebSocket after page visibility change');
            connectListenerStatusWebSocket();
          }

          // Try to resume audio if stream is live or recovering
          try {
            if (isListening && audioRef.current && (streamHealth.recovering || streamHealth.broadcastLive)) {
              if (audioRef.current.paused) {
                attemptStreamRecovery();
              }
            }
          } catch (e) { logger.debug('Visibility recovery check failed', e); }
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

  // Trigger recovery when network comes back online
  useEffect(() => {
    const handleOnline = () => {
      try {
        if (isListening && audioRef.current && (streamHealth.recovering || streamHealth.broadcastLive)) {
          attemptStreamRecovery();
        }
      } catch (e) { logger.debug('Online recovery check failed', e); }
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [isListening, streamHealth.recovering, streamHealth.broadcastLive]);

  // Simple audio level monitoring for status display
  const startAudioLevelMonitoring = () => {
    if (!analyserRef.current || audioLevelIntervalRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

    console.log('[AUDIO] Starting audio level monitoring for status display');

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
        console.log('[AUDIO] Audio levels (status display):', {
          rms: rms.toFixed(2),
          dB: dB.toFixed(1)
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
    peakListenerCount,
    websocketConnected,
    isListening,
    audioPlaying,
    volume,
    isMuted,
    serverConfig,
    audioSource,
    audioLevel,
    qualityError,

    // Health monitoring
    streamHealth,
    healthy: streamHealth.healthy,
    recovering: streamHealth.recovering,
    healthBroadcastLive: streamHealth.broadcastLive,
    isStreamRecovering,

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
    connectListenerStatusWebSocket,

    // Audio Source Functions
    setAudioSource,
    getAudioStream,
    getDesktopAudioStream,
    getMicrophoneAudioStream,
    mixAudioStreams,

    // Shared Functions
    disconnectAll,
    getStreamUrl,
    getWebSocketUrl,
    refreshStreamStatus,
    refreshStream: refreshStreamStatus, // Alias for compatibility
    clearQualityError: () => setQualityError(null),

    // Refs (for direct access when needed)
    djWebSocketRef,
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
