# Persistent Broadcast Functionality Documentation

**Project:** WildCats Radio  
**Author:** Vincent  
**Date:** May 27, 2025  
**Version:** 1.0

## Overview

The persistent broadcast functionality in WildCats Radio ensures that audio streams continue playing seamlessly across page refreshes, browser navigation, and network interruptions. This system provides a continuous listening experience similar to modern streaming platforms like Spotify or YouTube Music.

## Architecture Components

### 1. Global Audio Stream Context (`AudioStreamContext.jsx`)

**Location:** `frontend/src/context/AudioStreamContext.jsx`

The core of the persistent functionality is implemented through a React Context that manages:

- **Audio Element Management**: Single global HTML5 audio element
- **State Persistence**: localStorage-based stream state preservation
- **Network Resilience**: Automatic reconnection and error handling
- **Real-time Updates**: WebSocket integration for live stream status

#### Key Features:

```javascript
// Core state management
const [isPlaying, setIsPlaying] = useState(false);
const [currentStream, setCurrentStream] = useState(null);
const [isStreamBarVisible, setIsStreamBarVisible] = useState(false);
const [serverConfig, setServerConfig] = useState(null);
```

#### Persistence Mechanism:

```javascript
// Save stream state to localStorage
localStorage.setItem('persistentStream', JSON.stringify({
  isPlaying: true,
  currentTime: audioRef.current.currentTime,
  streamUrl: audioRef.current.src,
  volume: volume
}));
```

### 2. Stream Bar Component (`StreamBar.jsx`)

**Location:** `frontend/src/components/StreamBar.jsx`

A persistent UI component that appears at the bottom of all pages when audio is playing:

- **Always Visible**: Shows across all pages when stream is active
- **Quick Controls**: Play/pause, volume, stop functionality
- **Stream Information**: Current track and station details
- **Minimizable**: Can be hidden but remains functional

### 3. Network Configuration System

#### Dynamic IP Detection

Both frontend and backend use identical network detection logic:

**Frontend (`vite.config.js`):**
```javascript
function getNetworkInfo() {
  const networkInterfaces = require('os').networkInterfaces();
  // Prioritizes Wi-Fi and Ethernet over virtual adapters
  // Returns the same IP that backend detects
}
```

**Backend (`NetworkConfig.java`):**
```java
@Component
public class NetworkConfig {
    public String getServerIpAddress() {
        // Identical logic to frontend
        // Ensures URL consistency across components
    }
}
```

#### CORS Configuration

**Backend (`SecurityConfig.java`):**
```java
@Bean
public CorsConfigurationSource corsConfigurationSource() {
    // Dynamically builds allowed origins including:
    // - localhost variants (localhost, 127.0.0.1)
    // - Network IP variants (detected IP address)
    // - All ports (3000, 5173, 8080, etc.)
}
```

### 4. Icecast Server Configuration

**Location:** `icecast.xml`

```xml
<icecast>
    <hostname>192.168.254.116</hostname>
    <listen-socket>
        <port>8000</port>
        <bind-address>0.0.0.0</bind-address>
    </listen-socket>
    
    <http-headers>
        <header name="Access-Control-Allow-Origin" value="*"/>
        <header name="Access-Control-Allow-Methods" value="GET, POST, OPTIONS"/>
    </http-headers>
    
    <mount>
        <mount-name>/live.ogg</mount-name>
        <!-- Stream configuration -->
    </mount>
</icecast>
```

## Implementation Details

### State Persistence Flow

1. **Stream Initialization**
   ```javascript
   // When user starts playing
   audioRef.current.src = streamUrl;
   audioRef.current.play();
   
   // Save to localStorage
   localStorage.setItem('persistentStream', JSON.stringify({
     isPlaying: true,
     streamUrl: streamUrl,
     volume: volume,
     currentTime: audioRef.current.currentTime
   }));
   ```

2. **Page Load Restoration**
   ```javascript
   useEffect(() => {
     const savedStream = localStorage.getItem('persistentStream');
     if (savedStream && serverConfig) {
       const streamData = JSON.parse(savedStream);
       // Restore audio source and state
       audioRef.current.src = streamData.streamUrl;
       setIsStreamBarVisible(true);
       // Don't auto-play - let user decide
     }
   }, [serverConfig]);
   ```

3. **State Cleanup**
   ```javascript
   const clearInvalidLocalStorage = useCallback(() => {
     // Validates saved URLs against current server config
     // Clears invalid data to prevent errors
     if (!expectedUrl || !streamData.streamUrl.includes('live.ogg')) {
       localStorage.removeItem('persistentStream');
       setIsStreamBarVisible(false);
     }
   }, [serverConfig]);
   ```

### Error Handling & Recovery

#### Network Interruption Recovery
```javascript
audioRef.current.addEventListener('error', (e) => {
  // Exponential backoff reconnection
  if (reconnectAttempts.current < 3) {
    setTimeout(() => {
      reconnectAttempts.current += 1;
      audioRef.current.src = streamUrl;
      audioRef.current.load();
    }, 3000 * reconnectAttempts.current);
  }
});
```

