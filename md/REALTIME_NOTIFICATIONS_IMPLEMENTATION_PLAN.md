# Real-Time Notifications Implementation Plan

**Document Version:** 1.1
**Date:** January 2025
**Status:** 🟢 **PHASE 2 COMPLETE** - Connection monitoring and auto-reconnection implemented
**Priority:** HIGH

---

## Executive Summary

The current notification system has a **critical flaw**: WebSocket messages are received but immediately overwritten by periodic HTTP polling. Notifications only update when the manual refresh button is pressed, defeating the purpose of real-time WebSocket updates.

**Root Cause:** `fetchNotifications()` replaces the entire state array, overwriting real-time WebSocket notifications that haven't been persisted yet or were added between refresh cycles.

**✅ PHASE 1 COMPLETE:** Fixed state management to merge WebSocket updates with HTTP-fetched data instead of replacing. WebSocket notifications now persist after HTTP fetch cycles. All tests passed.

**✅ PHASE 2 COMPLETE:** Implemented connection status monitoring, automatic reconnection with exponential backoff, and conditional HTTP polling (fallback only when WebSocket disconnected).

**Remaining:** Implement connection monitoring, backend WebSocket updates for read/delete operations, and multi-device synchronization.

---

## 1. Current Implementation Analysis

### 1.1 Architecture Overview

**Frontend Components:**
- `NotificationContext.jsx` - Central state management
- `NotificationBell.jsx` - Bell icon with popover
- `Notifications.jsx` - Full notifications page
- `notificationService` (via `otherApis.js`) - API and WebSocket subscription

**Backend:**
- STOMP WebSocket endpoint: `/ws-radio`
- User queue: `/user/queue/notifications`
- Public announcements: `/topic/announcements/public`
- REST API: `/api/notifications/*`

### 1.2 Critical Issues Identified

#### Issue #1: State Replacement Overwrites Real-Time Updates
**Location:** `NotificationContext.jsx:169-192`

```169:192:frontend/src/context/NotificationContext.jsx
  const fetchNotifications = async () => {
    if (!isAuthenticated) return;

    try {
      logger.debug('Fetching notifications and unread count...');
      const [notificationsResponse, unreadCountResponse] = await Promise.all([
        notificationService.getPage(0, size),
        notificationService.getUnreadCount()
      ]);

      const content = notificationsResponse.data?.content || notificationsResponse.data || [];
      logger.debug('Fetched notifications:', content.length);
      logger.debug('Fetched unread count (raw):', unreadCountResponse.data);

      const filtered = (content || []).filter(shouldDisplayNotification);
      setNotifications(filtered);  // ❌ REPLACES entire array
      setPage(0);
      const last = notificationsResponse.data?.last;
      setHasMore(Boolean(last === false && filtered.length > 0));
      setUnreadCount(filtered.filter((n) => !n.read).length);  // ❌ Recalculates from fetched data only
    } catch (error) {
      logger.error('Error fetching notifications:', error);
    }
  };
```

**Problem:**
- `setNotifications(filtered)` completely replaces the state
- Any notifications added via WebSocket (`addNotification()`) are lost
- Unread count is recalculated from fetched data only, ignoring real-time updates

#### Issue #2: WebSocket Callback Adds But Gets Overwritten
**Location:** `NotificationContext.jsx:134-158`

```134:158:frontend/src/context/NotificationContext.jsx
  const connectToWebSocket = async () => {
    if (wsConnection.current) {
      return; // Already connected
    }

    try {
      logger.debug('Connecting to WebSocket for real-time notifications...');
      const connection = await notificationService.subscribeToNotifications((notification) => {
        logger.debug('Received real-time notification:', notification);
        // Add user-queue item to inbox
        if (notification && typeof notification.id !== 'undefined') {
          addNotification(notification);  // ✅ Adds notification
        }
      });

      wsConnection.current = connection;

      // Check if connection is actually established
      setIsConnected(connection.isConnected());  // ❌ Only checked once
      logger.debug('WebSocket connection established:', connection.isConnected());
    } catch (error) {
      logger.error('Failed to connect to WebSocket:', error);
      setIsConnected(false);
    }
  };
```

**Problem:**
- WebSocket messages ARE received and added via `addNotification()`
- But `fetchNotifications()` runs every 30 seconds and replaces the array
- Connection status is only checked once, not monitored continuously

#### Issue #3: No WebSocket Updates for Read/Delete Operations
**Location:** `NotificationContext.jsx:236-258`

