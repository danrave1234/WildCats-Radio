# Analytics Dashboard Feature

## Overview
The Analytics Dashboard provides a comprehensive view of the radio platform's key metrics and performance indicators. This feature is exclusively available to DJs and Administrators, offering valuable insights into user activity, broadcast performance, and engagement metrics.

**🔒 Access Restriction: This feature is only available to DJs and Administrators.**

## Features

### 1. Summary Cards
Four key metrics cards showing:
- **Users**: Total users with breakdown by role (Listeners, DJs, Admins)
- **Broadcasts**: Total broadcasts with live, scheduled, and completed counts
- **Engagement**: Total chat messages and song requests with averages per broadcast
- **Activity**: Recent activity metrics by different time periods (today, week, month)

### 2. Popular Broadcasts
- Ranked list of the top 5 most popular broadcasts
- Shows title, DJ name, listener count, and status for each broadcast
- Color-coded status indicators (live, scheduled, completed)

### 3. Recent Activity Log
- Chronological list of recent platform activities
- Filterable by timeframe (today, week, month)
- Activity types include broadcast starts/ends and user logins
- Icons to quickly identify activity types

### 4. Admin-Only Metrics
Additional section exclusively for administrators showing:
- System health metrics
- Response time statistics
- Error rates
- Peak traffic information

## Technical Implementation

### Components

#### 1. AnalyticsContext (`frontend/src/context/AnalyticsContext.jsx`)
- Manages analytics data state
- Fetches data from various API endpoints
- Processes and aggregates metrics
- Automatically refreshes data every 5 minutes

#### 2. AnalyticsDashboard Page (`frontend/src/pages/AnalyticsDashboard.jsx`)
- Main dashboard UI component
- **Role-restricted access**: Only DJs and Admins can view
- Responsive design with appropriate layouts for all devices
- Dark mode support
- Conditional rendering of admin-specific sections

### Data Sources
The dashboard aggregates data from multiple sources:
- User data via `authService`
- Broadcast information via `broadcastService`
- Activity logs via `activityLogService`
- Engagement metrics from chat and song requests

### Security
Multiple layers of security ensure that only authorized users can access:
1. **Sidebar Navigation**: The "Analytics" link only appears for users with DJ or ADMIN roles
2. **Route Protection**: The route is protected with `allowedRoles={['DJ', 'ADMIN']}`
3. **Component-Level Check**: The component itself verifies user roles

## Usage

### Accessing Analytics (DJ/Admin Only)
1. Log in as a DJ or Administrator
2. Click the "Analytics" link in the sidebar
3. View the dashboard metrics
4. Use the "Refresh Data" button to manually update metrics
5. Filter activity logs using the timeframe dropdown

### Admin-Specific Features
Administrators will see an additional section with system performance metrics:
- System health percentage
- Average response time
- Error rates
- Peak traffic statistics

## Benefits
- **Data-driven decisions**: Use metrics to improve broadcast scheduling and content
- **Performance tracking**: Monitor engagement and growth over time
- **System health monitoring**: For administrators to ensure platform stability
- **User insights**: Understand audience behavior and preferences 