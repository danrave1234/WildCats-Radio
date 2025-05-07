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

### Frontend Components
- [ ] DJ Streaming Component (DjStreamer.jsx)
- [ ] Audio capture with MediaRecorder API
- [ ] WebSocket connection management
- [ ] Stream control UI (start/stop buttons)
- [ ] Error handling and status display
- [ ] Radio Player Component (RadioPlayer.jsx)
- [ ] Stream status checking
- [ ] Audio playback interface
- [ ] Loading/error state handling

### Authentication & Security
- [x] Basic authentication for DJ access
- [x] Role-based stream access control
- [ ] Secure credential management
- [x] CORS configuration for WebSockets
- [ ] Input validation for stream parameters

### Advanced Shoutcast Features
- [x] Multiple stream support configuration
- [ ] DJ/User ID support (username:password format)
- [ ] Stream metadata updates during broadcast
- [ ] YP Directory listing configuration
- [ ] Introduction and backup files setup
- [ ] Stream recording functionality
- [ ] Artwork/album art transmission support
- [ ] Multiple bitrate support
- [ ] Listener statistics collection

### Integration and Testing
- [x] Backend-Frontend WebSocket connection testing
- [ ] Complete Audio Streaming Pipeline (Browser → WebSocket → FFmpeg → Shoutcast)
- [ ] Listener Playback Testing across different devices
- [ ] Stream metadata handling
- [x] Error recovery and reconnection logic
- [ ] Performance testing with multiple listeners

### Documentation
- [x] Basic Shoutcast DNAS documentation
- [ ] Integration architecture documentation
- [ ] DJ streaming guide
- [ ] Listener guide
- [ ] Troubleshooting guide

## Detailed Implementation

The following components have been implemented to enable Shoutcast streaming in the WildCats Radio project. This implementation integrates with the existing Broadcast system to provide a seamless streaming experience.

### 1. Backend Components

#### 1.1 AudioStreamHandler (New)
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

#### 1.3 StreamController (New)
- **File**: `backend/src/main/java/com/wildcastradio/ShoutCast/StreamController.java`
- **Purpose**: Provides REST endpoints for stream control
- **Key Endpoints**:
  - `/api/stream/start`: Authorizes stream start, creates a broadcast if needed
  - `/api/stream/stop`: Ends the active broadcast
  - `/api/stream/status`: Returns current stream and server status
- **Integration**: Works with existing BroadcastService to manage broadcasts

#### 1.4 Application Properties (Updated)
- **File**: `backend/src/main/resources/application.properties`
- **Changes**:
  - Added WebSocket configuration for maximum message sizes
  - Shoutcast configuration properties were already present

### 2. Integration with Existing Broadcast System

The implementation leverages the existing BroadcastEntity and BroadcastService to manage broadcasts:

1. When a DJ initiates streaming:
   - The StreamController creates or reuses a BroadcastEntity
   - The BroadcastService changes the status to LIVE
   - The ShoutcastService is notified to prepare for streaming

2. When audio streaming begins:
   - The AudioStreamHandler receives WebSocket connections
   - Audio data is transcoded via FFmpeg to MP3 format
   - The stream is sent to the Shoutcast server

3. When streaming ends:
   - The StreamController ends the broadcast
   - BroadcastService updates the broadcast status to ENDED
   - ShoutcastService terminates the stream connection
   - AudioStreamHandler cleans up resources

This approach maintains the separation of concerns:
- BroadcastService handles the business logic for broadcasts
- ShoutcastService manages server communication
- AudioStreamHandler handles real-time audio processing

### 3. Test Implementation: websocket-test.html

A standalone HTML file named `websocket-test.html` was created to test and validate the WebSocket streaming functionality. This implementation serves as a reference for the DJ frontend implementation and has proven to work successfully with the backend streaming pipeline.

#### 3.1 Key Features of websocket-test.html

