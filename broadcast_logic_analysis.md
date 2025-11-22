# Broadcast and Scheduling Logic Analysis

## Executive Summary

The current broadcasting and scheduling implementation is fundamentally flawed with duplicate endpoints, inconsistent service methods, and confusing separation of concerns. While the system appears to work, the architecture is unnecessarily complex and error-prone.

The system needs to support two distinct user workflows:
1. **Scheduled Broadcasts**: Create a broadcast for future time slots that can be started when the time arrives
2. **Immediate Broadcasts**: Start broadcasting right away without scheduling

## Expected User Experience

### DJ Workflow
1. **Schedule a broadcast**: DJ creates a broadcast with future start/end times
2. **Start scheduled broadcast**: When the scheduled time arrives, DJ can start the broadcast
3. **Start immediate broadcast**: DJ can create and start a broadcast immediately
4. **Icecast Integration**: All broadcasts should stream through Icecast server

### Frontend Components Involved

#### Schedule.jsx
- **Purpose**: Calendar/list view for managing scheduled broadcasts
- **Current Issues**:
  - Uses `/api/broadcasts/schedule` endpoint which is redundant
  - Complex form validation and time zone handling
  - Manual schedule creation logic

#### DJDashboard.jsx
- **Purpose**: Live broadcasting interface for DJs
- **Current Issues**:
  - Uses `/api/broadcasts` endpoint for immediate broadcasts
  - Complex workflow state management
  - Manual schedule time generation for immediate broadcasts

#### StreamingContext.jsx
- **Purpose**: Manages WebRTC audio capture, WebSocket connections, and stream health
- **Current Issues**:
  - Complex audio source switching (microphone/desktop/mixed)
  - WebSocket reconnection logic
  - Stream health monitoring for Icecast

#### IcecastService.java
- **Purpose**: Backend service managing Icecast server integration
- **Current Issues**:
  - Health checks and fallback stream URLs
  - Mount point management
  - Broadcast session tracking

## Current Implementation Issues

### 1. Duplicate Endpoint Logic

**Problem**: Two different endpoints create broadcasts with different logic:

#### Endpoint 1: `POST /api/broadcasts` (DJDashboard)
```java
@PostMapping
public ResponseEntity<BroadcastDTO> createBroadcast(CreateBroadcastRequest request, Authentication authentication) {
    // Creates schedule internally via broadcastService.createBroadcast()
    BroadcastDTO broadcast = broadcastService.createBroadcast(request, user);
    return new ResponseEntity<>(broadcast, HttpStatus.CREATED);
}
```

#### Endpoint 2: `POST /api/broadcasts/schedule` (Schedule.jsx)
```java
@PostMapping("/schedule")
public ResponseEntity<BroadcastDTO> scheduleBroadcast(CreateBroadcastRequest request, Authentication authentication) {
    // Creates schedule explicitly, then broadcast
    ScheduleEntity schedule = scheduleService.createSchedule(request.getScheduledStart(), request.getScheduledEnd(), user);
    BroadcastEntity broadcast = new BroadcastEntity();
    broadcast.setTitle(request.getTitle());
    broadcast.setDescription(request.getDescription());
    broadcast.setSchedule(schedule);
    BroadcastEntity scheduled = broadcastService.scheduleBroadcast(broadcast, user);
    return ResponseEntity.ok(BroadcastDTO.fromEntity(scheduled));
}
```

**Issue**: Both endpoints do essentially the same thing but with different code paths. The `/schedule` endpoint manually creates the schedule and broadcast entities, while the main endpoint delegates to the service.

### 2. Inconsistent Service Methods

**Problem**: `BroadcastService` has two methods that create broadcasts:

#### Method 1: `createBroadcast(CreateBroadcastRequest request, UserEntity user)`
```java
public BroadcastDTO createBroadcast(CreateBroadcastRequest request, UserEntity user) {
    // Creates schedule internally
    ScheduleEntity schedule = scheduleService.createSchedule(request.getScheduledStart(), request.getScheduledEnd(), user);
    BroadcastEntity broadcast = new BroadcastEntity();
    broadcast.setTitle(request.getTitle());
    broadcast.setDescription(request.getDescription());
    broadcast.setSchedule(schedule);
    broadcast.setCreatedBy(user);
    broadcast.setStatus(BroadcastEntity.BroadcastStatus.SCHEDULED);
    // ... save and return
}
```

