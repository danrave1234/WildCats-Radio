# Google Cloud Icecast Implementation Guide

This guide explains the complete implementation of WildCats Radio with Google Cloud Icecast server integration.

## Overview

WildCats Radio now supports streaming through a Google Cloud-hosted Icecast server. This implementation allows for scalable, cloud-based radio broadcasting with reliable audio streaming capabilities.

## Architecture

```
[DJ Browser] 
    ↓ WebSocket (WebM audio)
[Spring Boot App on Heroku]
    ↓ FFmpeg → Icecast protocol
[Google Cloud Icecast Server] 
    ↓ HTTP stream
[Listeners worldwide]
```

## Configuration

### Environment Variables

Set these environment variables for Google Cloud deployment:

```properties
# Spring Boot Application Domain (CRITICAL: This should be your deployed app URL)
APP_DOMAIN=your-app.herokuapp.com  # Replace with your actual deployment URL

# Google Cloud Icecast Server Configuration (for audio streaming only)
ICECAST_HOST=34.142.131.206
ICECAST_PORT=8000
ICECAST_USERNAME=source
ICECAST_PASSWORD=hackme
ICECAST_MOUNT=/live.ogg

# Admin credentials for Icecast management
ICECAST_ADMIN_USERNAME=admin
ICECAST_ADMIN_PASSWORD=hackme

# FFmpeg optimization settings
FFMPEG_RECONNECT_ENABLED=true
FFMPEG_RECONNECT_DELAY_MAX=5
FFMPEG_RW_TIMEOUT=5000000
FFMPEG_RETRY_ATTEMPTS=3

# Production optimizations
SPRING_PROFILES_ACTIVE=prod
DATABASE_POOL_SIZE=10
LOG_LEVEL_ICECAST=INFO
```

### application.properties

The application.properties file is pre-configured with Google Cloud settings:

```properties
# WildCats Radio Icecast Configuration for Google Cloud
icecast.host=${ICECAST_HOST:34.142.131.206}
icecast.port=${ICECAST_PORT:8000}
icecast.source.username=${ICECAST_USERNAME:source}
icecast.source.password=${ICECAST_PASSWORD:hackme}
icecast.mount.point=${ICECAST_MOUNT:/live.ogg}
icecast.admin.username=admin
icecast.admin.password=hackme
```

## Key Components

### 1. IcecastService
- **Location**: `backend/src/main/java/com/wildcastradio/icecast/IcecastService.java`
- **Purpose**: Manages connections to Google Cloud Icecast server
- **Key Features**:
  - Server connectivity checking
  - Stream status monitoring
  - Listener count tracking
  - Active broadcast management

### 2. IcecastStreamHandler
- **Location**: `backend/src/main/java/com/wildcastradio/icecast/IcecastStreamHandler.java`
- **Purpose**: Handles WebSocket audio streaming from DJ to Icecast
- **Key Features**:
  - WebSocket binary message handling
  - FFmpeg process management
  - Google Cloud Icecast integration
  - Automatic reconnection logic

### 3. ListenerStatusHandler
- **Location**: `backend/src/main/java/com/wildcastradio/icecast/ListenerStatusHandler.java`
- **Purpose**: Manages real-time status updates for listeners
- **Key Features**:
  - WebSocket status broadcasting
  - Listener count tracking
  - Stream status notifications

### 4. NetworkConfig
- **Location**: `backend/src/main/java/com/wildcastradio/config/NetworkConfig.java`
- **Purpose**: Handles network configuration and URL generation
- **Key Features**:
  - Automatic IP detection
  - Google Cloud URL configuration
  - WebSocket URL management

### 5. GoogleCloudConfig
- **Location**: `backend/src/main/java/com/wildcastradio/config/GoogleCloudConfig.java`
- **Purpose**: Google Cloud-specific configuration management
- **Key Features**:
  - Configuration validation
  - Cloud deployment detection
  - URL generation helpers

### 6. IcecastAdminController
- **Location**: `backend/src/main/java/com/wildcastradio/controller/IcecastAdminController.java`
- **Purpose**: Admin API endpoints for Icecast management
- **Key Endpoints**:
  - `/api/icecast/server-status` - Check server status
  - `/api/icecast/config` - Get configuration
  - `/api/icecast/health` - Health check

### 7. StartupValidator
- **Location**: `backend/src/main/java/com/wildcastradio/config/StartupValidator.java`
- **Purpose**: Validates configuration on application startup
- **Key Features**:
  - Configuration validation
  - Connectivity testing
  - Startup diagnostics

## API Endpoints

### Stream Management
- `GET /api/stream/status` - Get current stream status
- `GET /api/stream/websocket-url` - Get WebSocket URLs

### Icecast Administration
- `GET /api/icecast/server-status` - Detailed server status
- `GET /api/icecast/config` - Get streaming configuration
- `GET /api/icecast/websocket-urls` - Get all WebSocket URLs
- `GET /api/icecast/health` - Health check endpoint

### Broadcast Management
- `POST /api/broadcasts` - Create new broadcast
- `POST /api/broadcasts/{id}/start` - Start broadcast
- `POST /api/broadcasts/{id}/start-test` - Start test broadcast
- `POST /api/broadcasts/{id}/end` - End broadcast

## WebSocket Endpoints

### DJ Streaming
- **Endpoint**: `/ws/live`
- **Purpose**: Audio streaming from DJ to Icecast
- **Protocol**: Binary WebSocket (WebM audio)

### Listener Status
- **Endpoint**: `/ws/listener`
- **Purpose**: Real-time status updates for listeners
- **Protocol**: Text WebSocket (JSON messages)

## FFmpeg Integration

