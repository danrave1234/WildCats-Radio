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
- [x] WebSocket binary message size configuration
- [x] Security configuration for public endpoints

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
- [x] Role-based stream access control (ADMIN and DJ roles)
- [ ] Secure credential management
- [x] CORS configuration for WebSockets
- [x] Public access to stream status and WebSocket endpoints

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
- [x] Backend WebSocket endpoint testing
- [x] Stream status API endpoint testing
- [x] WebSocket connection establishment verification
- [ ] Complete Audio Streaming Pipeline (Browser → WebSocket → FFmpeg → Shoutcast)
- [ ] Listener Playback Testing across different devices
- [ ] Stream metadata handling
- [ ] Error recovery and reconnection logic
- [ ] Performance testing with multiple listeners

### Documentation
- [x] Basic Shoutcast DNAS documentation
- [ ] Integration architecture documentation
- [ ] DJ streaming guide
- [ ] Listener guide
- [ ] Troubleshooting guide

## Overview

This roadmap outlines the steps needed to implement Shoutcast streaming functionality in the WildCats Radio project. The integration will allow DJs to stream audio content directly through their browsers or mobile devices, which will then be broadcast to listeners via a Shoutcast DNAS server.

## Current Status

- FFmpeg is already installed
- Shoutcast DNAS is already installed
- Basic ShoutcastService and ShoutcastController are implemented
- Project is deployed on Heroku (backend) but local testing is needed

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

#### 2.2 Radio Player Component

- **File to create**: `frontend/src/components/RadioPlayer.jsx`
- **Purpose**: Allow listeners to tune in to the radio stream
- **Implementation**:
  ```