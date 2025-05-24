# Icecast Transition Roadmap

## Overview

This document outlines the plan to transition our broadcasting system from Shoutcast DNAS to Icecast. Based on the successful prototype implementation, this transition aims to provide a more reliable and flexible streaming solution while leveraging existing components where possible.

## Why Transition from Shoutcast to Icecast?

- **Open Source**: Icecast is fully open-source with an active community
- **Better Documentation**: More comprehensive and up-to-date documentation
- **Modern Features**: Better support for modern streaming technologies
- **Flexible Configuration**: More configurable, especially for network discovery
- **Cross-platform**: Better cross-platform support
- **Proven Implementation**: Already successfully tested in our prototype

## Implementation Checklist Update

### Backend Components
| Current (Shoutcast) | New (Icecast) | Action | Status |
|---------------------|---------------|--------|--------|
| `ShoutcastService.java` | `IcecastService.java` | Replace with Icecast-specific service | ✅ Completed |
| `AudioStreamHandler.java` | `IcecastStreamHandler.java` | Implement WebSocket handler for Icecast | ✅ Completed |
| `StreamController.java` (Shoutcast) | `StreamController.java` (Icecast) | Update REST endpoints for Icecast | ✅ Completed |
| `NetworkConfig.java` | `NetworkConfig.java` | Enhance for automatic IP detection | ✅ Completed |
| N/A | `config/icecast.xml` | Add Icecast configuration | ✅ Completed |
| N/A | `WebSocketMessageConfig.java` | Add WebSocket STOMP messaging config | ✅ Completed |

### Frontend Components
| Current (Shoutcast) | New (Icecast) | Action | Status |
|---------------------|---------------|--------|--------|
| `DJDashboard.jsx` (Shoutcast WebSocket) | `DJDashboard.jsx` (Icecast WebSocket) | Update for Icecast stream URLs | ✅ Completed |
| `ListenerDashboard.jsx` (Shoutcast stream URLs) | `ListenerDashboard.jsx` (Icecast stream URLs) | Update audio player for Icecast | ✅ Completed |
| `streamService.js` (Shoutcast APIs) | `streamService.js` (Icecast APIs) | Update API calls for Icecast | ✅ Completed |
| N/A | Frontend status indicators | Add server status indicators | ✅ Completed |

### Configuration Files
| Current (Shoutcast) | New (Icecast) | Action | Status |
|---------------------|---------------|--------|--------|
| Shoutcast properties in `application.properties` | Icecast properties in `application.properties` | Update server configuration | ✅ Completed |
| N/A | `config/icecast.xml` | Add Icecast server configuration | ✅ Completed |
| N/A | `config/ICECAST_SETUP.md` | Create setup documentation | ✅ Completed |

### Code Cleanup
- ✅ **All Shoutcast DNAS server startup/configuration code**
- ✅ **Shoutcast-specific authentication format (username:password)**
- ✅ **Shoutcast XML parsers and status checkers**
- ✅ **ShoutcastController endpoint APIs**
- ✅ **Shoutcast stream monitoring**
- ✅ **SHOUTCAST_ROADMAP.md** (replaced with this document)

## Components to Replace/Modify

### Backend Components

| Current (Shoutcast) | New (Icecast) | Action | Status |
|---------------------|---------------|--------|--------|
| `AudioStreamHandler.java` | `IcecastStreamHandler.java` | Replace with new handler that pipes to Icecast | ✅ Completed |
| `ShoutcastService.java` | `IcecastService.java` | Replace with Icecast-specific service | ✅ Completed |
| `StreamController.java` | `StreamController.java` | Modify to work with Icecast | ✅ Completed |
| N/A | `NetworkConfig.java` | Add new component for network discovery | ✅ Completed |
| `WebSocketConfig.java` | `WebSocketConfig.java` | Update configuration for Icecast streaming | ✅ Completed |

### Frontend Components