The system uses FFmpeg to convert WebM audio from the browser to Ogg Vorbis for Icecast:

```bash
ffmpeg -f webm -i pipe:0 \
       -c:a libvorbis -b:a 128k \
       -content_type application/ogg \
       -ice_name "WildCats Radio Live" \
       -ice_description "Live audio broadcast from WildCats Radio" \
       -f ogg \
       icecast://source:hackme@34.142.131.206:8000/live.ogg
```

## Monitoring and Debugging

### Startup Validation
The application performs comprehensive validation on startup:
- Google Cloud configuration validation
- Network configuration validation
- Icecast connectivity testing
- WebSocket configuration validation

### Logging
Enhanced logging is available for debugging:
```properties
logging.level.com.wildcastradio.icecast=DEBUG
logging.level.com.wildcastradio.config=DEBUG
```

### Health Checks
Multiple health check endpoints are available:
- `/api/icecast/health` - Icecast-specific health
- `/api/stream/status` - General stream status

## Deployment Process

1. **Set Environment Variables**: Configure all Google Cloud Icecast settings
2. **Deploy Application**: Deploy to your hosting platform (Heroku, etc.)
3. **Verify Configuration**: Check startup logs for validation results
4. **Test Connectivity**: Use health check endpoints to verify Icecast connectivity
5. **Test Streaming**: Create a test broadcast to verify end-to-end functionality

## Troubleshooting

### Common Issues

1. **Icecast Server Not Accessible**
   - Check Google Cloud firewall settings
   - Verify IP address and port configuration
   - Ensure Icecast server is running

2. **FFmpeg Connection Failures**
   - Check Icecast credentials
   - Verify mount point configuration
   - Review FFmpeg logs for specific errors

3. **WebSocket Connection Issues**
   - Check CORS configuration
   - Verify WebSocket URL generation
   - Review browser console for connection errors

### Critical Architecture Note

**IMPORTANT**: There are TWO separate servers in this setup:

1. **Spring Boot Application** (your deployed app on Heroku, etc.)
   - Handles WebSocket connections: `/ws/live` and `/ws/listener`
   - Serves API endpoints
   - Runs FFmpeg to convert and forward audio

2. **Google Cloud Icecast Server** (`34.142.131.206:8000`)
   - Only handles audio streaming to listeners
   - Receives stream from FFmpeg
   - Serves HTTP audio stream to listeners

**WebSocket URLs should NEVER point to the Icecast server!**

### Advanced Troubleshooting

4. **WebSocket Connection to Wrong Server**
   - **Problem**: Frontend trying to connect to `ws://34.142.131.206:8080/ws/listener`
   - **Solution**: WebSocket should connect to your Spring Boot app, not Icecast server
   - **Fix**: Set `APP_DOMAIN` environment variable to your deployed app URL

5. **Network Latency Issues**
   - Monitor for dropped packets or retransmissions
   - Consider TCP optimization for high packet rates
   - Check if VM has sufficient RX/TX queues
   - Reference: [Google Cloud TCP optimization](https://cloud.google.com/compute/docs/troubleshooting/troubleshooting-networking)

6. **Firewall Configuration**
   - Ensure Google Cloud firewall rules allow traffic on port 8000
   - Verify that all required network traffic is explicitly permitted
   - Check for 10-minute idle connection timeout and adjust TCP keep-alive settings
   - Reference: [Google Cloud firewall troubleshooting](https://cloud.google.com/compute/docs/troubleshooting/troubleshooting-networking)

7. **Connection Drops**
   - Default idle connection timeout is 10 minutes - adjust if needed
   - Implement TCP keep-alive for long-running connections
   - Monitor for connection pooling issues

### Debug Commands

Check Icecast server status:
```bash
curl http://34.142.131.206:8000/status-json.xsl
```

Test network connectivity:
```bash
# Test basic connectivity
telnet 34.142.131.206 8000

# Check firewall rules (from Google Cloud Console)
gcloud compute firewall-rules list --filter="name~icecast"
```

Test WebSocket connectivity:
```javascript
// CORRECT: Connect to your Spring Boot app
const ws = new WebSocket('ws://your-app.herokuapp.com/ws/listener');
ws.onopen = () => console.log('Connected');
ws.onmessage = (event) => console.log('Message:', event.data);

// WRONG: Don't connect to Icecast server
// const ws = new WebSocket('ws://34.142.131.206:8080/ws/listener'); // This will fail!
```

### Performance Monitoring

Monitor Google Cloud VM metrics:
- CPU usage during streaming
- Network throughput
- Memory consumption
- Disk I/O for logs

Check application logs for:
- FFmpeg connection errors
- WebSocket disconnections
- High listener counts causing issues

## Security Considerations

1. **Icecast Credentials**: Use strong passwords for source and admin accounts
2. **Network Security**: Configure Google Cloud firewall rules appropriately
3. **CORS Policy**: Review and adjust CORS settings for production
4. **SSL/TLS**: Consider implementing SSL for production deployments

## Performance Optimization

1. **Connection Pooling**: Database connection pool is optimized for cloud deployment
2. **FFmpeg Settings**: Reconnection and timeout settings are tuned for reliability
3. **WebSocket Configuration**: Buffer sizes are optimized for audio streaming
4. **Monitoring**: Comprehensive logging and monitoring for performance tracking

## Future Enhancements

1. **Load Balancing**: Multiple Icecast servers for high availability
2. **Auto-scaling**: Dynamic server scaling based on listener count
3. **CDN Integration**: Content delivery network for global distribution
4. **Advanced Monitoring**: Metrics collection and alerting
5. **SSL Termination**: HTTPS/WSS support for secure connections 