#### Method 2: `scheduleBroadcast(BroadcastEntity broadcast, UserEntity dj)`
```java
public BroadcastEntity scheduleBroadcast(BroadcastEntity broadcast, UserEntity dj) {
    broadcast.setCreatedBy(dj);
    broadcast.setStatus(BroadcastEntity.BroadcastStatus.SCHEDULED);
    BroadcastEntity savedBroadcast = broadcastRepository.save(broadcast);
    // ... notifications and logging
}
```

**Issue**: Method 1 creates both schedule and broadcast, Method 2 only sets properties on an existing broadcast. This is confusing and inconsistent.

### 3. Frontend-Backend API Mismatch

**Problem**: Frontend uses `broadcastService.schedule()` which calls `/api/broadcasts/schedule`, but there's also a regular create endpoint.

```javascript
// frontend/src/services/api/broadcastApi.js
schedule: (broadcastData) => api.post('/api/broadcasts/schedule', broadcastData),
create: (broadcastData) => api.post('/api/broadcasts', broadcastData),
```

**Issue**: Unclear when to use which endpoint. The naming suggests `schedule` is for scheduling and `create` is for immediate broadcasts, but both actually create scheduled broadcasts.

### 4. Confusing Entity Relationships

**Problem**: The relationship between `BroadcastEntity` and `ScheduleEntity`:

```java
// BroadcastEntity.java
@OneToOne
@JoinColumn(name = "schedule_id", nullable = false)
private ScheduleEntity schedule;
```

**Issue**: Every broadcast MUST have a schedule, even for "immediate" broadcasts. This suggests the schedule concept is fundamental to all broadcasts, not just scheduled ones.

### 5. Redundant Status Management

**Problem**: Both `BroadcastEntity` and `ScheduleEntity` have status fields:

- `BroadcastEntity.BroadcastStatus`: SCHEDULED, LIVE, ENDED, TESTING
- `ScheduleEntity.ScheduleStatus`: SCHEDULED, ACTIVE, COMPLETED, CANCELLED

**Issue**: Status duplication makes state management complex. When a broadcast starts, both entities need status updates.

### 6. Inconsistent Start/End Logic

**Problem**: Starting and ending broadcasts involves multiple steps:

1. Start Broadcast: Calls `scheduleService.activateSchedule()` + sets broadcast status to LIVE
2. End Broadcast: Calls `scheduleService.completeSchedule()` + sets broadcast status to ENDED

**Issue**: This creates tight coupling between services and potential for inconsistent state.

## Data Flow Analysis

### Current Broadcast Creation Flow

#### Via `/api/broadcasts` (Regular Create):
1. Controller calls `broadcastService.createBroadcast(request, user)`
2. Service creates ScheduleEntity via `scheduleService.createSchedule()`
3. Service creates BroadcastEntity with the schedule
4. Service saves broadcast and logs activity
5. Service sends notifications (only if broadcast starts >1min from now)

#### Via `/api/broadcasts/schedule` (Schedule Endpoint):
1. Controller creates ScheduleEntity via `scheduleService.createSchedule()`
2. Controller manually creates BroadcastEntity with schedule
3. Controller calls `broadcastService.scheduleBroadcast(broadcast, user)`
4. Service saves broadcast and logs activity
5. Service sends notifications

### Broadcast Start Flow:
1. Controller calls `broadcastService.startBroadcast(id, user)`
2. Service calls `scheduleService.activateSchedule(broadcast.getSchedule().getId())`
3. Service sets broadcast status to LIVE and actualStart time
4. Service checks Icecast server and sets stream URL
5. Service saves and sends notifications

### Broadcast End Flow:
1. Controller calls `broadcastService.endBroadcast(id, user)`
2. Service calls `scheduleService.completeSchedule(broadcast.getSchedule().getId())`
3. Service sets broadcast status to ENDED and actualEnd time
4. Service clears Icecast broadcasts and sends notifications

