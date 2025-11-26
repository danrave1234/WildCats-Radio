import { Audio, AVPlaybackStatus, AVPlaybackStatusSuccess, AVPlaybackStatusError, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import backgroundAudioService, { MediaMetadata } from './backgroundAudioService';

// Simple logger replacement
const logger = {
  debug: (message: string, ...args: any[]) => console.log(`[AudioStreamingService] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[AudioStreamingService] ${message}`, ...args),
};

export interface StreamConfig {
  streamUrl: string;
  serverIp: string;
  icecastPort: number;
  listenerCount: number;
  isLive: boolean;
  server: 'UP' | 'DOWN';
  icecastReachable: boolean;
}

export interface AudioState {
  isPlaying: boolean;
  isLoading: boolean;
  volume: number;
  isMuted: boolean;
  position: number;
  duration: number;
  error: string | null;
  isBuffering: boolean;
}

export interface ListenerStatus {
  userId: string | null;
  userName: string;
  broadcastId: number | null;
  action: 'START_LISTENING' | 'STOP_LISTENING' | 'HEARTBEAT';
  timestamp: number;
}

class AudioStreamingService {
  private sound: Audio.Sound | null = null;
  private isInitialized = false;
  private statusUpdateCallback: ((status: AudioState) => void) | null = null;
  private errorCallback: ((error: string) => void) | null = null;
  private currentStreamUrl: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private listenerStatusCallback: ((status: ListenerStatus) => void) | null = null;
  private lastToggleTime = 0;
  private readonly TOGGLE_DEBOUNCE_MS = 1000; // Prevent rapid toggles
  private lastBufferingLogTime = 0;
  private readonly BUFFERING_LOG_THROTTLE_MS = 10000; // Only log buffering every 10 seconds
  private bufferingStartTime: number | null = null;
  private readonly MAX_BUFFERING_TIME_MS = 30000; // 30 seconds max buffering before action
  private bufferingTimeout: NodeJS.Timeout | null = null;

  // Storage keys for persistence
  private static readonly STORAGE_KEYS = {
    VOLUME: 'wildcats_volume',
    MUTED: 'wildcats_muted',
    LISTENER_STATE: 'wildcats_listener_state',
    STREAM_CONFIG: 'wildcats_stream_config',
  };

  constructor() {
    this.initializeAudio();
    this.initializeBackgroundAudio();
  }

  private async initializeAudio(): Promise<void> {
    try {
      // Configure audio session for background streaming - CRITICAL for background audio
      await Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        // CRITICAL: Set interruption mode for background audio
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      });

      this.isInitialized = true;
      logger.debug('Audio initialized successfully with background audio support');
    } catch (error) {
      logger.error('Failed to initialize audio:', error);
      this.handleError('Failed to initialize audio system');
    }
  }

  private async initializeBackgroundAudio(): Promise<void> {
    try {
      // Initialize background audio service
      await backgroundAudioService.initialize();
      
      // Set up media action callback to handle notification controls
      backgroundAudioService.setMediaActionCallback((action) => {
        switch (action) {
          case 'play':
            this.play().catch(error => logger.error('Failed to play from notification:', error));
            break;
          case 'pause':
            this.pause().catch(error => logger.error('Failed to pause from notification:', error));
            break;
          case 'stop':
            this.stop().catch(error => logger.error('Failed to stop from notification:', error));
            break;
        }
      });
      
      logger.debug('Background audio integration initialized');
    } catch (error) {
      logger.error('Failed to initialize background audio integration:', error);
    }
  }

  public async loadStream(streamUrl: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeAudio();
    }

    try {
      // Add cache-busting to prevent stale connections (like web version)
      const cacheBustedUrl = streamUrl.includes('?') 
        ? `${streamUrl}&_=${Date.now()}` 
        : `${streamUrl}?_=${Date.now()}`;

      // Only unload if URL actually changed (like web version - keep connection stable)
      if (this.sound && this.currentStreamUrl !== streamUrl) {
        await this.unloadStream();
      }

      // If we already have a sound instance with the same base URL, don't reload unnecessarily
      // (cache-busting parameter changes, but base URL is the same)
      const baseUrl = streamUrl.split('?')[0];
      const currentBaseUrl = this.currentStreamUrl?.split('?')[0];
      if (this.sound && currentBaseUrl === baseUrl) {
        logger.debug('Stream already loaded with same base URL, keeping connection stable');
        return;
      }

      // Store the base URL (without cache-busting) for comparison
      this.currentStreamUrl = streamUrl;
      this.updateStatus({ isLoading: true, error: null });

      logger.debug('Loading stream:', cacheBustedUrl);

      // Get current volume and mute state
      const currentVolume = await this.getVolumeState();
      const currentMuted = await this.getMutedState();

      // iOS-specific handling for Icecast streams
      // Reference: https://github.com/doublesymmetry/react-native-track-player/issues/2096
      const isIcecastStream = streamUrl.includes('icecast') || streamUrl.includes('.mp3') || streamUrl.includes('.ogg');

      // Create new sound instance with proper volume normalization
      const soundConfig = {
        shouldPlay: false,
        isLooping: false,
        isMuted: currentMuted,
        volume: currentMuted ? 0 : currentVolume / 100, // Convert 0-100 to 0.0-1.0
        // Simplified settings to prevent iOS issues
        progressUpdateIntervalMillis: 5000, // Reduce update frequency
      };

      const { sound } = await Audio.Sound.createAsync(
        { uri: cacheBustedUrl },
        soundConfig,
        this.onPlaybackStatusUpdate.bind(this)
      );

      this.sound = sound;
      
      logger.debug('Stream loaded successfully:', cacheBustedUrl);
      this.updateStatus({ isLoading: false });

    } catch (error) {
      this.updateStatus({ isLoading: false });
      logger.error('Failed to load stream:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Handle specific iOS/Icecast errors
      if (Platform.OS === 'ios' && (streamUrl.includes('icecast') || streamUrl.includes('.mp3'))) {
        logger.debug('🍎 iOS Icecast loading failed, this may be due to known iOS/Icecast compatibility issues');
        // Don't immediately fail - iOS often has issues with initial Icecast connections
        // but the stream might work when actually played
        this.updateStatus({ isLoading: false, error: null });
        return;
      }
      
      // Handle specific AVFoundation errors
      if (errorMessage.includes('-11850') || errorMessage.includes('AVFoundationErrorDomain')) {
        this.handleError('Stream format not supported or unavailable. Trying alternative formats...');
        // Try to load with a different format
        await this.tryAlternativeFormats();
      } else if (errorMessage.includes('network')) {
        this.handleError('Network connection failed. Please check your internet connection.');
      } else if (errorMessage.includes('format')) {
        this.handleError('Audio format not supported. The broadcast may not be live.');
      } else if (errorMessage.includes('Volume')) {
        this.handleError('Audio configuration error. Please try again.');
      } else {
        this.handleError('Failed to load audio stream. Please try again.');
      }
    }
  }

  private async tryAlternativeFormats(): Promise<void> {
    // Import streamService for testing alternative URLs
    const streamService = (await import('./streamService')).default;
    
    try {
      logger.debug('Trying to find alternative working MP3 stream format...');
      const workingStream = await streamService.findWorkingMp3Stream();
      
      if (workingStream && workingStream.url !== this.currentStreamUrl) {
        logger.debug('Found alternative MP3 stream URL:', workingStream);
        await this.loadStream(workingStream.url);
      } else {
        this.handleError('No compatible MP3 stream formats available. The broadcast may not be live.');
      }
    } catch (error) {
      logger.error('Failed to load alternative MP3 formats:', error);
      this.handleError('Unable to find compatible MP3 stream format. Please try again later.');
    }
  }

  public async play(): Promise<void> {
    if (!this.sound) {
      // Try to reload the stream if we have a URL
      if (this.currentStreamUrl) {
        logger.debug('No sound instance but have URL, attempting to reload stream...');
        try {
          await this.loadStream(this.currentStreamUrl);
          // After loading, try to play again
          if (this.sound) {
            return this.play();
          }
        } catch (error) {
          logger.error('Failed to reload stream for playback:', error);
        }
      }
      
      this.handleError('No audio stream loaded');
      return;
    }

    try {
      this.updateStatus({ isLoading: true, error: null });
      
      // Check if the sound is actually loaded before trying to play
      const status = await this.sound.getStatusAsync();
      if (!status.isLoaded) {
        logger.debug('Sound not loaded, attempting to reload...');
        if (this.currentStreamUrl) {
          await this.loadStream(this.currentStreamUrl);
          // Try again after reloading
          if (this.sound) {
            return this.play();
          }
        }
        throw new Error('Sound not loaded and could not reload');
      }
      
      // CRITICAL: Ensure audio session is configured for background before playing
      logger.debug('🎵 Configuring audio session for background playback...');
      await Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      });
      
      // iOS-specific handling for Icecast streams
      const isIcecastStream = this.currentStreamUrl && 
        (this.currentStreamUrl.includes('icecast') || 
         this.currentStreamUrl.includes('.mp3') || 
         this.currentStreamUrl.includes('.ogg'));
      
      if (Platform.OS === 'ios' && isIcecastStream) {
        logger.debug('🍎 Starting iOS Icecast stream playback with optimizations');
        
        // Reduced delay for faster startup
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      logger.debug('🎵 Starting audio playback...');
      await this.sound.playAsync();
      this.startHeartbeat();
      
      // Start background audio with metadata
      const metadata: MediaMetadata = {
        title: 'WildCat Radio Live',
        artist: 'Live Broadcast',
        album: 'WildCat Radio',
        duration: 0, // Live stream has no duration
      };
      
      logger.debug('🎵 Starting background audio service...');
      await backgroundAudioService.startBackgroundAudio(metadata);
      
      logger.debug('✅ Playback started with background audio support');
    } catch (error) {
      this.updateStatus({ isLoading: false });
      logger.error('❌ Failed to start playback:', error);
      
      // iOS-specific error handling for Icecast
      if (Platform.OS === 'ios' && this.currentStreamUrl?.includes('icecast')) {
        logger.debug('🍎 iOS Icecast playback failed - attempting iOS-specific recovery');
        
        // For iOS Icecast issues, try a different approach
        try {
          // Recreate the audio session
          await Audio.setAudioModeAsync({
            staysActiveInBackground: true,
            playsInSilentModeIOS: true,
            allowsRecordingIOS: false,
            interruptionModeIOS: InterruptionModeIOS.DoNotMix,
            interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          });
          
          // Try to play again after session reset
          if (this.sound) {
            await this.sound.playAsync();
            this.startHeartbeat();
            
            // Try background audio again
            const metadata: MediaMetadata = {
              title: 'WildCat Radio Live',
              artist: 'Live Broadcast',
              album: 'WildCat Radio',
              duration: 0,
            };
            await backgroundAudioService.startBackgroundAudio(metadata);
            
            logger.debug('🍎 iOS Icecast playback recovered after session reset');
            return;
          }
        } catch (recoveryError) {
          logger.error('🍎 iOS Icecast recovery also failed:', recoveryError);
        }
      }
      
      // Don't immediately give up - try to reload the stream once
      if (this.currentStreamUrl && !String(error).includes('reload')) {
        logger.debug('Attempting to reload stream due to playback failure...');
        try {
          await this.loadStream(this.currentStreamUrl);
          // Mark the error to prevent infinite recursion
          const retryError = new Error('reload attempt');
          return this.play();
        } catch (reloadError) {
          logger.error('Stream reload also failed:', reloadError);
        }
      }
      
      this.handleError('Failed to start playback. Please try again.');
    }
  }

  public async pause(): Promise<void> {
    if (!this.sound) return;

    try {
      await this.sound.pauseAsync();
      this.stopHeartbeat();
      
      // Pause background audio (updates notification)
      await backgroundAudioService.pauseBackgroundAudio();
      
      logger.debug('Playback paused with background audio support');
    } catch (error) {
      logger.error('Failed to pause playback:', error);
    }
  }

  public async stop(): Promise<void> {
    if (!this.sound) return;

    try {
      await this.sound.stopAsync();
      this.stopHeartbeat();
      
      // Stop background audio (removes notification)
      await backgroundAudioService.stopBackgroundAudio();
      
      logger.debug('Playback stopped with background audio support');
    } catch (error) {
      logger.error('Failed to stop playback:', error);
    }
  }

  public async setVolume(volume: number): Promise<void> {
    if (!this.sound) return;

    try {
      // Ensure volume is within valid range (0-100)
      const clampedVolume = Math.max(0, Math.min(100, volume));
      
      // Convert to 0.0-1.0 range for expo-av
      const normalizedVolume = clampedVolume / 100;
      
      await this.sound.setVolumeAsync(normalizedVolume);
      await AsyncStorage.setItem(AudioStreamingService.STORAGE_KEYS.VOLUME, clampedVolume.toString());
      logger.debug('Volume set to:', clampedVolume, '(normalized:', normalizedVolume, ')');
    } catch (error) {
      logger.error('Failed to set volume:', error);
    }
  }

  public async setMuted(muted: boolean): Promise<void> {
    if (!this.sound) return;

    try {
      await this.sound.setIsMutedAsync(muted);
      await AsyncStorage.setItem(AudioStreamingService.STORAGE_KEYS.MUTED, muted.toString());
      logger.debug('Muted state set to:', muted);
    } catch (error) {
      logger.error('Failed to set muted state:', error);
    }
  }

  public async togglePlayPause(): Promise<void> {
    // Debounce rapid toggle attempts to prevent flickering
    const now = Date.now();
    if (now - this.lastToggleTime < this.TOGGLE_DEBOUNCE_MS) {
      logger.debug('Toggle debounced - too rapid');
      return;
    }
    this.lastToggleTime = now;

    if (!this.sound) {
      this.handleError('No audio stream loaded');
      return;
    }

    try {
      const status = await this.sound.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) {
          await this.pause();
        } else {
          await this.play();
        }
      }
    } catch (error) {
      logger.error('Failed to toggle play/pause:', error);
      this.handleError('Failed to control playback');
    }
  }

  public async unloadStream(): Promise<void> {
    try {
      this.stopHeartbeat();
      
      // Clear buffering timeout
      if (this.bufferingTimeout) {
        clearTimeout(this.bufferingTimeout);
        this.bufferingTimeout = null;
      }
      this.bufferingStartTime = null;
      this.lastBufferingLogTime = 0;
      
      if (this.sound) {
        await this.sound.unloadAsync();
        this.sound = null;
      }
      
      this.currentStreamUrl = null;
      this.reconnectAttempts = 0;
      logger.debug('Stream unloaded');
    } catch (error) {
      logger.error('Failed to unload stream:', error);
    }
  }

  public async refreshStream(): Promise<void> {
    if (!this.currentStreamUrl) {
      logger.debug('No stream URL available for refresh - stream may not be loaded yet');
      // Don't treat this as an error, just log it
      return;
    }

    logger.debug('Refreshing stream:', this.currentStreamUrl);
    
    // Store the URL before any operations to prevent it from being lost
    const streamUrlToRefresh = this.currentStreamUrl;
    const wasPlaying = await this.isPlaying();
    
    // Don't unload the stream completely - just pause it
    if (this.sound) {
      try {
        await this.sound.pauseAsync();
      } catch (error) {
        logger.debug('Could not pause during refresh (this is normal):', error);
      }
    }
    
    // Add a small delay before reloading
    setTimeout(async () => {
      try {
        // Ensure we still have the URL
        if (!streamUrlToRefresh) {
          logger.error('Stream URL was lost during refresh');
          return;
        }
        
        // Only unload if we're about to reload with the same URL
        if (this.sound) {
          await this.sound.unloadAsync();
          this.sound = null;
        }
        
        // Restore the URL in case it was cleared
        this.currentStreamUrl = streamUrlToRefresh;
        
        // Reload the stream
        await this.loadStream(streamUrlToRefresh);
        
        // Resume playing if it was playing before
        if (wasPlaying) {
          // Add a small delay to ensure the stream is ready
          setTimeout(async () => {
            try {
              await this.play();
            } catch (error) {
              logger.debug('Could not resume playback after refresh:', error);
            }
          }, 1000);
        }
        
        logger.debug('Stream refreshed successfully');
      } catch (error) {
        logger.error('Failed to refresh stream:', error);
        
        // Restore the URL even if refresh failed
        this.currentStreamUrl = streamUrlToRefresh;
        
        // Don't call handleError here as it might cause more issues
        logger.debug('Stream refresh failed, but URL preserved for retry');
      }
    }, 500);
  }

  public async isPlaying(): Promise<boolean> {
    if (!this.sound) return false;

    try {
      const status = await this.sound.getStatusAsync();
      return status.isLoaded && status.isPlaying;
    } catch (error) {
      logger.error('Failed to get playing status:', error);
      return false;
    }
  }

  public setStatusUpdateCallback(callback: ((status: AudioState) => void) | null): void {
    this.statusUpdateCallback = callback;
  }

  public setErrorCallback(callback: ((error: string) => void) | null): void {
    this.errorCallback = callback;
  }

  public setListenerStatusCallback(callback: ((status: ListenerStatus) => void) | null): void {
    this.listenerStatusCallback = callback;
  }

  private onPlaybackStatusUpdate(status: AVPlaybackStatus): void {
    if (status.isLoaded) {
      const successStatus = status as AVPlaybackStatusSuccess;
      
      const audioState: AudioState = {
        isPlaying: successStatus.isPlaying,
        isLoading: false, // Don't set loading to buffering state - loading is only for initial stream loading
        volume: successStatus.volume * 100,
        isMuted: successStatus.isMuted,
        position: successStatus.positionMillis || 0,
        duration: successStatus.durationMillis || 0,
        error: null,
        isBuffering: successStatus.isBuffering,
      };

      this.updateStatus(audioState);

      // Handle buffering states - don't spam logs, buffering is normal for live streams
      // Only log if buffering persists for an unusually long time (like web version)
      if (successStatus.isBuffering && successStatus.isPlaying) {
        const now = Date.now();
        
        // Track when buffering started
        if (this.bufferingStartTime === null) {
          this.bufferingStartTime = now;
          // Don't log initial buffering - it's normal
        }
        
        // Only log if buffering persists for more than 15 seconds (unusual)
        const bufferingDuration = this.bufferingStartTime ? (now - this.bufferingStartTime) : 0;
        if (bufferingDuration > 15000 && (now - this.lastBufferingLogTime > this.BUFFERING_LOG_THROTTLE_MS)) {
          logger.debug(`Stream buffering for ${Math.floor(bufferingDuration / 1000)}s...`);
          this.lastBufferingLogTime = now;
        }
        
        // If buffering persists for too long (30s), try to recover (like web version)
        if (bufferingDuration > this.MAX_BUFFERING_TIME_MS) {
          if (!this.bufferingTimeout) {
            logger.debug(`Long buffering detected (${Math.floor(bufferingDuration / 1000)}s), attempting recovery...`);
            this.bufferingTimeout = setTimeout(() => {
              this.handleLongBuffering();
            }, 2000) as any;
          }
        }
      } else {
        // Not buffering - reset tracking silently (like web version)
        if (this.bufferingStartTime !== null) {
          this.bufferingStartTime = null;
        }
        if (this.bufferingTimeout) {
          clearTimeout(this.bufferingTimeout);
          this.bufferingTimeout = null;
        }
      }

      // Reset reconnect attempts on successful status update
      if (successStatus.isPlaying || successStatus.isBuffering) {
        this.reconnectAttempts = 0;
      }
    } else {
      const errorStatus = status as AVPlaybackStatusError;
      
      // Handle undefined or null errors more gracefully
      const errorMessage = errorStatus.error || 'Unknown playback error';
      
      // Don't treat undefined errors as fatal - they often happen during stream initialization
      if (errorStatus.error === undefined || errorStatus.error === null) {
        logger.debug('Received undefined playback error - this is often normal during stream loading');
        return; // Don't handle as a real error
      }
      
      // Handle specific iOS AVFoundation errors
      const errorString = String(errorMessage);
      
      // AVFoundationErrorDomain -11819: Buffer allocation failure (iOS-specific)
      if (Platform.OS === 'ios' && errorString.includes('-11819')) {
        logger.error('🍎 iOS AVFoundation -11819 error detected (buffer allocation failure)');
        this.handleIos11819Error();
        return;
      }
      
      // AVFoundationErrorDomain -11800: General AVFoundation error
      if (Platform.OS === 'ios' && (errorString.includes('-11800') || errorString.includes('-12686') || errorString.includes('-16802'))) {
        logger.error('🍎 iOS AVFoundation pipeline error detected');
        this.handleIosAvFoundationError(errorString);
        return;
      }
      
      logger.error('Playback error:', errorMessage);
      
      // Only handle as error if it's a real error message
      if (typeof errorMessage === 'string' && errorMessage !== 'undefined' && errorMessage !== 'null') {
        this.handleError(`Playback error: ${errorMessage}`);
      } else {
        logger.debug('Ignoring non-critical playback status error');
      }
    }
  }

  /**
   * Handle iOS AVFoundationErrorDomain -11819 error (buffer allocation failure)
   * This requires audio session reset and stream reloading
   */
  private async handleIos11819Error(): Promise<void> {
    logger.debug('🍎 Handling iOS -11819 error with audio session reset...');
    
    try {
      // Store current stream URL
      const streamUrl = this.currentStreamUrl;
      
      // Stop current playback
      if (this.sound) {
        try {
          await this.sound.stopAsync();
          await this.sound.unloadAsync();
        } catch (error) {
          logger.debug('Error stopping sound during -11819 recovery:', error);
        }
        this.sound = null;
      }
      
      // Reset audio session completely
      await Audio.setAudioModeAsync({
        staysActiveInBackground: false,
        playsInSilentModeIOS: false,
        allowsRecordingIOS: false,
      });
      
      // Wait a moment for session to reset
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reinitialize audio session with proper settings
      await Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      
      // Reload the stream if we have a URL
      if (streamUrl) {
        logger.debug('🍎 Reloading stream after -11819 recovery...');
        this.currentStreamUrl = streamUrl; // Restore URL
        await this.loadStream(streamUrl);
        logger.debug('🍎 Stream reloaded successfully after -11819 recovery');
      }
      
    } catch (error) {
      logger.error('🍎 Failed to recover from -11819 error:', error);
      this.handleError('iOS audio system error. Please try again.');
    }
  }

  /**
   * Handle other iOS AVFoundation errors
   */
  private async handleIosAvFoundationError(errorString: string): Promise<void> {
    logger.debug('🍎 Handling iOS AVFoundation error:', errorString);
    
    try {
      // For other AVFoundation errors, try a simpler recovery
      if (this.sound) {
        await this.sound.stopAsync();
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Try to restart playback
        await this.sound.playAsync();
        logger.debug('🍎 Recovered from AVFoundation error');
      }
    } catch (error) {
      logger.error('🍎 Failed to recover from AVFoundation error:', error);
      // Fall back to full stream reload
      if (this.currentStreamUrl) {
        await this.refreshStream();
      }
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat(); // Clear any existing heartbeat
    
    this.heartbeatInterval = setInterval(() => {
      if (this.listenerStatusCallback) {
        this.listenerStatusCallback({
          userId: null, // Will be set by the calling component
          userName: 'Anonymous Listener',
          broadcastId: null,
          action: 'HEARTBEAT',
          timestamp: Date.now(),
        });
      }
    }, 15000) as any; // Type assertion to handle Node vs DOM timer types
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Handle long buffering by attempting to refresh the stream (like web version)
   */
  private async handleLongBuffering(): Promise<void> {
    if (this.bufferingTimeout) {
      clearTimeout(this.bufferingTimeout);
      this.bufferingTimeout = null;
    }
    
    if (!this.currentStreamUrl || !this.sound) {
      return;
    }
    
    logger.debug('Attempting to recover from long buffering (web-style recovery)...');
    
    try {
      // Reset buffering tracking
      this.bufferingStartTime = null;
      
      // Web version approach: pause, update src with cache-busting, reload, then play
      const wasPlaying = await this.isPlaying();
      
      if (wasPlaying) {
        // Pause current playback
        try {
          await this.sound.pauseAsync();
        } catch (e) {
          // Ignore pause errors
        }
        
        // Update source with cache-busting (like web version)
        const cacheBustedUrl = this.currentStreamUrl.includes('?') 
          ? `${this.currentStreamUrl}&_=${Date.now()}` 
          : `${this.currentStreamUrl}?_=${Date.now()}`;
        
        // Unload and reload with new URL
        try {
          await this.sound.unloadAsync();
          this.sound = null;
          
          // Reload with cache-busted URL
          await this.loadStream(this.currentStreamUrl);
          
          // Resume playback after a short delay
          setTimeout(async () => {
            try {
              if (this.sound) {
                await this.play();
                logger.debug('Recovered from long buffering successfully');
              }
            } catch (error) {
              logger.debug('Failed to resume after buffering recovery (will retry):', error);
            }
          }, 500);
        } catch (reloadError) {
          logger.debug('Stream reload during recovery failed (will retry):', reloadError);
          // Don't treat as fatal - will retry on next status update
        }
      }
    } catch (error) {
      logger.debug('Buffering recovery attempt failed (non-fatal):', error);
      // Don't show error to user - just log it, stream might recover on its own
    }
  }

  private updateStatus(partialStatus: Partial<AudioState>): void {
    if (this.statusUpdateCallback) {
      // Get current status first, then merge with partial update
      this.getCurrentStatus().then(currentStatus => {
        const newStatus = { ...currentStatus, ...partialStatus };
        this.statusUpdateCallback!(newStatus);
      });
    }
  }

  private async getCurrentStatus(): Promise<AudioState> {
    const defaultStatus: AudioState = {
      isPlaying: false,
      isLoading: false,
      volume: await this.getVolumeState(),
      isMuted: await this.getMutedState(),
      position: 0,
      duration: 0,
      error: null,
      isBuffering: false,
    };

    if (!this.sound) {
      return defaultStatus;
    }

    try {
      const status = await this.sound.getStatusAsync();
      if (status.isLoaded) {
        const successStatus = status as AVPlaybackStatusSuccess;
        return {
          isPlaying: successStatus.isPlaying,
          isLoading: successStatus.isBuffering,
          volume: successStatus.volume * 100,
          isMuted: successStatus.isMuted,
          position: successStatus.positionMillis || 0,
          duration: successStatus.durationMillis || 0,
          error: null,
          isBuffering: successStatus.isBuffering,
        };
      }
    } catch (error) {
      logger.error('Failed to get current status:', error);
    }

    return defaultStatus;
  }

  private handleError(error: string): void {
    logger.error('Audio streaming error:', error);
    this.updateStatus({ error, isLoading: false });
    
    if (this.errorCallback) {
      this.errorCallback(error);
    }
  }

  private async getVolumeState(): Promise<number> {
    try {
      const volume = await AsyncStorage.getItem(AudioStreamingService.STORAGE_KEYS.VOLUME);
      return volume ? parseInt(volume, 10) : 70; // Default volume 70%
    } catch (error) {
      logger.error('Failed to get volume state:', error);
      return 70;
    }
  }

  private async getMutedState(): Promise<boolean> {
    try {
      const muted = await AsyncStorage.getItem(AudioStreamingService.STORAGE_KEYS.MUTED);
      return muted === 'true';
    } catch (error) {
      logger.error('Failed to get muted state:', error);
      return false;
    }
  }

  // Public method to save stream config
  public async saveStreamConfig(config: StreamConfig): Promise<void> {
    try {
      await AsyncStorage.setItem(
        AudioStreamingService.STORAGE_KEYS.STREAM_CONFIG,
        JSON.stringify(config)
      );
    } catch (error) {
      logger.error('Failed to save stream config:', error);
    }
  }

  // Public method to get saved stream config
  public async getStreamConfig(): Promise<StreamConfig | null> {
    try {
      const config = await AsyncStorage.getItem(AudioStreamingService.STORAGE_KEYS.STREAM_CONFIG);
      return config ? JSON.parse(config) : {
        streamUrl: 'https://icecast.software/live.ogg',
        serverIp: 'icecast.software',
        icecastPort: 443,
        listenerCount: 0,
        isLive: false,
        server: 'UP',
        icecastReachable: true,
      };
    } catch (error) {
      logger.error('Failed to get stream config:', error);
      return {
        streamUrl: 'https://icecast.software/live.ogg',
        serverIp: 'icecast.software',
        icecastPort: 443,
        listenerCount: 0,
        isLive: false,
        server: 'UP',
        icecastReachable: true,
      };
    }
  }

  public async loadPrimaryStream(): Promise<void> {
    // Load the primary MP3 stream directly (mobile-exclusive)
    const primaryUrl = 'https://icecast.software/live.mp3';
    console.log('[AudioStreamingService] Loading primary MP3 stream for mobile:', primaryUrl);
    await this.loadStream(primaryUrl);
  }

  public async loadMp3Stream(): Promise<void> {
    // Dedicated MP3 stream loader for mobile
    const mp3Url = 'https://icecast.software/live.mp3';
    console.log('[AudioStreamingService] Loading MP3 stream exclusively for mobile:', mp3Url);
    await this.loadStream(mp3Url);
  }

  // Update media metadata for background audio
  public async updateMediaMetadata(title: string, artist: string, album?: string): Promise<void> {
    try {
      // Prevent duplicate updates with same metadata
      const currentState = backgroundAudioService.getState();
      if (currentState.currentTrack && 
          currentState.currentTrack.title === title && 
          currentState.currentTrack.artist === artist &&
          currentState.currentTrack.album === (album || 'WildCat Radio')) {
        logger.debug('Media metadata unchanged, skipping update');
        return;
      }

      const metadata: MediaMetadata = {
        title,
        artist,
        album: album || 'WildCat Radio',
        duration: 0, // Live stream has no duration
      };
      
      await backgroundAudioService.updateMetadata(metadata);
      logger.debug('Media metadata updated:', { title, artist, album });
    } catch (error) {
      logger.error('Failed to update media metadata:', error);
    }
  }

  // Get background audio state
  public getBackgroundAudioState() {
    return backgroundAudioService.getState();
  }

  // Cleanup background audio on service destruction
  public async cleanup(): Promise<void> {
    try {
      await this.unloadStream();
      await backgroundAudioService.cleanup();
      logger.debug('Audio streaming service cleaned up');
    } catch (error) {
      logger.error('Failed to cleanup audio streaming service:', error);
    }
  }
}

// Create a singleton instance
const audioStreamingService = new AudioStreamingService();

export default audioStreamingService; 