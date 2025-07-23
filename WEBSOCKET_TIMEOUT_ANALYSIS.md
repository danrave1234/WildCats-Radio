# WebSocket Timeout Analysis for WildCats Radio

## Issue Description
The user asked: "Does the project have like a time out in the broadcasting websocket where if its streaming for long it just cuts off?"

**Answer: YES** - The project has multiple timeout mechanisms that can cause WebSocket disconnections during long streaming sessions.

## Timeout Sources Identified

### 1. Backend WebSocket Timeouts (Primary Issue)

**Location:** `backend/src/main/resources/application.properties`

```properties
# Main culprit - 2 minute idle timeout
spring.websocket.max-session-idle-timeout=120000  # 120 seconds = 2 minutes

# SockJS heartbeat settings
spring.websocket.sockjs.heartbeat-time=15000       # 15 seconds
spring.websocket.sockjs.disconnect-delay=2000      # 2 seconds

# Async send timeout
setAsyncSendTimeout(30000L)                         # 30 seconds (in WebSocketConfig.java)
```

**Impact:** WebSocket connections will be automatically closed after 2 minutes of inactivity, even during active streaming sessions.

### 2. Icecast Server Timeouts

**Location:** `Icecast/icecast.xml`

```xml
<client-timeout>30</client-timeout>        <!-- 30 seconds -->
<header-timeout>15</header-timeout>        <!-- 15 seconds -->
<source-timeout>10</source-timeout>        <!-- 10 seconds -->
<respawn-timeout>5</respawn-timeout>       <!-- 5 seconds -->
```

**Impact:** These timeouts affect the audio streaming connection between FFmpeg and Icecast server.

### 3. Frontend WebSocket Configuration

**Location:** `frontend/src/config.js`

```javascript
// Heartbeat settings (should prevent timeouts)
wsHeartbeatInterval: isLocalEnvironment ? 10000 : 25000,  // 10s local, 25s deployed

// Reconnection settings
wsReconnectDelay: isLocalEnvironment ? 3000 : 5000,       // 3s local, 5s deployed
wsMaxReconnectAttempts: isLocalEnvironment ? 5 : 10,      // 5 local, 10 deployed
```

**Location:** `frontend/src/services/api.js`

```javascript
// STOMP client heartbeat configuration
stompClient.heartbeat.outgoing = this.config.wsHeartbeatInterval;  // 25s deployed
stompClient.heartbeat.incoming = this.config.wsHeartbeatInterval;  // 25s deployed
```

## Current Mitigation Mechanisms

### 1. Automatic Reconnection System ✅

The frontend has sophisticated reconnection logic:

- **globalWebSocketService.js**: Handles automatic reconnection with exponential backoff
- **Network awareness**: Detects network status and reconnects when online
- **Multiple WebSocket types**: Separate reconnection for DJ, listener, and analytics WebSockets
- **Configurable attempts**: Up to 10 reconnection attempts in deployed environment

### 2. Heartbeat/Keepalive System ✅

- **Frontend heartbeat**: 25-second intervals (deployed) should keep connections alive
- **SockJS heartbeat**: 15-second intervals on backend
- **Ping/pong mechanism**: Implemented in globalWebSocketService.js

### 3. Connection Health Monitoring ✅

- **Health checks**: Regular ping/pong to detect unhealthy connections
- **Forced reconnection**: Automatically reconnects unhealthy connections
- **Visibility handling**: Reconnects when browser tab becomes visible again

## The Problem: Timeout vs Heartbeat Mismatch

**Root Cause:** The backend WebSocket idle timeout (120 seconds) is longer than the frontend heartbeat interval (25 seconds), which should theoretically prevent timeouts. However, there may be edge cases where:

1. **Heartbeat failures**: Network issues cause heartbeat messages to be lost
2. **Processing delays**: Server-side processing delays cause timeouts despite heartbeats
3. **Load balancer timeouts**: Infrastructure timeouts not configured in the application
4. **Browser throttling**: Background tab throttling affects heartbeat timing

## Recommendations

### 1. Increase WebSocket Idle Timeout (Immediate Fix)

**File:** `backend/src/main/resources/application.properties`

```properties
# Increase from 2 minutes to 10 minutes for long streaming sessions
spring.websocket.max-session-idle-timeout=600000  # 600 seconds = 10 minutes

# Optionally increase heartbeat interval to reduce server load
spring.websocket.sockjs.heartbeat-time=30000      # 30 seconds
```

### 2. Optimize Frontend Heartbeat Settings

**File:** `frontend/src/config.js`

```javascript
// Reduce heartbeat interval for more reliable keepalive
wsHeartbeatInterval: isLocalEnvironment ? 10000 : 20000,  // 10s local, 20s deployed
```

### 3. Add Connection Monitoring Dashboard

Create a monitoring system to track:
- WebSocket connection duration
- Disconnection frequency
- Reconnection success rates
- Heartbeat failure rates

### 4. Implement Graceful Degradation

For long streaming sessions:
- **Progressive timeout increase**: Increase timeout for active streaming sessions
- **Activity-based timeouts**: Different timeouts for active vs idle connections
- **Session persistence**: Store session state to resume after reconnection

### 5. Infrastructure Considerations

Check for additional timeout sources:
- **Load balancer timeouts**: Nginx, CloudFlare, etc.
- **Cloud provider limits**: Google Cloud, AWS, etc.
- **Network infrastructure**: ISP or corporate firewall timeouts

## Current Status Assessment

**Good News:**
- ✅ Comprehensive reconnection system exists
- ✅ Heartbeat mechanism is implemented
- ✅ Multiple fallback strategies are in place
- ✅ Network awareness and health monitoring

**Areas for Improvement:**
- ⚠️ 2-minute idle timeout is too aggressive for streaming
- ⚠️ No differentiation between streaming and idle sessions
- ⚠️ No monitoring of timeout patterns
- ⚠️ Potential infrastructure timeout sources not addressed

## Conclusion

**Yes, the project does have timeouts that can cut off WebSocket connections during long streaming sessions.** The primary culprit is the 2-minute idle timeout on the backend. However, the application has robust reconnection mechanisms that should minimize the impact on users.

**Recommended immediate action:** Increase `spring.websocket.max-session-idle-timeout` from 120000 (2 minutes) to 600000 (10 minutes) or higher for better streaming experience.

The sophisticated reconnection system means that even when timeouts occur, the application should automatically reconnect and resume streaming with minimal interruption to the user experience.