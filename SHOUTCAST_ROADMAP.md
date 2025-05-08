# Shoutcast Integration Roadmap

## Implementation Checklist

### Shoutcast DNAS Server Setup
- [x] Download and extract Shoutcast DNAS
- [x] Configure sc_serv.conf file
- [x] Open firewall ports (8000 for HTTP, 8001 for source connections)
- [x] Basic server testing
- [x] Admin password configuration

### FFmpeg Integration
- [x] FFmpeg installation
- [x] Path configuration in environment
- [x] Basic transcoding test
- [x] Pipe-based streaming support testing

### Backend Components
- [x] Basic ShoutcastService implementation
- [x] Basic ShoutcastController implementation
- [x] Shoutcast configuration in application.properties
- [x] AudioStreamHandler implementation for WebSocket
- [x] Binary WebSocket message handling
- [x] FFmpeg process management in AudioStreamHandler
- [x] Error handling and logging for audio streams
- [x] Update WebSocket configuration for audio streaming
- [x] StreamController for REST endpoints (start/stop/status)
- [x] Stream status API with metadata for listeners

### Frontend Components
- [x] DJ Streaming in DJDashboard.jsx
- [x] Audio capture with MediaRecorder API
- [x] WebSocket connection management
- [x] Stream control UI (start/stop buttons)
- [x] Error handling and status display
- [x] Radio Player in ListenerDashboard.jsx
- [x] Stream status checking
- [x] Audio playback interface
- [x] Loading/error state handling
- [x] Audio visualization for listeners

### Authentication & Security
- [x] Basic authentication for DJ access
- [x] Role-based stream access control
- [x] Secure credential management
- [x] CORS configuration for WebSockets
- [x] Input validation for stream parameters

### Advanced Shoutcast Features
- [x] Multiple stream support configuration
- [x] DJ/User ID support (username:password format)
- [ ] Stream metadata updates during broadcast
- [ ] YP Directory listing configuration
- [ ] Introduction and backup files setup
- [ ] Stream recording functionality
- [ ] Artwork/album art transmission support
- [ ] Multiple bitrate support
- [x] Listener statistics collection

### Integration and Testing
- [x] Backend-Frontend WebSocket connection testing
- [x] Complete Audio Streaming Pipeline (Browser → WebSocket → FFmpeg → Shoutcast)
- [x] Listener Playback Testing across different devices
- [x] Stream metadata handling
- [x] Error recovery and reconnection logic
- [ ] Performance testing with multiple listeners

### Documentation
- [x] Basic Shoutcast DNAS documentation
- [x] Integration architecture documentation
- [x] DJ streaming guide
- [x] Listener guide
- [ ] Troubleshooting guide

## Detailed Implementation

The following components have been implemented to enable Shoutcast streaming in the WildCats Radio project. This implementation integrates with the existing Broadcast system to provide a seamless streaming experience.

### 1. Backend Components

#### 1.1 AudioStreamHandler
- **File**: `backend/src/main/java/com/wildcastradio/ShoutCast/AudioStreamHandler.java`
- **Purpose**: Handles WebSocket connections for audio streaming from DJ's browser to the Shoutcast server
- **Key Features**:
  - Manages binary WebSocket messages containing audio data
  - Creates and manages FFmpeg processes for transcoding WebM audio to MP3
  - Pipes browser audio data through FFmpeg to Shoutcast
  - Implements error handling and process cleanup
  - Logs FFmpeg output for debugging

#### 1.2 WebSocketConfig (Updated)
- **File**: `backend/src/main/java/com/wildcastradio/config/WebSocketConfig.java`
- **Purpose**: Configures WebSocket endpoints for the application
- **Changes**:
  - Added support for the binary WebSocket endpoint at `/stream`
  - Registered the AudioStreamHandler
  - Maintained existing STOMP WebSocket configuration for chat

#### 1.3 StreamController
- **File**: `backend/src/main/java/com/wildcastradio/ShoutCast/StreamController.java`
- **Purpose**: Provides REST endpoints for stream control
- **Key Endpoints**:
  - `/api/stream/start`: Authorizes stream start, creates a broadcast if needed
  - `/api/stream/stop`: Ends the active broadcast
  - `/api/stream/status`: Returns current stream and server status with metadata for listeners
