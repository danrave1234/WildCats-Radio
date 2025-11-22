# Mobile Frontend Live Broadcast Implementation Guide
## Aligning Mobile Frontend with Backend Enhancements

**Document Date:** January 2025  
**Scope:** Mobile React Native Application Changes  
**Reference:** `md/LIVE_BROADCAST_SYSTEM_EVALUATION.md`

---

## Executive Summary

This document identifies the specific mobile frontend changes required to fully leverage the backend implementations completed in Phases 1-3 of the Live Broadcast System Evaluation. The backend now includes atomic transactions, idempotency keys, exponential backoff, circuit breaker pattern, state machine validation, state persistence, and enhanced recovery mechanisms.

**Current Mobile Frontend Status:**
- ✅ Idempotency keys implemented in API calls (`apiService.ts` uses `generatePrefixedIdempotencyKey()`)
- ⚠️ **PARTIAL** WebSocket consolidation - STOMP client manager exists but **1 independent WebSocket connection still remains**
- ❌ Fixed reconnection delay (3 seconds) - no exponential backoff
- ❌ Missing ALL recovery message handling
- ❌ Missing ALL checkpoint update handling
- ❌ Missing ALL circuit breaker error handling
- ❌ Missing ALL state machine validation error messages
- ❌ Missing ALL recovery state UI indicators

**🚨 CRITICAL: WebSocket Consolidation Gap**

Despite STOMP client manager implementation, **1 independent WebSocket connection** still exists:
1. **Listener Status WebSocket** (`/ws-listener-status`) - JSON WebSocket for stream status/listener count via direct `new WebSocket()` in `mobile/app/(tabs)/broadcast.tsx` (`listenerWsRef`)

