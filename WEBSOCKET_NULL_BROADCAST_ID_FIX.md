# WebSocket Null Broadcast ID Fix

## Issue Description
The application was experiencing `ConversionFailedException` errors when trying to convert the string "null" to a Long type for `@DestinationVariable` parameters in WebSocket endpoints.

**Error Stack Trace:**
```
org.springframework.core.convert.ConversionFailedException: Failed to convert from type [java.lang.String] to type [@org.springframework.messaging.handler.annotation.DestinationVariable java.lang.Long] for value 'null'
Caused by: java.lang.NumberFormatException: For input string: "null"
```

## Root Cause Analysis
The issue occurred in the `BroadcastWebSocketController` class where two WebSocket endpoints were expecting Long broadcastId parameters:

1. `/broadcast/{broadcastId}/join` - Line 40
2. `/broadcast/{broadcastId}/leave` - Line 77

The frontend was sending WebSocket messages with "null" as the broadcastId in two scenarios:
1. When `currentBroadcastId` was null in `ListenerDashboard.jsx` (line 561)
2. When explicitly passing null for global broadcast subscriptions (line 823)

## Solution Implemented

### Backend Changes (BroadcastWebSocketController.java)
1. **Changed parameter type**: Changed `@DestinationVariable Long broadcastId` to `@DestinationVariable String broadcastId`
2. **Added validation**: Added null and "null" string validation before parsing
3. **Graceful handling**: Return appropriate responses for invalid broadcast IDs

**For joinBroadcast method:**
- Returns `JOIN_ACK` with null broadcast data for invalid IDs
- Returns `JOIN_ERROR` with error message for parsing failures

**For leaveBroadcast method:**
- Silently ignores invalid broadcast IDs (no response needed)

### Frontend Changes (api.js)
1. **Added validation**: Check if broadcastId is valid before sending join/leave messages
2. **Conditional messaging**: Only send join/leave WebSocket messages when broadcastId is not null or "null"

**Validation logic:**
```javascript
const shouldSendJoinLeave = broadcastId && broadcastId !== 'null' && broadcastId.toString().trim() !== '';
```

## Files Modified
1. `backend/src/main/java/com/wildcastradio/Broadcast/BroadcastWebSocketController.java`
2. `frontend/src/services/api.js`

## Testing
- Backend compilation successful (86 source files compiled without errors)
- Changes maintain backward compatibility
- WebSocket endpoints now handle null values gracefully without throwing exceptions

## Impact
- Eliminates `NumberFormatException` errors in WebSocket message handling
- Improves application stability and user experience
- Maintains existing functionality while adding proper error handling
- Allows for global broadcast subscriptions without causing server errors