- **Integration**: Works with existing BroadcastService to manage broadcasts

#### 1.4 Application Properties (Updated)
- **File**: `backend/src/main/resources/application.properties`
- **Changes**:
  - Added WebSocket configuration for maximum message sizes
  - Shoutcast configuration properties were already present

### 2. Frontend Components

#### 2.1 DJ Dashboard Streaming Implementation
- **File**: `frontend/src/pages/DJDashboard.jsx`
- **Purpose**: Allows DJs to broadcast audio directly from their browser
- **Key Features**:
  - Audio capture using MediaRecorder API with optimal settings
  - WebSocket connection to send audio to the backend
  - Stream control UI (start/stop buttons)
  - Audio visualization during broadcast
  - Error handling and automatic reconnection
  - Resource cleanup when broadcasting stops

#### 2.2 Listener Dashboard Implementation

A new section has been added to the ListenerDashboard component that allows listeners to tune in to live broadcasts.

- **File**: `frontend/src/pages/ListenerDashboard.jsx`
- **Purpose**: Provides a radio player interface for listeners to hear live broadcasts
- **Key Features**:
  - Direct connection to Shoutcast stream URL
  - Player controls for play/pause, mute, and volume adjustment
  - Audio visualization showing frequency spectrum during playback
  - Status indicators showing if a broadcast is live
  - Automatic stream status checking every 30 seconds
  - Error handling with automatic reconnection (up to 3 attempts)
  - Proper resource cleanup when component unmounts

**API Integration**:
- Uses `streamService.getStatus()` to check if a broadcast is currently live
- Uses `streamService.getListenerStreamUrl()` to get the direct HTTP stream URL
- Connects to Shoutcast stream on port 8000 with the configured mountpoint (/stream)

**Audio Player Implementation**:
```jsx
// Initialize audio player and set up event listeners
const audioRef = useRef(null);
if (!audioRef.current) {
  audioRef.current = new Audio();
  audioRef.current.volume = volume / 100;
  
  // Add event listeners for player state
  audioRef.current.addEventListener('playing', () => {
    setIsPlaying(true);
  });
  
  audioRef.current.addEventListener('pause', () => {
    setIsPlaying(false);
  });
  
  // Error handling with reconnection logic
  audioRef.current.addEventListener('error', (e) => {
    console.error('Audio error:', e);
    setStreamError('Error loading stream. Please try again.');
    setIsPlaying(false);
    
    // Try to reconnect if the stream fails
    if (reconnectAttempts < 3) {
      setTimeout(() => {
        setReconnectAttempts(prev => prev + 1);
        if (audioRef.current) {
          audioRef.current.src = streamUrl;
          audioRef.current.load();
        }
      }, 3000);
    }
  });
}
```

**Audio Visualization**:
```jsx
// Set up audio visualizer when playing
useEffect(() => {
  if (isPlaying && !audioContext && audioRef.current) {
    try {
      // Create audio context for visualization
      const context = new (window.AudioContext || window.webkitAudioContext)();
      const audioSource = context.createMediaElementSource(audioRef.current);
      const audioAnalyser = context.createAnalyser();
      
      // Connect the audio to the analyser and then to the destination
      audioSource.connect(audioAnalyser);
      audioAnalyser.connect(context.destination);
      
      // Set up analyser
      audioAnalyser.fftSize = 256;
      const bufferLength = audioAnalyser.frequencyBinCount;
      const audioDataArray = new Uint8Array(bufferLength);
      
      setAudioContext(context);
      setAnalyser(audioAnalyser);
      setDataArray(audioDataArray);
      
      // Start visualization
      const updateVisualization = () => {
        if (analyser) {
          analyser.getByteFrequencyData(audioDataArray);
          animationRef.current = requestAnimationFrame(updateVisualization);
        }
      };
      
      updateVisualization();
    } catch (error) {
      console.error("Error setting up audio visualization:", error);
    }
  }
  
  return () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };
}, [isPlaying, audioContext, analyser]);
```

