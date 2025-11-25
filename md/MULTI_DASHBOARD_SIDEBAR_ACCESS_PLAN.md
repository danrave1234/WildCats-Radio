# Multi-Dashboard Sidebar Access Implementation Plan
## Role-Based Dashboard Navigation System

**Date:** January 2025  
**Status:** 🚧 **IN PROGRESS**  
**Priority:** HIGH (Simplified UX & Organizational Efficiency)

---

## Executive Summary

Implement sidebar-based navigation that allows users to access multiple dashboards based on their role hierarchy. Higher-level roles can access lower-level dashboards through sidebar navigation, eliminating the need for complex role switching while maintaining all security restrictions.

**Key Benefits:**
- ✅ Simple sidebar navigation - no complex role switching
- ✅ Clear role hierarchy - base role determines accessible dashboards
- ✅ No database changes required - uses existing `role` column
- ✅ Maintains all critical broadcast restrictions
- ✅ Better UX - similar to AWS, Google Cloud, GitHub patterns

**Role Hierarchy:**
```
ADMIN → Admin Dashboard only
MODERATOR → Moderator + DJ + Listener Dashboards
DJ → DJ + Listener Dashboards  
LISTENER → Listener Dashboard only
```

---

## ⚠️ CRITICAL RESTRICTIONS

These restrictions **MUST** be maintained and enforced:

1. **🚫 Active DJ Logout Restriction**: Active DJs cannot logout until handover completes (or broadcast ends).
2. **👁️ Dashboard Control Restrictions**: Only active DJ sees full controls; others see read-only view.
3. **🔄 Handover Releases Restrictions**: After handover, original DJ can navigate freely.
4. **🔒 Broadcast State Validation**: All navigation checks broadcast state.
5. **📱 Multi-Session Control**: Only the *specific device* that started the broadcast (or performed handover) has streaming controls. Other sessions for the same DJ allow chat/management but lock streaming controls.

---

## Dashboard Access Matrix

| Base Role | Accessible Dashboards | Sidebar Items |
|-----------|---------------------|---------------|
| **ADMIN** | `/admin` | Admin Dashboard |
| **MODERATOR** | `/moderator`, `/dj`, `/` | Moderator Dashboard<br>DJ Dashboard<br>Listener Dashboard |
| **DJ** | `/dj`, `/` | DJ Dashboard<br>Listener Dashboard |
| **LISTENER** | `/` | Listener Dashboard |

---

## Implementation Plan

### Phase 1: Frontend Sidebar Navigation Component

**File:** `frontend/src/components/SidebarNavigation.jsx` (NEW)

**Requirements:**
- Display accessible dashboards based on user's base role.
- **Updated:** Allow active DJs to navigate to other dashboards (e.g., Listener view to check audio).
- **Updated:** Show visual indicator (Lock icon) for restricted actions, not blocking navigation.

**Implementation:**
```javascript
const SidebarNavigation = () => {
  // ... standard setup ...
  
  return (
    <nav className="sidebar-navigation">
      {dashboards.map(dashboard => {
        // Navigation is NO LONGER blocked for active DJs
        // They can visit other pages, but critical actions there might be restricted
        
        return (
          <SidebarItem
            key={dashboard.path}
            path={dashboard.path}
            label={dashboard.label}
            icon={dashboard.icon}
            isActive={isActive}
          />
        );
      })}
    </nav>
  );
};
```

---

### Phase 2: Dashboard Access Control

**Files to Update:**
- `frontend/src/pages/DJDashboard.jsx`
- `frontend/src/components/DJControls.jsx` (hypothetical or inline)

**DJ Dashboard Access Control:**
```javascript
const DJDashboard = () => {
  const { currentUser } = useAuth();
  const { activeBroadcast, isBroadcastingDevice } = useBroadcast(); // New flag from context
  
  const isActiveDJ = activeBroadcast?.status === 'LIVE' && 
                     activeBroadcast?.currentActiveDJ?.id === currentUser?.id;
  
  // Scenario 1: User is NOT the active DJ -> Read-Only View
  if (activeBroadcast?.status === 'LIVE' && !isActiveDJ) {
    return <ReadOnlyView ... />;
  }
  
  // Scenario 2: User IS the active DJ, but on a different device -> Restricted Controls
  if (isActiveDJ && !isBroadcastingDevice) {
    return (
      <div className="dj-dashboard">
        <RestrictedBanner message="You are broadcasting from another device. Streaming controls are disabled here." />
        <ChatPanel />
        <PollPanel />
        <RequestPanel />
        {/* Streaming controls hidden or locked */}
      </div>
    );
  }
  
  // Scenario 3: Active DJ on Broadcasting Device -> Full Controls
  return <DJControls isActiveDJ={isActiveDJ} />;
};
```