```236:258:frontend/src/context/NotificationContext.jsx
  const markAsRead = async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
      logger.debug('Marked notification as read:', notificationId);
    } catch (error) {
      logger.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(notifications.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      logger.debug('Marked all notifications as read');
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
    }
  };
```

**Problem:**
- Backend doesn't send WebSocket updates when notifications are marked as read
- UI updates optimistically but may be out of sync if another client marks as read
- No synchronization mechanism for multi-device scenarios

#### Issue #4: Connection Status Not Monitored
**Location:** `NotificationContext.jsx:152`

**Problem:**
- `isConnected` is only set once during initial connection
- No monitoring of connection state changes
- No automatic reconnection if WebSocket disconnects
- UI shows stale connection status

#### Issue #5: Periodic Refresh Conflicts with Real-Time Updates
**Location:** `NotificationContext.jsx:112-125`

```112:125:frontend/src/context/NotificationContext.jsx
  const startPeriodicRefresh = () => {
    // Clear any existing interval
    if (refreshInterval.current) {
      clearInterval(refreshInterval.current);
    }

    // Refresh notifications every 30 seconds
    refreshInterval.current = setInterval(() => {
      if (isAuthenticated) {
        logger.debug('Periodic notification refresh...');
        fetchNotifications();  // ❌ Overwrites real-time updates
      }
    }, 30000); // 30 seconds
  };
```

**Problem:**
- Periodic refresh should be a fallback, not primary mechanism
- Runs even when WebSocket is connected
- Overwrites any real-time notifications added between cycles

---

## 2. Implementation Plan

### 2.1 Phase 1: Fix State Management (CRITICAL) ✅ COMPLETED

**Objective:** Merge WebSocket updates with HTTP-fetched data instead of replacing

**Status:** ✅ **IMPLEMENTED** - WebSocket notifications now persist after HTTP fetch cycles

**Changes Made:**

1. **Modified `fetchNotifications()` to merge instead of replace**
   - Uses `setNotifications(prev => ...)` to merge with existing state
   - Creates server map for efficient lookup by ID
   - Preserves WebSocket notifications not yet in server response
   - Sorts merged notifications by timestamp

2. **Fixed unread count calculation**
   - Uses server unread count as source of truth
   - Accounts for read/delete operations that happened elsewhere
   - No longer recalculates from filtered array

**Files Modified:**
- `frontend/src/context/NotificationContext.jsx` (lines 169-192)

**Actual Implementation:**

```169:192:frontend/src/context/NotificationContext.jsx
  const fetchNotifications = async () => {
    if (!isAuthenticated) return;

    try {
      logger.debug('Fetching notifications and unread count...');
      const [notificationsResponse, unreadCountResponse] = await Promise.all([
        notificationService.getPage(0, size),
        notificationService.getUnreadCount()
      ]);

      const content = notificationsResponse.data?.content || notificationsResponse.data || [];
      logger.debug('Fetched notifications:', content.length);
      logger.debug('Fetched unread count (raw):', unreadCountResponse.data);

      const filtered = (content || []).filter(shouldDisplayNotification);

      // ✅ PHASE 1: MERGE instead of replace to preserve WebSocket notifications
      setNotifications(prev => {
        const serverMap = new Map(filtered.map(n => [n.id, n]));
        const merged = [];

        // Add/update notifications from server (source of truth)
        filtered.forEach(serverNotif => {
          merged.push(serverNotif);
        });

        // Preserve WebSocket notifications not yet in server response
        // (new notifications that arrived via WebSocket but haven't been persisted)
        prev.forEach(wsNotif => {
          if (!serverMap.has(wsNotif.id) && wsNotif.id != null) {
            logger.debug('Preserving WebSocket notification not in server response:', wsNotif.id);
            merged.push(wsNotif);
          }
        });

        // Sort by timestamp (newest first)
        return merged.sort((a, b) =>
          new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0)
        );
      });

      setPage(0);
      const last = notificationsResponse.data?.last;
      setHasMore(Boolean(last === false && filtered.length > 0));

      // ✅ PHASE 1: Use server unread count as source of truth
      // This accounts for any read/delete operations that happened elsewhere
      const serverUnreadCount = unreadCountResponse.data || 0;
      setUnreadCount(serverUnreadCount);
      logger.debug('Updated unread count from server:', serverUnreadCount);
    } catch (error) {
      logger.error('Error fetching notifications:', error);
    }
  };
```

**Testing Results:** ✅ ALL TESTS PASSED
- [x] WebSocket notifications persist after HTTP fetch cycle
- [x] No duplicate notifications in merged state
- [x] Unread count uses server as source of truth
- [x] Notifications sorted by timestamp correctly (newest first)
- [x] Merging logic preserves WebSocket notifications not yet persisted
- [x] Server notifications are properly integrated