- **Standalone Testing**: The file works as a complete, standalone application for testing DJ streaming without requiring the full frontend application.
- **User Interface**:
  - Connection settings (WebSocket URL and API Base URL)
  - Stream control buttons (Start Stream, Stop Stream, Check Stream Status)
  - Status display showing connection state
  - Audio visualizer with frequency spectrum display
  - Volume meter showing audio levels
  - Detailed logging panel showing connection events and data flow

- **Audio Streaming Implementation**:
  - Uses the MediaRecorder API to capture audio from the microphone
  - Handles different audio formats with fallback options (audio/webm, audio/webm;codecs=opus, audio/ogg;codecs=opus)
  - Configures audio quality parameters (128 kbps bitrate)
  - Sends audio data in small chunks (100ms) to ensure smooth streaming

- **WebSocket Connection Management**:
  - Establishes binary WebSocket connections for sending audio data
  - Handles connection errors and unexpected disconnections
  - Implements exponential backoff reconnection logic with max retry limits
  - Proper resource cleanup when streaming stops

- **Backend Integration**:
  - Makes API calls to the backend for stream authorization (/api/stream/start)
  - Notifies the backend when streaming ends (/api/stream/stop)
  - Checks stream status via API (/api/stream/status)

#### 3.2 Implementation Details

##### 3.2.1 Audio Capture and Processing
```javascript
// Get audio from microphone with optimized settings
audioStream = await navigator.mediaDevices.getUserMedia({
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
    }
});

// Set up audio context for visualization
audioContext = new (window.AudioContext || window.webkitAudioContext)();
const source = audioContext.createMediaStreamSource(audioStream);
analyser = audioContext.createAnalyser();
analyser.fftSize = 256;
source.connect(analyser);

// Find supported audio format
const options = {
    mimeType: 'audio/webm',
    audioBitsPerSecond: 128000
};

// Try to find a supported mime type with fallbacks
if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        options.mimeType = 'audio/ogg;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options.mimeType = 'audio/mp4';
    }
}

mediaRecorder = new MediaRecorder(audioStream, options);
```

##### 3.2.2 WebSocket Connection and Audio Transmission
```javascript
// Connect to WebSocket server
websocket = new WebSocket(serverUrlInput.value);
websocket.binaryType = "arraybuffer";

// Send audio data through WebSocket when available
mediaRecorder.ondataavailable = async (e) => {
    if (e.data.size > 0 && websocket && websocket.readyState === WebSocket.OPEN) {
        try {
            const arrayBuffer = await e.data.arrayBuffer();
            websocket.send(arrayBuffer);
        } catch (error) {
            // Handle errors and reconnect if needed
            if (error.message.includes("null") && isStreaming) {
                setTimeout(connectWebSocket, 1000);
            }
        }
    }
};

// Capture audio in small chunks for smoother streaming
mediaRecorder.start(100); // 100ms chunks
```

##### 3.2.3 Error Handling and Reconnection Logic
```javascript
// Handle WebSocket connection closing
websocket.onclose = (event) => {
    if (isStreaming && retryCount < MAX_RETRIES) {
        retryCount++;
        const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff with max of 10 seconds
        setTimeout(connectWebSocket, backoffTime);
    } else if (retryCount >= MAX_RETRIES) {
        isStreaming = false;
        stopStream();
    } else {
        updateStatus('disconnected', 'Disconnected');
    }
};
```

##### 3.2.4 Proper Resource Cleanup
```javascript
// Stop streaming and clean up resources
async function stopStream() {
    isStreaming = false;
    
    // Stop MediaRecorder
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    
    // Stop all audio tracks
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
    }
    
    // Close AudioContext
    if (audioContext) {
        await audioContext.close();
        audioContext = null;
        analyser = null;
    }
    
    // Close WebSocket
    if (websocket) {
        if (websocket.readyState === WebSocket.OPEN || websocket.readyState === WebSocket.CONNECTING) {
            websocket.close();
        }
        websocket = null;
    }
    
    // Notify server
    try {
        await fetch(`${apiUrlInput.value}/api/stream/stop`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        // Log error but continue cleanup
    }
}
```

