import { Audio, AVPlaybackStatus, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Simple logger
const logger = {
  debug: (message: string, ...args: any[]) => console.log(`[AudioStreamingService] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[AudioStreamingService] ${message}`, ...args),
};

export interface StreamConfig {
  streamUrl: string;
  listenerCount: number;
  isLive: boolean;
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

class AudioStreamingService {
  private sound: Audio.Sound | null = null;
  private isInitialized = false;
  private statusUpdateCallback: ((status: AudioState) => void) | null = null;
  private errorCallback: ((error: string) => void) | null = null;
  private currentStreamUrl: string | null = null;
  private lastToggleTime = 0;
  private readonly TOGGLE_DEBOUNCE_MS = 1000;

  // Storage keys for persistence
  private static readonly STORAGE_KEYS = {
    VOLUME: 'wildcats_volume',
    MUTED: 'wildcats_muted',
  };

  constructor() {
    this.initializeAudio();
  }

  private async initializeAudio(): Promise<void> {
    try {
      // Configure audio session for background streaming
      await Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      });

      // Load saved volume and muted state
      const savedVolume = await AsyncStorage.getItem(AudioStreamingService.STORAGE_KEYS.VOLUME);
      const savedMuted = await AsyncStorage.getItem(AudioStreamingService.STORAGE_KEYS.MUTED);

      if (savedVolume) {
        const volume = parseInt(savedVolume, 10);
        this.updateStatus({ volume });
      }

      if (savedMuted) {
        const muted = savedMuted === 'true';
        this.updateStatus({ isMuted: muted });
      }

      this.isInitialized = true;
      logger.debug('Audio initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize audio:', error);
      this.handleError('Failed to initialize audio system');
    }
  }

  private updateStatus(updates: Partial<AudioState>): void {
    if (this.statusUpdateCallback) {
      // Get current status from sound if available
      if (this.sound) {
        this.sound.getStatusAsync().then((status) => {
          if (status.isLoaded) {
            const currentState: AudioState = {
              isPlaying: status.isPlaying || false,
              isLoading: false,
              volume: Math.round((status.volume || 1) * 100),
              isMuted: status.isMuted || false,
              position: status.positionMillis || 0,
              duration: status.durationMillis || 0,
              error: null,
              isBuffering: status.isBuffering || false,
            };
            this.statusUpdateCallback?.({ ...currentState, ...updates });
          }
        }).catch(() => {
          // If status check fails, just use updates
          this.statusUpdateCallback?.({ ...this.getDefaultState(), ...updates });
        });
      } else {
        // No sound instance, use default state with updates
        this.statusUpdateCallback?.({ ...this.getDefaultState(), ...updates });
      }
    }
  }

  private getDefaultState(): AudioState {
    return {
      isPlaying: false,
      isLoading: false,
      volume: 70,
      isMuted: false,
      position: 0,
      duration: 0,
      error: null,
      isBuffering: false,
    };
  }

  private handleError(error: string): void {
    logger.error(error);
    this.updateStatus({ error, isLoading: false });
    if (this.errorCallback) {
      this.errorCallback(error);
    }
  }

  public setStatusUpdateCallback(callback: (status: AudioState) => void): void {
    this.statusUpdateCallback = callback;
  }

  public setErrorCallback(callback: (error: string) => void): void {
    this.errorCallback = callback;
  }

  public async loadStream(streamUrl: string): Promise<void> {
    try {
      this.updateStatus({ isLoading: true, error: null });

      // Unload existing stream if any
      if (this.sound) {
        await this.sound.unloadAsync();
        this.sound = null;
      }

      // Create new sound instance
      const { sound } = await Audio.Sound.createAsync(
        { uri: streamUrl },
        {
          shouldPlay: false,
          isLooping: false,
          volume: 1.0,
        },
        this.onPlaybackStatusUpdate.bind(this)
      );

      this.sound = sound;
      this.currentStreamUrl = streamUrl;
      this.updateStatus({ isLoading: false });
      logger.debug('Stream loaded successfully:', streamUrl);
    } catch (error: any) {
      logger.error('Failed to load stream:', error);
      const errorMessage = error?.message || 'Failed to load audio stream';
      this.handleError(errorMessage);
      throw error;
    }
  }

  private onPlaybackStatusUpdate(status: AVPlaybackStatus): void {
    if (!status.isLoaded) {
      return;
    }

    const audioState: AudioState = {
      isPlaying: status.isPlaying || false,
      isLoading: false,
      volume: Math.round((status.volume || 1) * 100),
      isMuted: status.isMuted || false,
      position: status.positionMillis || 0,
      duration: status.durationMillis || 0,
      error: status.error ? status.error.message : null,
      isBuffering: status.isBuffering || false,
    };

    this.updateStatus(audioState);
  }

  public async play(): Promise<void> {
    if (!this.sound) {
      if (this.currentStreamUrl) {
        logger.debug('No sound instance but have URL, attempting to reload stream...');
        try {
          await this.loadStream(this.currentStreamUrl);
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

      const status = await this.sound.getStatusAsync();
      if (!status.isLoaded) {
        logger.debug('Sound not loaded, attempting to reload...');
        if (this.currentStreamUrl) {
          await this.loadStream(this.currentStreamUrl);
          if (this.sound) {
            return this.play();
          }
        }
        throw new Error('Sound not loaded and could not reload');
      }

      // Ensure audio session is configured
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
      if (Platform.OS === 'ios' && this.currentStreamUrl?.includes('icecast')) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      logger.debug('Starting audio playback...');
      await this.sound.playAsync();
      logger.debug('Playback started successfully');
    } catch (error: any) {
      this.updateStatus({ isLoading: false });
      logger.error('Failed to start playback:', error);
      this.handleError('Failed to start playback. Please try again.');
      throw error;
    }
  }

  public async pause(): Promise<void> {
    if (!this.sound) return;

    try {
      await this.sound.pauseAsync();
      logger.debug('Playback paused');
    } catch (error) {
      logger.error('Failed to pause playback:', error);
    }
  }

  public async stop(): Promise<void> {
    if (!this.sound) return;

    try {
      await this.sound.stopAsync();
      logger.debug('Playback stopped');
    } catch (error) {
      logger.error('Failed to stop playback:', error);
    }
  }

  public async setVolume(volume: number): Promise<void> {
    if (!this.sound) return;

    try {
      const clampedVolume = Math.max(0, Math.min(100, volume));
      const normalizedVolume = clampedVolume / 100;

      await this.sound.setVolumeAsync(normalizedVolume);
      await AsyncStorage.setItem(AudioStreamingService.STORAGE_KEYS.VOLUME, clampedVolume.toString());
      this.updateStatus({ volume: clampedVolume });
      logger.debug('Volume set to:', clampedVolume);
    } catch (error) {
      logger.error('Failed to set volume:', error);
    }
  }

  public async setMuted(muted: boolean): Promise<void> {
    if (!this.sound) return;

    try {
      await this.sound.setIsMutedAsync(muted);
      await AsyncStorage.setItem(AudioStreamingService.STORAGE_KEYS.MUTED, muted.toString());
      this.updateStatus({ isMuted: muted });
      logger.debug('Muted state set to:', muted);
    } catch (error) {
      logger.error('Failed to set muted state:', error);
    }
  }

  public async togglePlayPause(): Promise<void> {
    // Debounce rapid toggle attempts
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
      if (this.sound) {
        await this.sound.unloadAsync();
        this.sound = null;
      }
      this.currentStreamUrl = null;
      logger.debug('Stream unloaded');
    } catch (error) {
      logger.error('Failed to unload stream:', error);
    }
  }

  public async refreshStream(): Promise<void> {
    if (!this.currentStreamUrl) {
      logger.debug('No stream URL available for refresh');
      return;
    }

    logger.debug('Refreshing stream:', this.currentStreamUrl);
    const streamUrlToRefresh = this.currentStreamUrl;
    const wasPlaying = await this.isPlaying();

    if (this.sound) {
      await this.sound.pauseAsync();
    }

    try {
      await this.loadStream(streamUrlToRefresh);
      if (wasPlaying) {
        await this.play();
      }
      logger.debug('Stream refreshed successfully');
    } catch (error) {
      logger.error('Failed to refresh stream:', error);
      throw error;
    }
  }

  public async isPlaying(): Promise<boolean> {
    if (!this.sound) return false;

    try {
      const status = await this.sound.getStatusAsync();
      return status.isLoaded ? (status.isPlaying || false) : false;
    } catch (error) {
      logger.error('Failed to check playing status:', error);
      return false;
    }
  }

  public getCurrentStreamUrl(): string | null {
    return this.currentStreamUrl;
  }
}

// Export singleton instance
const audioStreamingService = new AudioStreamingService();
export default audioStreamingService;