### Phase 3: Multi-Session & Handover Logic (Revised)

**Goal:** Allow global navigation but restrict *streaming* to one device.

**Strategy:**
1.  **Session Token:** When `startBroadcast` or `handoverLogin` succeeds, the backend returns a unique `activeSessionId`.
2.  **Local Flag:** The frontend stores this `activeSessionId` in `localStorage`.
3.  **Context Check:** `StreamingContext` compares `activeBroadcast.activeSessionId` (from WebSocket) with the local storage value.
4.  **Result:** `isBroadcastingDevice` is true ONLY if they match.

**Navigation UI Update:**
- **Visual Feedback:** Replace `window.alert()` with a subtle but clear visual cue.
- **Lock Animation:** When a restricted action is attempted (e.g., clicking "Stop Broadcast" on a remote device), the button should display a "Lock" icon that shakes or pulses to indicate it is disabled.
- **Toast Notification:** Optionally show a non-intrusive Toast message: "Streaming controls are locked on this device."
- **Logout Protection:** Use the same visual feedback for the logout button if the user is the active DJ.

---

---

### Phase 4: Logout Restriction Enhancement

**File:** `frontend/src/context/AuthContext.jsx`

**Update logout function:**
```javascript
const logout = async () => {
  try {
    // Check if user is active DJ before allowing logout
    const activeBroadcast = await broadcastService.getActiveBroadcast();
    
    if (activeBroadcast?.status === 'LIVE' && 
        activeBroadcast?.currentActiveDJ?.id === currentUser?.id) {
      throw new Error(
        'Cannot logout while actively broadcasting. Please hand over the broadcast first.'
      );
    }
    
    await authService.logout();
    setCurrentUser(null);
    navigate('/');
  } catch (err) {
    // Show Toast notification instead of throwing error to UI if handled here
    toast.error(err.message || 'Logout failed');
  }
};
```

**Backend:** `backend/src/main/java/com/wildcastradio/User/UserController.java`

**Update logout endpoint:**
```java
@PostMapping("/logout")
public ResponseEntity<?> logout(Authentication authentication, HttpServletResponse response) {
    if (authentication != null) {
        UserEntity user = userService.getUserByEmail(authentication.getName())
                .orElse(null);
        
        if (user != null) {
            // Check if user is active DJ of LIVE broadcast
            BroadcastEntity activeBroadcast = broadcastRepository
                .findByCurrentActiveDJAndStatus(user, BroadcastEntity.BroadcastStatus.LIVE)
                .orElse(null);
            
            if (activeBroadcast != null) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", 
                        "Cannot logout while actively broadcasting. Please hand over the broadcast first."));
            }
        }
    }
    
    // Clear cookie and proceed with logout
    ResponseCookie cookie = ResponseCookie.from("token", "")
            .httpOnly(true)
            .secure(useSecureCookies)
            .sameSite("Strict")
            .path("/")
            .maxAge(0)
            .build();
    
    return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, cookie.toString())
            .body(Map.of("success", true));
}
```

---

### Phase 5: Route Protection Updates

**File:** `frontend/src/App.jsx`

**Update routing:**
```javascript
// Allow access based on base role, not effective role
<Route path="/moderator" element={
  <ProtectedRoute allowedRoles={['MODERATOR', 'ADMIN']}>
    <ModeratorDashboard />
  </ProtectedRoute>
} />

<Route path="/dj" element={
  <ProtectedRoute allowedRoles={['DJ', 'MODERATOR', 'ADMIN']}>
    <DJDashboard />
  </ProtectedRoute>
} />

<Route path="/" element={<ListenerDashboard />} />
```

---

## Database Changes

**REQUIRED:**
- Add `active_session_id` column to the `broadcasts` table.

