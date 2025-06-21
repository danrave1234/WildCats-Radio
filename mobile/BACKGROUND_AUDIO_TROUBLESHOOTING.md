# Background Audio Troubleshooting Guide

## Quick Checklist

If background audio isn't working, check these items in order:

### 1. App Configuration (app.json)
Ensure your `app.json` has the correct background modes:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["audio", "fetch", "background-processing"]
      }
    },
    "android": {
      "permissions": [
        "WAKE_LOCK",
        "FOREGROUND_SERVICE",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE"
      ]
    }
  }
}
```

### 2. Audio Session Configuration
The audio session must be configured with `staysActiveInBackground: true`:

```typescript
await Audio.setAudioModeAsync({
  staysActiveInBackground: true,
  playsInSilentModeIOS: true,
  allowsRecordingIOS: false,
  shouldDuckAndroid: false,
  playThroughEarpieceAndroid: false,
  interruptionModeIOS: InterruptionModeIOS.DoNotMix,
  interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
});
```

### 3. Notification Permissions
Background audio requires notification permissions for media controls:

```typescript
const { status } = await Notifications.requestPermissionsAsync();
if (status !== 'granted') {
  console.warn('Notification permissions not granted - media controls may not work');
}
```

### 4. Testing Steps

#### Step 1: Test Basic Audio
1. Start the app
2. Play audio
3. Verify audio plays in foreground
4. Check console logs for any errors

#### Step 2: Test Background Audio
1. Start audio playback
2. Press home button (don't swipe up to close app)
3. Audio should continue playing
4. Check notification panel for media controls

#### Step 3: Test Media Controls
1. While audio is playing in background
2. Open notification panel
3. Tap pause/play buttons
4. Audio should respond to controls

### 5. Common Issues and Solutions

#### Issue: Audio stops when app goes to background
**Solution**: Check audio session configuration and ensure `staysActiveInBackground: true`

#### Issue: No media controls in notification
**Solution**: Check notification permissions and background task registration

#### Issue: Audio works but no background controls
**Solution**: Verify background task is registered and notification is created

#### Issue: iOS audio stops in background
**Solution**: Ensure `UIBackgroundModes` includes "audio" in app.json

#### Issue: Android audio stops in background
**Solution**: Check WAKE_LOCK and FOREGROUND_SERVICE permissions

### 6. Debug Logging

Enable debug logging to troubleshoot:

```typescript
// In audioStreamingService.ts
const logger = {
  debug: (message: string, ...args: any[]) => console.log(`[AudioStreamingService] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[AudioStreamingService] ${message}`, ...args),
};
```

Look for these log messages:
- `✅ Background audio started successfully`
- `🎵 Creating media notification...`
- `🎵 Background task registered: true`

### 7. Platform-Specific Notes

#### iOS
- Background audio only works in standalone apps (not Expo Go)
- Requires `UIBackgroundModes: ["audio"]` in Info.plist
- Audio session must be configured before playing

#### Android
- Requires foreground service for background audio
- Media notification is mandatory for background playback
- WAKE_LOCK permission prevents device sleep

### 8. Testing in Development

#### Expo Go Limitations
- Background audio doesn't work in Expo Go on iOS
- Use `npx expo run:ios` or `npx expo run:android` for testing

#### Development Build Testing
```bash
# iOS
npx expo run:ios

# Android  
npx expo run:android
```

### 9. Production Checklist

Before releasing:
- [ ] Test background audio on physical devices
- [ ] Verify media controls work in notification panel
- [ ] Test with device locked/unlocked
- [ ] Test with other audio apps
- [ ] Verify audio resumes after phone calls
- [ ] Test battery optimization settings

### 10. Debugging Commands

```bash
# Check if background tasks are registered
npx expo run:ios --device
# Then in Metro logs, look for: "Background task registered: true"

# Check notification permissions
# Look for: "Notification permissions granted: true"

# Check audio session
# Look for: "Audio initialized successfully with background audio support"
```

### 11. Known Limitations

- Background audio requires notification permissions
- iOS requires standalone app (not Expo Go)
- Some Android devices have aggressive battery optimization
- Background tasks may be limited by OS power management

### 12. Support

If background audio still doesn't work after following this guide:

1. Check console logs for error messages
2. Verify all permissions are granted
3. Test on different devices/OS versions
4. Ensure app.json configuration is correct
5. Try rebuilding the app with `npx expo run:ios/android` 