| Current (Shoutcast) | New (Icecast) | Action | Status |
|---------------------|---------------|--------|--------|
| DJ streaming in DJDashboard.jsx | Update DJ interface | Modify WebSocket usage and FFmpeg piping | ⏳ In Progress |
| Radio Player in ListenerDashboard.jsx | Update player component | Modify to use Icecast stream URLs | ⏳ In Progress |

## Code to Delete/Repurpose

### Code to Delete

- **All Shoutcast DNAS server startup/configuration code**
- **Shoutcast-specific authentication format (username:password)**
- **YP Directory listing configuration**

### Code to Repurpose

- **FFmpeg Integration**: The existing FFmpeg code can be repurposed with modifications to output format
- **WebSocket Implementation**: Retain basic structure but update to handle Icecast streaming
- **Authentication & Security**: Modify for Icecast but keep general approach
- **Stream Control UI**: Retain UI elements but update underlying logic

## Detailed Technical Changes

### 1. Server Configuration

#### Current Shoutcast Configuration:
```
- Main admin password: 123
- Stream password: 1234
- Port: 8000
- Mountpoint: /stream
- Max listeners: 100
```

#### New Icecast Configuration:
```xml
<icecast>
  <location>Earth</location>
  <admin>admin@localhost</admin>
  
  <!-- Use NetworkConfig to detect and set hostname dynamically -->
  <hostname>auto-detected-ip</hostname>

  <limits>
    <clients>100</clients>
    <sources>2</sources>
    <queue-size>524288</queue-size>
    <client-timeout>30</client-timeout>
    <header-timeout>15</header-timeout>
    <source-timeout>10</source-timeout>
    <burst-on-connect>1</burst-on-connect>
    <burst-size>65535</burst-size>
  </limits>

  <authentication>
    <source-password>hackme</source-password>
    <relay-password>hackme</relay-password>
    <admin-user>admin</admin-user>
    <admin-password>hackme</admin-password>
  </authentication>

  <listen-socket>
    <port>8000</port>
    <bind-address>0.0.0.0</bind-address>
  </listen-socket>

  <http-headers>
    <header name="Access-Control-Allow-Origin" value="*"/>
  </http-headers>

  <mount>
    <mount-name>/live.ogg</mount-name>
    <username>source</username>
    <password>hackme</password>
    <max-listeners>100</max-listeners>
  </mount>
</icecast>
```

### 2. Backend Changes

#### New NetworkConfig Component:
```java
@Component
public class NetworkConfig {
    private static final Logger logger = LoggerFactory.getLogger(NetworkConfig.class);
    
    @Value("${server.port:8080}")
    private int serverPort;
    
    private String serverIp;
    
    @PostConstruct
    public void init() {
        serverIp = detectServerIp();
        logger.info("Server running on IP: {} and port: {}", serverIp, serverPort);
    }
    
    // Detect server IP for network discovery
    private String detectServerIp() {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface networkInterface = interfaces.nextElement();
                if (networkInterface.isLoopback() || !networkInterface.isUp() ||
                        networkInterface.isVirtual() || networkInterface.isPointToPoint()) {
                    continue;
                }

                Enumeration<InetAddress> addresses = networkInterface.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress address = addresses.nextElement();
                    String ip = address.getHostAddress();
                    if (address.isLoopbackAddress() || ip.contains(":")) {
                        continue;
                    }
                    return ip;
                }
            }
            return InetAddress.getLocalHost().getHostAddress();
        } catch (Exception e) {
            logger.error("Error detecting server IP address", e);
            return "localhost";
        }
    }
    
    // Helper methods
    public String getIcecastUrl() {
        return "http://" + serverIp + ":8000";
    }
    
    public String getWebSocketUrl() {
        return "ws://" + serverIp + ":" + serverPort + "/ws/live";
    }
    
    public String getStreamUrl() {
        return getIcecastUrl() + "/live.ogg";
    }
    
    // Getters
    public String getServerIp() {
        return serverIp;
    }
    
    public int getServerPort() {
        return serverPort;
    }
}
```