**SQL Snippet:**
```sql
ALTER TABLE IF EXISTS broadcasts
    ADD COLUMN IF NOT EXISTS active_session_id VARCHAR(255) NULL;

CREATE INDEX IF NOT EXISTS idx_broadcast_active_session_id ON broadcasts(active_session_id);
```


---

## Backend Changes

### Required Changes:

1. **Logout Endpoint Enhancement** (UserController.java)
   - Add active DJ check before allowing logout
   - Return 403 FORBIDDEN if user is active DJ

2. **Broadcast Repository Method** (BroadcastRepository.java)
   - Ensure `findByCurrentActiveDJAndStatus()` method exists
   - Used for logout validation

### No Changes Needed:
- ❌ No role switching endpoints
- ❌ No role context tracking
- ❌ No role switch history
- ❌ No role switching service

---

## Frontend Changes

### New Components:
1. **SidebarNavigation.jsx** - Main sidebar component with role-based menu
2. **SidebarItem.jsx** - Individual sidebar menu item with restriction handling
3. **ReadOnlyView.jsx** - Read-only dashboard view component

### Updated Components:
1. **AuthContext.jsx** - Enhanced logout with active DJ check
2. **DJDashboard.jsx** - Access control based on active DJ status
3. **ModeratorDashboard.jsx** - No changes needed (always accessible)
4. **ListenerDashboard.jsx** - No changes needed (always accessible)
5. **App.jsx** - Route protection based on base role
6. **Header.jsx** - Integrate SidebarNavigation component

---

## Security & Validation

### Frontend Validation:
- ✅ Sidebar navigation checks active DJ status
- ✅ Dashboard components validate active DJ before showing controls
- ✅ Logout function checks active broadcast before allowing logout
- ✅ Visual indicators show restrictions in sidebar

### Backend Validation:
- ✅ Logout endpoint validates active DJ status
- ✅ Broadcast control endpoints validate active DJ (existing)
- ✅ Route protection based on base role (existing)

---

## UX Considerations

### Visual Indicators:
- **Active Dashboard**: Highlighted in sidebar
- **Restricted Items**: Disabled/grayed out with tooltip explanation
- **Read-Only View**: Clear message when another DJ is broadcasting
- **Current Role Badge**: Show base role in header

### User Flow Examples:

**Moderator Workflow:**
1. Logs in → Sees Moderator Dashboard
2. Clicks "DJ Dashboard" in sidebar → Navigates to DJ Dashboard
3. Can start broadcast → Becomes active DJ
4. Sidebar shows "DJ Dashboard" as active, other items restricted
5. Hands over broadcast → Restrictions released
6. Can navigate to Listener Dashboard freely

**DJ Workflow:**
1. Logs in → Sees DJ Dashboard
2. Starts broadcast → Becomes active DJ
3. Sidebar shows "Listener Dashboard" as disabled
4. Cannot logout or navigate away
5. Hands over broadcast → Restrictions released
6. Can navigate to Listener Dashboard

---

## Handover & Multi-Session Handling

### 1. Seamless Transition Logic
**Issue:** When a physical handover occurs, the dashboard must transition from "Read-Only" to "Active Controls" immediately for the new DJ.
**Resolution:** 
- The `DJHandoverModal` triggers an account switch via `handoverLogin`.
- `AuthContext` updates `currentUser`.
- `StreamingContext` must listen for `CURRENT_DJ_UPDATE` WebSocket events to update `activeBroadcast.currentActiveDJ`.
- **Critical:** The `isActiveDJ` check in `DJDashboard` must react to these changes instantly to unmount `ReadOnlyView` and mount `DJControls`.

### 2. Remote Session Restrictions (Edge Case)
**Scenario:** DJ2 is logged in on the Studio PC (performing the broadcast) AND on their personal phone/laptop.
**Risk:** Both devices become "Active DJ" after handover. The phone shows streaming controls (Stop/Mic) but has no audio pipeline attached.
**Restriction Strategy:**
- **Local Session Flag:** Implement a `isBroadcastingDevice` flag in `localStorage` or `StreamingContext`.
- **Studio PC:** When handover completes, the local session sets `isBroadcastingDevice = true`.
- **Remote Devices:** Do not have this flag.
- **UI Behavior:**
  - **Studio PC:** Shows full Audio/Streaming controls.
  - **Remote Devices:** Shows "Active DJ (Remote Mode)" - allows Chat/Poll/Request management but **disables** Audio/Streaming controls to prevent accidental interruption.