#### 3.3 Key Learnings from websocket-test.html Implementation

1. **Audio Format Compatibility**: The implementation demonstrated that `audio/webm` or `audio/webm;codecs=opus` formats work best with FFmpeg for transcoding to MP3.

2. **Chunk Size Optimization**: Sending audio data in 100ms chunks provides a good balance between latency and transmission efficiency.

3. **Resilient Connection Handling**: Implementing proper reconnection logic with exponential backoff is crucial for maintaining stable streams.

4. **Resource Management**: Proper cleanup of media resources (tracks, contexts, recorders) is essential to prevent memory leaks and browser performance issues.

5. **Error Logging**: Comprehensive logging of all streaming events helped identify and troubleshoot issues in the audio pipeline.

6. **Visual Feedback**: The audio visualizer and volume meter provided important visual confirmation that audio was being captured correctly.

#### 3.4 Integration Points for Frontend Implementation

When implementing the DJ streaming functionality in the React frontend, the following elements from websocket-test.html should be incorporated:

1. **Audio Capture Configuration**: Reuse the same audio configuration parameters for optimal quality.

2. **Format Detection and Fallbacks**: Implement the same format detection and fallback mechanisms.

3. **Connection Management**: Use the same WebSocket connection and reconnection patterns.

4. **Resource Cleanup**: Ensure proper cleanup of all resources when the component unmounts or streaming stops.

5. **Visual Feedback**: Consider implementing audio visualization for user feedback during streaming.

### 4. Core Components Still To Be Implemented

1. **Frontend DJ Streaming Interface**:
   - Component to capture and stream audio from browser
   - Interface to control streaming (start/stop)
   - Status indicators and error handling

2. **Frontend Radio Player**:
   - Component to play the Shoutcast stream
   - Status checking and auto-reconnection

## Overview

This roadmap outlines the steps needed to implement Shoutcast streaming functionality in the WildCats Radio project. The integration will allow DJs to stream audio content directly through their browsers or mobile devices, which will then be broadcast to listeners via a Shoutcast DNAS server.

## Current Status

- FFmpeg is already installed
- Shoutcast DNAS is already installed
- Basic ShoutcastService and ShoutcastController are implemented
- Project is deployed on Heroku (backend) but local testing is needed
- The websocket-test.html implementation has proven the WebSocket streaming concept works

## Implementation Roadmap

### 1. Backend Components

#### 1.1 WebSocket Handler for Audio Streaming