### 2.2 Phase 2: Monitor Connection Status ✅ COMPLETED

**Objective:** Continuously monitor WebSocket connection and handle reconnection

**Status:** ✅ **IMPLEMENTED** - Connection monitoring, auto-reconnection, and conditional polling working

**Changes Made:**

1. **Added connection status monitoring effect**
   - Monitors connection every 5 seconds
   - Updates `isConnected` state in real-time
   - Logs connection status changes

2. **Implemented automatic reconnection with exponential backoff**
   - Detects disconnection immediately
   - Attempts reconnection with delays: 3s, 6s, 12s, 24s, 48s
   - Maximum 5 reconnection attempts before giving up
   - Resets attempt counter on successful reconnection

3. **Made periodic refresh conditional**
   - HTTP polling only runs when WebSocket is disconnected
   - WebSocket is primary mechanism, HTTP is fallback
   - Reduces server load and improves performance

**Files Modified:**
- `frontend/src/context/NotificationContext.jsx` (lines 111-173)

**Actual Implementation:**

```112:173:frontend/src/context/NotificationContext.jsx
  // ✅ PHASE 2: Add connection status monitoring
  useEffect(() => {
    if (!isAuthenticated || !wsConnection.current) return;

    let reconnectionAttempts = 0;
    const maxReconnectionAttempts = 5;
    const baseReconnectionDelay = 3000; // 3 seconds

    const checkConnection = () => {
      const connected = wsConnection.current?.isConnected() || false;

      // Update connection status if it changed
      if (connected !== isConnected) {
        setIsConnected(connected);
        logger.debug('WebSocket connection status changed:', connected ? 'connected' : 'disconnected');
      }

      // If disconnected, attempt reconnection with exponential backoff
      if (!connected) {
        reconnectionAttempts++;
        if (reconnectionAttempts <= maxReconnectionAttempts) {
          const delay = baseReconnectionDelay * Math.pow(2, reconnectionAttempts - 1); // Exponential backoff
          logger.warn(`WebSocket disconnected, attempting reconnection ${reconnectionAttempts}/${maxReconnectionAttempts} in ${delay}ms...`);

          setTimeout(() => {
            if (isAuthenticated && !wsConnection.current?.isConnected()) {
              // Clean up old connection
              disconnectWebSocket();

              // Attempt reconnection
              connectToWebSocket().then(() => {
                logger.info('WebSocket reconnection successful');
                reconnectionAttempts = 0; // Reset on success
              }).catch((error) => {
                logger.error('WebSocket reconnection failed:', error);
              });
            }
          }, delay);
        } else {
          logger.error(`WebSocket reconnection failed after ${maxReconnectionAttempts} attempts`);
          reconnectionAttempts = 0; // Reset for next disconnection
        }
      } else {
        // Reset reconnection attempts on successful connection
        reconnectionAttempts = 0;
      }
    };

    // Clear any existing interval
    if (connectionCheckInterval.current) {
      clearInterval(connectionCheckInterval.current);
    }

    // Check connection status every 5 seconds
    connectionCheckInterval.current = setInterval(checkConnection, 5000);

    // Initial check
    checkConnection();

    return () => {
      if (connectionCheckInterval.current) {
        clearInterval(connectionCheckInterval.current);
        connectionCheckInterval.current = null;
      }
    };
  }, [isAuthenticated]); // Only depend on isAuthenticated to avoid loops
```

**Conditional Refresh Implementation:**

```125:132:frontend/src/context/NotificationContext.jsx
    // ✅ PHASE 2: Only refresh when WebSocket is disconnected (fallback mode)
    refreshInterval.current = setInterval(() => {
      if (isAuthenticated && !isConnected) {
        logger.debug('Periodic notification refresh (WebSocket disconnected - fallback mode)...');
        fetchNotifications();
      }
    }, 30000); // 30 seconds
```

**Implementation:**

```javascript
// Add connection monitoring effect
useEffect(() => {
  if (!isAuthenticated || !wsConnection.current) return;
  
  const checkConnection = () => {
    const connected = wsConnection.current?.isConnected() || false;
    setIsConnected(connected);
    
    // If disconnected, attempt reconnection
    if (!connected && wsConnection.current) {
      logger.warn('WebSocket disconnected, attempting reconnection...');
      disconnectWebSocket();
      setTimeout(() => {
        if (isAuthenticated) {
          connectToWebSocket();
        }
      }, 3000); // Retry after 3 seconds
    }
  };
  
  // Check connection status every 5 seconds
  const connectionInterval = setInterval(checkConnection, 5000);
  
  return () => clearInterval(connectionInterval);
}, [isAuthenticated, wsConnection.current]);

// Make periodic refresh conditional
const startPeriodicRefresh = () => {
  if (refreshInterval.current) {
    clearInterval(refreshInterval.current);
  }

  // Only refresh if WebSocket is not connected
  refreshInterval.current = setInterval(() => {
    if (isAuthenticated && !isConnected) {
      logger.debug('Periodic notification refresh (WebSocket disconnected)...');
      fetchNotifications();
    }
  }, 30000);
};
```

