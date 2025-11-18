# Frontend Live Broadcast Implementation Guide
## Aligning Frontend with Backend Enhancements

**Document Date:** January 2025  
**Scope:** Frontend Web Application Changes  
**Reference:** `md/LIVE_BROADCAST_SYSTEM_EVALUATION.md`

---

## Executive Summary

This document identifies the specific frontend web changes required to fully leverage the backend implementations completed in Phases 1-3 of the Live Broadcast System Evaluation. The backend now includes atomic transactions, idempotency keys, exponential backoff, circuit breaker pattern, state machine validation, state persistence, and enhanced recovery mechanisms.

**Current Frontend Status:**
- ❌ **BROKEN** Idempotency keys - `idempotencyUtils.js` is **EMPTY** but imported by `broadcastApi.js` (CRITICAL BUG)
- ⚠️ **PARTIAL** WebSocket consolidation - STOMP client manager exists but **2 independent WebSocket connections still remain**
- ✅ Exponential backoff via `WebSocketReconnectManager` (properly implemented)
- ⚠️ Partial recovery message handling (only on DJ Dashboard mount, no WebSocket handler)
- ❌ Missing checkpoint update handling
- ❌ Missing circuit breaker error handling (503 responses)
- ❌ Missing enhanced state machine validation error messages (409 responses)
- ❌ Missing recovery state UI indicators

**🚨 CRITICAL: WebSocket Hard Refactor Required**

**HARD REFACTOR - NO BACKWARD COMPATIBILITY**

This is a **breaking change** that requires simultaneous deployment of backend and frontend. The current mixed WebSocket architecture will be **completely eliminated**:

**Current State (BROKEN):**
- 3 WebSocket connections per user (STOMP + 2 raw WebSocket)
- Inconsistent messaging patterns
- Raw WebSocket for listener status (inefficient)

**Target State (Post-Hard Refactor):**
- **2 WebSocket connections per user only:**
  - 1 STOMP connection (`/ws-radio`) - ALL text messaging
  - 1 Raw WebSocket (`/ws/live`) - DJ audio streaming only (binary)
- **83% connection reduction** achieved
- **Pure STOMP architecture** for all text-based features

**Breaking Changes:**
- `/ws/listener` endpoint **REMOVED IMMEDIATELY**
- `ListenerStatusHandler` class **REMOVED**
- `connectListenerStatusWebSocket()` method **REMOVED**
- All clients **MUST** use STOMP simultaneously

---

## 1. Backend Features Requiring Frontend Updates

### 1.1 ❌ Idempotency Keys (BROKEN - CRITICAL)
**Status:** ❌ **BROKEN** - File exists but is completely empty

**Backend Feature:**
- Accepts `Idempotency-Key` header on start/end operations
- Returns existing result if duplicate operation detected
- Prevents duplicate operations from network retries

**Frontend Implementation Status:**
- ❌ `frontend/src/utils/idempotencyUtils.js` - **FILE IS EMPTY** (CRITICAL BUG)
- ⚠️ `frontend/src/services/api/broadcastApi.js` - Imports `generatePrefixedIdempotencyKey` from empty file
- **Impact:** Broadcast start/end operations will fail with runtime errors

**CRITICAL FIX REQUIRED:**

**File:** `frontend/src/utils/idempotencyUtils.js`

```javascript
/**
 * Idempotency Key Utilities
 * Generates unique keys to prevent duplicate API operations
 */

/**
 * Generates a unique idempotency key for API operations
 * @returns {string} Unique UUID v4 idempotency key
 */
export const generateIdempotencyKey = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Generates an idempotency key with a prefix for better organization
 * @param {string} operation - Operation type (e.g., 'broadcast-start', 'broadcast-end')
 * @returns {string} Prefixed idempotency key
 */
export const generatePrefixedIdempotencyKey = (operation) => {
  const key = generateIdempotencyKey();
  return `${operation}-${key}`;
};

/**
 * Validates if a string looks like a valid idempotency key
 * @param {string} key - The key to validate
 * @returns {boolean} True if valid
 */
export const isValidIdempotencyKey = (key) => {
  return typeof key === 'string' && key.trim().length > 0;
};
```

**Testing:** After implementing, verify broadcast start/end operations work without console errors.

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

### Phase -1: 🚨 EMERGENCY FIX - Broken Idempotency (Week 1 - CRITICAL BLOCKER)
**Status:** ❌ **BROKEN** - `idempotencyUtils.js` is empty but imported by `broadcastApi.js`

#### Critical Issue
- `frontend/src/utils/idempotencyUtils.js` is completely empty
- `frontend/src/services/api/broadcastApi.js` imports `generatePrefixedIdempotencyKey` from it
- This causes runtime errors when trying to start/end broadcasts
- **Impact:** Broadcast operations will fail immediately

#### Fix Required
- [ ] **-1.1** Implement `idempotencyUtils.js` with UUID generation functions (see section 1.1 above)
- [ ] **-1.2** Test broadcast start/end operations work without errors

**Files to Modify:**
- `frontend/src/utils/idempotencyUtils.js` - Add missing implementation

**Testing:** Verify broadcast start/end buttons work without console errors.

