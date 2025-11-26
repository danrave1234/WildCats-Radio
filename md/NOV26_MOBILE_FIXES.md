# Mobile App Fixes & Enhancements - November 26, 2025

## Executive Summary
This document details the critical fixes and enhancements applied to the WildCats Radio mobile application to resolve WebSocket connectivity issues, improve chat responsiveness, fix UI rendering bugs ("ghost messages"), and ensure robust broadcast state handling.

## 1. Critical Connectivity Fixes

### 1.1 TextEncoder Polyfill for StompJS v7
**Problem:** The app uses `@stomp/stompjs` v7, which depends on `TextEncoder`/`TextDecoder`. These are not available globally in the standard React Native environment, causing silent WebSocket connection failures.
**Fix:**
- Installed `text-encoding` package.
- Imported the polyfill in `mobile/app/_layout.tsx` to ensure it's available globally before the app initializes.

### 1.2 WebSocket Timeout & State Management
**Problem:**
- Mobile networks and emulators often have higher latency, causing the default 15s timeout to trigger prematurely.
- Attempting to assign to the read-only `connected` property of the Stomp client caused runtime errors.
**Fix:**
- Increased `StompClientManager` connection timeout to **30 seconds**.
- Increased `WebSocketManager` wrapper timeout to **35 seconds**.
- Removed manual assignment of `this.stompClient.connected`.
- **File:** `mobile/services/websocketService.ts`

### 1.3 Network Configuration
**Problem:** `LOCAL_IP` was set to a specific LAN IP, breaking connectivity on Android Emulators which use a virtual router.
**Fix:**
- Updated default `LOCAL_IP` to `10.0.2.2` (standard Android Emulator host alias).
- Added comments for iOS (`localhost`) and physical device configuration.
- **File:** `mobile/config/environment.ts`

### 1.4 Robust API Response Parsing
**Problem:** API methods like `getSongRequestsForBroadcast` crashed with "JSON Parse error" when the backend returned an empty body (e.g., 200 OK with no content).
**Fix:**
- Updated `mobile/services/apiService.ts` to read responses as text first (`response.text()`).
- Checks for empty strings before attempting `JSON.parse()`.
- Applied to: `getSongRequestsForBroadcast`, `getChatMessages`, `getAllPollsForBroadcast`, `getActivePollsForBroadcast`, `getPollResults`, `hasUserVotedOnPoll`, `getUserVoteForPoll`, `getCurrentActiveDJ`.

## 2. Feature Enhancements

### 2.1 Optimistic Chat Updates (Real-time Feel)
**Problem:** Chat messages felt sluggish because the UI waited for the server round-trip before displaying the user's own message.
**Solution:**
- Implemented optimistic updates in `handleSendChatMessage`.
- Messages are immediately added to the local state with a temporary ID.
- The temporary message is reconciled (replaced or removed) upon server response.
- **File:** `mobile/app/(tabs)/broadcast.tsx`

### 2.2 Robust Broadcast State Handling
**Problem:** If the app missed the `BROADCAST_ENDED` event (e.g., due to backgrounding), it could get stuck in a "LIVE" state even after the broadcast ended.
**Solution:**
- **Fail-Safe Ending:** Modified `handleGlobalBroadcastUpdate`. If `STREAM_STATUS` reports `isLive: false` while the app thinks a broadcast is active, it forces a transition to "Off Air".
- **Broadcast-Specific Subscription:** Added a dedicated subscription to `/topic/broadcast/{id}` to listen for `BROADCAST_CHECKPOINT` and `BROADCAST_RECOVERY` events, matching the web frontend's resilience logic.
- **File:** `mobile/app/(tabs)/broadcast.tsx`

## 3. Chat Experience Fixes

### 3.1 Correct Sender Name Display
**Problem:** Chat messages displayed "Unknown User" or default avatars because the mobile app expected a `name` field, but the backend provided `firstname` and `lastname` separately.
**Fix:**
- Updated `ChatMessageSender` interface in `apiService.ts` to include `firstname`, `lastname`, and `email`.
- Updated `AnimatedMessage.tsx` to robustly construct the full name from available fields.
- Updated `ChatTab.tsx` and `broadcast.tsx` to use this robust logic for message grouping and ownership checks ("You").

### 3.2 "Ghost" Message Bubbles
**Problem:** New chat messages would sometimes occupy layout space but remain invisible (opacity 0), creating "ghost" gaps in the chat list. This was due to an issue with `Animated.Value.setValue` not always triggering a visual update on the native driver during the initial render frame.
**Fix:**
- Refactored `AnimatedMessage.tsx` to use `Animated.timing` for a reliable entry animation (opacity 0 -> 1).
- This ensures the UI always transitions to a visible state.

## 4. Network Reliability Enhancements

### 4.1 Graceful Timeout Handling
**Problem:** Critical API calls (`getCurrentActiveDJ`, `getChatMessages`) would hang or throw generic network errors on slow emulator connections.
**Fix:**
- Replaced raw `fetch` with `fetchWithTimeout` wrapper for `getCurrentActiveDJ`, `getChatMessages`, and `getActivePollsForBroadcast` in `apiService.ts`.
- This provides clearer error messages and prevents indefinite hanging.

## 5. Files Modified

| File Path | Change Category | Description |
|-----------|-----------------|-------------|
| `mobile/app/_layout.tsx` | Fix | Added `text-encoding` polyfill import. |
| `mobile/services/websocketService.ts` | Fix | Increased timeouts, removed invalid property assignment. |
| `mobile/config/environment.ts` | Config | Updated `LOCAL_IP` for Android Emulator. |
| `mobile/services/apiService.ts` | Robustness | Safe JSON parsing, `fetchWithTimeout`, DTO updates for user names. |
| `mobile/app/(tabs)/broadcast.tsx` | Feature | Optimistic chat, fail-safe state, message ownership logic. |
| `mobile/components/broadcast/AnimatedMessage.tsx` | UI Fix | Fixed "ghost" messages via animation, correct name display. |
| `mobile/components/broadcast/ChatTab.tsx` | UI Fix | Improved message grouping logic using robust sender IDs. |
| `mobile/TROUBLESHOOTING.md` | Documentation | New guide for emulator networking and common issues. |

## 6. Verification Steps

1.  **Rebuild App:** Run `npx expo start -c` to clear cache and rebuild.
2.  **Test Chat Names:** Login and send a message. Verify your name appears correctly (or "You").
3.  **Test Visibility:** Verify new messages appear with a smooth fade-in animation and are fully visible (no ghost gaps).
4.  **Test Connectivity:** Ensure `getCurrentActiveDJ` and chat loading work without timeout errors on the emulator.