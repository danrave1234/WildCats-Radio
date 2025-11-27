import { useState, useEffect, useCallback } from 'react';
import audioStreamingService, { AudioState, StreamConfig } from '../services/audioStreamingService';

interface StreamingState extends AudioState {
  streamConfig: StreamConfig | null;
  isLive: boolean;
  listenerCount: number;
}

interface StreamingActions {
  loadStream: (streamUrl: string) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  togglePlayPause: () => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  setMuted: (muted: boolean) => Promise<void>;
  refreshStream: () => Promise<void>;
  updateStreamConfig: (config: StreamConfig) => Promise<void>;
}

export const useAudioStreaming = (): [StreamingState, StreamingActions] => {
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isPlaying: false,
    isLoading: false,
    volume: 70,
    isMuted: false,
    position: 0,
    duration: 0,
    error: null,
    isBuffering: false,
    streamConfig: null,
    isLive: false,
    listenerCount: 0,
  });

  // Initialize audio streaming service callbacks
  useEffect(() => {
    const statusCallback = (audioState: AudioState) => {
      setStreamingState(prev => ({
        ...prev,
        ...audioState,
      }));
    };

    const errorCallback = (error: string) => {
      setStreamingState(prev => ({
        ...prev,
        error,
        isLoading: false,
      }));
    };

    audioStreamingService.setStatusUpdateCallback(statusCallback);
    audioStreamingService.setErrorCallback(errorCallback);

    // Load saved volume and muted state
    const loadSavedSettings = async () => {
      // Settings are loaded in the service constructor
      // Just trigger a status update to sync state
      const currentUrl = audioStreamingService.getCurrentStreamUrl();
      if (currentUrl) {
        try {
          await audioStreamingService.loadStream(currentUrl);
        } catch (error) {
          // Ignore errors during initialization
        }
      }
    };

    loadSavedSettings();
  }, []);

  // Actions
  const actions: StreamingActions = {
    loadStream: useCallback(async (streamUrl: string) => {
      try {
        setStreamingState(prev => ({ ...prev, error: null }));
        await audioStreamingService.loadStream(streamUrl);
      } catch (error) {
        console.error('Failed to load stream:', error);
        throw error;
      }
    }, []),

    play: useCallback(async () => {
      try {
        await audioStreamingService.play();
      } catch (error) {
        console.error('Failed to play stream:', error);
        throw error;
      }
    }, []),

    pause: useCallback(async () => {
      try {
        await audioStreamingService.pause();
      } catch (error) {
        console.error('Failed to pause stream:', error);
        throw error;
      }
    }, []),

    stop: useCallback(async () => {
      try {
        await audioStreamingService.stop();
      } catch (error) {
        console.error('Failed to stop stream:', error);
        throw error;
      }
    }, []),

    togglePlayPause: useCallback(async () => {
      try {
        await audioStreamingService.togglePlayPause();
      } catch (error) {
        console.error('Failed to toggle play/pause:', error);
        throw error;
      }
    }, []),

    setVolume: useCallback(async (volume: number) => {
      try {
        const clampedVolume = Math.max(0, Math.min(100, volume));
        await audioStreamingService.setVolume(clampedVolume);
        setStreamingState(prev => ({ ...prev, volume: clampedVolume }));
      } catch (error) {
        console.error('Failed to set volume:', error);
        throw error;
      }
    }, []),

    setMuted: useCallback(async (muted: boolean) => {
      try {
        await audioStreamingService.setMuted(muted);
        setStreamingState(prev => ({ ...prev, isMuted: muted }));
      } catch (error) {
        console.error('Failed to set muted:', error);
        throw error;
      }
    }, []),

    refreshStream: useCallback(async () => {
      try {
        await audioStreamingService.refreshStream();
      } catch (error) {
        console.error('Failed to refresh stream:', error);
        throw error;
      }
    }, []),

    updateStreamConfig: useCallback(async (config: StreamConfig) => {
      setStreamingState(prev => ({
        ...prev,
        streamConfig: config,
        isLive: config.isLive,
        listenerCount: config.listenerCount,
      }));
    }, []),
  };

  return [streamingState, actions];
};

