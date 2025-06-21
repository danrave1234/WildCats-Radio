# React Native Broadcast Integration Roadmap

## Overview
This guide outlines the steps to integrate the WildCats Radio broadcast functionality into React Native, using the existing web frontend ListenerDashboard implementation as reference. The backend is hosted on Heroku and the Icecast server is on Google VM.

## Key Endpoints and URLs

### Core URLs
- **Backend (Production)**: `https://wildcat-radio-f05d362144e6.autoidleapp.com`
- **Backend (Development)**: `http://192.168.5.60:8080` (currently used in the app)
- **Icecast Server (Google VM)**: `https://icecast.software`
- **Stream URL**: `https://icecast.software/live.ogg`

### API Endpoints
- **Stream Config**: `GET /api/stream/config`
- **Stream Status**: `GET /api/stream/status`
- **WebSocket URLs**: `GET /api/stream/websocket-url`
- **Health Check**: `GET /api/stream/health`

### WebSocket Endpoints
- **DJ Streaming**: `ws://backend/ws/live`
- **Listener Status**: `ws://backend/ws/listener`
- **Chat & Notifications**: `ws://backend/ws-radio` (SockJS + STOMP)

## Current Implementation Status

### ✅ Phase 1: Core Audio Streaming (COMPLETED)
**Implementation**: `audioStreamingService.ts`, `useAudioStreaming.ts`

**Completed Features**:
- ✅ Audio streaming using expo-av
- ✅ Stream URL configuration from backend
- ✅ Volume control (0-100) with persistence
- ✅ Mute/unmute functionality with persistence
- ✅ Play/pause controls with proper error handling
- ✅ Background audio support for iOS/Android
- ✅ Automatic retry on connection failure
- ✅ State persistence to AsyncStorage
- ✅ Stream loading state management
- ✅ Robust error handling and user feedback

**Key Implementation Notes**:
- Using expo-av instead of react-native-track-player
- Background audio configured with `staysActiveInBackground: true`
- Heartbeat mechanism implemented for listener status
- Reconnect logic with exponential backoff
- Stream ready state prevents "No audio stream loaded" errors

### Current Issues Fixed

1. **✅ Backend URL**: Updated to use correct Icecast URLs (`https://icecast.software`)
2. **✅ Stream Loading**: Added proper stream loading states and error handling
3. **✅ TypeScript Errors**: Fixed interval timer type casting
4. **✅ Error Prevention**: Added `isStreamReady` state to prevent premature play attempts
5. **✅ Volume Normalization**: Fixed volume range conversion (0-100 to 0.0-1.0)
6. **✅ Volume Validation**: Added proper volume clamping and validation
7. **✅ Auto-unmute**: Automatically unmutes when volume is increased from 0
8. **✅ Stream URL Persistence**: Fixed stream URL handling and persistence
9. **✅ Error Messages**: Improved user-friendly error messages and alerts

### ✅ Phase 2: Real-time Features (MOSTLY COMPLETED)

#### ✅ 2.1 Listener Status WebSocket (COMPLETED)
**Implementation**: Part of `audioStreamingService.ts`

**Features Implemented**:
- ✅ Heartbeat messages every 15 seconds
- ✅ Listener status callback mechanism
- ✅ Connection state management

#### ✅ 2.2 Chat System (COMPLETED)
**Implementation**: `broadcast.tsx`, `websocketService.ts`, `chatService.ts`

**Features Implemented**:
- ✅ SockJS client with STOMP for React Native
- ✅ Authentication via JWT token in headers
- ✅ Real-time message receiving with proper grouping
- ✅ Message sending functionality
- ✅ Beautiful UI with message animations
- ✅ Auto-scrolling chat view
- ✅ Proper timestamp formatting

**WebSocket Topics Used**:
- Subscribe: `/topic/broadcast/{broadcastId}/chat`
- Send: `/app/broadcast/{broadcastId}/chat`

#### ✅ 2.3 Song Request System (COMPLETED)
**Implementation**: `broadcast.tsx`, `songRequestService.ts`

**Features Implemented**:
- ✅ Song request creation
- ✅ Request queue display
- ✅ Status indicators for pending/played requests

### ✅ Phase 3: Interactive Features (COMPLETED)

#### ✅ 3.1 Live Polls (COMPLETED)
**Implementation**: `broadcast.tsx`, `pollService.ts`