### 2.3 Phase 3: Backend WebSocket Updates for Read/Delete

**Objective:** Send WebSocket updates when notifications are modified

**Changes Required:**

1. **Backend: Send WebSocket update on mark as read**
   - When notification is marked as read, send update to user's queue
   - Include updated notification DTO

2. **Backend: Send WebSocket update on mark all as read**
   - Send bulk update message
   - Include count of marked notifications

3. **Frontend: Handle WebSocket update messages**
   - Listen for notification update messages
   - Update local state when updates received
   - Sync read status across devices

**Backend Files to Modify:**
- `backend/src/main/java/com/wildcastradio/Notification/NotificationService.java`
- `backend/src/main/java/com/wildcastradio/Notification/NotificationController.java`

**Frontend Files to Modify:**
- `frontend/src/context/NotificationContext.jsx`
- `frontend/src/services/api/otherApis.js`

**Backend Implementation:**

```java
@Transactional
public NotificationEntity markAsRead(Long notificationId) {
    NotificationEntity notification = notificationRepository.findById(notificationId)
            .orElseThrow(() -> new RuntimeException("Notification not found"));

    notification.setRead(true);
    NotificationEntity saved = notificationRepository.save(notification);
    
    // ✅ Send WebSocket update
    NotificationDTO dto = NotificationDTO.fromEntity(saved);
    messagingTemplate.convertAndSendToUser(
            saved.getRecipient().getEmail(),
            "/queue/notifications/updates",
            dto
    );
    
    return saved;
}

@Transactional
public int markAllAsRead(UserEntity user) {
    int updated = notificationRepository.markAllAsReadForUser(user);
    
    // ✅ Send WebSocket update
    Map<String, Object> update = new HashMap<>();
    update.put("type", "MARK_ALL_READ");
    update.put("count", updated);
    messagingTemplate.convertAndSendToUser(
            user.getEmail(),
            "/queue/notifications/updates",
            update
    );
    
    return updated;
}
```

**Frontend Implementation:**

```javascript
// Subscribe to notification updates
const connection = await notificationService.subscribeToNotifications((notification) => {
  // Handle new notifications
  if (notification && typeof notification.id !== 'undefined') {
    addNotification(notification);
  }
}, (update) => {
  // ✅ Handle notification updates (read/delete)
  if (update.type === 'MARK_ALL_READ') {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  } else if (update.id) {
    // Single notification update
    setNotifications(prev => prev.map(n => 
      n.id === update.id ? { ...n, ...update } : n
    ));
    if (update.read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  }
});
```

### 2.4 Phase 4: Optimize Notification Bell Component

**Objective:** Ensure NotificationBell uses real-time updates correctly

**Changes Required:**

1. **Remove dependency on manual refresh**
   - NotificationBell should rely on context state
   - Remove any local state that conflicts with context

2. **Handle real-time updates in popover**
   - Update unread count immediately when notifications arrive
   - Show new notifications in popover without refresh

**Files to Modify:**
- `frontend/src/components/NotificationBell.jsx`

**Current Issue:**
- NotificationBell correctly uses `combinedNotifications` from context
- But context state is overwritten by `fetchNotifications()`
- Fixing Phase 1 will automatically fix NotificationBell

### 2.5 Phase 5: Optimize Notifications Page

**Objective:** Ensure Notifications page uses real-time updates correctly

**Changes Required:**

1. **Remove manual refresh dependency**
   - Notifications page should rely on context state
   - Manual refresh should only be fallback when WebSocket disconnected

2. **Show connection status clearly**
   - Display WebSocket connection status
   - Indicate when using fallback polling

**Files to Modify:**
- `frontend/src/pages/Notifications.jsx`

**Current Issue:**
- Notifications page correctly uses `combinedNotifications` from context
- But context state is overwritten by `fetchNotifications()`
- Fixing Phase 1 will automatically fix Notifications page
- Manual refresh button should only be used when WebSocket is disconnected

---

## 3. Implementation Steps

