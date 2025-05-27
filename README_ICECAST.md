# WildCats Radio - Icecast Streaming System

## Overview

WildCats Radio now uses Icecast as the streaming server, providing a robust and open-source solution for live audio broadcasting. The system allows DJs to broadcast directly from their browser microphones to listeners through a web-based interface.

## System Architecture

```
DJ Browser (WebRTC) → WebSocket → Spring Boot → FFmpeg → Icecast Server → Listeners
```

### Components

1. **DJ Dashboard**: React-based interface for broadcasting
2. **Listener Dashboard**: React-based interface for listening to streams
3. **Spring Boot Backend**: Handles WebSocket connections and server management
4. **FFmpeg**: Transcodes WebM audio to Ogg Vorbis format
5. **Icecast Server**: Distributes audio streams to multiple listeners

## Quick Start

### Prerequisites

1. **Icecast Server**: Install and configure Icecast
2. **FFmpeg**: Install FFmpeg with libvorbis support
3. **Java 17**: For Spring Boot application
4. **Node.js**: For React frontend

### Running the System

1. **Start Icecast Server**:
   ```bash
   icecast -c config/icecast.xml
   ```

2. **Start Spring Boot Backend**:
   ```bash
   cd backend
   mvn spring-boot:run
   ```

3. **Start React Frontend**:
   ```bash
   cd frontend
   npm start
   ```

### Usage

#### For DJs:
1. Navigate to `/dj` in your browser
2. Allow microphone access when prompted
3. Click "Go Live" to start broadcasting
4. Use "Stream Preview" to monitor your own broadcast

#### For Listeners:
1. Navigate to `/listener` in your browser
2. Click the play button when a stream is live
3. Adjust volume as needed
4. Use refresh button if stream stops working

## Features

### Automatic Network Discovery
- Server automatically detects its IP address
- Dynamic URL generation for all components
- No manual configuration needed for different networks

### Browser-Based Broadcasting
- No special software required for DJs
- Uses WebRTC for microphone access
- Real-time audio streaming via WebSockets

### Stream Quality
- 128kbps Ogg Vorbis audio
- Low latency streaming
- Automatic reconnection handling

### Cross-Device Support
- Works on laptops, tablets, and smartphones
- Responsive web design
- Network-agnostic operation

## Configuration

### Icecast Configuration (`config/icecast.xml`)
```xml
<icecast>
  <hostname>auto-detected-ip</hostname>
  <listen-socket>
    <port>8000</port>
    <bind-address>0.0.0.0</bind-address>
  </listen-socket>
  <authentication>
    <source-password>hackme</source-password>
    <admin-password>hackme</admin-password>
  </authentication>
  <mount>
    <mount-name>/live.ogg</mount-name>
    <username>source</username>
    <password>hackme</password>
  </mount>
</icecast>
```

### Spring Boot Configuration (`application.properties`)
```properties
server.port=8080
icecast.port=8000
```

## API Endpoints

### Stream Configuration
- `GET /api/stream/config` - Get network configuration
- `GET /api/stream/status` - Get current stream status

### WebSocket Endpoints
- `ws://server:8080/ws/live` - Audio streaming endpoint for DJs

### Icecast Endpoints
- `http://server:8000/live.ogg` - Live stream for listeners
- `http://server:8000/status-json.xsl` - Stream status (JSON)

## Technical Details

### Audio Pipeline
1. **Browser captures audio**: WebRTC getUserMedia API
2. **Audio encoding**: MediaRecorder with WebM/Opus format
3. **WebSocket transmission**: Binary messages every 250ms
4. **Server processing**: FFmpeg transcodes to Ogg Vorbis
5. **Icecast distribution**: Stream available to multiple listeners

### Network Requirements
- **DJ to Server**: WebSocket connection (port 8080)
- **Server to Icecast**: Local connection (port 8000)
- **Listeners to Icecast**: HTTP connection (port 8000)

### Security Considerations
- Default passwords should be changed in production
- HTTPS recommended for public deployments
- Firewall configuration may be needed

## Troubleshooting

### Common Issues

1. **"Failed to get server configuration"**
   - Check if Spring Boot backend is running
   - Verify API endpoints are accessible

2. **"Failed to connect to streaming server"**
   - Ensure WebSocket endpoint is reachable
   - Check firewall settings

3. **"Error loading stream"**
   - Verify Icecast server is running
   - Check if stream is actually live
   - Try refreshing the stream

4. **FFmpeg errors**
   - Ensure FFmpeg is installed and in PATH
   - Check if libvorbis codec is available
   - Verify Icecast credentials

### Debug Information
- Browser console shows detailed error messages
- Spring Boot logs show WebSocket and FFmpeg status
- Icecast logs show connection and stream information

## Network Information Display

The system displays network information to help with troubleshooting:
- Server IP address (auto-detected)
- Server ports (Spring Boot and Icecast)
- WebSocket URL for DJ connections
- Stream URL for listeners

This information is shown in both DJ and Listener dashboards for easy access.

## Future Enhancements

- HTTPS/WSS support for secure connections
- Multiple simultaneous DJ support
- Stream recording capabilities
- Advanced audio effects and processing
- Mobile app development
- CDN integration for scaling 