---

### Phase 0: 🚨 CRITICAL WebSocket Hard Refactor (Week 1 - BLOCKING)
**Status:** ❌ **REQUIRED** - Hard refactor with NO backward compatibility

**HARD CUTOFF APPROACH:**
- **Simultaneous deployment** of backend and frontend required
- **All legacy WebSocket endpoints removed immediately**
- **Zero backward compatibility** - all clients must update together

**WebSocket Architecture Changes:**
1. **Listener Status Migration (REQUIRED):**
   - **REMOVED:** Raw WebSocket `/ws/listener` endpoint
   - **MIGRATED TO:** STOMP topic `/topic/listener-status`
   - **IMPACT:** All listener status updates now use STOMP

2. **DJ Audio WebSocket (REMAINS UNCHANGED):**
   - **KEEPS:** Raw WebSocket `/ws/live` for binary audio streaming
   - **REASON:** STOMP unsuitable for real-time binary audio data
   - **RESULT:** Strategic exception maintained

3. **Poll WebSocket (REMOVED):**
   - **REMOVED:** Legacy `connectPollWebSocket()` method
   - **REASON:** Polls already use STOMP via `pollService.subscribeToPolls()`

**Implementation Tasks:**
- [ ] **0.1** Create `ListenerStatusWebSocketController.java` (backend)
  - Handle STOMP messages for listener status updates
  - Replace `ListenerStatusHandler` functionality
- [ ] **0.2** Update `WebSocketConfig.java` (backend)
  - Remove `/ws/listener` endpoint registration
  - Keep only `/ws/live` for DJ audio streaming
- [ ] **0.3** Migrate `StreamingContext.jsx` to STOMP subscriptions
  - Replace `connectListenerStatusWebSocket()` with STOMP `/topic/listener-status`
  - Update message handling for STOMP format
- [ ] **0.4** Migrate `ListenerDashboard.jsx` to STOMP
  - Remove raw WebSocket usage
  - Use STOMP subscription pattern
- [ ] **0.5** Update `globalWebSocketService.js`
  - Remove `connectListenerStatusWebSocket()` method completely
  - Remove `connectPollWebSocket()` method completely
- [ ] **0.6** Update security configuration
  - Remove `/ws/listener` from permitted endpoints
  - Ensure STOMP endpoints properly secured

**Files to Create/Modify:**
- `backend/src/main/java/com/wildcastradio/ListenerStatus/ListenerStatusWebSocketController.java` (NEW)
- `backend/src/main/java/com/wildcastradio/config/WebSocketConfig.java` (MODIFIED)
- `backend/src/main/java/com/wildcastradio/config/SecurityConfig.java` (MODIFIED)
- `frontend/src/context/StreamingContext.jsx` (MODIFIED)
- `frontend/src/pages/ListenerDashboard.jsx` (MODIFIED)
- `frontend/src/services/globalWebSocketService.js` (MODIFIED)

**Testing:** Verify WebSocket connection count in browser DevTools Network tab
- **Target:** 2 WebSocket connections per user
  - 1 STOMP connection (`/ws-radio`) - ALL text messaging
  - 1 Raw WebSocket (`/ws/live`) - DJ audio streaming only
- **Expected Result:** 83% reduction (3 → 2 connections)
- **Failure:** Any connections > 2 per user indicates incomplete migration

---

### Phase 1: Critical Error Handling (Week 2)
- [ ] **1.1** Implement circuit breaker error handling in `broadcastApi.js`
- [ ] **1.2** Add circuit breaker retry logic in `DJDashboard.jsx`
- [ ] **1.3** Enhance state machine validation error messages
- [ ] **1.4** Add pre-validation checks before start/end operations
- [ ] **1.5** Create `errorHandler.js` utility for error message mapping

### Phase 2: Recovery & Checkpoint Handling (Week 3)
- [ ] **2.1** Implement `BROADCAST_RECOVERY` message handler in DJ Dashboard
- [ ] **2.2** Implement `BROADCAST_RECOVERY` message handler in Listener Dashboard
- [ ] **2.3** Add checkpoint WebSocket subscription (or polling fallback)
- [ ] **2.4** Display checkpoint time in DJ Dashboard
- [ ] **2.5** Use backend `currentDurationSeconds` for accurate duration display

### Phase 3: UI/UX Enhancements (Week 4)
- [ ] **3.1** Add recovery state banner in DJ Dashboard
- [ ] **3.2** Add recovery state banner in Listener Dashboard
- [ ] **3.3** Implement circuit breaker countdown UI
- [ ] **3.4** Add state machine validation button states
- [ ] **3.5** Enhance error messages with user-friendly text

### Phase 4: Testing & Polish (Week 5)
- [ ] **4.1** Test circuit breaker error scenarios
- [ ] **4.2** Test state machine validation error scenarios
- [ ] **4.3** Test recovery message handling
- [ ] **4.4** Test checkpoint updates
- [ ] **4.5** Verify all WebSocket message types are handled

---

## 6. Files Requiring Changes

### High Priority
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

### Medium Priority
4. `frontend/src/context/StreamingContext.jsx`
   - Recovery message handling in global context