#### Replace AudioStreamHandler with IcecastStreamHandler:
```java
@Component
public class IcecastStreamHandler extends BinaryWebSocketHandler {
    private static final Logger logger = LoggerFactory.getLogger(IcecastStreamHandler.class);
    private Process ffmpeg;
    
    private final NetworkConfig networkConfig;
    
    @Autowired
    public IcecastStreamHandler(NetworkConfig networkConfig) {
        this.networkConfig = networkConfig;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        logger.info("WebSocket connection established with session ID: {}", session.getId());
        
        String serverIp = networkConfig.getServerIp();
        logger.info("Using server IP: {}", serverIp);

        // Build FFmpeg command for Icecast
        List<String> cmd = new ArrayList<>(Arrays.asList(
                "ffmpeg",
                "-f", "webm", "-i", "pipe:0",  // Read WebM from stdin
                "-c:a", "libvorbis", "-b:a", "128k",  // Convert to Ogg Vorbis
                "-content_type", "application/ogg",
                "-ice_name", "WildCats Radio Live",
                "-ice_description", "Live audio broadcast",
                "-f", "ogg"
        ));

        // Add Icecast URL with dynamic IP
        cmd.add("icecast://source:hackme@" + serverIp + ":8000/live.ogg");

        try {
            logger.info("Starting FFmpeg process with command: {}", String.join(" ", cmd));
            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.redirectErrorStream(true);

            ffmpeg = pb.start();
            logger.info("FFmpeg process started successfully");

            // Give FFmpeg time to initialize
            Thread.sleep(500);

            // Monitor FFmpeg output
            new Thread(() -> {
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(ffmpeg.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        logger.info("FFmpeg output: {}", line);
                    }
                    
                    int exitCode = ffmpeg.waitFor();
                    logger.info("FFmpeg process exited with code: {}", exitCode);
                } catch (Exception e) {
                    logger.error("FFmpeg monitoring thread error", e);
                }
            }).start();
            
        } catch (IOException e) {
            logger.error("Failed to start FFmpeg process", e);
            session.close(CloseStatus.SERVER_ERROR);
            throw e;
        }
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage msg) throws IOException {
        if (ffmpeg != null && ffmpeg.isAlive()) {
            try {
                OutputStream outputStream = ffmpeg.getOutputStream();
                if (outputStream != null) {
                    outputStream.write(msg.getPayload().array());
                    outputStream.flush();
                } else {
                    logger.error("FFmpeg output stream is null");
                    session.close(new CloseStatus(1011, "FFmpeg output stream not available"));
                }
            } catch (IOException e) {
                logger.error("Error writing to FFmpeg process: {}", e.getMessage());
                session.close(CloseStatus.SERVER_ERROR);
                throw e;
            }
        } else {
            logger.warn("FFmpeg process is not running");
            session.close(new CloseStatus(1011, "FFmpeg process not available"));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        logger.info("WebSocket connection closed with status: {}", status);
        if (ffmpeg != null) {
            logger.info("Terminating FFmpeg process");
            ffmpeg.destroy();
            try {
                boolean terminated = ffmpeg.waitFor(5, TimeUnit.SECONDS);
                if (!terminated) {
                    logger.warn("FFmpeg process did not terminate gracefully, forcing destruction");
                    ffmpeg.destroyForcibly();
                }
            } catch (InterruptedException e) {
                logger.warn("Interrupted while waiting for FFmpeg to terminate", e);
                Thread.currentThread().interrupt();
            } finally {
                ffmpeg = null;
            }
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        logger.error("Transport error in WebSocket session: {}", session.getId(), exception);
        if (ffmpeg != null) {
            ffmpeg.destroy();
            ffmpeg = null;
        }
        super.handleTransportError(session, exception);
    }
}
```

