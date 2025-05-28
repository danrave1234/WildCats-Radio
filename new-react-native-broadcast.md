# React Native Broadcast Integration Roadmap

## Overview
This guide outlines the steps to integrate the WildCats Radio broadcast functionality into React Native, using the existing web frontend ListenerDashboard implementation as reference. The backend is hosted on Heroku and the Icecast server is on Google VM.

## Key Endpoints and URLs

### Core URLs
- **Backend (Heroku)**: `https://wildcat-radio-f05d362144e6.autoidleapp.com`
- **Icecast Server (Google VM)**: `http://34.142.131.206:8000`
- **Stream URL**: `http://34.142.131.206:8000/live.ogg`

### API Endpoints
- **Stream Config**: `GET /api/stream/config`
- **Stream Status**: `GET /api/stream/status`
- **WebSocket URLs**: `GET /api/stream/websocket-url`
- **Health Check**: `GET /api/stream/health`

### WebSocket Endpoints
- **DJ Streaming**: `ws://heroku-backend/ws/live`
- **Listener Status**: `ws://heroku-backend/ws/listener`
- **Chat**: `ws://heroku-backend/ws-radio` (SockJS)
- **Broadcast Updates**: `ws://heroku-backend/ws-radio` (SockJS)

## Phase 1: Core Audio Streaming (Listener Functionality)

### 1.1 Audio Player Setup
**Reference**: `StreamingContext.jsx` lines 1250-1370

**Requirements**:
- React Native audio library (react-native-track-player or react-native-sound)
- Stream URL: `http://34.142.131.206:8000/live.ogg`
- Volume control (0-100)
- Mute/unmute functionality
- Play/pause controls

**Key Logic**:
1. Initialize audio player with stream URL from `/api/stream/config`
2. Handle audio states: loading, playing, paused, error
3. Implement automatic retry on connection failure
4. Persist audio settings (volume, mute state) to AsyncStorage

### 1.2 Stream Status Integration
**Reference**: `StreamingContext.jsx` lines 470-530

**Implementation Steps**:
1. Fetch initial config from `/api/stream/config`
2. Poll `/api/stream/status` every 10 seconds for live status
3. Display listener count from status response
4. Handle server connectivity states

**Data Structure**:
```json
{
  "live": boolean,
  "server": "UP|DOWN",
  "streamUrl": "http://34.142.131.206:8000/live.ogg",
  "listenerCount": number,
  "icecastReachable": boolean
}
```

## Phase 2: Real-time Features (WebSocket Integration)

### 2.1 Listener Status WebSocket
**Reference**: `StreamingContext.jsx` lines 1400-1450

**Implementation**:
1. Connect to listener WebSocket: `ws://heroku-backend/ws/listener`
2. Send periodic heartbeat messages
3. Receive real-time listener count updates
4. Handle connection states (connecting, connected, disconnected)

**Message Format**:
```json
{
  "type": "heartbeat|status_update",
  "listenerCount": number,
  "timestamp": number
}
```

### 2.2 Chat System
**Reference**: `ListenerDashboard.jsx` lines 630-720

**Requirements**:
- SockJS client for React Native
- Authentication token in WebSocket headers
- Real-time message receiving
- Message sending functionality

**WebSocket Setup**:
1. Connect to `/ws-radio` using SockJS
2. Subscribe to `/topic/chat/general`
3. Send messages to `/app/chat/send`
4. Handle authentication via JWT token

**Message Types**:
- Incoming: `{type: "CHAT", username: string, message: string, timestamp: string}`
- Outgoing: `{message: string, username: string}`

### 2.3 Song Request System
**Reference**: `ListenerDashboard.jsx` lines 1270-1310

**Implementation**:
1. Subscribe to `/topic/song-requests`
2. Send requests to `/app/song-request/submit`
3. Display request queue
4. Handle request status updates

**Request Format**:
```json
{
  "title": "Song Title",
  "artist": "Artist Name",
  "requestedBy": "username"
}
```

## Phase 3: Interactive Features

### 3.1 Live Polls
**Reference**: `ListenerDashboard.jsx` lines 740-810

**Features**:
- Real-time poll notifications
- Vote submission
- Results display
- Poll history

**WebSocket Topics**:
- Subscribe: `/topic/polls`
- Vote: `/app/poll/vote`

### 3.2 Broadcast Information
**Reference**: `ListenerDashboard.jsx` lines 80-120

**API Integration**:
- `GET /api/broadcasts/live` - Get current live broadcast
- `GET /api/broadcasts/upcoming` - Get next scheduled broadcast
- `GET /api/broadcasts/{id}` - Get specific broadcast details

**Data Display**:
- Current DJ name
- Broadcast title/description
- Start time
- Duration
- Next broadcast information

## Phase 4: DJ Broadcasting Features (Advanced)

### 4.1 Audio Recording Setup
**Reference**: `StreamingContext.jsx` lines 1150-1200

**Requirements**:
- React Native audio recording (react-native-audio-recorder-player)
- Microphone permissions
- Real-time audio streaming via WebSocket
- Audio level monitoring