**Features Implemented**:
- ✅ Real-time poll notifications via WebSocket
- ✅ Vote submission with immediate feedback
- ✅ Results display with percentages
- ✅ Active/completed poll state management

**WebSocket Topics**:
- Subscribe: `/topic/broadcast/{broadcastId}/polls`

#### ✅ 3.2 Broadcast Information (COMPLETED)
**Implementation**: `broadcast.tsx`

**Features Implemented**:
- ✅ Current DJ name display
- ✅ Broadcast title/description
- ✅ Start time formatting
- ✅ Live indicator
- ✅ Listener count display

### ❌ Phase 4: DJ Broadcasting Features (NOT IMPLEMENTED)
**Status**: Not yet implemented - listener features prioritized

### ✅ Phase 5: State Management and Persistence (COMPLETED)

**Implementation**: `AuthContext.tsx`, AsyncStorage integration

**Persistence Keys Used**:
- `wildcats_volume` - Volume setting
- `wildcats_muted` - Mute state
- `wildcats_listener_state` - Audio settings
- `wildcats_stream_config` - Server configuration

### ✅ Phase 6: Error Handling and Reconnection (COMPLETED)

**Features Implemented**:
- ✅ WebSocket reconnection with exponential backoff
- ✅ Audio stream retry on failure
- ✅ Connection state indicators
- ✅ Proper error messages for users
- ✅ App state handling for background/foreground

### ✅ Phase 7: UI Components (COMPLETED)

**All Components Implemented**:
- ✅ Audio Player (in-app controls, not shown in broadcast screen)
- ✅ Chat Component with advanced features
- ✅ Broadcast Info Component
- ✅ Song Request Component
- ✅ Live Polls Component
- ✅ Tab-based navigation

## Technical Stack Differences from Roadmap

### Dependencies Used (vs Recommended)
- **Audio**: `expo-av` ✅ (instead of react-native-track-player)
- **WebSocket**: `sockjs-client` + `@stomp/stompjs` ✅
- **Storage**: `@react-native-async-storage/async-storage` ✅
- **HTTP**: Native `fetch` API ✅
- **Navigation**: `expo-router` (instead of React Navigation)
- **UI Framework**: `nativewind` (TailwindCSS for React Native)
- **Date Handling**: `date-fns` ✅

### Current Issues to Address

1. **Backend URL**: Currently using development URL (`http://192.168.5.60:8080`) instead of production
2. **Stream URL Format**: Using HTTP instead of HTTPS for Icecast
3. **Missing Features**:
   - Push notifications service (partially implemented)
   - Offline state handling
   - Analytics integration
   - DJ broadcasting features

### Recommended Next Steps

1. **Switch to Production Backend**:
   ```typescript
   // In streamService.ts and apiService.ts
   const BACKEND_BASE_URL = 'https://wildcat-radio-f05d362144e6.autoidleapp.com';
   ```

2. **Add HTTPS Stream Support**:
   - Update Icecast configuration for SSL
   - Or implement a proxy through the backend

3. **Implement Missing Features**:
   - Complete notification service integration
   - Add offline mode with cached data
   - Implement analytics tracking
   - Add DJ broadcasting features

4. **Performance Optimizations**:
   - Implement lazy loading for chat messages
   - Add virtualized lists for large datasets
   - Optimize WebSocket message handling

5. **Platform-Specific Enhancements**:
   - iOS: Add Now Playing info to Control Center
   - Android: Add notification controls for playback
   - Both: Implement audio focus handling

## Testing Considerations

### Current Test Coverage Needed
- Unit tests for services
- Integration tests for WebSocket connections
- End-to-end tests for critical user flows
- Performance testing for audio streaming
- Network condition testing

### Device Testing Requirements
- Test on various Android versions (API 21+)
- Test on iOS 13+
- Test background audio on both platforms
- Test with different network conditions
- Battery usage optimization testing

This roadmap reflects the current state of implementation with most listener-facing features completed and working. The app successfully implements real-time chat, song requests, polls, and audio streaming with a modern, performant architecture. 

### Current Status

**Audio Streaming**: ✅ Fully functional with proper volume control and error handling
**Real-time Chat**: ✅ Working with WebSocket integration
**Song Requests**: ✅ Working with proper form handling
**Live Polls**: ✅ Working with real-time updates
**Listener Count**: ✅ Working with WebSocket updates 