#### Update WebSocketConfig:
```java
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
    
    private final IcecastStreamHandler icecastStreamHandler;
    
    @Autowired
    public WebSocketConfig(IcecastStreamHandler icecastStreamHandler) {
        this.icecastStreamHandler = icecastStreamHandler;
    }
    
    @Bean
    public ServletServerContainerFactoryBean createWebSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        // Increase buffer size for audio data
        container.setMaxBinaryMessageBufferSize(65536);
        container.setMaxTextMessageBufferSize(65536);
        container.setAsyncSendTimeout(30000L);
        return container;
    }
    
    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(icecastStreamHandler, "/ws/live")
                .setAllowedOrigins("*");
    }
}
```

### 3. Frontend Changes

#### DJDashboard.jsx Updates:

```jsx
// Key changes to implement in DJDashboard.jsx

// 1. WebSocket connection using dynamic URL
const connectWebSocket = () => {
  // Get the WebSocket URL from the backend
  apiService.getStreamConfig().then(config => {
    const wsUrl = config.webSocketUrl;
    websocket = new WebSocket(wsUrl);
    websocket.binaryType = "arraybuffer";
    
    websocket.onopen = () => {
      console.log("WebSocket connected");
      startRecording();
    };
    
    // Handle errors and connection closure
    websocket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setStreamError("Failed to connect to streaming server");
      stopBroadcast();
    };
    
    websocket.onclose = (event) => {
      console.log("WebSocket disconnected:", event.code, event.reason);
      stopBroadcast();
    };
  });
};

// 2. Audio recording with proper settings for Icecast
const startRecording = () => {
  // Use optimal settings for Icecast/FFmpeg
  const options = {
    mimeType: "audio/webm;codecs=opus",
    audioBitsPerSecond: 128000
  };
  
  mediaRecorder = new MediaRecorder(stream, options);
  
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0 && websocket && websocket.readyState === WebSocket.OPEN) {
      event.data.arrayBuffer().then(buffer => {
        websocket.send(buffer);
      });
    }
  };
  
  // Use smaller chunks (250ms) to reduce message size
  mediaRecorder.start(250);
  setIsLive(true);
};
```

#### ListenerDashboard.jsx Updates:

```jsx
// Key changes to implement in ListenerDashboard.jsx

// 1. Stream status checking function 
const checkStreamStatus = () => {
  apiService.getStreamStatus().then(response => {
    setIsLive(response.isLive);
    if (response.isLive && audioRef.current && !isPlaying) {
      // If stream is live but not playing, set up the player
      audioRef.current.src = response.streamUrl;
      audioRef.current.load();
      audioRef.current.play().catch(e => console.error("Autoplay prevented:", e));
    } else if (!response.isLive && audioRef.current && isPlaying) {
      // If stream is not live but we're playing, stop playback
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }).catch(error => {
    console.error("Error checking stream status:", error);
    setStreamError("Error checking stream status");
    setIsLive(false);
  });
};

// 2. Audio player setup
useEffect(() => {
  // Set up audio player with event listeners
  if (!audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.volume = volume / 100;
    
    audioRef.current.addEventListener('playing', () => {
      setIsPlaying(true);
      setStreamError(null);
    });
    
    audioRef.current.addEventListener('pause', () => {
      setIsPlaying(false);
    });
    
    audioRef.current.addEventListener('error', (e) => {
      console.error('Audio error:', e);
      setStreamError('Error loading stream. Please try again.');
      setIsPlaying(false);
      
      // Attempt to reconnect
      if (reconnectAttempts < 3) {
        setTimeout(() => {
          setReconnectAttempts(prev => prev + 1);
          if (audioRef.current && isLive) {
            audioRef.current.src = streamUrl;
            audioRef.current.load();
            audioRef.current.play().catch(e => console.error("Autoplay prevented:", e));
          }
        }, 3000);
      }
    });
  }
  
  // Check stream status immediately and set up interval
  checkStreamStatus();
  const interval = setInterval(checkStreamStatus, 10000);
  
  return () => {
    clearInterval(interval);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  };
}, []);
```