5. `frontend/src/utils/errorHandler.js` (NEW)
   - Centralized error message mapping

### Low Priority
6. `frontend/src/components/Header.jsx`
   - Recovery state banner (if global)

---

## 7. Testing Scenarios

### 7.1 Circuit Breaker Testing
1. **Scenario:** Backend circuit breaker opens after 5 failures
   - **Expected:** Frontend shows "Service temporarily unavailable" message
   - **Expected:** Retry countdown displays
   - **Expected:** Auto-retry after countdown

2. **Scenario:** Circuit breaker closes
   - **Expected:** Operations resume normally
   - **Expected:** Error banner disappears

### 7.2 State Machine Validation Testing
1. **Scenario:** Attempt to start already LIVE broadcast
   - **Expected:** Error message: "Broadcast is already LIVE"
   - **Expected:** Start button disabled
   - **Expected:** Broadcast state refreshed

2. **Scenario:** Attempt to end already ENDED broadcast
   - **Expected:** Error message: "Broadcast already ended"
   - **Expected:** End button disabled

### 7.3 Recovery Testing
1. **Scenario:** Server restarts during LIVE broadcast
   - **Expected:** `BROADCAST_RECOVERY` message received
   - **Expected:** Recovery banner displayed
   - **Expected:** Broadcast state restored
   - **Expected:** Duration preserved from checkpoint

2. **Scenario:** Checkpoint updates received
   - **Expected:** Duration updated from backend checkpoint
   - **Expected:** Last checkpoint time displayed (optional)

### 7.4 Idempotency Testing
1. **Scenario:** Rapid double-click on start button
   - **Expected:** Only one broadcast started
   - **Expected:** Second request returns existing result
   - **Expected:** No duplicate operations

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
- ✅ `stompClientManager` - Already implemented
- ✅ `idempotencyUtils` - Already implemented
- ✅ `WebSocketReconnectManager` - Already implemented
- ❌ `errorHandler.js` - Needs to be created

---

## 10. Migration Notes

### 10.1 Breaking Changes
**CRITICAL BREAKING CHANGES - NO BACKWARD COMPATIBILITY**

- `/ws/listener` raw WebSocket endpoint **REMOVED IMMEDIATELY**
- `ListenerStatusHandler` class **REMOVED**
- `connectListenerStatusWebSocket()` method **REMOVED**
- All clients **MUST** use STOMP subscriptions simultaneously
- No gradual migration - all changes deployed together

### 10.2 Hard Cutover Deployment
1. **Week 1:** Implement all WebSocket changes (Phase 0) + Idempotency fix (Phase -1)
2. **Week 2:** Implement error handling improvements (Phase 1)
3. **Week 3:** Implement recovery and checkpoint handling (Phase 2)
4. **Week 4:** Implement UI enhancements (Phase 3)
5. **Week 5:** Hard cutover deployment (backend + frontend simultaneously)

### 10.3 No Feature Flags
**NO FEATURE FLAGS - IMMEDIATE REMOVAL**
- This is a hard refactor with zero backward compatibility
- All features must work together from deployment
- No gradual rollout or feature toggles

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
- ✅ **2 WebSocket connections per user achieved** (STOMP + DJ audio)
- ✅ **83% connection reduction** (3 → 2 connections)
- ✅ All WebSocket message types handled via STOMP
- ✅ Error handling is consistent across components
- ✅ Code is maintainable and well-documented
- ✅ No performance regressions

---

**Document Version:** 1.3
**Last Updated:** January 2025
**Author:** Frontend Implementation Guide
**Status:** 🔴 **HARD REFACTOR REQUIRED** - Breaking changes with zero backward compatibility

**Critical Findings (After Code Review):**

**Web Frontend:** ❌ BROKEN/INCOMPLETE - 4 independent WebSocket connections exist:
- STOMP client (1 connection) - Used by chat, polls, broadcast status ✅
- DJ Audio WebSocket (`/ws/live`) - Binary audio upload ❌
- Listener Status WebSocket (`/ws-listener-status`) - Stream status ❌
- Poll WebSocket - Legacy code (already migrated) ❌

**Broken Components:**
- `idempotencyUtils.js` - Empty file causing runtime errors ❌
- All error handling (circuit breaker, state machine validation) - Missing ❌
- Recovery message handling - Not implemented ❌
- Checkpoint updates - Not implemented ❌
- Recovery UI indicators - Not implemented ❌

**CRITICAL RECOMMENDATIONS:**

1. **IMMEDIATE PRIORITY:** Fix Phase -1 (broken idempotency) - this is blocking all broadcast operations
2. **HIGH PRIORITY:** Complete Phase 0 WebSocket consolidation to achieve the promised 95% API reduction
3. **ESSENTIAL:** Implement Phase 1 error handling to prevent user confusion from circuit breaker and state machine errors
4. **IMPORTANT:** Add Phase 2 recovery handling to leverage backend crash recovery capabilities

**Current Reality:** The evaluation document claims Phases 1-3 are "COMPLETED" but the frontend implementation reveals these features are completely missing. This represents a significant gap between documented status and actual implementation.

