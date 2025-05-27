# React Native Broadcast Integration Roadmap

## Overview

This document outlines the essential API endpoints, integration points, and technical specifications for implementing broadcast listening capabilities in the WildCats Radio React Native mobile application. The mobile app will serve as a **listener-only** client, focusing on broadcast reception, real-time status monitoring, and interactive features.

## Backend Integration Points

### Core API Endpoints

**Base URL**: `https://wildcat-radio-f05d362144e6.autoidleapp.com`

#### Stream Configuration & Status
- **GET** `/api/stream/config` - Retrieve streaming configuration
  - Returns: `serverIp`, `serverPort`, `icecastPort`, `streamUrl`, `webSocketUrl`, `listenerWebSocketUrl`
- **GET** `/api/stream/status` - Get current stream status
  - Returns: `live`, `server`, `listenerCount`, `activeBroadcasts`
- **GET** `/api/stream/health` - Health check endpoint
  - Returns: Server health status and Icecast connectivity

#### Broadcast Management
- **GET** `/api/broadcasts/live` - Get currently live broadcasts
- **GET** `/api/broadcasts/upcoming` - Get scheduled upcoming broadcasts
- **GET** `/api/broadcasts/{id}` - Get specific broadcast details

#### Interactive Features
- **GET** `/api/broadcasts/{id}/chat` - Get chat messages for broadcast
- **POST** `/api/broadcasts/{id}/chat` - Send chat message
- **GET** `/api/broadcasts/{id}/song-requests` - Get song requests
- **POST** `/api/broadcasts/{id}/song-requests` - Submit song request
- **GET** `/api/broadcasts/{id}/polls/active` - Get active polls
- **POST** `/api/polls/{id}/vote` - Vote on poll

#### Real-time Communication
- **WebSocket** `/ws/listener` - Real-time stream status updates
  - Receives: `STREAM_STATUS` events with live status and listener count
  - Sends: `PLAYER_STATUS` messages to report playback state
- **WebSocket** `/ws-radio` - STOMP-based messaging for chat/polls
  - Endpoints: `/topic/chat/{broadcastId}`, `/topic/polls/{broadcastId}`

### Audio Stream Integration

#### Icecast Stream URLs
- **Primary Stream**: Retrieved from `/api/stream/config` response
- **Format Support**: OGG Vorbis, MP3 (depending on server configuration)
- **Bitrate**: Configurable (typically 128kbps for mobile optimization)
- **Stream Endpoint**: Typically `{icecastHost}:{icecastPort}/live.ogg`

#### Stream Metadata
- **Now Playing**: Available through WebSocket updates
- **Broadcast Information**: Title, description, DJ information
- **Listener Statistics**: Real-time listener count updates

## React Native Technical Requirements

### Audio Streaming Dependencies
- **react-native-track-player**: Primary audio streaming library
  - Supports background playback
  - Native media controls integration
  - Network stream handling
  - Cross-platform compatibility
- **@react-native-async-storage/async-storage**: Configuration persistence
- **react-native-keep-awake**: Prevent screen sleep during playback

### Network & WebSocket Libraries
- **Native WebSocket API**: Built-in React Native WebSocket support
- **Fetch API**: HTTP requests for REST endpoints
- **@react-native-netinfo/netinfo**: Network state detection and monitoring

### Platform-Specific Considerations

#### iOS Requirements
- **App Transport Security (ATS)**: Configure for HTTPS/WSS connections
- **Background Audio**: Configure audio session for background playback
- **Info.plist Configuration**: Background modes for audio
- **Permissions**: No microphone access required for listener-only app

#### Android Requirements
- **Network Security Config**: Allow cleartext traffic if needed
- **Foreground Service**: For background audio playback
- **Permissions**: `INTERNET`, `WAKE_LOCK`, `FOREGROUND_SERVICE`
- **Notification Channels**: For media playback notifications

## Broadcast Reception Architecture

### Stream Status Monitoring
- **Polling Interval**: 5-second intervals for status checks
- **WebSocket Primary**: Real-time updates when available
- **Fallback Strategy**: HTTP polling when WebSocket unavailable
- **Connection Resilience**: Automatic reconnection with exponential backoff
- **Heartbeat Mechanism**: Regular ping/pong for connection health

### Audio Stream Handling
- **Stream URL Resolution**: Dynamic URL fetching from configuration endpoint
- **Format Detection**: Automatic codec selection based on device capabilities
- **Buffer Management**: Optimized buffering for mobile networks (3-10 seconds)
- **Error Recovery**: Automatic stream reconnection on network issues
- **Quality Adaptation**: Adjust based on network conditions

### Real-time Features Integration

#### Chat System
- **Message Format**: JSON with sender, content, timestamp, broadcastId
- **Rate Limiting**: Client-side message throttling (1 message per 2 seconds)
- **Message History**: Load recent messages on connection
- **Moderation**: Support for message filtering and user blocking

#### Song Requests
- **Request Format**: songTitle, artist, dedication (optional)
- **Status Tracking**: pending, approved, played, rejected
- **Duplicate Prevention**: Check for similar requests
- **Queue Management**: Display request queue position

#### Live Polls
- **Poll Types**: Multiple choice, yes/no, rating
- **Vote Validation**: Prevent duplicate voting per user
- **Real-time Results**: Live vote count updates
- **Poll Lifecycle**: Active, ended, archived states

## Network Optimization Strategies