### 4. API Service Updates

```javascript
// Updates to API service for Icecast integration

const streamService = {
  
  // Get stream configuration including dynamic URLs
  getStreamConfig: async () => {
    const response = await fetch('/api/stream/config');
    if (!response.ok) {
      throw new Error('Failed to get stream configuration');
    }
    return response.json();
  },
  
  // Check if stream is currently live
  getStreamStatus: async () => {
    const response = await fetch('/api/stream/status');
    if (!response.ok) {
      throw new Error('Failed to get stream status');
    }
    return response.json();
  },
  
  // Start a broadcast (for DJs)
  startBroadcast: async (broadcastData) => {
    const response = await fetch('/api/stream/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(broadcastData),
    });
    if (!response.ok) {
      throw new Error('Failed to start broadcast');
    }
    return response.json();
  },
  
  // Stop an active broadcast
  stopBroadcast: async () => {
    const response = await fetch('/api/stream/stop', {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Failed to stop broadcast');
    }
    return response.json();
  }
};
```

## Migration Strategy

### Phase 1: Initial Setup & Research
- Install and configure Icecast server
- Document configuration differences between Shoutcast and Icecast
- Set up test environment for development

### Phase 2: Core Backend Development
- Implement NetworkConfig for automatic IP detection
- Create IcecastStreamHandler to replace AudioStreamHandler
- Update WebSocket configuration for binary audio streaming
- Modify existing controllers for Icecast compatibility

### Phase 3: Frontend Adaptation
- Update DJDashboard.jsx to work with Icecast streaming
- Update ListenerDashboard.jsx for Icecast stream playback
- Test and debug WebSocket streaming

### Phase 4: Integration & Testing
- Test complete streaming pipeline
- Cross-browser and cross-device testing
- Performance optimization
- Fix any compatibility issues

### Phase 5: Cleanup & Documentation
- Remove obsolete Shoutcast code
- Update documentation and comments
- Finalize migration and deploy

## Conclusion

This transition from Shoutcast to Icecast will provide a more robust and flexible streaming solution. The successful prototype has demonstrated that the Icecast+FFmpeg approach works well across different devices and networks. By using auto-discovery of network information, the system will be easier to deploy in various environments without manual configuration.

The implementation will maintain all existing functionality while improving reliability and adding the potential for future enhancements like better stream quality, metadata updates, and enhanced network support. 

## Current Progress & Next Steps

### Progress Update (May 2025)

The transition to Icecast is well underway, with significant progress made on the backend components:

1. ✅ **Core Backend Infrastructure**: All essential Icecast service classes have been implemented
   - IcecastService for tracking broadcast status
   - IcecastStreamHandler for WebSocket audio handling
   - NetworkConfig for auto-discovery of server IP

2. ✅ **WebSocket Configuration**: Both streaming and messaging WebSocket configurations complete
   - WebSocketConfig for audio streaming
   - WebSocketMessageConfig for notifications and real-time updates
   - Fixed SimpMessagingTemplate bean dependency issue

3. ✅ **Configuration**: Application properties updated for Icecast integration
   - Port settings
   - Authentication credentials
   - Mount points

4. ✅ **Application Configuration**: Updated Spring Boot annotations
   - Added @EnableScheduling for broadcast notifications
   - Updated Maven dependencies for WebSocket messaging support

### Next Steps

1. 🔄 **Backend Integration Testing**:
   - Test the complete streaming pipeline from WebSocket to Icecast
   - Verify the network auto-discovery functionality
   - Test the notification system with WebSocket STOMP

2. 🔜 **Frontend Updates**:
   - Update DJDashboard.jsx to work with Icecast streaming
   - Update ListenerDashboard.jsx for Icecast stream URLs
   - Test cross-device streaming

3. 🔜 **Deployment & Documentation**:
   - Finalize setup instructions for Icecast server
   - Document the complete implementation
   - Create user guides for both DJ and listener interfaces 