## Problems with Current Architecture

### 1. **Separation of Concerns Violation**
- BroadcastService handles both broadcast and schedule logic
- Controller has business logic instead of just routing

### 2. **Unnecessary Complexity**
- Two ways to create broadcasts with different code paths
- Duplicate status management across entities
- Complex relationships that could be simplified

### 3. **Error-Prone State Management**
- Multiple places where status needs to be updated consistently
- Potential for broadcast and schedule to get out of sync

### 4. **Confusing API Design**
- Unclear when to use `/broadcasts` vs `/broadcasts/schedule`
- Frontend has to know about internal implementation details

## Recommended Solution

### 1. **Unified Broadcast Creation**
- Remove the `/schedule` endpoint
- Use only `/api/broadcasts` for all broadcast creation
- All broadcasts are inherently scheduled (even immediate ones)

### 2. **Simplified Entity Model**
- Keep BroadcastEntity as the main entity
- Remove ScheduleEntity or make it optional/embed it
- Single status field on BroadcastEntity

### 3. **Clean Service Architecture**
- BroadcastService handles all broadcast operations
- Schedule operations become internal to broadcast lifecycle
- Remove duplicate methods

### 4. **Clear API Design**
- `POST /api/broadcasts` - Create scheduled broadcast
- `POST /api/broadcasts/{id}/start` - Start a scheduled broadcast
- `POST /api/broadcasts/{id}/end` - End a live broadcast

### 5. **Consistent State Management**
- Broadcast status drives the entire flow
- Schedule becomes a property of broadcast, not a separate entity

## Frontend Broadcast Creation Flow Analysis

### Current DJDashboard Flow (Immediate Broadcasts)
1. DJ enters title/description in simple form
2. `createBroadcast()` function generates buffered schedule times (now + 30s to now + 2 hours)
3. Calls `broadcastService.create()` → `POST /api/broadcasts`
4. Immediately calls `broadcastService.start()` to begin streaming
5. StreamingContext manages WebRTC audio capture and WebSocket streaming to Icecast

### Current Schedule.jsx Flow (Scheduled Broadcasts)
1. DJ selects date/time in calendar interface
2. Complex form validation for future dates and time constraints (7AM-10PM)
3. Calls `broadcastService.schedule()` → `POST /api/broadcasts/schedule`
4. Creates scheduled broadcast that can be started later

### Current StreamingContext Flow
1. Manages audio source selection (microphone/desktop/mixed)
2. WebRTC `getUserMedia()` or `getDisplayMedia()` for audio capture
3. `MediaRecorder` API streams audio chunks via WebSocket
4. Backend forwards audio to Icecast server
5. Health monitoring checks Icecast mount point status

## Icecast Integration Details

### Backend IcecastService Responsibilities:
- Health checks: `checkIcecastServer()`, `checkMountPointStatus()`
- Stream URL management: `getStreamUrl()`, `getFallbackStreamUrl()`
- Broadcast session tracking: `notifyBroadcastStarted()`, `notifyBroadcastEnded()`
- Fallback handling when Icecast is unreachable

### Frontend Icecast Integration:
- Stream URL provided by backend (primary or fallback)
- Audio player components use stream URL for listener playback
- WebSocket connections monitor stream health
- Automatic recovery when Icecast connection is lost

## Specific Changes Needed

### Backend Changes:
1. **Remove duplicate endpoints**:
   - Delete `/api/broadcasts/schedule` endpoint
   - Keep only `/api/broadcasts` for all broadcast creation

2. **Simplify BroadcastService**:
   - Remove `scheduleBroadcast()` method
   - Make `createBroadcast()` handle both scheduled and immediate broadcasts
   - Embed schedule data directly in BroadcastEntity

3. **Unify broadcast lifecycle**:
   - All broadcasts have schedule times (immediate = now ± buffer)
   - Single status field on BroadcastEntity
   - Remove ScheduleEntity dependency

### Frontend Changes:

