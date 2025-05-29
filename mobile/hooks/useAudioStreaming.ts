import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import audioStreamingService, { 
  AudioState, 
  StreamConfig, 
  ListenerStatus 
} from '../services/audioStreamingService';
import { createLogger } from '../services/logger';

const logger = createLogger('useAudioStreaming');

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
  sendListenerStatus: (status: Partial<ListenerStatus>) => void;
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

  const [listenerStatusCallback, setListenerStatusCallback] = useState<((status: ListenerStatus) => void) | null>(null);
  const appState = useRef(AppState.currentState);
  const wasPlayingBeforeBackground = useRef(false);

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

    const listenerCallback = (status: ListenerStatus) => {
      if (listenerStatusCallback) {
        listenerStatusCallback(status);
      }
    };

    audioStreamingService.setStatusUpdateCallback(statusCallback);
    audioStreamingService.setErrorCallback(errorCallback);
    audioStreamingService.setListenerStatusCallback(listenerCallback);

    // Load saved stream config on mount
    const loadSavedConfig = async () => {
      const savedConfig = await audioStreamingService.getStreamConfig();
      if (savedConfig) {
        setStreamingState(prev => ({
          ...prev,
          streamConfig: savedConfig,
          isLive: savedConfig.isLive,
          listenerCount: savedConfig.listenerCount,
        }));
      }
    };

    loadSavedConfig();

    return () => {
      audioStreamingService.setStatusUpdateCallback(null);
      audioStreamingService.setErrorCallback(null);
      audioStreamingService.setListenerStatusCallback(null);
    };
  }, [listenerStatusCallback]);

  // Handle app state changes for background audio
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      logger.debug('App state changed:', { from: appState.current, to: nextAppState });

      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground
        logger.debug('App came to foreground');
        
        // Restore playback if it was playing before
        if (wasPlayingBeforeBackground.current && streamingState.streamConfig?.streamUrl) {
          logger.debug('Restoring playback after foreground');
          await audioStreamingService.refreshStream();
        }
      } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        // App went to background
        logger.debug('App went to background');
        wasPlayingBeforeBackground.current = streamingState.isPlaying;
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [streamingState.isPlaying, streamingState.streamConfig]);

  // Actions
  const actions: StreamingActions = {
    loadStream: useCallback(async (streamUrl: string) => {
      try {
        setStreamingState(prev => ({ ...prev, error: null }));
        await audioStreamingService.loadStream(streamUrl);
        logger.debug('Stream loaded successfully');
      } catch (error) {
        logger.error('Failed to load stream:', error);
      }
    }, []),

    play: useCallback(async () => {
      try {
        await audioStreamingService.play();
      } catch (error) {
        logger.error('Failed to play stream:', error);
      }
    }, []),

    pause: useCallback(async () => {
      try {
        await audioStreamingService.pause();
      } catch (error) {
        logger.error('Failed to pause stream:', error);
      }
    }, []),

    stop: useCallback(async () => {
      try {
        await audioStreamingService.stop();
      } catch (error) {
        logger.error('Failed to stop stream:', error);
      }
    }, []),

    togglePlayPause: useCallback(async () => {
      try {
        await audioStreamingService.togglePlayPause();
      } catch (error) {
        logger.error('Failed to toggle play/pause:', error);
      }
    }, []),

    setVolume: useCallback(async (volume: number) => {
      try {
        // Ensure volume is within valid range
        const clampedVolume = Math.max(0, Math.min(100, volume));
        await audioStreamingService.setVolume(clampedVolume);
        setStreamingState(prev => ({ ...prev, volume: clampedVolume }));
        logger.debug('Volume updated to:', clampedVolume);
      } catch (error) {
        logger.error('Failed to set volume:', error);
      }
    }, []),

    setMuted: useCallback(async (muted: boolean) => {
      try {
        await audioStreamingService.setMuted(muted);
        setStreamingState(prev => ({ ...prev, isMuted: muted }));
        logger.debug('Muted state updated to:', muted);
      } catch (error) {
        logger.error('Failed to set muted state:', error);
      }
    }, []),

    refreshStream: useCallback(async () => {
      try {
        setStreamingState(prev => ({ ...prev, error: null }));
        await audioStreamingService.refreshStream();
        logger.debug('Stream refreshed successfully');
      } catch (error) {
        logger.error('Failed to refresh stream:', error);
        setStreamingState(prev => ({ 
          ...prev, 
          error: 'Failed to refresh stream. Please try again.' 
        }));
      }
    }, []),

    updateStreamConfig: useCallback(async (config: StreamConfig) => {
      try {
        await audioStreamingService.saveStreamConfig(config);
        setStreamingState(prev => ({
          ...prev,
          streamConfig: config,
          isLive: config.isLive,
          listenerCount: config.listenerCount,
        }));
        logger.debug('Stream config updated:', config);
      } catch (error) {
        logger.error('Failed to update stream config:', error);
      }
    }, []),

    sendListenerStatus: useCallback((status: Partial<ListenerStatus>) => {
      const fullStatus: ListenerStatus = {
        userId: null,
        userName: 'Anonymous Listener',
        broadcastId: null,
        action: 'HEARTBEAT',
        timestamp: Date.now(),
        ...status,
      };

      if (listenerStatusCallback) {
        listenerStatusCallback(fullStatus);
      }
    }, [listenerStatusCallback]),
  };

  // Provide method to set listener status callback
  const setListenerStatusCallbackWrapper = useCallback((callback: (status: ListenerStatus) => void) => {
    setListenerStatusCallback(() => callback);
  }, []);

  // Add the callback setter to actions for external use
  (actions as any).setListenerStatusCallback = setListenerStatusCallbackWrapper;

  return [streamingState, actions];
}; 