**Note:** Mobile does NOT have a DJ WebSocket (mobile only listens, doesn't stream audio). Chat, polls, and broadcast updates already use STOMP via `StompClientManager` in `websocketService.ts`.

---

## 1. Backend Features Requiring Mobile Frontend Updates

### 1.1 ✅ Idempotency Keys (COMPLETED)
**Status:** ✅ **IMPLEMENTED**

**Backend Feature:**
- Accepts `Idempotency-Key` header on start/end operations
- Returns existing result if duplicate operation detected
- Prevents duplicate operations from network retries

**Mobile Frontend Implementation:**
- ✅ `mobile/services/idempotencyUtils.ts` - UUID generation utility (React Native compatible)
- ✅ `mobile/services/apiService.ts` - Idempotency keys added to `startBroadcast()` and `endBroadcast()` calls

**No Changes Required** - Implementation is complete.

---

### 1.2 ❌ Circuit Breaker Error Handling (MISSING)

**Backend Feature:**
- Circuit breaker blocks requests after 5 consecutive failures
- Returns HTTP 503 (Service Unavailable) when circuit is OPEN
- Includes `Retry-After` header with recovery time

**Mobile Frontend Gap:**
- No specific handling for circuit breaker errors
- Generic error messages don't inform users about temporary unavailability
- No retry logic with exponential backoff for circuit breaker failures
- No React Native Alert/Toast for circuit breaker notifications

**Required Changes:**

**File:** `mobile/services/apiService.ts`

```typescript
// Add circuit breaker error detection helper
const handleCircuitBreakerError = (error: any): { isCircuitBreaker: boolean; retryAfter: number; message: string } | null => {
  if (error?.response?.status === 503 || error?.status === 503) {
    const retryAfter = error?.response?.headers?.['retry-after'] || 
                      error?.response?.headers?.['Retry-After'] ||
                      error?.headers?.['retry-after'] ||
                      error?.headers?.['Retry-After'];
    const retrySeconds = retryAfter ? parseInt(retryAfter, 10) : 60;
    
    return {
      isCircuitBreaker: true,
      retryAfter: retrySeconds,
      message: `Service temporarily unavailable. Please try again in ${retrySeconds} seconds.`
    };
  }
  return null;
};

// Update startBroadcast to handle circuit breaker
export const startBroadcast = async (broadcastId: number, token: string): Promise<Broadcast | { error: string }> => {
  try {
    const idempotencyKey = generatePrefixedIdempotencyKey('broadcast-start');

    const response = await fetch(`${API_BASE_URL}/broadcasts/${broadcastId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      // Check for circuit breaker error
      const circuitBreakerError = handleCircuitBreakerError({ response, status: response.status });
      if (circuitBreakerError) {
        return { error: circuitBreakerError.message };
      }
      
      return { error: data.message || data.error || `Failed to start broadcast. Status: ${response.status}` };
    }
    return data as Broadcast;
  } catch (error: any) {
    console.error('StartBroadcast API error:', error);
    
    // Check for circuit breaker error in catch block
    const circuitBreakerError = handleCircuitBreakerError(error);
    if (circuitBreakerError) {
      return { error: circuitBreakerError.message };
    }
    
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

// Similar update for endBroadcast
export const endBroadcast = async (broadcastId: number, token: string): Promise<Broadcast | { error: string }> => {
  try {
    const idempotencyKey = generatePrefixedIdempotencyKey('broadcast-end');

    const response = await fetch(`${API_BASE_URL}/broadcasts/${broadcastId}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      // Check for circuit breaker error
      const circuitBreakerError = handleCircuitBreakerError({ response, status: response.status });
      if (circuitBreakerError) {
        return { error: circuitBreakerError.message };
      }
      
      return { error: data.message || data.error || `Failed to end broadcast. Status: ${response.status}` };
    }
    return data as Broadcast;
  } catch (error: any) {
    console.error('EndBroadcast API error:', error);
    
    // Check for circuit breaker error in catch block
    const circuitBreakerError = handleCircuitBreakerError(error);
    if (circuitBreakerError) {
      return { error: circuitBreakerError.message };
    }
    
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};
```

**File:** `mobile/app/(tabs)/broadcast.tsx`

```typescript
// Add circuit breaker error handling with React Native Alert
const handleBroadcastOperation = async (operation: 'start' | 'end', broadcastId: number) => {
  try {
    let result;
    if (operation === 'start') {
      result = await startBroadcast(broadcastId, authToken!);
    } else {
      result = await endBroadcast(broadcastId, authToken!);
    }
    
    if ('error' in result) {
      // Check for circuit breaker error
      if (result.error.includes('temporarily unavailable')) {
        const retryMatch = result.error.match(/(\d+) seconds/);
        const retrySeconds = retryMatch ? parseInt(retryMatch[1], 10) : 60;
        
        Alert.alert(
          'Service Temporarily Unavailable',
          `The service is temporarily unavailable. Please try again in ${retrySeconds} seconds.`,
          [
            { text: 'OK', style: 'default' },
            {
              text: 'Retry Now',
              onPress: () => {
                // Auto-retry after delay
                setTimeout(() => {
                  handleBroadcastOperation(operation, broadcastId);
                }, retrySeconds * 1000);
              }
            }
          ]
        );
        return;
      }
      
      // Other errors
      Alert.alert('Error', result.error);
    } else {
      // Success
      setCurrentBroadcast(result);
    }
  } catch (error) {
    console.error(`Error ${operation}ing broadcast:`, error);
    Alert.alert('Error', `Failed to ${operation} broadcast. Please try again.`);
  }
};
```

---

### 1.3 ❌ State Machine Validation Error Handling (MISSING)

**Backend Feature:**
- Validates state transitions before operations
- Returns HTTP 409 (Conflict) with descriptive error message
- Prevents invalid operations (e.g., starting already LIVE broadcast)

**Mobile Frontend Gap:**
- No specific handling for 409 Conflict errors
- Generic error messages don't explain why operation failed
- No user-friendly error messages for invalid state transitions

**Required Changes:**

**File:** `mobile/services/apiService.ts`

```typescript
// Add state machine error detection helper
const handleStateMachineError = (error: any): { isStateMachineError: boolean; message: string } | null => {
  if (error?.response?.status === 409 || error?.status === 409) {
    const backendMessage = error?.response?.data?.message || error?.data?.message || '';
    
    let userMessage = '';
    if (backendMessage.includes('already LIVE')) {
      userMessage = 'This broadcast is already live. Cannot start again.';
    } else if (backendMessage.includes('Cannot start')) {
      userMessage = `Cannot start broadcast: ${backendMessage}`;
    } else if (backendMessage.includes('already ENDED')) {
      userMessage = 'This broadcast has already ended.';
    } else if (backendMessage.includes('Cannot end')) {
      userMessage = `Cannot end broadcast: ${backendMessage}`;
    } else {
      userMessage = `Invalid operation: ${backendMessage}`;
    }
    
    return {
      isStateMachineError: true,
      message: userMessage
    };
  }
  return null;
};

// Update startBroadcast to handle state machine errors
export const startBroadcast = async (broadcastId: number, token: string): Promise<Broadcast | { error: string }> => {
  try {
    const idempotencyKey = generatePrefixedIdempotencyKey('broadcast-start');

    const response = await fetch(`${API_BASE_URL}/broadcasts/${broadcastId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      // Check for state machine validation error
      const stateMachineError = handleStateMachineError({ response, status: response.status, data });
      if (stateMachineError) {
        return { error: stateMachineError.message };
      }
      
      // Check for circuit breaker error
      const circuitBreakerError = handleCircuitBreakerError({ response, status: response.status });
      if (circuitBreakerError) {
        return { error: circuitBreakerError.message };
      }
      
      return { error: data.message || data.error || `Failed to start broadcast. Status: ${response.status}` };
    }
    return data as Broadcast;
  } catch (error: any) {
    console.error('StartBroadcast API error:', error);
    
    // Check for state machine error
    const stateMachineError = handleStateMachineError(error);
    if (stateMachineError) {
      return { error: stateMachineError.message };
    }
    
    // Check for circuit breaker error
    const circuitBreakerError = handleCircuitBreakerError(error);
    if (circuitBreakerError) {
      return { error: circuitBreakerError.message };
    }
    
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

// Similar update for endBroadcast
```

**File:** `mobile/app/(tabs)/broadcast.tsx`

```typescript
// Add state machine error handling with React Native Alert
const handleBroadcastOperation = async (operation: 'start' | 'end', broadcastId: number) => {
  try {
    let result;
    if (operation === 'start') {
      result = await startBroadcast(broadcastId, authToken!);
    } else {
      result = await endBroadcast(broadcastId, authToken!);
    }
    
    if ('error' in result) {
      // Check for state machine validation error
      if (result.error.includes('already live') || result.error.includes('already ended') || result.error.includes('Cannot')) {
        Alert.alert(
          'Invalid Operation',
          result.error,
          [
            { text: 'OK', style: 'default' },
            {
              text: 'Refresh Status',
              onPress: async () => {
                // Refresh broadcast status
                const updated = await getBroadcastDetails(broadcastId, authToken!);
                if (!('error' in updated)) {
                  setCurrentBroadcast(updated);
                }
              }
            }
          ]
        );
        return;
      }
      
      // Check for circuit breaker error
      if (result.error.includes('temporarily unavailable')) {
        // ... circuit breaker handling from section 1.2 ...
        return;
      }
      
      // Other errors
      Alert.alert('Error', result.error);
    } else {
      // Success
      setCurrentBroadcast(result);
    }
  } catch (error) {
    console.error(`Error ${operation}ing broadcast:`, error);
    Alert.alert('Error', `Failed to ${operation} broadcast. Please try again.`);
  }
};
```

---

### 1.4 ❌ Broadcast Recovery Message Handling (MISSING)

**Backend Feature:**
- Sends `BROADCAST_RECOVERY` WebSocket messages on server startup
- Includes recovery metadata (reason, checkpoint time, duration)
- Notifies clients when broadcasts are auto-recovered

**Mobile Frontend Gap:**
- No handler for `BROADCAST_RECOVERY` message type
- No recovery notifications displayed to mobile users
- No recovery status displayed

**Required Changes:**

**File:** `mobile/app/(tabs)/broadcast.tsx`

```typescript
// Add recovery message handling in global broadcast WebSocket subscription
useEffect(() => {
  if (routeBroadcastId) {
    return; // Skip if we have a specific broadcast ID
  }

  let connection: any = null;

  const setupGlobalBroadcastWebSocket = async () => {
    if (!authToken) {
      console.log('🌐 Skipping global broadcast WebSocket - no auth token');
      return;
    }
    
    try {
      console.log('🌐 Setting up global broadcast WebSocket...');
      
      // Use the existing WebSocket service to subscribe to global updates
      connection = await chatService.subscribeToGlobalBroadcastUpdates((update) => {
        console.log('🌐 Global broadcast update received:', update);
        
        if (update.type === 'BROADCAST_STARTED') {
          console.log('🎉 New broadcast started:', update.broadcast);
          setCurrentBroadcast(update.broadcast);
          
          // Show notification to user
          Alert.alert(
            'Broadcast Started!',
            `${update.broadcast.title} is now live!`,
            [{ text: 'OK' }]
          );
        } else if (update.type === 'BROADCAST_ENDED') {
          console.log('📻 Broadcast ended:', update.broadcastId);
          if (currentBroadcast?.id === update.broadcastId) {
            setCurrentBroadcast(null);
          }
        } else if (update.type === 'BROADCAST_RECOVERY') {
          console.log('🔄 Broadcast recovery notification:', update);
          
          // Show recovery notification to mobile users
          Alert.alert(
            'Broadcast Recovered',
            update.message || 'Broadcast recovered after server restart. Stream may have been briefly interrupted.',
            [{ text: 'OK' }]
          );
          
          // Update broadcast state if provided
          if (update.broadcast) {
            setCurrentBroadcast(update.broadcast);
            
            // Update duration from checkpoint if available
            if (update.duration !== undefined) {
              // Could update UI to show recovered duration
              console.log('📊 Broadcast duration recovered:', update.duration, 'seconds');
            }
          }
        }
      }, authToken);
      
      console.log('🌐 Global broadcast WebSocket connected');
    } catch (error) {
      console.error('🌐 Failed to setup global broadcast WebSocket:', error);
    }
  };

  setupGlobalBroadcastWebSocket();

  // Cleanup function
  return () => {
    if (connection?.data?.disconnect) {
      console.log('🌐 Cleaning up global broadcast WebSocket');
      connection.data.disconnect();
    }
  };
}, [routeBroadcastId, authToken]);
```

**File:** `mobile/services/chatService.ts`

```typescript
// Update subscribeToGlobalBroadcastUpdates to handle BROADCAST_RECOVERY
async subscribeToGlobalBroadcastUpdates(
  callback: (update: { 
    type: string; 
    broadcast?: any; 
    broadcastId?: number;
    message?: string;
    duration?: number;
    checkpointTime?: string;
  }) => void,
  authToken?: string
): Promise<ServiceResult<ChatConnection>> {
  return new Promise((resolve, reject) => {
    // Set up connection handler to wait for connection before subscribing
    const handleConnect = () => {
      try {
        // Subscribe to global broadcast status topic
        stompClientManager.subscribe('/topic/broadcast/status', (message: any) => {
          try {
            const data = JSON.parse(message.body);
            callback(data);
          } catch (error) {
            logger.error('Error parsing global broadcast update:', error);
          }
        }, authToken).then((subscription) => {
          resolve({
            data: {
              disconnect: () => {
                subscription.unsubscribe();
              },
              isConnected: () => stompClientManager.isConnected(),
            }
          });
        }).catch((error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    };

    // Connect first, then subscribe
    stompClientManager.connect(authToken)
      .then(() => {
        handleConnect();
      })
      .catch((error) => {
        logger.error('Failed to connect STOMP for global broadcast updates:', error);
        reject(error);
      });
  });
}
```

---

### 1.5 ❌ Checkpoint Update Handling (MISSING)

**Backend Feature:**
- Checkpoints live broadcasts every 60 seconds
- Updates `lastCheckpointTime` and `currentDurationSeconds`
- Sends checkpoint updates via WebSocket (optional, can be implemented)

**Mobile Frontend Gap:**
- No handling of checkpoint updates
- Duration displayed is calculated client-side, not from backend checkpoint
- No display of last checkpoint time

**Required Changes:**

**Option A: Backend sends checkpoint updates via WebSocket (Recommended)**

**Backend Change Required:** Add checkpoint WebSocket notifications in `BroadcastService.checkpointLiveBroadcasts()`

**File:** `mobile/app/(tabs)/broadcast.tsx`

```typescript
// Add checkpoint update handler via STOMP subscription
useEffect(() => {
  if (!currentBroadcast?.id || currentBroadcast.status !== 'LIVE') {
    return;
  }

  let checkpointSubscription: any = null;

  const setupCheckpointSubscription = async () => {
    try {
      // Subscribe to broadcast-specific checkpoint updates
      checkpointSubscription = await websocketService.subscribe(
        `/topic/broadcast/${currentBroadcast.id}`,
        (message: any) => {
          try {
            const data = JSON.parse(message.body);
            
            if (data.type === 'BROADCAST_CHECKPOINT') {
              console.log('📊 Checkpoint update received:', data);
              
              // Update duration from backend checkpoint if available
              if (data.currentDurationSeconds !== undefined) {
                // Use backend-provided duration for accuracy
                // Could update UI to show accurate duration
                console.log('📊 Broadcast duration updated from checkpoint:', data.currentDurationSeconds, 'seconds');
              }
              
              // Update last checkpoint time if provided
              if (data.lastCheckpointTime) {
                console.log('📊 Last checkpoint time:', data.lastCheckpointTime);
                // Could display: "Last saved: 2 minutes ago"
              }
            }
          } catch (error) {
            console.error('Error parsing checkpoint message:', error);
          }
        }
      );
    } catch (error) {
      console.error('Failed to subscribe to checkpoint updates:', error);
    }
  };

  setupCheckpointSubscription();

  return () => {
    if (checkpointSubscription) {
      checkpointSubscription.unsubscribe();
    }
  };
}, [currentBroadcast?.id, currentBroadcast?.status]);
```

**Option B: Poll checkpoint data from health endpoint (Fallback)**

**File:** `mobile/app/(tabs)/broadcast.tsx`

```typescript
// Use health endpoint that includes checkpoint data (if available)
useEffect(() => {
  if (currentBroadcast?.status !== 'LIVE') return;
  
  // Only poll if STOMP WebSocket is not connected
  if (websocketService.isConnected()) {
    console.log('📡 Skipping checkpoint poll - STOMP WebSocket is connected');
    return;
  }
  
  const interval = setInterval(async () => {
    try {
      // Note: This requires backend to expose checkpoint data in health endpoint
      // For now, this is a placeholder for future implementation
      const healthResponse = await streamService.getStreamStatus();
      
      // If backend adds checkpoint data to stream status:
      // if (healthResponse.currentDurationSeconds) {
      //   console.log('📊 Broadcast duration from checkpoint:', healthResponse.currentDurationSeconds);
      // }
    } catch (error) {
      console.debug('Failed to fetch checkpoint data:', error);
    }
  }, 60000); // Every 60 seconds (matches backend checkpoint interval)
  
  return () => clearInterval(interval);
}, [currentBroadcast?.id, currentBroadcast?.status]);
```

---

### 1.6 ❌ Recovery State UI Indicators (MISSING)

**Backend Feature:**
- Tracks `recovering` flag in health status
- Sends recovery state via WebSocket health updates
- Distinguishes between healthy, unhealthy, and recovering states

**Mobile Frontend Gap:**
- Recovery state is not received or displayed
- No visual distinction between recovering and unhealthy states
- No recovery progress indicator

**Required Changes:**

**File:** `mobile/app/(tabs)/broadcast.tsx`

```typescript
// Add recovery state display
const [recoveryState, setRecoveryState] = useState<{
  status: 'recovering' | 'unhealthy' | null;
  message: string;
} | null>(null);

// Update recovery state from listener WebSocket (after migrating to STOMP)
// For now, update from listener status WebSocket messages
useEffect(() => {
  if (!listenerWsRef.current) return;
  
  const originalOnMessage = listenerWsRef.current.onmessage;
  
  listenerWsRef.current.onmessage = (event: any) => {
    // Call original handler
    if (originalOnMessage) {
      originalOnMessage(event);
    }
    
    try {
      // Handle pong response
      if (event.data === 'pong') {
        return;
      }

      const data = JSON.parse(event.data);
      
      // Update recovery state from health data
      if (data.type === 'STREAM_STATUS' && data.health) {
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
    } catch (error) {
      console.error('Error parsing listener WebSocket message:', error);
    }
  };
}, [listenerWsRef.current]);

// Display recovery banner in UI
{recoveryState && (
  <View className={`p-3 rounded-md mb-4 ${
    recoveryState.status === 'recovering' 
      ? 'bg-yellow-100 border-yellow-400' 
      : 'bg-red-100 border-red-400'
  }`}>
    <View className="flex-row items-center">
      {recoveryState.status === 'recovering' && (
        <ActivityIndicator size="small" color="#D97706" className="mr-2" />
      )}
      <Text className={`text-sm ${
        recoveryState.status === 'recovering' 
          ? 'text-yellow-800' 
          : 'text-red-800'
      }`}>
        {recoveryState.message}
      </Text>
    </View>
  </View>
)}
```

**Note:** After migrating listener WebSocket to STOMP (Phase 0), recovery state updates should come via STOMP topic `/topic/listener-status` instead of direct WebSocket.

---

### 1.7 ⚠️ Enhanced Error Messages for Duplicate Operations (PARTIAL)

**Backend Feature:**
- Returns existing broadcast when duplicate operation detected (idempotency)
- Includes metadata indicating operation was idempotent

**Mobile Frontend Gap:**
- No user feedback when duplicate operation is detected
- User may not know their tap was handled (idempotent response)

**Required Changes:**

**File:** `mobile/app/(tabs)/broadcast.tsx`

```typescript
const handleBroadcastOperation = async (operation: 'start' | 'end', broadcastId: number) => {
  try {
    let result;
    if (operation === 'start') {
      result = await startBroadcast(broadcastId, authToken!);
    } else {
      result = await endBroadcast(broadcastId, authToken!);
    }
    
    if ('error' in result) {
      // ... existing error handling ...
    } else {
      // Success - check if this was an idempotent operation
      // Note: This requires backend to send X-Idempotent-Operation header
      // For now, we can check if the broadcast status matches what we expected
      if (result.status === 'LIVE' && operation === 'start') {
        // Broadcast is already live - might be idempotent
        console.log('📊 Broadcast start may have been idempotent (already live)');
        // Optional: Show brief notification
        // Alert.alert('Success', 'Broadcast is already live.');
      }
      
      setCurrentBroadcast(result);
    }
  } catch (error) {
    console.error(`Error ${operation}ing broadcast:`, error);
    Alert.alert('Error', `Failed to ${operation} broadcast. Please try again.`);
  }
};
```

**Note:** This requires backend to send `X-Idempotent-Operation: true` header when returning existing result.

---

## 2. WebSocket Consolidation (Phase 0 - CRITICAL)

### 2.1 ❌ Migrate Listener Status WebSocket to STOMP

**Current Implementation:**
- Direct `new WebSocket()` connection in `mobile/app/(tabs)/broadcast.tsx` (`listenerWsRef`)
- Fixed 3-second reconnection delay
- Separate connection from STOMP client

**Required Changes:**

**File:** `mobile/app/(tabs)/broadcast.tsx`

```typescript
// Remove listenerWsRef and direct WebSocket connection
// Replace with STOMP subscription via websocketService

// Remove this:
// const listenerWsRef = useRef<WebSocket | null>(null);
// const heartbeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);

// Add STOMP subscription for listener status
useEffect(() => {
  if (!currentBroadcast || currentBroadcast.status !== 'LIVE') {
    return;
  }

  let listenerStatusSubscription: any = null;

  const setupListenerStatusSubscription = async () => {
    try {
      console.log('🔄 Setting up listener status STOMP subscription...');
      
      // Subscribe to listener status topic via STOMP
      listenerStatusSubscription = await websocketService.subscribe(
        '/topic/listener-status',
        (message: any) => {
          try {
            const data = JSON.parse(message.body);
            
            if (data.type === 'STREAM_STATUS') {
              // Update listener count
              if (data.listenerCount !== undefined) {
                setStreamStatus(prev => ({
                  ...prev,
                  listenerCount: data.listenerCount,
                }));
              }
              
              // Update recovery state from health data
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
            }
          } catch (error) {
            console.error('Error parsing listener status message:', error);
          }
        }
      );
      
      console.log('✅ Listener status STOMP subscription connected');
    } catch (error) {
      console.error('❌ Failed to subscribe to listener status:', error);
    }
  };

  setupListenerStatusSubscription();

  return () => {
    if (listenerStatusSubscription) {
      listenerStatusSubscription.unsubscribe();
    }
  };
}, [currentBroadcast?.id, currentBroadcast?.status]);

// Remove the old listener WebSocket useEffect (lines 715-859)
// Remove listener status send logic that uses listenerWsRef (lines 861-874)
```

**File:** `mobile/services/websocketService.ts`

```typescript
// Add listener status subscription helper method
async subscribeToListenerStatus(
  callback: (status: { type: string; listenerCount?: number; health?: any }) => void,
  token?: string
): Promise<{ unsubscribe: () => void }> {
  return await stompClientManager.subscribe('/topic/listener-status', (message: any) => {
    try {
      const data = JSON.parse(message.body);
      callback(data);
    } catch (error) {
      logger.error('Error parsing listener status message:', error);
    }
  }, token);
}
```

---

### 2.2 ❌ Implement Exponential Backoff for Reconnection

**Current Implementation:**
- Fixed 3-second delay in `broadcast.tsx` listener WebSocket reconnection
- Fixed 3-second delay in `websocketService.ts` STOMP reconnection
- No exponential backoff or jitter

**Required Changes:**

**File:** `mobile/utils/WebSocketReconnectManager.ts` (NEW)

```typescript
import { createLogger } from '../services/logger';

const logger = createLogger('WebSocketReconnectManager');

interface WebSocketReconnectManagerOptions {
  baseDelay?: number;
  maxDelay?: number;
  maxAttempts?: number;
  jitterPercent?: number;
  onMaxAttemptsReached?: (error: Error) => void;
}

/**
 * WebSocket reconnection manager with exponential backoff and jitter for React Native.
 * Prevents thundering herd problem and provides resilient reconnection.
 */
export class WebSocketReconnectManager {
  private baseDelay: number;
  private maxDelay: number;
  private maxAttempts: number;
  private attempts: number;
  private jitterPercent: number;
  private onMaxAttemptsReached?: (error: Error) => void;

  constructor(options: WebSocketReconnectManagerOptions = {}) {
    this.baseDelay = options.baseDelay || 1000; // 1 second
    this.maxDelay = options.maxDelay || 30000; // 30 seconds
    this.maxAttempts = options.maxAttempts || 10;
    this.attempts = 0;
    this.jitterPercent = options.jitterPercent || 0.25; // ±25% jitter
    this.onMaxAttemptsReached = options.onMaxAttemptsReached;
  }

  /**
   * Calculate delay with exponential backoff and jitter
   * @returns {number} Delay in milliseconds
   */
  getDelay(): number {
    const exponentialDelay = Math.min(
      this.baseDelay * Math.pow(2, this.attempts),
      this.maxDelay
    );
    
    // Add jitter (±25%) to prevent thundering herd
    const jitter = exponentialDelay * this.jitterPercent * (Math.random() * 2 - 1);
    const finalDelay = exponentialDelay + jitter;
    
    return Math.round(Math.max(0, finalDelay));
  }

  /**
   * Attempt to reconnect with exponential backoff
   * @param {Function} connectFn - Function that returns a Promise resolving when connection succeeds
   * @returns {Promise} Resolves when connection succeeds, rejects if max attempts reached
   */
  async reconnect(connectFn: () => Promise<void>): Promise<void> {
    if (this.attempts >= this.maxAttempts) {
      const error = new Error(`Max reconnection attempts (${this.maxAttempts}) reached`);
      logger.error(error.message);
      
      if (this.onMaxAttemptsReached) {
        this.onMaxAttemptsReached(error);
      }
      
      throw error;
    }
    
    this.attempts++;
    const delay = this.getDelay();
    
    logger.info(`Reconnection attempt ${this.attempts}/${this.maxAttempts} - waiting ${delay}ms before retry`);
    
    // Wait for calculated delay
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      await connectFn();
      // Reset attempts on successful connection
      logger.info(`Reconnection successful after ${this.attempts} attempt(s)`);
      this.attempts = 0;
    } catch (error) {
      logger.warn(`Reconnection attempt ${this.attempts} failed:`, error);
      // Recursively retry with increased delay
      return this.reconnect(connectFn);
    }
  }

  /**
   * Reset the reconnection attempts counter
   */
  reset(): void {
    logger.debug('Resetting reconnection attempts counter');
    this.attempts = 0;
  }

  /**
   * Get current attempt number
   */
  getAttempts(): number {
    return this.attempts;
  }
}

export default WebSocketReconnectManager;
```

**File:** `mobile/services/websocketService.ts`

```typescript
import WebSocketReconnectManager from '../utils/WebSocketReconnectManager';

class WebSocketManager implements WebSocketService {
  // ... existing properties ...
  private reconnectManager: WebSocketReconnectManager;

  constructor() {
    // ... existing initialization ...
    this.reconnectManager = new WebSocketReconnectManager({
      baseDelay: 1000,
      maxDelay: 30000,
      maxAttempts: 10,
      onMaxAttemptsReached: (error) => {
        console.error('Max reconnection attempts reached:', error);
        this.errorHandlers.forEach(handler => handler(error));
      }
    });
  }

  private attemptReconnect(): void {
    if (!this.currentBroadcastId || !this.currentAuthToken) {
      return;
    }

    // Use exponential backoff manager instead of fixed delay
    this.reconnectManager.reconnect(async () => {
      if (this.currentBroadcastId && this.currentAuthToken) {
        await this.connect(this.currentBroadcastId, this.currentAuthToken);
      }
    }).catch((error) => {
      console.error('Reconnection failed after max attempts:', error);
    });
  }

  // Reset reconnect manager on successful connection
  private async subscribeToTopics(broadcastId: number, authToken?: string): Promise<void> {
    try {
      // ... existing subscription code ...
      
      // Reset reconnect attempts on successful subscription
      this.reconnectManager.reset();
    } catch (error) {
      console.error('❌ Error subscribing to topics:', error);
    }
  }
}
```

---

## 3. WebSocket Message Types to Handle

### 3.1 New Message Types from Backend

The backend now sends additional WebSocket message types that the mobile frontend should handle:

| Message Type | Description | Priority | Status |
|-------------|-------------|----------|--------|
| `BROADCAST_RECOVERY` | Broadcast recovered after server restart | HIGH | ❌ Missing |
| `BROADCAST_CHECKPOINT` | Periodic checkpoint update (every 60s) | MEDIUM | ❌ Missing |
| `BROADCAST_STATE_TRANSITION` | State change with metadata | LOW | ⚠️ Partial |
| `CIRCUIT_BREAKER_OPEN` | Circuit breaker opened (service unavailable) | HIGH | ❌ Missing |
| `CIRCUIT_BREAKER_CLOSED` | Circuit breaker closed (service restored) | MEDIUM | ❌ Missing |

### 3.2 Implementation Locations

**Broadcast Screen:**
- `mobile/app/(tabs)/broadcast.tsx` - Global broadcast WebSocket subscription, checkpoint subscription

**WebSocket Service:**
- `mobile/services/websocketService.ts` - STOMP client manager, message routing

**Chat Service:**
- `mobile/services/chatService.ts` - Global broadcast updates subscription

---

## 4. Error Handling Enhancements

### 4.1 HTTP Status Code Handling

| Status Code | Backend Meaning | Mobile Frontend Action Required |
|------------|----------------|--------------------------------|
| 409 Conflict | State machine validation failed | Show React Native Alert with user-friendly message, refresh state |
| 503 Service Unavailable | Circuit breaker open | Show React Native Alert with retry countdown |
| 400 Bad Request | Invalid idempotency key format | Log error, regenerate key |
| 200 OK (with idempotent header) | Duplicate operation handled | Optional: Show "already processed" message |

### 4.2 Error Message Mapping

**File:** `mobile/services/errorHandler.ts` (NEW)

```typescript
import { Alert } from 'react-native';

export interface BroadcastError {
  isCircuitBreaker: boolean;
  isStateMachineError: boolean;
  message: string;
  retryAfter?: number;
}

export const getBroadcastErrorMessage = (error: any): BroadcastError => {
  const status = error?.response?.status || error?.status;
  const message = error?.response?.data?.message || error?.data?.message || error?.message || 'An error occurred';
  
  // Circuit breaker error (503)
  if (status === 503) {
    const retryAfter = error?.response?.headers?.['retry-after'] || 
                      error?.response?.headers?.['Retry-After'] ||
                      error?.headers?.['retry-after'] ||
                      error?.headers?.['Retry-After'] ||
                      60;
    const retrySeconds = typeof retryAfter === 'string' ? parseInt(retryAfter, 10) : retryAfter;
    
    return {
      isCircuitBreaker: true,
      isStateMachineError: false,
      message: `Service temporarily unavailable. Please try again in ${retrySeconds} seconds.`,
      retryAfter: retrySeconds
    };
  }
  
  // State machine validation error (409)
  if (status === 409) {
    let userMessage = message;
    
    if (message.includes('already LIVE')) {
      userMessage = 'This broadcast is already live. Cannot start again.';
    } else if (message.includes('Cannot start')) {
      userMessage = `Cannot start broadcast: ${message}`;
    } else if (message.includes('already ENDED')) {
      userMessage = 'This broadcast has already ended.';
    } else if (message.includes('Cannot end')) {
      userMessage = `Cannot end broadcast: ${message}`;
    } else {
      userMessage = `Invalid operation: ${message}`;
    }
    
    return {
      isCircuitBreaker: false,
      isStateMachineError: true,
      message: userMessage
    };
  }
  
  // Generic error
  return {
    isCircuitBreaker: false,
    isStateMachineError: false,
    message: message || 'An error occurred. Please try again.'
  };
};

export const showBroadcastErrorAlert = (error: BroadcastError, onRetry?: () => void, onRefresh?: () => void) => {
  if (error.isCircuitBreaker) {
    Alert.alert(
      'Service Temporarily Unavailable',
      error.message,
      [
        { text: 'OK', style: 'default' },
        ...(onRetry ? [{
          text: 'Retry Now',
          onPress: () => {
            setTimeout(() => {
              onRetry();
            }, (error.retryAfter || 60) * 1000);
          }
        }] : [])
      ]
    );
  } else if (error.isStateMachineError) {
    Alert.alert(
      'Invalid Operation',
      error.message,
      [
        { text: 'OK', style: 'default' },
        ...(onRefresh ? [{
          text: 'Refresh Status',
          onPress: onRefresh
        }] : [])
      ]
    );
  } else {
    Alert.alert('Error', error.message);
  }
};
```

---

## 5. UI/UX Enhancements

### 5.1 Recovery State Indicators

**Priority:** HIGH

- **Broadcast Screen:** Show recovery banner when `recovering === true`
- **Auto-hide:** After recovery completes (5 seconds)
- **Mobile-friendly:** Use React Native Alert or Toast for notifications

### 5.2 Checkpoint Status Display

**Priority:** MEDIUM

- **Broadcast Screen:** Show "Last saved: X minutes ago" indicator (optional)
- **Duration Display:** Use backend `currentDurationSeconds` when available
- **Visual Indicator:** Subtle animation on checkpoint save

### 5.3 Circuit Breaker UI

**Priority:** HIGH

- **Error Alert:** Show React Native Alert when circuit breaker is open
- **Retry Countdown:** Display countdown timer in Alert
- **Auto-Retry:** Option to retry after countdown completes

### 5.4 State Machine Validation UI

**Priority:** MEDIUM

- **Error Messages:** User-friendly messages for invalid transitions
- **Refresh Option:** Allow users to refresh broadcast status after error

---

## 6. Implementation Checklist

### Phase 0: 🚨 CRITICAL WebSocket Consolidation (Week 1 - BLOCKING)
**Status:** ❌ **REQUIRED** - Must be completed to achieve full WebSocket optimization

**Remaining Independent WebSocket Connection:**
1. **Listener Status WebSocket** (`/ws-listener-status`) - JSON WebSocket for stream status/listener count
   - **Current:** Direct `new WebSocket()` in `mobile/app/(tabs)/broadcast.tsx` (`listenerWsRef`)
   - **Solution:** Migrate to STOMP topic `/topic/listener-status` via `websocketService.subscribe()`

**Implementation Tasks:**
- [ ] **0.1** Migrate Listener Status WebSocket to STOMP topic `/topic/listener-status`
  - Update `mobile/app/(tabs)/broadcast.tsx` to use `websocketService.subscribe()` instead of direct WebSocket
  - Remove `listenerWsRef` and direct WebSocket connection code
  - Remove `heartbeatInterval` ref (STOMP handles heartbeats)
  - Update listener status send logic to use STOMP publish
- [ ] **0.2** Implement exponential backoff for STOMP reconnection
  - Create `mobile/utils/WebSocketReconnectManager.ts` (React Native compatible)
  - Update `websocketService.ts` to use exponential backoff instead of fixed 3-second delay
  - Add jitter to prevent thundering herd problem
- [ ] **0.3** Update WebSocket error handling
  - Add circuit breaker error detection
  - Add state machine validation error handling
  - Match web frontend error handling patterns

**Files to Modify:**
- `mobile/app/(tabs)/broadcast.tsx` - Migrate listener WebSocket to STOMP
- `mobile/services/websocketService.ts` - Add exponential backoff, listener status subscription helper
- `mobile/utils/WebSocketReconnectManager.ts` (NEW) - Exponential backoff manager for React Native

**Testing:** Verify WebSocket connection count in React Native debugger
- **Target:** 1 STOMP connection
- **Current:** 1 STOMP connection + 1 Listener Status WebSocket = **2 connections**

---

### Phase 1: Critical Error Handling (Week 2)
- [ ] **1.1** Implement circuit breaker error handling in `apiService.ts`
  - Add `handleCircuitBreakerError()` helper function
  - Update `startBroadcast()` and `endBroadcast()` methods
  - Parse `Retry-After` headers and return structured error objects
- [ ] **1.2** Add circuit breaker retry logic in broadcast screen
  - Show React Native Alert with retry countdown when circuit breaker is open
  - Use React Native Alert API for mobile-friendly display
  - Prevent multiple retry attempts
- [ ] **1.3** Enhance state machine validation error messages
  - Add error message mapping for 409 Conflict responses
  - Create mobile-friendly error display components
  - Use React Native Alert for immediate feedback
- [ ] **1.4** Create mobile `errorHandler.ts` utility
  - Match web `errorHandler.js` functionality
  - Adapt for React Native Alert/Toast patterns
  - Add mobile-specific error display logic

### Phase 2: Recovery & Checkpoint Handling (Week 3)
- [ ] **2.1** Implement `BROADCAST_RECOVERY` message handler in broadcast screen
  - Update `chatService.subscribeToGlobalBroadcastUpdates()` to handle recovery messages
  - Display recovery notification using React Native Alert
  - Update stream status and duration after recovery
- [ ] **2.2** Add checkpoint WebSocket subscription (or polling fallback)
  - Subscribe to checkpoint updates via STOMP topic `/topic/broadcast/{id}`
  - Fallback to polling `getStreamStatus()` endpoint if WebSocket unavailable
  - Update duration display from checkpoint data
- [ ] **2.3** Display checkpoint status in broadcast screen
  - Show "Last saved: X minutes ago" indicator (optional)
  - Use backend `currentDurationSeconds` for accurate duration display
  - Update duration in real-time from checkpoints

### Phase 3: UI/UX Enhancements (Week 4)
- [ ] **3.1** Add recovery state banner in broadcast screen
  - Display recovery notification when `recovering === true` in health status
  - Use React Native Alert or Toast for mobile-friendly display
  - Auto-hide after recovery completes (5 seconds)
- [ ] **3.2** Implement circuit breaker countdown UI for mobile
  - Show Alert with retry countdown when circuit breaker is open
  - Use React Native Alert API for mobile-friendly display
  - Update countdown in real-time
- [ ] **3.3** Add state machine validation error display
  - Show user-friendly error messages for invalid state transitions
  - Use React Native Alert for error display
  - Provide clear guidance on what actions are available
- [ ] **3.4** Enhance error messages with mobile-friendly text
  - Adapt error messages for mobile screen sizes
  - Use appropriate React Native components (Alert, Toast, etc.)
  - Ensure error messages are readable on small screens

### Phase 4: Testing & Polish (Week 5)
- [ ] **4.1** Test circuit breaker error scenarios on mobile
  - Test with React Native debugger
  - Verify Alert/Toast displays correctly
- [ ] **4.2** Test state machine validation error scenarios on mobile
  - Test error message display
  - Verify mobile-friendly error handling
- [ ] **4.3** Test recovery message handling on mobile
  - Test `BROADCAST_RECOVERY` message reception via STOMP
  - Verify recovery notification display
- [ ] **4.4** Test checkpoint updates on mobile
  - Verify checkpoint data received via WebSocket or polling
  - Test duration display accuracy
- [ ] **4.5** Verify mobile WebSocket connection count
  - Should be 1 STOMP connection after Phase 0 completion
  - Test on iOS and Android devices

---

## 7. Files Requiring Changes

### High Priority
1. `mobile/app/(tabs)/broadcast.tsx`
   - Migrate listener WebSocket to STOMP (`listenerWsRef` → `websocketService.subscribe()`)
   - Circuit breaker error handling
   - State machine validation error handling
   - Recovery message handling
   - Checkpoint updates
   - Recovery state UI

2. `mobile/services/apiService.ts`
   - Circuit breaker error detection in `startBroadcast()` and `endBroadcast()`
   - State machine validation error detection
   - Enhanced error handling

3. `mobile/services/websocketService.ts`
   - Add exponential backoff reconnection manager
   - Add listener status subscription helper
   - Update reconnection logic

### Medium Priority
4. `mobile/services/chatService.ts`
   - Update `subscribeToGlobalBroadcastUpdates()` to handle `BROADCAST_RECOVERY` messages

5. `mobile/utils/WebSocketReconnectManager.ts` (NEW)
   - Exponential backoff manager for React Native
   - Jitter implementation
   - Max attempts handling

6. `mobile/services/errorHandler.ts` (NEW)
   - Centralized error message mapping for React Native
   - Mobile-friendly error display utilities
   - Alert/Toast helpers

### Low Priority
7. `mobile/services/idempotencyUtils.ts`
   - Already implemented ✅
   - No changes needed

---

## 8. Testing Scenarios

### 8.1 Circuit Breaker Testing
1. **Scenario:** Backend circuit breaker opens after 5 failures
   - **Expected:** Mobile shows React Native Alert with "Service temporarily unavailable" message
   - **Expected:** Retry countdown displayed in Alert
   - **Expected:** Option to retry after countdown

2. **Scenario:** Circuit breaker closes
   - **Expected:** Operations resume normally
   - **Expected:** Alert dismissed

### 8.2 State Machine Validation Testing
1. **Scenario:** Attempt invalid broadcast operation (if mobile has broadcast control)
   - **Expected:** Alert with user-friendly error message
   - **Expected:** Error message explains why operation failed
   - **Expected:** Option to refresh broadcast status

### 8.3 Recovery Testing
1. **Scenario:** Server restarts during LIVE broadcast
   - **Expected:** `BROADCAST_RECOVERY` message received via STOMP
   - **Expected:** Recovery notification displayed (Alert or Toast)
   - **Expected:** Broadcast state restored
   - **Expected:** Duration preserved from checkpoint

2. **Scenario:** Checkpoint updates received
   - **Expected:** Duration updated from backend checkpoint
   - **Expected:** Checkpoint status displayed (optional)

### 8.4 WebSocket Consolidation Testing
1. **Scenario:** Verify single STOMP connection
   - **Expected:** Only 1 STOMP WebSocket connection in React Native debugger
   - **Expected:** All features (chat, polls, broadcast status, listener status) work via single connection
   - **Expected:** No independent WebSocket connections remain

### 8.5 Exponential Backoff Testing
1. **Scenario:** WebSocket disconnects and reconnects
   - **Expected:** Reconnection attempts use exponential backoff (1s → 2s → 4s → 8s → 16s → 30s)
   - **Expected:** Jitter prevents simultaneous reconnections
   - **Expected:** Max attempts respected (10 attempts)

---

## 9. Backend API Changes Reference

### 9.1 New Headers
- `Idempotency-Key: <uuid>` - Already implemented ✅
- `X-Idempotent-Operation: true` - Recommended for backend to send

### 9.2 New WebSocket Topics
- `/topic/broadcast/{id}` - Already subscribed ✅ (via `websocketService`)
- `/topic/broadcast/status` - Already subscribed ✅ (via `chatService`)
- `/topic/listener-status` - Needs subscription ❌ (currently using direct WebSocket)

### 9.3 New Message Types
- `BROADCAST_RECOVERY` - Needs mobile handler ❌
- `BROADCAST_CHECKPOINT` - Needs mobile handler ❌
- `CIRCUIT_BREAKER_OPEN` - Needs mobile handler ❌
- `CIRCUIT_BREAKER_CLOSED` - Needs mobile handler ❌

### 9.4 New Error Responses
- `409 Conflict` - State machine validation - Needs handling ❌
- `503 Service Unavailable` - Circuit breaker - Needs handling ❌

---

## 10. Dependencies & Prerequisites

### 10.1 Backend Requirements
- ✅ Backend must send `BROADCAST_RECOVERY` messages (already implemented)
- ⚠️ Backend should send `BROADCAST_CHECKPOINT` messages (optional, can use polling)
- ⚠️ Backend should send `CIRCUIT_BREAKER_OPEN/CLOSED` messages (optional)
- ✅ Backend must return `409` for state machine validation errors (already implemented)
- ✅ Backend must return `503` for circuit breaker errors (already implemented)

### 10.2 Mobile Frontend Dependencies
- ✅ `StompClientManager` - Already implemented (`mobile/services/websocketService.ts`)
- ✅ `idempotencyUtils` - Already implemented (`mobile/services/idempotencyUtils.ts`)
- ❌ `WebSocketReconnectManager` - Needs to be created
- ❌ `errorHandler.ts` - Needs to be created

### 10.3 React Native Dependencies
- ✅ `react-native` Alert API - Built-in
- ✅ `@stomp/stompjs` - Already installed
- ✅ `sockjs-client` - Already installed
- ⚠️ Toast library (optional) - Consider `react-native-toast-message` for non-blocking notifications

---

## 11. Migration Notes

### 11.1 Backward Compatibility
- All changes are additive (new handlers, new UI elements)
- Existing functionality remains unchanged
- No breaking changes to existing APIs

### 11.2 Gradual Rollout
1. **Week 1:** Complete WebSocket consolidation (Phase 0)
2. **Week 2:** Deploy error handling improvements (circuit breaker, state machine)
3. **Week 3:** Deploy recovery and checkpoint handling
4. **Week 4:** Deploy UI enhancements
5. **Week 5:** Testing and bug fixes

### 11.3 Feature Flags (Optional)
Consider feature flags for:
- Recovery message handling
- Checkpoint updates
- Circuit breaker UI
- Enhanced error messages

---

## 12. Mobile-Specific Considerations

### 12.1 Battery Efficiency
- **WebSocket Consolidation:** Reduces battery drain by using single connection
- **Polling Intervals:** Keep fallback polling intervals long (60s+) to preserve battery
- **Background Handling:** Ensure WebSocket reconnects properly when app returns to foreground

### 12.2 Network Resilience
- **Exponential Backoff:** Prevents battery drain from rapid reconnection attempts
- **Offline Handling:** Gracefully handle network disconnections
- **Background/Foreground:** Handle app state changes (background/foreground transitions)

### 12.3 User Experience
- **Alert vs Toast:** Use Alert for critical errors, Toast for non-critical notifications
- **Error Messages:** Keep messages concise for mobile screens
- **Loading States:** Show appropriate loading indicators during operations

---

## 13. Success Criteria

### 13.1 Functional Requirements
- ✅ All backend error scenarios handled gracefully
- ✅ Recovery messages displayed to mobile users
- ✅ Checkpoint updates reflected in UI
- ✅ Circuit breaker errors show retry countdown
- ✅ State machine validation errors show clear messages

### 13.2 User Experience
- ✅ Users understand why operations fail
- ✅ Users see recovery status during interruptions
- ✅ Users know when to retry failed operations
- ✅ No confusing error messages
- ✅ Mobile-friendly error displays (Alert/Toast)

### 13.3 Technical Requirements
- ⚠️ **BLOCKED** Single STOMP WebSocket connection per user (1 independent connection still exists)
- ✅ All WebSocket message types handled (via STOMP)
- ⚠️ Error handling needs enhancement (circuit breaker, state machine)
- ✅ Code is maintainable and well-documented
- ✅ No performance regressions
- ✅ Battery-efficient implementation

---

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Author:** Mobile Frontend Implementation Guide  
**Status:** 🚨 **BLOCKED** - Phase 0 WebSocket consolidation required before proceeding

**Critical Finding:** Despite STOMP client manager implementation, 1 independent WebSocket connection still exists:
- Listener Status WebSocket (`/ws-listener-status`) - Stream status updates

**Recommendation:** Complete Phase 0 WebSocket consolidation before implementing other phases to achieve full optimization benefits and reduce battery drain.