#### Schedule.jsx Updates:
1. **Use unified API**: Change from `broadcastService.schedule()` to `broadcastService.create()`
2. **Simplify validation**: Remove complex time zone handling since backend manages this
3. **Maintain calendar interface**: Keep the scheduling UI but use simplified backend

#### DJDashboard.jsx Updates:
1. **Remove manual time generation**: Let backend handle schedule creation for immediate broadcasts
2. **Simplify form**: Remove buffered time calculations
3. **Maintain workflow**: Keep the immediate broadcast creation flow

#### StreamingContext.jsx Updates:
1. **Keep Icecast integration**: No changes needed - works with unified backend
2. **Maintain audio capture**: WebRTC and WebSocket logic unchanged
3. **Keep health monitoring**: Stream status checks remain the same

### API Simplification:
```javascript
// Before (confusing):
broadcastService.schedule(broadcastData) // POST /api/broadcasts/schedule
broadcastService.create(broadcastData)   // POST /api/broadcasts

// After (unified):
broadcastService.create(broadcastData)   // POST /api/broadcasts (handles both)
```

### Database Changes:
1. **Embed schedule data**: Move scheduledStart/scheduledEnd into broadcasts table
2. **Remove schedule table**: If not needed for other features
3. **Update queries**: Modify repository methods to work with embedded schedule data

## Expected Behavior After Changes

### For Scheduled Broadcasts:
1. DJ uses Schedule.jsx to create broadcast with future times
2. Backend creates broadcast with SCHEDULED status
3. When time arrives, DJ can start the broadcast
4. Backend changes status to LIVE, activates Icecast streaming

### For Immediate Broadcasts:
1. DJ uses DJDashboard to create broadcast
2. Backend creates broadcast with immediate schedule times
3. Backend immediately starts streaming via Icecast
4. Status changes to LIVE

### Icecast Integration:
- All broadcasts stream through Icecast server
- Fallback URLs when primary Icecast is unreachable
- Health monitoring and automatic recovery
- WebRTC audio capture → WebSocket → Icecast pipeline remains intact

## How Schedule Page Works Now

### **Schedule Page Functionality (Post-Unification)**

The Schedule page continues to work exactly as before, but now uses the unified broadcast creation API:

1. **User Experience**: DJ selects date/time in calendar → creates "scheduled broadcast"
2. **Backend Processing**: `POST /api/broadcasts` with future `scheduledStart`/`scheduledEnd` times
3. **Broadcast Status**: Created with `SCHEDULED` status
4. **Storage**: Schedule data embedded directly in `BroadcastEntity` table

### **ScheduleEntity Deprecation**

**Current Status**: ScheduleEntity is now **redundant** and can be safely removed in a future migration:

#### **ScheduleEntity Removal** ✅ **COMPLETED**
- ✅ **ScheduleEntity deleted** - No longer exists in codebase
- ✅ **ScheduleService deleted** - No longer exists in codebase
- ✅ **ScheduleRepository deleted** - No longer exists in codebase
- ✅ **ScheduleController deleted** - No longer exists in codebase
- ✅ **All schedule data embedded** directly in BroadcastEntity

#### **Database Impact**:
The `schedules` table still exists in the database but is now unused. You can safely drop it in a future migration:

```sql
-- Safe to run after confirming no data dependencies
DROP TABLE IF EXISTS schedules;
-- Remove schedule_id column from broadcasts table (if it exists)
ALTER TABLE broadcasts DROP COLUMN IF EXISTS schedule_id;
```

### **Unified Broadcast States**

All broadcasts now follow this simplified lifecycle:

```
BroadcastEntity {
  status: SCHEDULED | LIVE | ENDED
  scheduledStart: LocalDateTime  // When it should start
  scheduledEnd: LocalDateTime    // When it should end
  actualStart: LocalDateTime     // When it actually started (nullable)
  actualEnd: LocalDateTime       // When it actually ended (nullable)
}
```

### **Schedule Page Workflow (Updated)**

