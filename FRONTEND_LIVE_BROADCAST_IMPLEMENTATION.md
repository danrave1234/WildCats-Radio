# Frontend Live Broadcast Implementation Guide
## Aligning Frontend with Backend Enhancements

**Document Date:** January 2025  
**Scope:** Frontend Web & Mobile Application Changes  
**Reference:** `md/LIVE_BROADCAST_SYSTEM_EVALUATION.md`

---

## Executive Summary

This document identifies the specific frontend web and mobile changes required to fully leverage the backend implementations completed in Phases 1-3 of the Live Broadcast System Evaluation. The backend now includes atomic transactions, idempotency keys, exponential backoff, circuit breaker pattern, state machine validation, state persistence, and enhanced recovery mechanisms.

**Current Frontend Status:**

### Web Frontend
- ✅ Idempotency keys implemented in API calls
- ⚠️ **PARTIAL** WebSocket consolidation - STOMP client manager exists but **2 independent WebSocket connections still remain**
- ✅ Exponential backoff via `WebSocketReconnectManager`
- ⚠️ Partial recovery message handling
- ❌ Missing checkpoint update handling
- ❌ Missing circuit breaker error handling
- ❌ Missing enhanced state machine validation error messages
- ❌ Missing recovery state UI indicators

### Mobile Frontend
- ✅ Idempotency keys implemented in API calls (`apiService.ts` uses `generatePrefixedIdempotencyKey()`)
- ⚠️ **PARTIAL** WebSocket consolidation - STOMP client manager exists but **1 independent WebSocket connection still remains**
- ⚠️ Fixed reconnection delay (3 seconds) - no exponential backoff
- ⚠️ Partial recovery message handling
- ❌ Missing checkpoint update handling
- ❌ Missing circuit breaker error handling
- ❌ Missing enhanced state machine validation error messages
- ❌ Missing recovery state UI indicators

**🚨 CRITICAL: WebSocket Consolidation Gap**

### Web Frontend
Despite STOMP client manager implementation, **2 independent WebSocket connections** still exist:
1. **DJ Audio Streaming WebSocket** (`/ws/live`) - Binary WebSocket for audio upload via `globalWebSocketService.connectDJWebSocket()`
2. **Listener Status WebSocket** (`/ws-listener-status`) - JSON WebSocket for stream status/listener count via `globalWebSocketService.connectListenerStatusWebSocket()`

**Note:** Polls are already using STOMP (`pollService.subscribeToPolls()` uses `stompClientManager`). The `connectPollWebSocket()` method in `globalWebSocketService.js` appears to be unused legacy code.

### Mobile Frontend
Despite STOMP client manager implementation, **1 independent WebSocket connection** still exists:
1. **Listener Status WebSocket** (`/ws-listener-status`) - JSON WebSocket for stream status/listener count via direct `new WebSocket()` in `broadcast.tsx` (`listenerWsRef`)