- **File to create**: `backend/src/main/java/com/wildcastradio/ShoutCast/AudioStreamHandler.java`
- **Purpose**: Handle WebSocket connections and route audio data to Shoutcast server via FFmpeg
- **Implementation**:
  ```java
  @Component
  public class AudioStreamHandler extends BinaryWebSocketHandler {
    private static final Logger logger = LoggerFactory.getLogger(AudioStreamHandler.class);
    private Process ffmpeg;
    private String streamUrl;
    private String streamPassword;

    @Value("${shoutcast.server.url:localhost}")
    private String serverUrl;

    @Value("${shoutcast.server.port:8000}")
    private String serverPort;

    @Value("${shoutcast.server.source.password:hackme}")
    private String sourcePassword;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
      logger.info("WebSocket connection established for audio streaming");
      
      // Create the FFmpeg process to transcode WebM audio to MP3 for Shoutcast
      streamUrl = "icecast://source:" + sourcePassword + "@" + serverUrl + ":" + serverPort + "/stream";
      
      List<String> command = new ArrayList<>();
      command.add("ffmpeg");
      command.add("-y");
      command.add("-f");
      command.add("webm");
      command.add("-i");
      command.add("pipe:0");
      command.add("-c:a");
      command.add("libmp3lame");
      command.add("-b:a");
      command.add("128k");
      command.add("-f");
      command.add("mp3");
      command.add(streamUrl);

      ProcessBuilder pb = new ProcessBuilder(command);
      pb.redirectErrorStream(true);
      
      logger.info("Starting FFmpeg process with command: {}", String.join(" ", command));
      ffmpeg = pb.start();
      
      // Start a thread to log FFmpeg output
      new Thread(() -> {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(ffmpeg.getInputStream()))) {
          String line;
          while ((line = reader.readLine()) != null) {
            logger.info("FFmpeg: {}", line);
          }
        } catch (IOException e) {
          logger.error("Error reading FFmpeg output", e);
        }
      }).start();
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) throws IOException {
      if (ffmpeg != null && ffmpeg.isAlive()) {
        try {
          ffmpeg.getOutputStream().write(message.getPayload().array());
          ffmpeg.getOutputStream().flush();
        } catch (IOException e) {
          logger.error("Error writing to FFmpeg process", e);
          session.close(CloseStatus.SERVER_ERROR);
        }
      }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
      logger.info("WebSocket connection closed: {}", status);
      if (ffmpeg != null) {
        logger.info("Stopping FFmpeg process");
        ffmpeg.destroy();
        try {
          // Wait for process to terminate
          boolean terminated = ffmpeg.waitFor(5, TimeUnit.SECONDS);
          if (!terminated) {
            logger.warn("FFmpeg process did not terminate gracefully, forcing shutdown");
            ffmpeg.destroyForcibly();
          }
        } catch (InterruptedException e) {
          logger.error("Interrupted while waiting for FFmpeg to terminate", e);
          Thread.currentThread().interrupt();
        }
      }
    }
  }
  ```

#### 1.2 Update WebSocket Configuration

- **File to modify**: `backend/src/main/java/com/wildcastradio/config/WebSocketConfig.java`
- **Changes needed**:
  - Add configuration for the audio streaming WebSocket endpoint
  - Register the AudioStreamHandler

```java
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    @Autowired
    private AudioStreamHandler audioStreamHandler;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // Register the audio stream handler
        registry.addHandler(audioStreamHandler, "/stream")
                .setAllowedOrigins("*");
        
        // Keep existing STOMP endpoints for chat functionality
    }
}
```

#### 1.3 Update StreamController

- **File to create**: `backend/src/main/java/com/wildcastradio/ShoutCast/StreamController.java`
- **Purpose**: Provide REST endpoints for stream control
- **Implementation**:
  ```java
  @RestController
  @RequestMapping("/api/stream")
  public class StreamController {
    
    @Autowired
    private ShoutcastService shoutcastService;
    
    @PostMapping("/start")
    @PreAuthorize("hasRole('DJ')")
    public ResponseEntity<Void> start() {
        // This endpoint handles the authorization and permission check
        // The actual streaming happens via WebSocket connection
        return ResponseEntity.ok().build();
    }
    
    @PostMapping("/stop") 
    @PreAuthorize("hasRole('DJ')")
    public ResponseEntity<Void> stop() {
        // The actual streaming termination happens when WebSocket is closed
        return ResponseEntity.ok().build();
    }
    
    @GetMapping("/status")
    public Map<String, Object> status() {
        boolean isServerAccessible = shoutcastService.isServerAccessible();
        boolean isInTestMode = shoutcastService.isInTestMode();
        
        Map<String, Object> status = new HashMap<>();
        status.put("live", isServerAccessible);
        status.put("testMode", isInTestMode);
        return status;
    }
  }
  ```

#### 1.4 Update application.properties