**Implementation**:
1. Request microphone permissions
2. Initialize audio recorder with specific format (OGG/WebM)
3. Stream audio chunks to WebSocket endpoint
4. Handle recording states and errors

### 4.2 Broadcast Management
**Reference**: `StreamingContext.jsx` lines 1080-1180

**API Endpoints**:
- `POST /api/broadcasts` - Create broadcast
- `POST /api/broadcasts/{id}/start` - Start broadcast
- `POST /api/broadcasts/{id}/end` - End broadcast
- `GET /api/broadcasts/{id}/analytics` - Get analytics

**Workflow**:
1. Create broadcast with title, description, schedule
2. Connect to DJ WebSocket endpoint
3. Start audio streaming
4. Monitor broadcast status
5. Handle broadcast termination

### 4.3 DJ Controls
**Reference**: `StreamingContext.jsx` lines 340-370

**Features**:
- Mute/unmute microphone
- Audio gain control
- Noise gate settings
- Audio level visualization
- Source switching (future: desktop audio)

## Phase 5: State Management and Persistence

### 5.1 Context/State Management
**Reference**: `StreamingContext.jsx` lines 40-100

**State Structure**:
```javascript
{
  // Listener State
  isListening: boolean,
  audioPlaying: boolean,
  volume: number,
  isMuted: boolean,
  
  // Stream State
  isLive: boolean,
  listenerCount: number,
  currentBroadcast: object,
  
  // Connection State
  websocketConnected: boolean,
  serverConfig: object
}
```

### 5.2 Persistence
**Reference**: `StreamingContext.jsx` lines 80-150

**AsyncStorage Keys**:
- `wildcats_listener_state` - Audio settings
- `wildcats_current_broadcast` - Current broadcast info
- `wildcats_stream_config` - Server configuration
- `wildcats_volume` - Volume setting
- `wildcats_muted` - Mute state

## Phase 6: Error Handling and Reconnection

### 6.1 Connection Management
**Reference**: `StreamingContext.jsx` lines 550-600

**Strategies**:
- Automatic WebSocket reconnection with exponential backoff
- Audio stream retry on failure
- Fallback to polling when WebSocket fails
- Connection state indicators

### 6.2 Error Scenarios
**Reference**: `errorHandler.js` and `StreamingContext.jsx`

**Handle**:
- Network connectivity issues
- Server downtime
- Authentication failures
- Audio playback errors
- WebSocket disconnections

## Phase 7: UI Components

### 7.1 Audio Player Component
**Features**:
- Play/pause button
- Volume slider
- Mute button
- Current status indicator
- Loading states

### 7.2 Chat Component
**Features**:
- Message list with auto-scroll
- Message input with send button
- User authentication check
- Login/register prompts for guests

### 7.3 Broadcast Info Component
**Features**:
- Current DJ information
- Broadcast title and description
- Listener count display
- Next broadcast countdown

### 7.4 Song Request Component
**Features**:
- Request form (title, artist)
- Request queue display
- Request status indicators

## Implementation Priority

### Priority 1 (MVP):
1. Audio streaming (Phase 1)
2. Basic WebSocket integration (Phase 2.1)
3. Simple UI components (Phase 7.1, 7.3)

### Priority 2 (Core Features):
1. Chat system (Phase 2.2)
2. Broadcast information (Phase 3.2)
3. Error handling (Phase 6)

### Priority 3 (Enhanced Features):
1. Song requests (Phase 2.3)
2. Live polls (Phase 3.1)
3. State persistence (Phase 5)

### Priority 4 (DJ Features):
1. DJ broadcasting (Phase 4)
2. Advanced audio controls
3. Analytics integration

## Technical Considerations

### Dependencies
- **Audio**: `react-native-track-player` or `@react-native-community/audio-toolkit`
- **WebSocket**: `ws` or `sockjs-client` with React Native compatibility
- **Storage**: `@react-native-async-storage/async-storage`
- **HTTP**: `axios` or `fetch`
- **Permissions**: `react-native-permissions`

### Platform Differences
- **iOS**: Background audio capabilities, different audio session handling
- **Android**: Audio focus management, different permission model
- **Audio Formats**: Ensure OGG/WebM support or use adaptive streaming

### Performance Optimization
- Implement audio buffer management
- Use background tasks for audio streaming
- Optimize WebSocket message handling
- Implement proper memory management for audio streams

## Testing Strategy

### Unit Tests
- Audio player functionality
- WebSocket connection handling
- State management logic
- API service methods

### Integration Tests
- End-to-end audio streaming
- Real-time chat functionality
- Broadcast lifecycle
- Error recovery scenarios

### Device Testing
- Test on various Android/iOS devices
- Network condition testing (WiFi, cellular, poor connection)
- Background audio testing
- Battery usage optimization

## Deployment Considerations

### App Store Guidelines
- Background audio declarations
- Microphone usage descriptions
- Network usage justification

### Performance Monitoring
- Audio streaming quality metrics
- WebSocket connection stability
- Crash reporting for audio failures
- User engagement analytics

This roadmap provides a comprehensive path to implement the WildCats Radio functionality in React Native while maintaining compatibility with the existing backend infrastructure and leveraging the proven patterns from the web frontend implementation. 