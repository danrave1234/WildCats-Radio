# Broadcast History Feature

## Overview
The Broadcast History feature provides a dedicated view for tracking all broadcast-related events and activities. It filters notifications to show only broadcast-specific events such as scheduled broadcasts, started broadcasts, ended broadcasts, etc.

**🔒 Access Restriction: This feature is only available to DJs and Administrators.**

## Features

### Frontend Components

#### 1. BroadcastHistoryContext (`frontend/src/context/BroadcastHistoryContext.jsx`)
- Manages broadcast history state and API calls
- Filters notifications to only show broadcast-related types:
  - `BROADCAST_SCHEDULED`
  - `BROADCAST_STARTING_SOON`
  - `BROADCAST_STARTED`
  - `BROADCAST_ENDED`
  - `NEW_BROADCAST_POSTED`
- Provides functions for fetching history by time period and type
- Calculates broadcast statistics

#### 2. BroadcastHistory Page (`frontend/src/pages/BroadcastHistory.jsx`)
- Main page component for viewing broadcast history
- **Role-restricted access**: Only DJs and Admins can view this page
- Features include:
  - Search functionality
  - Filter by broadcast type
  - Time-based filtering (today, week, month, all time)
  - Statistics dashboard showing total, scheduled, started, ended, and recent activity
  - Responsive design with dark mode support
  - Security check with access restriction message for unauthorized users

#### 3. Navigation Integration
- Added "Broadcast History" link to the sidebar (`frontend/src/components/Sidebar.jsx`)
- **Conditionally rendered**: Only visible to DJs and Admins
- Integrated route in the main App component (`frontend/src/App.jsx`)
- **Protected route**: Only accessible by DJ and ADMIN roles

### Backend Integration
The feature leverages the existing notification system rather than creating duplicate functionality:
- Uses existing `NotificationController` endpoints
- Filters notifications on the frontend to show only broadcast-related types
- No additional backend components needed

## Access Control

### Role-Based Restrictions
The feature implements multiple layers of security:

1. **Sidebar Navigation**: The "Broadcast History" link only appears for users with DJ or ADMIN roles
2. **Route Protection**: The route is protected with `allowedRoles={['DJ', 'ADMIN']}`
3. **Component-Level Check**: The BroadcastHistory component itself checks user roles and displays an access restriction message for unauthorized users

### Unauthorized Access
If a user without proper permissions attempts to access the broadcast history:
- They won't see the navigation link in the sidebar
- Direct URL access will be blocked by the protected route
- If they somehow bypass the route protection, they'll see an "Access Restricted" message

## Usage

### Accessing Broadcast History (DJ/Admin Only)
1. Log in as a DJ or Administrator
2. Navigate to the sidebar and click "Broadcast History"
3. The page will load all broadcast-related notifications
4. Use the search bar to find specific broadcasts
5. Filter by type or time period using the dropdown menus

### Statistics
The statistics cards show:
- **Total**: Total number of broadcast events
- **Scheduled**: Number of scheduled broadcasts
- **Started**: Number of started broadcasts
- **Ended**: Number of ended broadcasts
- **Recent**: Activity in the last 30 days

### Filtering Options
- **Search**: Search by message content or broadcast type
- **Time Filter**: Show broadcasts from today, this week, this month, or all time
- **Type Filter**: Filter by specific broadcast event types
- **Sort**: Sort by newest or oldest first

## Technical Implementation

### Data Flow
1. Frontend context fetches all notifications via `notificationService.getAll()`
2. Filters results to only include broadcast-related notification types
3. Sorts and displays the filtered results
4. Calculates statistics from the filtered data

### API Endpoints Used
- `GET /api/notifications` - Get all notifications
- `GET /api/notifications/recent?since={date}` - Get recent notifications
- `GET /api/notifications/by-type/{type}` - Get notifications by type

### Styling
- Uses Tailwind CSS for styling
- Supports both light and dark themes
- Responsive design for mobile and desktop
- Consistent with the existing application design system

## Future Enhancements
- Real-time updates via WebSocket integration
- Export functionality for broadcast history
- More detailed analytics and charts
- Broadcast duration tracking
- Integration with actual broadcast scheduling system 