- **File to modify**: `backend/src/main/resources/application.properties`
- **Add Shoutcast configuration**:
  ```properties
  # Shoutcast Server Configuration
  shoutcast.server.url=localhost
  shoutcast.server.port=8000
  shoutcast.server.admin.password=admin
  shoutcast.server.source.password=hackme
  shoutcast.server.mount=/stream
  
  # Configure maximum WebSocket message size
  spring.websocket.max-text-message-size=65536
  spring.websocket.max-binary-message-size=1048576
  ```

### 2. Frontend Components

#### 2.1 DJ Streaming Component

- **File to create**: `frontend/src/components/DjStreamer.jsx`
- **Purpose**: Allow DJs to start/stop streaming audio from their devices
- **Implementation**:
  ```jsx
  import { useState, useRef, useEffect } from 'react';
  import axios from 'axios';

  export default function DjStreamer() {
    const [streaming, setStreaming] = useState(false);
    const [streamingError, setStreamingError] = useState(null);
    const mediaRef = useRef(null);
    const socketRef = useRef(null);
    const mediaRecorderRef = useRef(null);

    // Clean up on component unmount
    useEffect(() => {
      return () => {
        if (mediaRef.current) {
          mediaRef.current.getTracks().forEach(track => track.stop());
        }
        if (socketRef.current) {
          socketRef.current.close();
        }
      };
    }, []);

    const startStreaming = async () => {
      try {
        setStreamingError(null);
        
        // 1. Request server authorization
        await axios.post('/api/stream/start');
        
        // 2. Get audio from microphone
        const audioStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        mediaRef.current = audioStream;
        
        // 3. Create WebSocket connection
        const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/stream`);
        ws.binaryType = "arraybuffer";
        
        // 4. Set up MediaRecorder to stream audio chunks
        const mediaRecorder = new MediaRecorder(audioStream, { 
          mimeType: 'audio/webm;codecs=opus',
          audioBitsPerSecond: 128000
        });
        
        // 5. Send audio data through WebSocket when available
        mediaRecorder.ondataavailable = async (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            const arrayBuffer = await e.data.arrayBuffer();
            ws.send(arrayBuffer);
          }
        };
        
        // 6. Handle WebSocket events
        ws.onopen = () => {
          console.log('WebSocket connection established');
          mediaRecorder.start(100); // Capture in 100ms chunks
          setStreaming(true);
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setStreamingError('Connection error occurred');
          stopStreaming();
        };
        
        ws.onclose = () => {
          console.log('WebSocket connection closed');
          if (streaming) {
            stopStreaming();
          }
        };
        
        socketRef.current = ws;
        mediaRecorderRef.current = mediaRecorder;
        
      } catch (error) {
        console.error('Error starting stream:', error);
        setStreamingError(error.message || 'Failed to start streaming');
        stopStreaming();
      }
    };

    const stopStreaming = async () => {
      // Stop MediaRecorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      
      // Stop all audio tracks
      if (mediaRef.current) {
        mediaRef.current.getTracks().forEach(track => track.stop());
        mediaRef.current = null;
      }
      
      // Close WebSocket
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      
      // Notify server
      try {
        await axios.post('/api/stream/stop');
      } catch (error) {
        console.error('Error stopping stream on server:', error);
      }
      
      setStreaming(false);
    };

    return (
      <div className="p-4 bg-gray-800 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-white">DJ Streaming Console</h2>
        
        {streamingError && (
          <div className="bg-red-600 text-white p-3 mb-4 rounded-md">
            {streamingError}
          </div>
        )}
        
        <div className="flex flex-col">
          {streaming ? (
            <>
              <div className="bg-red-500 text-white px-4 py-2 rounded-md mb-4 text-center">
                LIVE ON AIR
              </div>
              <button
                onClick={stopStreaming}
                className="bg-red-700 hover:bg-red-800 text-white font-bold py-3 px-6 rounded-lg transition duration-300"
              >
                Stop Streaming
              </button>
            </>
          ) : (
            <button
              onClick={startStreaming}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300"
            >
              Start Streaming
            </button>
          )}
        </div>
      </div>
    );
  }
  ```