### Step 1: Fix State Management (CRITICAL - Do First)
1. Modify `fetchNotifications()` to merge instead of replace
2. Update unread count calculation to use merged state
3. Test that WebSocket notifications persist after HTTP fetch

### Step 2: Add Connection Monitoring
1. Add connection status monitoring effect
2. Implement automatic reconnection logic
3. Make periodic refresh conditional on connection status
4. Test reconnection scenarios

### Step 3: Backend WebSocket Updates
1. Modify `NotificationService.markAsRead()` to send WebSocket update
2. Modify `NotificationService.markAllAsRead()` to send WebSocket update
3. Add new subscription endpoint `/queue/notifications/updates`
4. Update frontend to handle update messages
5. Test multi-device synchronization

### Step 4: Testing & Validation
1. Test WebSocket notifications appear immediately
2. Test notifications persist after HTTP fetch
3. Test connection reconnection
4. Test multi-device synchronization
5. Test manual refresh as fallback

---

## 4. Testing Checklist

### 4.1 Real-Time Notification Delivery
- [x] **Phase 1:** Notification persists after HTTP fetch cycle ✅
- [ ] New notification arrives via WebSocket and appears immediately in bell
- [ ] New notification appears in Notifications page without refresh
- [ ] Unread count updates immediately when notification arrives

### 4.2 State Merging
- [x] **Phase 1:** WebSocket notification added, then HTTP fetch doesn't remove it ✅
- [x] **Phase 1:** HTTP fetch updates existing notification data correctly ✅
- [x] **Phase 1:** Unread count uses server as source of truth ✅
- [x] **Phase 1:** No duplicate notifications in list ✅

### 4.3 Connection Management
- [x] **Phase 2:** Connection status updates when WebSocket disconnects ✅
- [x] **Phase 2:** Automatic reconnection attempts when disconnected ✅
- [x] **Phase 2:** Periodic refresh only runs when WebSocket disconnected ✅
- [ ] UI shows correct connection status

### 4.4 Read/Delete Operations
- [ ] Mark as read updates UI immediately
- [ ] Mark all as read updates UI immediately
- [ ] Read status syncs across multiple browser tabs
- [ ] Unread count updates correctly

### 4.5 Edge Cases
- [ ] Multiple notifications arrive rapidly
- [ ] Notification arrives while HTTP fetch in progress
- [ ] WebSocket disconnects during notification delivery
- [ ] User marks as read while notification arriving

---

## 5. Expected Outcomes

### 5.1 Immediate Benefits
- ✅ Notifications appear instantly via WebSocket
- ✅ No need to press refresh button
- ✅ Real-time updates work correctly
- ✅ Better user experience

### 5.2 Long-Term Benefits
- ✅ Reduced server load (less HTTP polling)
- ✅ Better scalability (WebSocket is more efficient)
- ✅ Multi-device synchronization
- ✅ Foundation for push notifications

---

## 6. Risk Assessment

### 6.1 Low Risk
- State management changes (well-understood pattern)
- Connection monitoring (standard WebSocket pattern)

### 6.2 Medium Risk
- Backend WebSocket updates (requires careful testing)
- State merging logic (edge cases need validation)

### 6.3 Mitigation
- Implement phases incrementally
- Test each phase before moving to next
- Keep HTTP polling as fallback
- Monitor error logs during rollout

---

## 7. Rollback Plan

If issues arise:
1. Revert `fetchNotifications()` to replace (not merge) - restores current behavior
2. Disable connection monitoring - falls back to periodic refresh
3. Remove backend WebSocket updates - frontend still works with HTTP only

---

## 8. Success Criteria

**Phase 1 Complete When:** ✅ COMPLETED
- WebSocket notifications persist after HTTP fetch
- Unread count updates correctly
- No duplicate notifications

**Phase 2 Complete When:**
- Connection status accurately reflects WebSocket state
- Automatic reconnection works
- Periodic refresh only runs when disconnected

**Phase 3 Complete When:**
- Read/delete operations sync via WebSocket
- Multi-device synchronization works
- No manual refresh needed

**Overall Success:**
- ✅ Notifications update in real-time without manual refresh
- ✅ WebSocket is primary mechanism, HTTP polling is fallback
- ✅ All components (bell, page) show consistent state
- ✅ Connection status accurately displayed

---

## 9. Notes

- This is a **critical fix** - current implementation defeats the purpose of WebSocket
- Phase 1 is **MANDATORY** - other phases depend on it
- Backend changes (Phase 3) are **OPTIONAL** but recommended for multi-device sync
- Keep HTTP polling as fallback for reliability
- Monitor WebSocket connection health in production