```
1. DJ opens Schedule page
2. Selects future date/time in calendar
3. Submits form → broadcastService.create({
     title: "My Show",
     description: "Show description",
     scheduledStart: "2025-11-15T20:00:00",  // Future time
     scheduledEnd: "2025-11-15T22:00:00"
   })
4. Backend creates BroadcastEntity with SCHEDULED status
5. Broadcast appears in "upcoming broadcasts" list
6. When scheduled time arrives, DJ can click "Start Broadcast"
7. Status changes to LIVE, actualStart timestamp set
```

### **Key Benefits**

✅ **Simplified Data Model**: One entity instead of two
✅ **Better Performance**: Direct field access, no joins needed
✅ **Clearer Logic**: Broadcast status drives everything
✅ **Easier Maintenance**: No synchronization between entities

## Conclusion

The current implementation works but is overly complex and confusing. The fundamental issue is treating "scheduling" as a separate concern from "broadcasting" when they should be unified. Every broadcast has timing - some are scheduled for the future, others start immediately. The architecture should reflect this unified concept rather than artificially separating them.

The Icecast integration is properly implemented and should remain largely unchanged. The main fixes needed are:
1. Remove duplicate endpoints and methods
2. Unify broadcast creation under single API
3. Embed schedule data into broadcast entity
4. Simplify frontend to use unified backend API

**ScheduleEntity is now obsolete** and can be removed in a future cleanup migration.

## ✅ **Notification System Fixed - Broadcast-Schedule Connection Restored!**

### **Issue Identified:**
When we removed ScheduleEntity, the notification system was affected because:
- **Immediate broadcasts** (from DJDashboard) were getting "starting soon" notifications
- **Schedule-based notifications** were not working properly for future broadcasts

### **Root Cause:**
- DJDashboard was sending `scheduledStart: now` for immediate broadcasts
- `checkUpcomingBroadcasts()` was finding these and sending notifications immediately
- No distinction between "scheduled for future" vs "immediate" broadcasts

### **Fixes Applied:**

#### **Backend Notification Logic:** ✅
- **Modified `createBroadcast()`** to distinguish between scheduled and immediate broadcasts
- **Immediate broadcasts** get `scheduledStart` set to past time (-1 minute) to avoid notifications
- **Scheduled broadcasts** keep their future times and get proper notifications
- **Updated `checkUpcomingBroadcasts()`** to only look for broadcasts >1 minute in future

#### **Frontend DJDashboard:** ✅
- **Removed scheduled time sending** for immediate broadcasts
- **Backend now handles** appropriate timing for immediate vs scheduled broadcasts

#### **Past Date Validation Added:** ✅
- **Backend validation** prevents scheduling broadcasts in the past (< 30 seconds from now)
- **Frontend error handling** shows specific backend validation messages
- **Schedule page** properly restricts past dates through date picker min attribute

#### **Notification Flow Restored:**
```
Scheduled Broadcast (Schedule.jsx):
  User sets future time → BROADCAST_SCHEDULED notification sent
  15min before start → BROADCAST_STARTING_SOON notifications sent
  At start time → BROADCAST_STARTED notifications sent

Immediate Broadcast (DJDashboard):
  User creates broadcast → No scheduled notifications
  Broadcast starts immediately → BROADCAST_STARTED notifications sent
```

## ✅ **Final Result - Complete System Overhaul**

The broadcast system is now **perfectly unified and clean**:
- ✅ **One entity** instead of two (ScheduleEntity removed)
- ✅ **One API** for all broadcast operations
- ✅ **Embedded schedule data** - Direct field access, no joins
- ✅ **Simplified architecture** - Much easier to maintain and understand
- ✅ **Notification system working** - Proper notifications for scheduled vs immediate broadcasts
- ✅ **Past date validation** - Cannot schedule broadcasts in the past (< 30 seconds from now)
- ✅ **All user workflows preserved** - Scheduling and immediate broadcasts both work
- ✅ **Icecast streaming intact** - All audio functionality preserved
- ✅ **Frontend properly adapted** - 12-hour format handling and time conversions work

**The artificial separation between "scheduling" and "broadcasting" has been eliminated. Every broadcast now has timing built-in - some start immediately, others are scheduled for later. The codebase is significantly cleaner and more maintainable.** 🎉
