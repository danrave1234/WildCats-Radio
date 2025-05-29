import { Audio, AVPlaybackStatus, AVPlaybackStatusSuccess, AVPlaybackStatusError } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  // Storage keys for persistence
  private static readonly STORAGE_KEYS = {
    VOLUME: 'wildcats_volume',
    MUTED: 'wildcats_muted',
    LISTENER_STATE: 'wildcats_listener_state',
    STREAM_CONFIG: 'wildcats_stream_config',
  };

  constructor() {
    this.initializeAudio();
  }

  private async initializeAudio(): Promise<void> {
    try {
      // Configure audio session for streaming with correct expo-av API
      await Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
      });

      this.isInitialized = true;
      logger.debug('Audio initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize audio:', error);
      this.handleError('Failed to initialize audio system');
    }
  }

  public async loadStream(streamUrl: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeAudio();
    }

    try {
      // Clean up existing sound
      if (this.sound) {
        await this.unloadStream();
      }

      this.currentStreamUrl = streamUrl;
      this.updateStatus({ isLoading: true, error: null });

      // Create new sound instance
      const { sound } = await Audio.Sound.createAsync(
        { uri: streamUrl },
        {
          shouldPlay: false,
          isLooping: false,
          isMuted: await this.getMutedState(),
          volume: await this.getVolumeState(),
        },
        this.onPlaybackStatusUpdate.bind(this)
      );

      this.sound = sound;
      
      // Load the audio with timeout
      const loadTimeout = setTimeout(() => {
        this.handleError('Stream loading timeout. The broadcast may not be live.');
      }, 10000);

      await sound.loadAsync({ uri: streamUrl });
      clearTimeout(loadTimeout);

      this.updateStatus({ isLoading: false });
      logger.debug('Stream loaded successfully:', streamUrl);

    } catch (error) {
      this.updateStatus({ isLoading: false });
      logger.error('Failed to load stream:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('network')) {
        this.handleError('Network connection failed. Please check your internet connection.');
      } else if (errorMessage.includes('format')) {
        this.handleError('Audio format not supported. The broadcast may not be live.');
      } else {
        this.handleError('Failed to load audio stream. Please try again.');
      }
    }
  }

  public async play(): Promise<void> {
    if (!this.sound) {
      this.handleError('No audio stream loaded');
      return;
    }

    try {
      this.updateStatus({ isLoading: true, error: null });
      await this.sound.playAsync();
      this.startHeartbeat();
      logger.debug('Playback started');
    } catch (error) {
      this.updateStatus({ isLoading: false });
      logger.error('Failed to start playback:', error);
      this.handleError('Failed to start playback. Please try again.');
    }
  }

  public async pause(): Promise<void> {
    if (!this.sound) return;

    try {
      await this.sound.pauseAsync();
      this.stopHeartbeat();
      logger.debug('Playback paused');
    } catch (error) {
      logger.error('Failed to pause playback:', error);
    }
  }

  public async stop(): Promise<void> {
    if (!this.sound) return;

    try {
      await this.sound.stopAsync();
      this.stopHeartbeat();
      logger.debug('Playback stopped');
    } catch (error) {
      logger.error('Failed to stop playback:', error);
    }
  }

  public async setVolume(volume: number): Promise<void> {
    if (!this.sound) return;

    try {
      const normalizedVolume = Math.max(0, Math.min(1, volume / 100));
      await this.sound.setVolumeAsync(normalizedVolume);
      await AsyncStorage.setItem(AudioStreamingService.STORAGE_KEYS.VOLUME, volume.toString());
      logger.debug('Volume set to:', volume);
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
      this.handleError('No stream URL available');
      return;
    }

    const wasPlaying = await this.isPlaying();
    await this.unloadStream();
    
    // Add a small delay before reloading
    setTimeout(async () => {
      await this.loadStream(this.currentStreamUrl!);
      if (wasPlaying) {
        await this.play();
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
        isLoading: successStatus.isBuffering,
        volume: successStatus.volume * 100,
        isMuted: successStatus.isMuted,
        position: successStatus.positionMillis || 0,
        duration: successStatus.durationMillis || 0,
        error: null,
        isBuffering: successStatus.isBuffering,
      };

      this.updateStatus(audioState);

      // Handle buffering states
      if (successStatus.isBuffering && successStatus.isPlaying) {
        logger.debug('Stream is buffering...');
      }

      // Auto-reconnect on connection issues
      if (!successStatus.isPlaying && !successStatus.isBuffering && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.attemptReconnect();
      }
    } else {
      const errorStatus = status as AVPlaybackStatusError;
      logger.error('Playback error:', errorStatus.error);
      this.handleError(`Playback error: ${errorStatus.error}`);
    }
  }

  private async attemptReconnect(): Promise<void> {
    if (!this.currentStreamUrl || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    logger.debug(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    setTimeout(async () => {
      try {
        await this.refreshStream();
        this.reconnectAttempts = 0; // Reset on successful reconnect
      } catch (error) {
        logger.error('Reconnect attempt failed:', error);
      }
    }, this.reconnectDelay * this.reconnectAttempts);
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
      return config ? JSON.parse(config) : null;
    } catch (error) {
      logger.error('Failed to get stream config:', error);
      return null;
    }
  }
}

// Create a singleton instance
const audioStreamingService = new AudioStreamingService();

export default audioStreamingService; 