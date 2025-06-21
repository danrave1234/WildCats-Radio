import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

// Background task name
const BACKGROUND_AUDIO_TASK = 'background-audio-task';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false, // Don't show alert for media controls
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

export interface MediaMetadata {
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
  duration?: number;
}

export interface BackgroundAudioState {
  isPlaying: boolean;
  currentTrack: MediaMetadata | null;
  isBackgroundActive: boolean;
}

class BackgroundAudioService {
  private static instance: BackgroundAudioService;
  private isInitialized = false;
  private currentNotificationId: string | null = null;
  private mediaMetadata: MediaMetadata | null = null;
  private isPlaying = false;
  private stateCallback: ((state: BackgroundAudioState) => void) | null = null;

  static getInstance(): BackgroundAudioService {
    if (!BackgroundAudioService.instance) {
      BackgroundAudioService.instance = new BackgroundAudioService();
    }
    return BackgroundAudioService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Request notification permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Notification permissions not granted - media controls may not work');
      }

      // Don't configure audio session here - it's already configured in audioStreamingService
      // This prevents conflicts between multiple audio session configurations

      // Try to register background task (non-critical)
      await this.registerBackgroundTask();

      // Set up notification action handlers
      this.setupNotificationHandlers();

      this.isInitialized = true;
      console.log('✅ Background audio service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize background audio service:', error);
      // Still mark as initialized so audio can work without background features
      this.isInitialized = true;
    }
  }

  private async registerBackgroundTask(): Promise<void> {
    try {
      // Define the background task for audio session management
      TaskManager.defineTask(BACKGROUND_AUDIO_TASK, async () => {
        try {
          // Keep the audio session alive and update notification if needed
          console.log('🎵 Background audio task running');
          
          // Update the notification if needed
          if (this.currentNotificationId && this.mediaMetadata) {
            await this.updateMediaNotification(this.mediaMetadata, this.isPlaying);
          }

          return BackgroundFetch.BackgroundFetchResult.NewData;
        } catch (error) {
          console.error('Background task error:', error);
          return BackgroundFetch.BackgroundFetchResult.Failed;
        }
      });

      // Register the background task only if not already registered
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_AUDIO_TASK);
      if (!isRegistered) {
        try {
          await BackgroundFetch.registerTaskAsync(BACKGROUND_AUDIO_TASK, {
            minimumInterval: 30000, // 30 seconds (increased for better battery life)
            stopOnTerminate: false,
            startOnBoot: false,
          });
          console.log('✅ Background task registered successfully');
        } catch (registerError) {
          console.warn('⚠️ Background task registration failed, but audio will still work:', registerError);
          // Don't throw error - background audio can still work without background fetch
        }
      }
    } catch (error) {
      console.warn('⚠️ Background task setup failed, but audio will still work:', error);
      // Don't throw error - the main audio functionality should still work
    }
  }

  private setupNotificationHandlers(): void {
    // Handle notification responses (when user taps media controls)
    Notifications.addNotificationResponseReceivedListener((response) => {
      const action = response.actionIdentifier;
      console.log('🎵 Media control action:', action);

      switch (action) {
        case 'play':
          this.handlePlayAction();
          break;
        case 'pause':
          this.handlePauseAction();
          break;
        case 'stop':
          this.handleStopAction();
          break;
        default:
          // Default action (tap on notification)
          console.log('Notification tapped - opening app');
          break;
      }
    });
  }

  async startBackgroundAudio(metadata: MediaMetadata): Promise<void> {
    try {
      console.log('🎵 Starting background audio with metadata:', metadata);
      this.mediaMetadata = metadata;
      this.isPlaying = true;

      // Create media notification
      console.log('🎵 Creating media notification...');
      await this.createMediaNotification(metadata, true);

      // Start background task
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_AUDIO_TASK);
      console.log('🎵 Background task registered:', isRegistered);
      
      if (!isRegistered) {
        console.log('🎵 Background task not registered, registering now...');
        await this.registerBackgroundTask();
      }

      this.notifyStateChange();
      console.log('✅ Background audio started successfully for:', metadata.title);
    } catch (error) {
      console.error('❌ Failed to start background audio:', error);
      // Don't throw error - let audio continue without background features
    }
  }

  async pauseBackgroundAudio(): Promise<void> {
    try {
      console.log('⏸️ Pausing background audio...');
      this.isPlaying = false;

      // Update notification to show pause state
      if (this.mediaMetadata) {
        console.log('🎵 Updating notification for pause state...');
        await this.updateMediaNotification(this.mediaMetadata, false);
      }

      this.notifyStateChange();
      console.log('✅ Background audio paused successfully');
    } catch (error) {
      console.error('❌ Failed to pause background audio:', error);
    }
  }

  async stopBackgroundAudio(): Promise<void> {
    try {
      console.log('⏹️ Stopping background audio...');
      this.isPlaying = false;
      this.mediaMetadata = null;

      // Remove notification
      if (this.currentNotificationId) {
        console.log('🎵 Removing media notification...');
        await Notifications.dismissNotificationAsync(this.currentNotificationId);
        this.currentNotificationId = null;
      }

      // Stop background task
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_AUDIO_TASK);
      if (isRegistered) {
        console.log('🎵 Unregistering background task...');
        try {
          await BackgroundFetch.unregisterTaskAsync(BACKGROUND_AUDIO_TASK);
        } catch (unregisterError) {
          console.warn('⚠️ Failed to unregister background task:', unregisterError);
        }
      }

      this.notifyStateChange();
      console.log('✅ Background audio stopped successfully');
    } catch (error) {
      console.error('❌ Failed to stop background audio:', error);
    }
  }

  async updateMetadata(metadata: MediaMetadata): Promise<void> {
    try {
      // Prevent unnecessary updates if metadata hasn't changed
      if (this.mediaMetadata && 
          this.mediaMetadata.title === metadata.title && 
          this.mediaMetadata.artist === metadata.artist &&
          this.mediaMetadata.album === metadata.album) {
        console.log('🎵 Metadata unchanged, skipping update');
        return;
      }

      this.mediaMetadata = metadata;

      // Only update notification if we have an existing one and are playing
      if (this.currentNotificationId && this.isPlaying) {
        await this.updateMediaNotification(metadata, this.isPlaying);
      }

      this.notifyStateChange();
      console.log('🎵 Media metadata updated:', metadata.title);
    } catch (error) {
      console.error('❌ Failed to update metadata:', error);
    }
  }

  private async createMediaNotification(metadata: MediaMetadata, isPlaying: boolean): Promise<void> {
    try {
      const playAction = {
        identifier: 'play',
        buttonTitle: '▶️',
      };

      const pauseAction = {
        identifier: 'pause',
        buttonTitle: '⏸️',
      };

      const stopAction = {
        identifier: 'stop',
        buttonTitle: '⏹️',
      };

      // Create notification category with media controls
      await Notifications.setNotificationCategoryAsync('media-controls', [
        isPlaying ? pauseAction : playAction,
        stopAction,
      ]);

      const notificationContent = {
        title: metadata.title,
        body: `${metadata.artist} • WildCat Radio`,
        categoryIdentifier: 'media-controls',
        data: {
          type: 'media-control',
          isPlaying,
        },
        // Make it persistent and non-dismissible
        sticky: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        sound: false, // No sound for media controls
      };

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: null, // Show immediately
      });

      this.currentNotificationId = notificationId;
      console.log('🔔 Media notification created:', notificationId);
    } catch (error) {
      console.error('❌ Failed to create media notification:', error);
    }
  }

  private async updateMediaNotification(metadata: MediaMetadata, isPlaying: boolean): Promise<void> {
    try {
      if (!this.currentNotificationId) {
        // Create new notification if none exists
        await this.createMediaNotification(metadata, isPlaying);
        return;
      }

      // Dismiss old notification and create new one
      // (Expo doesn't support updating notification content directly)
      await Notifications.dismissNotificationAsync(this.currentNotificationId);
      await this.createMediaNotification(metadata, isPlaying);
    } catch (error) {
      console.error('❌ Failed to update media notification:', error);
    }
  }

  private handlePlayAction(): void {
    console.log('🎵 Play action triggered from notification');
    // This will be handled by the audio service
    this.notifyMediaAction('play');
  }

  private handlePauseAction(): void {
    console.log('⏸️ Pause action triggered from notification');
    // This will be handled by the audio service
    this.notifyMediaAction('pause');
  }

  private handleStopAction(): void {
    console.log('⏹️ Stop action triggered from notification');
    // This will be handled by the audio service
    this.notifyMediaAction('stop');
  }

  private notifyMediaAction(action: 'play' | 'pause' | 'stop'): void {
    // Emit custom event that the audio service can listen to
    if (this.mediaActionCallback) {
      this.mediaActionCallback(action);
    }
  }

  private notifyStateChange(): void {
    if (this.stateCallback) {
      this.stateCallback({
        isPlaying: this.isPlaying,
        currentTrack: this.mediaMetadata,
        isBackgroundActive: this.isPlaying && this.mediaMetadata !== null,
      });
    }
  }

  // Callback for media actions from notifications
  private mediaActionCallback: ((action: 'play' | 'pause' | 'stop') => void) | null = null;

  setMediaActionCallback(callback: (action: 'play' | 'pause' | 'stop') => void): void {
    this.mediaActionCallback = callback;
  }

  setStateCallback(callback: (state: BackgroundAudioState) => void): void {
    this.stateCallback = callback;
  }

  getState(): BackgroundAudioState {
    return {
      isPlaying: this.isPlaying,
      currentTrack: this.mediaMetadata,
      isBackgroundActive: this.isPlaying && this.mediaMetadata !== null,
    };
  }

  async cleanup(): Promise<void> {
    try {
      await this.stopBackgroundAudio();
      
      // Unregister background task
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_AUDIO_TASK);
      if (isRegistered) {
        await TaskManager.unregisterTaskAsync(BACKGROUND_AUDIO_TASK);
      }

      this.isInitialized = false;
      console.log('🧹 Background audio service cleaned up');
    } catch (error) {
      console.error('❌ Failed to cleanup background audio service:', error);
    }
  }
}

export default BackgroundAudioService.getInstance(); 