**Note:** Mobile uses STOMP for chat (`chatService.subscribeToChatMessages()`), polls (`pollService.subscribeToPolls()`), and broadcast updates via `websocketService` which uses `StompClientManager`. Mobile does NOT have a DJ WebSocket (mobile only listens, doesn't stream audio).

---

## 1. Backend Features Requiring Frontend Updates

### 1.1 ✅ Idempotency Keys (COMPLETED)
**Status:** ✅ **IMPLEMENTED**

**Backend Feature:**
- Accepts `Idempotency-Key` header on start/end operations
- Returns existing result if duplicate operation detected
- Prevents duplicate operations from network retries

**Frontend Implementation:**
- ✅ `frontend/src/utils/idempotencyUtils.js` - UUID generation utility
- ✅ `frontend/src/services/api/broadcastApi.js` - Idempotency keys added to start/end calls

**No Changes Required** - Implementation is complete.

---

### 1.2 ❌ Circuit Breaker Error Handling (MISSING)

**Backend Feature:**
- Circuit breaker blocks requests after 5 consecutive failures
- Returns HTTP 503 (Service Unavailable) when circuit is OPEN
- Includes `Retry-After` header with recovery time

**Frontend Gap:**
- No specific handling for circuit breaker errors
- Generic error messages don't inform users about temporary unavailability
- No retry logic with exponential backoff for circuit breaker failures

**Required Changes:**

**File:** `frontend/src/services/api/broadcastApi.js`

```javascript
// Add circuit breaker error detection
const handleCircuitBreakerError = (error) => {
  if (error.response?.status === 503) {
    const retryAfter = error.response?.headers['retry-after'] || 
                      error.response?.headers['Retry-After'];
    const retrySeconds = retryAfter ? parseInt(retryAfter, 10) : 60;
    
    return {
      isCircuitBreaker: true,
      retryAfter: retrySeconds,
      message: `Service temporarily unavailable. Please try again in ${retrySeconds} seconds.`
    };
  }
  return null;
};

// Update start/end methods to handle circuit breaker
start: async (id) => {
  const idempotencyKey = generatePrefixedIdempotencyKey('broadcast-start');
  try {
    return await api.post(`/api/broadcasts/${id}/start`, {}, {
      headers: { 'Idempotency-Key': idempotencyKey }
    });
  } catch (error) {
    const circuitBreakerError = handleCircuitBreakerError(error);
    if (circuitBreakerError) {
      throw new Error(circuitBreakerError.message);
    }
    throw error;
  }
},
```

**File:** `frontend/src/pages/DJDashboard.jsx`

```javascript
// Update error handling in startBroadcastLive and stopBroadcast
catch (error) {
  logger.error("Error starting broadcast:", error);
  
  // Check for circuit breaker error
  if (error.message?.includes('temporarily unavailable')) {
    const retryMatch = error.message.match(/(\d+) seconds/);
    const retrySeconds = retryMatch ? parseInt(retryMatch[1], 10) : 60;
    
    setStreamError(`Service temporarily unavailable. Retrying in ${retrySeconds} seconds...`);
    
    // Auto-retry after delay
    setTimeout(() => {
      startBroadcastLive();
    }, retrySeconds * 1000);
    return;
  }
  
  const msg = error?.response?.data?.message || error.message || "Failed to start broadcast";
  setStreamError(`Error starting broadcast: ${msg}`);
}
```

---

### 1.3 ⚠️ State Machine Validation Error Handling (PARTIAL)

**Backend Feature:**
- Validates state transitions before operations
- Returns HTTP 409 (Conflict) with descriptive error message
- Prevents invalid operations (e.g., starting already LIVE broadcast)

**Frontend Gap:**
- Generic error handling doesn't distinguish state machine errors
- No user-friendly messages explaining why operation failed
- No UI feedback preventing invalid button clicks

**Required Changes:**

**File:** `frontend/src/pages/DJDashboard.jsx`

```javascript
// Add state validation before operations
const startBroadcastLive = async () => {
  if (!currentBroadcast?.id) {
    setStreamError("No broadcast instance found");
    return;
  }

  // Pre-validate state on frontend (optional, backend will also validate)
  if (currentBroadcast.status === 'LIVE') {
    setStreamError("Broadcast is already LIVE. Cannot start again.");
    return;
  }
  
  if (currentBroadcast.status === 'ENDED') {
    setStreamError("Cannot start an ended broadcast. Please create a new broadcast.");
    return;
  }

  try {
    setStreamError(null);
    logger.debug("Starting broadcast live:", currentBroadcast.id);

    const response = await broadcastService.start(currentBroadcast.id);
    // ... existing code ...
  } catch (error) {
    logger.error("Error starting broadcast:", error);
    
    // Handle state machine validation errors
    if (error.response?.status === 409) {
      const backendMessage = error.response?.data?.message || '';
      if (backendMessage.includes('already LIVE') || backendMessage.includes('Cannot start')) {
        setStreamError(`Cannot start broadcast: ${backendMessage}`);
        // Refresh broadcast state
        const updated = await broadcastService.getById(currentBroadcast.id);
        setCurrentBroadcast(updated.data);
        return;
      }
    }
    
    // Handle circuit breaker (from section 1.2)
    if (error.message?.includes('temporarily unavailable')) {
      // ... circuit breaker handling ...
      return;
    }
    
    const msg = error?.response?.data?.message || error.message || "Failed to start broadcast";
    setStreamError(`Error starting broadcast: ${msg}`);
  }
};
```

**File:** `frontend/src/pages/DJDashboard.jsx`

```javascript
// Disable start button when broadcast is already LIVE
<button
  onClick={startBroadcastLive}
  disabled={currentBroadcast?.status === 'LIVE' || isStartingBroadcast}
  className={...}
>
  {currentBroadcast?.status === 'LIVE' ? 'Broadcast Already Live' : 'Start Broadcast'}
</button>
```

---

### 1.4 ❌ Broadcast Recovery Message Handling (MISSING)

**Backend Feature:**
- Sends `BROADCAST_RECOVERY` WebSocket messages on server startup
- Includes recovery metadata (reason, checkpoint time, duration)
- Notifies clients when broadcasts are auto-recovered

**Frontend Gap:**
- No handler for `BROADCAST_RECOVERY` message type
- Recovery notifications only shown on DJ Dashboard mount
- No recovery status displayed to listeners

**Required Changes:**

**File:** `frontend/src/pages/DJDashboard.jsx`

```javascript
// Update WebSocket subscription to handle recovery messages
const setupReconnectionWebSocket = async () => {
  if (!currentBroadcast?.id) return;
  
  try {
    // Subscribe to broadcast-specific recovery updates
    const connection = await stompClientManager.subscribe(
      `/topic/broadcast/${currentBroadcast.id}`, 
      (message) => {
        const data = JSON.parse(message.body);
        
        if (data.type === 'BROADCAST_RECOVERY') {
          logger.info('DJ Dashboard: Broadcast recovery notification received:', data);
          
          setReconnectionStatus({
            status: 'RECOVERED',
            message: data.message || 'Broadcast recovered after server restart',
            checkpointTime: data.checkpointTime,
            duration: data.duration,
            timestamp: data.timestamp
          });
          
          // Update broadcast state if provided
          if (data.broadcast) {
            setCurrentBroadcast(data.broadcast);
            if (data.broadcast.actualStart) {
              setBroadcastStartTime(new Date(data.broadcast.actualStart));
            }
          }
          
          // Hide recovery notification after 5 seconds
          setTimeout(() => {
            setReconnectionStatus(null);
          }, 5000);
        }
        
        // Existing RECONNECTION_STATUS handling...
        if (data.type === 'RECONNECTION_STATUS') {
          // ... existing code ...
        }
      }
    );
    
    // Also subscribe to global broadcast status for recovery
    const globalConnection = await stompClientManager.subscribe(
      "/topic/broadcast/status", 
      (message) => {
        const data = JSON.parse(message.body);
        
        if (data.type === 'BROADCAST_RECOVERY' && data.broadcastId === currentBroadcast.id) {
          // Handle global recovery notification
          // ... same handling as above ...
        }
        
        // Existing RECONNECTION_STATUS handling...
        if (data.type === "RECONNECTION_STATUS" && data.broadcastId === currentBroadcast.id) {
          // ... existing code ...
        }
      }
    );
    
    reconnectionWsRef.current = { connection, globalConnection };
  } catch (error) {
    logger.error("DJ Dashboard: Failed to connect reconnection WebSocket:", error);
  }
};
```

**File:** `frontend/src/pages/ListenerDashboard.jsx`

```javascript
// Add recovery message handling in setupBroadcastWebSocket
const setupBroadcastWebSocket = async () => {
  // ... existing code ...
  
  const connection = await broadcastService.subscribeToBroadcastUpdates(
    subscribedBroadcastId, 
    (message) => {
      switch (message.type) {
        // ... existing cases ...
        
        case 'BROADCAST_RECOVERY':
          logger.info('Listener Dashboard: Broadcast recovery notification:', message);
          
          // Show recovery notification to listeners
          if (message.broadcast) {
            setCurrentBroadcast(message.broadcast);
            // Display recovery banner (optional)
            // Could show: "Broadcast recovered after brief interruption"
          }
          break;
          
        // ... rest of cases ...
      }
    }
  );
  
  // ... rest of setup ...
};
```

---

### 1.5 ❌ Checkpoint Update Handling (MISSING)

**Backend Feature:**
- Checkpoints live broadcasts every 60 seconds
- Updates `lastCheckpointTime` and `currentDurationSeconds`
- Sends checkpoint updates via WebSocket (optional, can be implemented)

**Frontend Gap:**
- No handling of checkpoint updates
- Duration displayed is calculated client-side, not from backend checkpoint
- No display of last checkpoint time

**Required Changes:**

**Option A: Backend sends checkpoint updates via WebSocket (Recommended)**

**Backend Change Required:** Add checkpoint WebSocket notifications in `BroadcastService.checkpointLiveBroadcasts()`

**File:** `frontend/src/pages/DJDashboard.jsx`

```javascript
// Add checkpoint update handler
const setupCheckpointWebSocket = async () => {
  if (!currentBroadcast?.id) return;
  
  try {
    const connection = await stompClientManager.subscribe(
      `/topic/broadcast/${currentBroadcast.id}`, 
      (message) => {
        const data = JSON.parse(message.body);
        
        if (data.type === 'BROADCAST_CHECKPOINT') {
          logger.debug('DJ Dashboard: Checkpoint update received:', data);
          
          // Update broadcast duration from backend checkpoint
          if (data.currentDurationSeconds !== undefined) {
            // Use backend-provided duration for accuracy
            const durationMs = data.currentDurationSeconds * 1000;
            const checkpointStart = new Date(Date.now() - durationMs);
            setBroadcastStartTime(checkpointStart);
          }
          
          // Update last checkpoint time if provided
          if (data.lastCheckpointTime) {
            // Could display: "Last saved: 2 minutes ago"
            // Store in state for display
          }
        }
      }
    );
    
    checkpointWsRef.current = connection;
  } catch (error) {
    logger.error("DJ Dashboard: Failed to subscribe to checkpoint updates:", error);
  }
};
```

**Option B: Poll checkpoint data from health endpoint (Fallback)**

**File:** `frontend/src/pages/DJDashboard.jsx`

```javascript
// Use health endpoint that includes checkpoint data
useEffect(() => {
  if (currentBroadcast?.status !== 'LIVE') return;
  
  const interval = setInterval(async () => {
    try {
      const healthResponse = await broadcastService.getLiveHealth();
      const health = healthResponse.data;
      
      // Update duration from backend checkpoint if available
      if (health.currentDurationSeconds) {
        const durationMs = health.currentDurationSeconds * 1000;
        const checkpointStart = new Date(Date.now() - durationMs);
        setBroadcastStartTime(checkpointStart);
      }
    } catch (error) {
      logger.debug('Failed to fetch checkpoint data:', error);
    }
  }, 60000); // Every 60 seconds (matches backend checkpoint interval)
  
  return () => clearInterval(interval);
}, [currentBroadcast?.id, currentBroadcast?.status]);
```

**UI Display Addition:**

```javascript
// Display checkpoint status in DJ Dashboard
{currentBroadcast?.status === 'LIVE' && lastCheckpointTime && (
  <div className="text-xs text-gray-500">
    Last saved: {formatTimeAgo(lastCheckpointTime)}
  </div>
)}
```

---

### 1.6 ⚠️ Recovery State UI Indicators (PARTIAL)

**Backend Feature:**
- Tracks `recovering` flag in health status
- Sends recovery state via WebSocket health updates
- Distinguishes between healthy, unhealthy, and recovering states

**Frontend Gap:**
- Recovery state is received but not prominently displayed
- No visual distinction between recovering and unhealthy states
- No recovery progress indicator

**Required Changes:**

**File:** `frontend/src/pages/DJDashboard.jsx`

```javascript
// Add recovery state display
const [recoveryState, setRecoveryState] = useState(null);

// Update recovery state from health WebSocket
useEffect(() => {
  // Subscribe to health updates
  const subscription = stompClientManager.subscribe('/topic/broadcast/live', (message) => {
    const data = JSON.parse(message.body);
    
    if (data.health) {
      const { healthy, recovering } = data.health;
      
      if (recovering) {
        setRecoveryState({
          status: 'recovering',
          message: 'Broadcast is recovering from interruption...'
        });
      } else if (!healthy) {
        setRecoveryState({
          status: 'unhealthy',
          message: 'Broadcast health check failed'
        });
      } else {
        setRecoveryState(null); // Healthy
      }
    }
  });
  
  return () => subscription.then(sub => sub.unsubscribe());
}, []);

// Display recovery banner
{recoveryState && (
  <div className={`p-3 rounded-md mb-4 ${
    recoveryState.status === 'recovering' 
      ? 'bg-yellow-100 border-yellow-400 text-yellow-800'
      : 'bg-red-100 border-red-400 text-red-800'
  }`}>
    <div className="flex items-center">
      {recoveryState.status === 'recovering' && (
        <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      <span>{recoveryState.message}</span>
    </div>
  </div>
)}
```

**File:** `frontend/src/pages/ListenerDashboard.jsx`

```javascript
// Add recovery indicator for listeners
const [streamRecoveryState, setStreamRecoveryState] = useState(null);

// Update from listener status WebSocket
const handleMessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'STREAM_STATUS' && data.health) {
    const { healthy, recovering } = data.health;
    
    if (recovering) {
      setStreamRecoveryState('recovering');
    } else if (!healthy) {
      setStreamRecoveryState('unhealthy');
    } else {
      setStreamRecoveryState(null);
    }
  }
};

// Display recovery banner for listeners
{streamRecoveryState === 'recovering' && (
  <div className="bg-yellow-100 border-yellow-400 text-yellow-800 p-2 rounded mb-2">
    <div className="flex items-center">
      <svg className="animate-spin h-4 w-4 mr-2" ...>
        {/* Spinner icon */}
      </svg>
      <span className="text-sm">Stream is recovering from interruption...</span>
    </div>
  </div>
)}
```

---

### 1.7 ⚠️ Enhanced Error Messages for Duplicate Operations (PARTIAL)

**Backend Feature:**
- Returns existing broadcast when duplicate operation detected (idempotency)
- Includes metadata indicating operation was idempotent

**Frontend Gap:**
- No user feedback when duplicate operation is detected
- User may not know their click was handled (idempotent response)

**Required Changes:**

**File:** `frontend/src/pages/DJDashboard.jsx`

```javascript
const startBroadcastLive = async () => {
  // ... existing validation ...
  
  try {
    setStreamError(null);
    logger.debug("Starting broadcast live:", currentBroadcast.id);

    const response = await broadcastService.start(currentBroadcast.id);
    const liveBroadcast = response.data;
    
    // Check if this was an idempotent operation (duplicate request)
    // Backend could include header or metadata indicating idempotency
    const wasIdempotent = response.headers['x-idempotent-operation'] === 'true';
    
    if (wasIdempotent) {
      logger.info("Broadcast start was idempotent (duplicate request handled gracefully)");
      // Optional: Show brief notification
      // toast.success("Broadcast already started");
    }
    
    setCurrentBroadcast(liveBroadcast);
    // ... rest of existing code ...
  } catch (error) {
    // ... existing error handling ...
  }
};
```

**Note:** This requires backend to send `X-Idempotent-Operation: true` header when returning existing result.

---

## 2. WebSocket Message Types to Handle

### 2.1 New Message Types from Backend

The backend now sends additional WebSocket message types that the frontend should handle:

| Message Type | Description | Priority | Status |
|-------------|-------------|----------|--------|
| `BROADCAST_RECOVERY` | Broadcast recovered after server restart | HIGH | ❌ Missing |
| `BROADCAST_CHECKPOINT` | Periodic checkpoint update (every 60s) | MEDIUM | ❌ Missing |
| `BROADCAST_STATE_TRANSITION` | State change with metadata | LOW | ⚠️ Partial |
| `CIRCUIT_BREAKER_OPEN` | Circuit breaker opened (service unavailable) | HIGH | ❌ Missing |
| `CIRCUIT_BREAKER_CLOSED` | Circuit breaker closed (service restored) | MEDIUM | ❌ Missing |

### 2.2 Implementation Locations

**DJ Dashboard:**
- `frontend/src/pages/DJDashboard.jsx` - `setupReconnectionWebSocket()`, `setupCheckpointWebSocket()`

**Listener Dashboard:**
- `frontend/src/pages/ListenerDashboard.jsx` - `setupBroadcastWebSocket()`

**Global Context:**
- `frontend/src/context/StreamingContext.jsx` - `connectBroadcastStatusWebSocket()`

---

## 3. Error Handling Enhancements

### 3.1 HTTP Status Code Handling

| Status Code | Backend Meaning | Frontend Action Required |
|------------|----------------|------------------------|
| 409 Conflict | State machine validation failed | Show user-friendly message, refresh state |
| 503 Service Unavailable | Circuit breaker open | Show retry message with countdown |
| 400 Bad Request | Invalid idempotency key format | Log error, regenerate key |
| 200 OK (with idempotent header) | Duplicate operation handled | Optional: Show "already processed" message |

### 3.2 Error Message Mapping

**File:** `frontend/src/utils/errorHandler.js` (NEW)

```javascript
export const getBroadcastErrorMessage = (error) => {
  const status = error.response?.status;
  const message = error.response?.data?.message || error.message;
  
  switch (status) {
    case 409:
      if (message.includes('already LIVE')) {
        return 'This broadcast is already live. Cannot start again.';
      }
      if (message.includes('Cannot start')) {
        return `Cannot start broadcast: ${message}`;
      }
      return `Invalid operation: ${message}`;
      
    case 503:
      const retryAfter = error.response?.headers['retry-after'] || 60;
      return `Service temporarily unavailable. Please try again in ${retryAfter} seconds.`;
      
    case 400:
      if (message.includes('idempotency')) {
        return 'Invalid request. Please try again.';
      }
      return message || 'Invalid request';
      
    default:
      return message || 'An error occurred. Please try again.';
  }
};
```

---

## 4. UI/UX Enhancements

### 4.1 Recovery State Indicators

**Priority:** HIGH

- **DJ Dashboard:** Show recovery banner when `recovering === true`
- **Listener Dashboard:** Show "Stream recovering..." banner
- **Both:** Auto-hide after recovery completes (5 seconds)

### 4.2 Checkpoint Status Display

**Priority:** MEDIUM

- **DJ Dashboard:** Show "Last saved: X minutes ago" indicator
- **Duration Display:** Use backend `currentDurationSeconds` when available
- **Visual Indicator:** Subtle pulse animation on checkpoint save

### 4.3 Circuit Breaker UI

**Priority:** HIGH

- **Error Banner:** Show when circuit breaker is open
- **Retry Countdown:** Display countdown timer for retry
- **Auto-Retry:** Automatically retry after countdown completes

### 4.4 State Machine Validation UI

**Priority:** MEDIUM

- **Button States:** Disable start button when broadcast is LIVE
- **Tooltips:** Explain why button is disabled
- **Error Messages:** User-friendly messages for invalid transitions

---

## 5. Implementation Checklist

### Phase 0: 🚨 CRITICAL WebSocket Consolidation (Week 1 - BLOCKING)
**Status:** ❌ **REQUIRED** - Must be completed to achieve full WebSocket optimization

#### Web Frontend - Remaining Independent WebSocket Connections

1. **DJ Audio Streaming WebSocket** (`/ws/live`) - Binary WebSocket for audio upload
   - **Current:** `globalWebSocketService.connectDJWebSocket()` creates independent WebSocket
   - **Challenge:** STOMP may not natively support binary data (ArrayBuffer)
   - **Solution Options:**
     - **Option A:** Base64 encode binary audio data and send via STOMP text messages
     - **Option B:** Keep DJ WebSocket separate (binary requirement) but document as intentional
     - **Option C:** Backend adds STOMP binary message support

2. **Listener Status WebSocket** (`/ws-listener-status`) - JSON WebSocket for stream status
   - **Current:** `globalWebSocketService.connectListenerStatusWebSocket()` creates independent WebSocket
   - **Solution:** Migrate to STOMP topic `/topic/listener-status` (JSON messages compatible)

#### Mobile Frontend - Remaining Independent WebSocket Connections

1. **Listener Status WebSocket** (`/ws-listener-status`) - JSON WebSocket for stream status/listener count
   - **Current:** Direct `new WebSocket()` in `mobile/app/(tabs)/broadcast.tsx` (`listenerWsRef`)
   - **Solution:** Migrate to STOMP topic `/topic/listener-status` via `StompClientManager`
   - **Note:** Mobile does NOT have DJ WebSocket (mobile only listens, doesn't stream audio)

#### Web Frontend Implementation Tasks
- [ ] **0.1** Migrate Listener Status WebSocket to STOMP topic `/topic/listener-status`
  - Update `StreamingContext.jsx` to subscribe via `stompClientManager`
  - Update `ListenerDashboard.jsx` to use STOMP subscription
  - Remove `connectListenerStatusWebSocket()` usage
- [ ] **0.2** Evaluate DJ Audio WebSocket migration options
  - Test STOMP binary message support (if backend supports)
  - If not supported, document DJ WebSocket as intentionally separate due to binary requirement
  - If migrating: Base64 encode audio chunks and send via STOMP text messages
- [ ] **0.3** Remove unused `connectPollWebSocket()` from `globalWebSocketService.js`
  - Polls already use STOMP via `pollService.subscribeToPolls()`
  - Clean up legacy code
- [ ] **0.4** Update documentation to reflect final WebSocket architecture
  - Document which connections use STOMP vs independent WebSocket
  - Explain rationale for any remaining independent connections

#### Mobile Frontend Implementation Tasks
- [ ] **0.5** Migrate Listener Status WebSocket to STOMP topic `/topic/listener-status`
  - Update `mobile/app/(tabs)/broadcast.tsx` to use `StompClientManager.subscribe()` instead of direct WebSocket
  - Remove `listenerWsRef` and direct WebSocket connection code
  - Use existing `websocketService` or `stompClientManager` for listener status subscription
- [ ] **0.6** Implement exponential backoff for mobile WebSocket reconnection
  - Currently uses fixed 3-second delay in `broadcast.tsx`
  - Create mobile version of `WebSocketReconnectManager` or reuse existing pattern
- [ ] **0.7** Update mobile WebSocket error handling
  - Add circuit breaker error detection
  - Add state machine validation error handling
  - Match web frontend error handling patterns

**Files to Modify (Web):**
- `frontend/src/context/StreamingContext.jsx` - Migrate listener status to STOMP
- `frontend/src/pages/ListenerDashboard.jsx` - Migrate listener status to STOMP
- `frontend/src/services/globalWebSocketService.js` - Remove unused poll WebSocket code
- `frontend/src/services/stompClientManager.js` - Add listener status subscription helper (if needed)

**Files to Modify (Mobile):**
- `mobile/app/(tabs)/broadcast.tsx` - Migrate listener WebSocket to STOMP
- `mobile/services/websocketService.ts` - Add listener status subscription helper (if needed)
- `mobile/services/websocketService.ts` - Implement exponential backoff reconnection

**Testing:**
- **Web:** Verify WebSocket connection count in browser DevTools Network tab
  - **Target:** 1 STOMP connection + 1 DJ WebSocket (if binary requirement prevents STOMP migration)
  - **Current:** 1 STOMP connection + 1 DJ WebSocket + 1 Listener Status WebSocket = **3 connections**
- **Mobile:** Verify WebSocket connection count in React Native debugger
  - **Target:** 1 STOMP connection
  - **Current:** 1 STOMP connection + 1 Listener Status WebSocket = **2 connections**

---

### Phase 1: Critical Error Handling (Week 2)

#### Web Frontend Tasks
- [ ] **1.1** Implement circuit breaker error handling in `broadcastApi.js`
- [ ] **1.2** Add circuit breaker retry logic in `DJDashboard.jsx`
- [ ] **1.3** Enhance state machine validation error messages
- [ ] **1.4** Add pre-validation checks before start/end operations
- [ ] **1.5** Create `errorHandler.js` utility for error message mapping

#### Mobile Frontend Tasks
- [ ] **1.6** Implement circuit breaker error handling in `apiService.ts`
  - Add `handleCircuitBreakerError()` helper function
  - Update `startBroadcast()` and `endBroadcast()` methods
- [ ] **1.7** Add circuit breaker retry logic in mobile broadcast screen
  - Update error handling in `mobile/app/(tabs)/broadcast.tsx` (if mobile has broadcast control)
  - Add retry countdown UI for mobile
- [ ] **1.8** Enhance state machine validation error messages
  - Add error message mapping for 409 Conflict responses
  - Create mobile-friendly error display components
- [ ] **1.9** Create mobile `errorHandler.ts` utility
  - Match web `errorHandler.js` functionality
  - Adapt for React Native Alert/Toast patterns

### Phase 2: Recovery & Checkpoint Handling (Week 3)

#### Web Frontend Tasks
- [ ] **2.1** Implement `BROADCAST_RECOVERY` message handler in DJ Dashboard
- [ ] **2.2** Implement `BROADCAST_RECOVERY` message handler in Listener Dashboard
- [ ] **2.3** Add checkpoint WebSocket subscription (or polling fallback)
- [ ] **2.4** Display checkpoint time in DJ Dashboard
- [ ] **2.5** Use backend `currentDurationSeconds` for accurate duration display

#### Mobile Frontend Tasks
- [ ] **2.6** Implement `BROADCAST_RECOVERY` message handler in mobile broadcast screen
  - Update `mobile/app/(tabs)/broadcast.tsx` to handle recovery messages
  - Subscribe to `/topic/broadcast/{id}` or `/topic/broadcast/status` via STOMP
  - Display recovery notification to mobile users
- [ ] **2.7** Add checkpoint WebSocket subscription (or polling fallback)
  - Subscribe to checkpoint updates via STOMP topic
  - Fallback to polling `getLiveHealth()` endpoint if WebSocket unavailable
- [ ] **2.8** Display checkpoint status in mobile broadcast screen
  - Show "Last saved: X minutes ago" indicator (optional)
  - Use backend `currentDurationSeconds` for accurate duration display

### Phase 3: UI/UX Enhancements (Week 4)

#### Web Frontend Tasks
- [ ] **3.1** Add recovery state banner in DJ Dashboard
- [ ] **3.2** Add recovery state banner in Listener Dashboard
- [ ] **3.3** Implement circuit breaker countdown UI
- [ ] **3.4** Add state machine validation button states
- [ ] **3.5** Enhance error messages with user-friendly text

#### Mobile Frontend Tasks
- [ ] **3.6** Add recovery state banner in mobile broadcast screen
  - Display recovery notification when `recovering === true` in health status
  - Use React Native Alert or Toast for mobile-friendly display
  - Auto-hide after recovery completes (5 seconds)
- [ ] **3.7** Implement circuit breaker countdown UI for mobile
  - Show Alert with retry countdown when circuit breaker is open
  - Use React Native Alert API for mobile-friendly display
- [ ] **3.8** Add state machine validation error display
  - Show user-friendly error messages for invalid state transitions
  - Use React Native Alert for error display
- [ ] **3.9** Enhance error messages with mobile-friendly text
  - Adapt error messages for mobile screen sizes
  - Use appropriate React Native components (Alert, Toast, etc.)

### Phase 4: Testing & Polish (Week 5)

#### Web Frontend Tasks
- [ ] **4.1** Test circuit breaker error scenarios
- [ ] **4.2** Test state machine validation error scenarios
- [ ] **4.3** Test recovery message handling
- [ ] **4.4** Test checkpoint updates
- [ ] **4.5** Verify all WebSocket message types are handled

#### Mobile Frontend Tasks
- [ ] **4.6** Test circuit breaker error scenarios on mobile
  - Test with React Native debugger
  - Verify Alert/Toast displays correctly
- [ ] **4.7** Test state machine validation error scenarios on mobile
  - Test error message display
  - Verify mobile-friendly error handling
- [ ] **4.8** Test recovery message handling on mobile
  - Test `BROADCAST_RECOVERY` message reception via STOMP
  - Verify recovery notification display
- [ ] **4.9** Test checkpoint updates on mobile
  - Verify checkpoint data received via WebSocket or polling
  - Test duration display accuracy
- [ ] **4.10** Verify mobile WebSocket connection count
  - Should be 1 STOMP connection after Phase 0 completion
  - Test on iOS and Android devices

---

## 6. Files Requiring Changes

### Web Frontend - High Priority
1. `frontend/src/pages/DJDashboard.jsx`
   - Circuit breaker error handling
   - State machine validation
   - Recovery message handling
   - Checkpoint updates
   - Recovery state UI

2. `frontend/src/services/api/broadcastApi.js`
   - Circuit breaker error detection
   - Enhanced error handling

3. `frontend/src/pages/ListenerDashboard.jsx`
   - Recovery message handling
   - Recovery state UI
   - Migrate listener status WebSocket to STOMP

### Web Frontend - Medium Priority
4. `frontend/src/context/StreamingContext.jsx`
   - Recovery message handling in global context
   - Migrate listener status WebSocket to STOMP

5. `frontend/src/utils/errorHandler.js` (NEW)
   - Centralized error message mapping

6. `frontend/src/services/globalWebSocketService.js`
   - Remove unused `connectPollWebSocket()` method

### Web Frontend - Low Priority
7. `frontend/src/components/Header.jsx`
   - Recovery state banner (if global)

---

### Mobile Frontend - High Priority
1. `mobile/app/(tabs)/broadcast.tsx`
   - Migrate listener WebSocket to STOMP (`listenerWsRef` → `StompClientManager`)
   - Circuit breaker error handling
   - State machine validation error handling
   - Recovery message handling
   - Checkpoint updates
   - Recovery state UI
   - Implement exponential backoff reconnection

2. `mobile/services/apiService.ts`
   - Circuit breaker error detection in `startBroadcast()` and `endBroadcast()`
   - Enhanced error handling

### Mobile Frontend - Medium Priority
3. `mobile/services/websocketService.ts`
   - Add listener status subscription helper (if needed)
   - Implement exponential backoff reconnection manager

4. `mobile/services/errorHandler.ts` (NEW)
   - Centralized error message mapping for React Native
   - Mobile-friendly error display utilities

### Mobile Frontend - Low Priority
5. `mobile/services/idempotencyUtils.ts`
   - Already implemented ✅
   - No changes needed

---

## 7. Testing Scenarios

### 7.1 Circuit Breaker Testing

#### Web Frontend
1. **Scenario:** Backend circuit breaker opens after 5 failures
   - **Expected:** Frontend shows "Service temporarily unavailable" message
   - **Expected:** Retry countdown displays
   - **Expected:** Auto-retry after countdown

2. **Scenario:** Circuit breaker closes
   - **Expected:** Operations resume normally
   - **Expected:** Error banner disappears

#### Mobile Frontend
1. **Scenario:** Backend circuit breaker opens after 5 failures
   - **Expected:** Mobile shows Alert with "Service temporarily unavailable" message
   - **Expected:** Retry countdown displayed in Alert
   - **Expected:** Auto-retry after countdown (if applicable)

2. **Scenario:** Circuit breaker closes
   - **Expected:** Operations resume normally
   - **Expected:** Alert dismissed

### 7.2 State Machine Validation Testing

#### Web Frontend
1. **Scenario:** Attempt to start already LIVE broadcast
   - **Expected:** Error message: "Broadcast is already LIVE"
   - **Expected:** Start button disabled
   - **Expected:** Broadcast state refreshed

2. **Scenario:** Attempt to end already ENDED broadcast
   - **Expected:** Error message: "Broadcast already ended"
   - **Expected:** End button disabled

#### Mobile Frontend
1. **Scenario:** Attempt invalid broadcast operation (if mobile has broadcast control)
   - **Expected:** Alert with user-friendly error message
   - **Expected:** Error message explains why operation failed

### 7.3 Recovery Testing

#### Web Frontend
1. **Scenario:** Server restarts during LIVE broadcast
   - **Expected:** `BROADCAST_RECOVERY` message received
   - **Expected:** Recovery banner displayed
   - **Expected:** Broadcast state restored
   - **Expected:** Duration preserved from checkpoint

2. **Scenario:** Checkpoint updates received
   - **Expected:** Duration updated from backend checkpoint
   - **Expected:** Last checkpoint time displayed (optional)

#### Mobile Frontend
1. **Scenario:** Server restarts during LIVE broadcast
   - **Expected:** `BROADCAST_RECOVERY` message received via STOMP
   - **Expected:** Recovery notification displayed (Alert or Toast)
   - **Expected:** Broadcast state restored
   - **Expected:** Duration preserved from checkpoint

2. **Scenario:** Checkpoint updates received
   - **Expected:** Duration updated from backend checkpoint
   - **Expected:** Checkpoint status displayed (optional)

### 7.4 Idempotency Testing

#### Web Frontend
1. **Scenario:** Rapid double-click on start button
   - **Expected:** Only one broadcast started
   - **Expected:** Second request returns existing result
   - **Expected:** No duplicate operations

#### Mobile Frontend
1. **Scenario:** Rapid double-tap on broadcast operation (if applicable)
   - **Expected:** Only one operation executed
   - **Expected:** Second request returns existing result
   - **Expected:** No duplicate operations

### 7.5 WebSocket Consolidation Testing

#### Web Frontend
1. **Scenario:** Verify single STOMP connection
   - **Expected:** Only 1 STOMP WebSocket connection in Network tab
   - **Expected:** All features (chat, polls, broadcast status) work via single connection
   - **Expected:** Listener status uses STOMP (after Phase 0)

#### Mobile Frontend
1. **Scenario:** Verify single STOMP connection
   - **Expected:** Only 1 STOMP WebSocket connection in React Native debugger
   - **Expected:** All features (chat, polls, broadcast status, listener status) work via single connection
   - **Expected:** No independent WebSocket connections remain

---

## 8. Backend API Changes Reference

### 8.1 New Headers
- `Idempotency-Key: <uuid>` - Already implemented ✅
- `X-Idempotent-Operation: true` - Recommended for backend to send

### 8.2 New WebSocket Topics
- `/topic/broadcast/{id}` - Already subscribed ✅
- `/topic/broadcast/status` - Already subscribed ✅
- `/topic/broadcast/live` - Already subscribed ✅

### 8.3 New Message Types
- `BROADCAST_RECOVERY` - Needs frontend handler ❌
- `BROADCAST_CHECKPOINT` - Needs frontend handler ❌
- `CIRCUIT_BREAKER_OPEN` - Needs frontend handler ❌
- `CIRCUIT_BREAKER_CLOSED` - Needs frontend handler ❌

### 8.4 New Error Responses
- `409 Conflict` - State machine validation - Needs handling ⚠️
- `503 Service Unavailable` - Circuit breaker - Needs handling ❌

---

## 9. Dependencies & Prerequisites

### 9.1 Backend Requirements
- ✅ Backend must send `BROADCAST_RECOVERY` messages (already implemented)
- ⚠️ Backend should send `BROADCAST_CHECKPOINT` messages (optional, can use polling)
- ⚠️ Backend should send `CIRCUIT_BREAKER_OPEN/CLOSED` messages (optional)
- ✅ Backend must return `409` for state machine validation errors (already implemented)
- ✅ Backend must return `503` for circuit breaker errors (already implemented)

### 9.2 Frontend Dependencies

#### Web Frontend
- ✅ `stompClientManager` - Already implemented (`frontend/src/services/stompClientManager.js`)
- ✅ `idempotencyUtils` - Already implemented (`frontend/src/utils/idempotencyUtils.js`)
- ✅ `WebSocketReconnectManager` - Already implemented (`frontend/src/utils/WebSocketReconnectManager.js`)
- ❌ `errorHandler.js` - Needs to be created

#### Mobile Frontend
- ✅ `StompClientManager` - Already implemented (`mobile/services/websocketService.ts`)
- ✅ `idempotencyUtils` - Already implemented (`mobile/services/idempotencyUtils.ts`)
- ❌ `WebSocketReconnectManager` - Needs to be created (or exponential backoff pattern implemented)
- ❌ `errorHandler.ts` - Needs to be created

---

## 10. Migration Notes

### 10.1 Backward Compatibility
- All changes are additive (new handlers, new UI elements)
- Existing functionality remains unchanged
- No breaking changes to existing APIs

### 10.2 Gradual Rollout
1. **Week 1:** Complete WebSocket consolidation (Phase 0)
2. **Week 2:** Deploy error handling improvements (circuit breaker, state machine)
3. **Week 3:** Deploy recovery and checkpoint handling
4. **Week 4:** Deploy UI enhancements
5. **Week 5:** Testing and bug fixes

### 10.3 Feature Flags (Optional)
Consider feature flags for:
- Recovery message handling
- Checkpoint updates
- Circuit breaker UI
- Enhanced error messages

---

## 11. Success Criteria

### 11.1 Functional Requirements
- ✅ All backend error scenarios handled gracefully
- ✅ Recovery messages displayed to users
- ✅ Checkpoint updates reflected in UI
- ✅ Circuit breaker errors show retry countdown
- ✅ State machine validation errors show clear messages

### 11.2 User Experience
- ✅ Users understand why operations fail
- ✅ Users see recovery status during interruptions
- ✅ Users know when to retry failed operations
- ✅ No confusing error messages

### 11.3 Technical Requirements

#### Web Frontend
- ⚠️ **BLOCKED** Single STOMP WebSocket connection per user (2 independent connections still exist)
- ✅ All WebSocket message types handled
- ✅ Error handling is consistent across components
- ✅ Code is maintainable and well-documented
- ✅ No performance regressions

#### Mobile Frontend
- ⚠️ **BLOCKED** Single STOMP WebSocket connection per user (1 independent connection still exists)
- ✅ All WebSocket message types handled (via STOMP)
- ⚠️ Error handling needs enhancement (circuit breaker, state machine)
- ✅ Code is maintainable and well-documented
- ✅ No performance regressions

---

**Document Version:** 1.1  
**Last Updated:** January 2025  
**Author:** Frontend Implementation Guide  
**Status:** 🚨 **BLOCKED** - Phase 0 WebSocket consolidation required before proceeding

**Critical Findings:**

**Web Frontend:** Despite STOMP client manager implementation, 2 independent WebSocket connections still exist:
- DJ Audio Streaming WebSocket (`/ws/live`) - Binary audio upload
- Listener Status WebSocket (`/ws-listener-status`) - Stream status updates

**Mobile Frontend:** Despite STOMP client manager implementation, 1 independent WebSocket connection still exists:
- Listener Status WebSocket (`/ws-listener-status`) - Stream status/listener count (direct `new WebSocket()` in `broadcast.tsx`)

**Recommendation:** Complete Phase 0 WebSocket consolidation for both web and mobile before implementing other phases to achieve full optimization benefits.