This implementation allows any user to easily listen to live broadcasts directly from their browser without needing additional software or plugins. The player provides real-time feedback about the stream status and offers a modern interface consistent with the rest of the application.

#### 2.3 API Services for Streaming
- **File**: `frontend/src/services/api.js`
- **Purpose**: Provides API calls for stream control and status
- **Key Functions**:
  - `streamService.start()`: Authorizes and starts a stream
  - `streamService.stop()`: Stops an active stream
  - `streamService.getStatus()`: Checks server and stream status
  - `streamService.getStreamUrl()`: Gets WebSocket URL for DJs
  - `streamService.getListenerStreamUrl()`: Gets HTTP stream URL for listeners

### 3. Authentication & Security

Stream access is secured through several mechanisms:

- **DJ Authorization**: Only users with the DJ role can initiate broadcasts
- **Backend Security**: WebSocket connections for streaming require authentication
- **Shoutcast Server Security**: Source password authentication is used for FFmpeg to connect to Shoutcast
- **Error Handling**: Invalid stream attempts are rejected with appropriate error messages

### 4. Integration with Existing Broadcast System

The implementation leverages the existing BroadcastEntity and BroadcastService to manage broadcasts:

1. When a DJ initiates streaming:
   - The StreamController creates or reuses a BroadcastEntity
   - The BroadcastService changes the status to LIVE
   - The ShoutcastService is notified to prepare for streaming

2. When audio streaming begins:
   - The AudioStreamHandler receives WebSocket connections
   - Audio data is transcoded via FFmpeg to MP3 format
   - The stream is sent to the Shoutcast server

3. When listeners connect:
   - The ListenerDashboard checks for active broadcasts
   - If a broadcast is active, it connects to the Shoutcast HTTP stream
   - Audio is played through the HTML5 audio element
   - Visual feedback is provided through an audio visualizer

4. When streaming ends:
   - The StreamController ends the broadcast
   - BroadcastService updates the broadcast status to ENDED
   - ShoutcastService terminates the stream connection
   - AudioStreamHandler cleans up resources
   - Listeners are notified that the broadcast has ended

### 5. Shoutcast Server Configuration

The Shoutcast DNAS server is configured with:

- Main admin password: 123
- Stream password: 1234
- Port: 8000
- Mountpoint: /stream
- Max listeners: 100
- Public server: always
- Server ID: 1

### 6. Streaming Architecture

The complete streaming pipeline consists of:

1. **Browser Audio Capture**: DJ's browser captures audio using MediaRecorder API
2. **WebSocket Transmission**: Audio chunks are sent via binary WebSocket to backend
3. **Backend Processing**: AudioStreamHandler receives chunks and pipes them to FFmpeg
4. **Transcoding**: FFmpeg converts WebM/Opus audio to MP3 format suitable for Shoutcast
5. **Shoutcast Broadcasting**: FFmpeg sends the MP3 stream to Shoutcast DNAS server
6. **Listener Reception**: Listener browsers connect to the HTTP stream from Shoutcast
7. **Playback**: HTML5 audio elements play the stream on listener devices

### 7. Testing and Validation

The streaming functionality has been tested and validated with:

- Different browsers (Chrome, Firefox, Edge)
- Various audio input devices (built-in microphones, headsets)
- Multiple concurrent listeners
- Network interruption scenarios
- Resource cleanup validation

### 8. Future Enhancements

Planned enhancements include:

- Stream metadata updates during broadcast
- Multiple bitrate support for different connection speeds
- Stream recording functionality
- Enhanced analytics for listener statistics
- Artwork/album art transmission

## Conclusion

The Shoutcast integration provides a complete end-to-end streaming solution that enables:

1. **DJs to broadcast** directly from their browsers without additional software
2. **Listeners to tune in** to live broadcasts from any device with a web browser
3. **Admins to monitor** broadcasting activity and listener statistics

The implementation maintains compatibility with existing radio applications (like VLC, Winamp) while providing a modern web-based interface for both broadcasting and listening.