### Bandwidth Management
- **Adaptive Streaming**: Quality adjustment based on network conditions
- **Connection Type Detection**: WiFi vs cellular optimization
- **Data Usage Monitoring**: Track and report data consumption
- **Compression**: Enable gzip compression for API responses

### Offline Handling
- **Graceful Degradation**: UI updates when stream unavailable
- **Cached Configuration**: Persist last known good configuration
- **Retry Logic**: Intelligent reconnection strategies
- **Offline Indicators**: Clear visual feedback for connection status

## Security & Authentication

### API Authentication
- **Bearer Token**: JWT-based authentication for protected endpoints
- **Token Refresh**: Automatic token renewal before expiration
- **Session Management**: Secure token storage in AsyncStorage
- **Logout Handling**: Proper token cleanup on logout

### WebSocket Security
- **WSS Protocol**: Secure WebSocket connections (wss://)
- **Origin Validation**: Server-side origin checking
- **Rate Limiting**: Connection and message rate limits
- **Authentication**: Token-based WebSocket authentication

## Performance Considerations

### Memory Management
- **Audio Buffer Optimization**: Efficient memory usage for streaming
- **WebSocket Connection Pooling**: Reuse connections where possible
- **Component Lifecycle**: Proper cleanup on unmount
- **Image Caching**: Optimize artwork and UI images

### Battery Optimization
- **Background Processing**: Minimize CPU usage during background playback
- **Network Efficiency**: Reduce unnecessary API calls
- **Screen Wake Management**: Intelligent screen timeout handling
- **Location Services**: Disable unnecessary location tracking

## Integration Timeline & Phases

### Phase 1: Core Audio Streaming (Week 1-2)
- Stream configuration retrieval
- Basic audio playback implementation
- Stream status monitoring
- Error handling and recovery

### Phase 2: Real-time Communication (Week 2-3)
- WebSocket integration for status updates
- Listener count tracking
- Connection resilience implementation
- Heartbeat mechanism

### Phase 3: Interactive Features (Week 3-4)
- Chat system integration
- Song request functionality
- Live poll participation
- Real-time message handling

### Phase 4: Background & Notifications (Week 4-5)
- Background playback support
- Native media controls
- Notification management
- Lock screen controls

### Phase 5: Optimization & Testing (Week 5-6)
- Performance optimization
- Network condition handling
- Cross-platform testing
- User experience refinement

## API Response Formats

### Stream Configuration Response
- **serverIp**: Backend server IP address
- **serverPort**: Backend server port (typically 8080)
- **icecastPort**: Icecast streaming port (typically 8000)
- **streamUrl**: Complete audio stream URL
- **webSocketUrl**: DJ WebSocket endpoint
- **listenerWebSocketUrl**: Listener status WebSocket endpoint

### Stream Status Response
- **live**: Boolean indicating if stream is active
- **server**: Server status ("UP" or "DOWN")
- **listenerCount**: Current number of active listeners
- **activeBroadcasts**: Number of active broadcast sessions

### WebSocket Message Formats
- **Stream Status**: `{"type": "STREAM_STATUS", "isLive": boolean, "listenerCount": number, "timestamp": number}`
- **Player Status**: `{"type": "PLAYER_STATUS", "isPlaying": boolean, "timestamp": number}`
- **Chat Message**: `{"type": "CHAT_MESSAGE", "content": string, "sender": object, "broadcastId": number}`

## Error Handling Strategies

### Network Errors
- **Connection Timeout**: 30-second timeout for HTTP requests
- **Retry Logic**: Exponential backoff for failed requests (1s, 2s, 4s, 8s, 16s)
- **Fallback Mechanisms**: Graceful degradation when services unavailable
- **User Feedback**: Clear error messages and recovery suggestions

### Stream Errors
- **Audio Codec Issues**: Fallback to alternative formats
- **Network Interruption**: Automatic reconnection with user notification
- **Server Unavailable**: Clear error messaging and manual retry options
- **Buffer Underrun**: Intelligent rebuffering strategies

## Success Metrics & KPIs

### Technical Performance
- **Stream Latency**: < 10 seconds from broadcast to playback
- **Connection Reliability**: > 95% uptime for WebSocket connections
- **Audio Quality**: Consistent playback without interruptions
- **App Responsiveness**: < 2 seconds for UI interactions

### User Experience
- **Real-time Responsiveness**: < 2 seconds for chat/poll updates
- **Battery Efficiency**: < 5% battery drain per hour of streaming
- **Network Efficiency**: Optimized data usage for mobile networks
- **Crash Rate**: < 0.1% crash rate across all sessions

## Deployment Considerations

### App Store Requirements
- **iOS App Store**: Background audio capability declarations
- **Google Play Store**: Foreground service usage justification
- **Privacy Policies**: Data collection and usage disclosure
- **Content Guidelines**: Compliance with platform content policies

### Backend Dependencies
- **Icecast Server**: Reliable streaming server configuration
- **WebSocket Infrastructure**: Scalable real-time communication
- **CDN Integration**: Content delivery optimization for global users
- **Load Balancing**: Handle multiple concurrent listeners

### Monitoring & Analytics
- **Stream Quality Monitoring**: Track audio quality metrics
- **User Engagement**: Monitor listening duration and interaction rates
- **Error Tracking**: Comprehensive error logging and reporting
- **Performance Metrics**: App performance and resource usage tracking

This roadmap provides the essential technical foundation for implementing broadcast listening capabilities in React Native, focusing on the core integration points, API specifications, and architectural considerations needed for a robust mobile streaming experience. 