#### Empty Source Attribute Fix
```javascript
// Prevent "empty src" errors
if (audioRef.current.src && audioRef.current.src !== streamUrl) {
  audioRef.current.pause();
  audioRef.current.src = '';
  audioRef.current.load();
}
audioRef.current.src = streamUrl;
audioRef.current.load();
```

### Real-time Updates via WebSocket

```javascript
const setupWebSocketForStreamStatus = useCallback(() => {
  const stompClient = createStompClient('/ws-radio');
  
  stompClient.subscribe('/topic/stream/status', (message) => {
    const status = JSON.parse(message.body);
    setIsLive(status.live);
    
    // Auto-reconnect when stream comes back online
    if (status.server === 'UP' && status.live && !isPlaying) {
      audioRef.current.src = serverConfig.streamUrl;
      audioRef.current.load();
    }
  });
}, []);
```

## Network Debug Panel

**Access:** Press `Ctrl+Shift+D` in development mode

**Location:** `frontend/src/components/NetworkDebugPanel.jsx`

Displays real-time network configuration for troubleshooting:

- **Server IP Address**: Current detected network IP
- **Frontend Location**: Browser's current location
- **Stream URLs**: All generated stream URLs
- **CORS Origins**: Configured allowed origins
- **Connection Status**: WebSocket and API connectivity

## Troubleshooting Common Issues

### 1. "Stream source not available" Error

**Cause**: URL mismatch between Icecast hostname and backend IP detection

**Solution**:
```xml
<!-- icecast.xml -->
<hostname>192.168.254.116</hostname>  <!-- Match network IP -->
```

### 2. Persistent Stream Bar Shows Without Playing

**Cause**: Invalid localStorage data from previous sessions

**Solution**: Automatic cleanup implemented
```javascript
// Validates localStorage against current server config
clearInvalidLocalStorage();
```

### 3. Chat/WebSocket Connection Issues

**Cause**: CORS configuration not matching dynamic IP

**Solution**: Dynamic CORS origins in `SecurityConfig.java`
```java
origins.add("http://" + serverIp + ":3000");
origins.add("http://" + serverIp + ":5173");
```

## Testing Procedures

### 1. Stream Persistence Test
1. Start playing audio stream
2. Navigate to different pages
3. Refresh browser
4. Verify stream continues and controls remain functional

### 2. Network Recovery Test
1. Start stream
2. Disconnect network for 10 seconds
3. Reconnect network
4. Verify automatic reconnection

### 3. Multi-device Test
1. Start stream on Device A
2. Access same stream URL on Device B
3. Verify both can listen simultaneously

## File Structure

```
WildCats-Radio/
├── icecast.xml                               # Icecast server configuration
├── frontend/
│   ├── src/
│   │   ├── context/
│   │   │   └── AudioStreamContext.jsx        # Core persistence logic
│   │   ├── components/
│   │   │   ├── StreamBar.jsx                 # Persistent UI component
│   │   │   └── NetworkDebugPanel.jsx         # Debug utilities
│   │   └── pages/
│   │       └── ListenerDashboard.jsx         # Main listener interface
│   └── vite.config.js                        # Frontend network detection
└── backend/
    └── src/main/java/com/wildcatsradio/
        ├── config/
        │   ├── NetworkConfig.java             # Network IP detection
        │   └── SecurityConfig.java            # CORS configuration
        └── controller/
            └── StreamController.java          # Stream API endpoints
```

## Performance Optimizations

### 1. Throttled Status Checks
```javascript
// Only check stream status once every 10 seconds
const throttledStatusCheck = throttle(performStatusCheck, 10000);
```

### 2. Minimal localStorage Writes
```javascript
// Only save to localStorage every 5 seconds during playback
if (isPlaying && now - lastSaveTime > 5000) {
  localStorage.setItem('persistentStream', ...);
}
```

### 3. Smart WebSocket Management
```javascript
// Prevent multiple WebSocket connections
if (wsConnectedRef.current && stompClientRef.current?.connected) {
  return; // Don't create new connection
}
```

## Security Considerations

1. **CORS Configuration**: Restricts origins to known development and production URLs
2. **Input Validation**: Stream URLs validated against expected patterns
3. **Error Boundaries**: Graceful handling of malformed localStorage data
4. **Resource Cleanup**: Proper cleanup of audio elements and WebSocket connections

## Future Enhancements

1. **Offline Support**: Cache stream segments for temporary offline playback
2. **Multiple Stream Support**: Allow switching between different streams
3. **Advanced Queue Management**: Playlist and queue functionality
4. **Analytics Integration**: Track listening behavior and preferences
5. **Mobile App Integration**: Extend persistence to mobile applications

## Technical Notes

- **Browser Compatibility**: Tested on Chrome, Firefox, Edge, Safari
- **Audio Format**: Ogg Vorbis (.ogg) primary, MP3 fallback
- **Network Requirements**: Local network access, ports 3000, 5173, 8000, 8080
- **Memory Usage**: Minimal impact due to single audio element approach
- **Latency**: ~2-3 second delay for live streams (Icecast default)

---

**Last Updated**: May 27, 2025  
**Contact**: Vincent  
**Project Repository**: WildCats-Radio 