---

## Testing Scenarios

### Navigation Tests:
1. ✅ Moderator can access all three dashboards
2. ✅ DJ can access DJ and Listener dashboards
3. ✅ Listener can only access Listener dashboard
4. ✅ Active DJ cannot navigate to other dashboards
5. ✅ Active DJ cannot logout
6. ✅ After handover, navigation restrictions released

### Dashboard Access Tests:
1. ✅ Active DJ sees full controls on DJ dashboard
2. ✅ Non-active DJ sees read-only view on DJ dashboard
3. ✅ Moderator dashboard always accessible
4. ✅ Listener dashboard always accessible to all roles

### Edge Cases:
1. ✅ Page refresh maintains active DJ restrictions
2. ✅ Multiple DJs logged in - only active DJ sees controls
3. ✅ Broadcast ends - restrictions released automatically
4. ✅ Handover completes - original DJ restrictions released

---

## Implementation Checklist

### Phase 1: Sidebar Component
- [x] Create `SidebarNavigation.jsx` component (Implemented in `Sidebar.jsx`)
- [x] Create `SidebarItem.jsx` component (Used existing `ui/sidebar.jsx`)
- [x] Implement role-based dashboard list logic
- [x] Add active DJ restriction handling
- [x] Add visual indicators for restrictions

### Phase 2: Dashboard Updates
- [x] Update `DJDashboard.jsx` with access control
- [x] Create `ReadOnlyView.jsx` component
- [ ] Test active DJ vs non-active DJ views
- [ ] Update `ModeratorDashboard.jsx` (if needed)
- [ ] Update `ListenerDashboard.jsx` (if needed)

### Phase 3: Navigation Restrictions
- [x] Implement navigation blocking for active DJ
- [x] Add error messages for blocked navigation
- [ ] Test sidebar restriction logic

### Phase 4: Logout Enhancement
- [x] Update frontend logout function
- [x] Update backend logout endpoint
- [ ] Test logout blocking for active DJ
- [ ] Test logout after handover

### Phase 5: Integration
- [x] Integrate sidebar into main layout
- [x] Update route protection
- [ ] Test all navigation flows
- [ ] Verify all restrictions work correctly

### Phase 6: Handover & Multi-Session Backend Support
- [x] Add `activeSessionId` to BroadcastEntity and DTO
- [x] Update `handoverLogin` to generate session ID
- [x] Update `startBroadcast` to generate session ID
- [x] Include `activeSessionId` in WebSocket updates
- [x] Include `activeSessionId` in API responses

### Phase 7: Frontend Multi-Session Implementation
- [x] Update StreamingContext with activeSessionId state
- [x] Implement `isBroadcastingDevice` logic
- [x] Update DJDashboard controls to use `isBroadcastingDevice`
- [x] Replace alerts with Toast notifications
- [x] Update Sidebar to allow navigation for active DJs
- [x] Implement DJHandoverModal session ID capture
- [x] Reorganize Sidebar structure for DJs (consistent with Moderators)
- [x] Add visual lock indicator for restricted links in Sidebar
- [x] Move handover WebSocket logic to StreamingContext (Fix persistence issue)
- [x] Implement handover state synchronization in DJHandoverModal/StreamingContext (Fix overlay persistence)
- [x] Add retry mechanism for broadcast data fetch in DJHandoverModal
- [x] Refactor DJDashboard.jsx state management to use StreamingContext as single source of truth
- [x] Reorganize Sidebar structure for DJs (consistent with Moderators)
- [x] Add visual lock indicator for restricted links in Sidebar

---

## Success Metrics

- **Navigation Success Rate**: > 95% successful dashboard navigation
- **Restriction Compliance**: 100% active DJ restrictions enforced
- **User Satisfaction**: Clear understanding of accessible dashboards
- **Error Rate**: < 5% navigation errors
- **Performance**: Dashboard navigation completes in < 500ms

---

## Rollback Plan

If issues arise:
1. Remove `SidebarNavigation` component
2. Revert to single dashboard per role
3. Remove navigation restriction logic
4. Keep logout enhancement (security improvement)

---

**Document Version:** 1.0  
**Last Updated:** January 2025

