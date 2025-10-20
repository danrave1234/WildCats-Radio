import { useState, useEffect, useMemo } from 'react';
import { useAnalytics } from '../context/AnalyticsContext';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/ui/spinner';
import { EnhancedScrollArea } from '../components/ui/enhanced-scroll-area';
import { format, subDays, subWeeks, subMonths, subYears, startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay, endOfWeek, endOfMonth, endOfYear, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);
import {
  ChartBarIcon,
  UsersIcon,
  RadioIcon,
  ClockIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  CalendarIcon,
  ChatBubbleOvalLeftIcon,
  MusicalNoteIcon,
  ArrowTrendingUpIcon,
  FireIcon,
  CheckCircleIcon,
  ClockIcon as ClockIconOutline,
  PresentationChartBarIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline';

// Format a number to up to 3 decimal places, trimming unnecessary zeros
const formatDecimal = (value, maxFractionDigits = 3) => {
  const num = Number(value);
  if (!isFinite(num)) return '0';
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits
  });
};

// Helper to parse backend timestamp as local time (Philippines time)
const parseBackendTimestamp = (timestamp) => {
  if (!timestamp) return null;
  
  // If it already has timezone info (ends with Z or has timezone offset), parse as UTC
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(timestamp)) {
    return parseISO(timestamp);
  }
  
  // If no timezone info, treat as local time (Philippines time)
  // Parse the date string directly as local time
  return new Date(timestamp);
};

// Safe date formatting helper to prevent "Invalid time value" errors
const safeFormatInTimeZone = (timestamp, timezone, format) => {
  try {
    const parsedDate = parseBackendTimestamp(timestamp);
    if (!parsedDate || isNaN(parsedDate.getTime())) {
      return 'Invalid date';
    }
    return formatInTimeZone(parsedDate, timezone, format);
  } catch (error) {
    console.warn('Date formatting error:', error, 'for timestamp:', timestamp);
    return 'Invalid date';
  }
};

export default function AnalyticsDashboard() {
  const { currentUser } = useAuth();
  const { 
    userStats,
    broadcastStats,
    engagementStats,
    activityStats,
    demographicStats,
    mostPopularBroadcasts,
    loading,
    error,
    lastUpdated,
    refreshData,
    refreshDemographics,
    wsConnected
  } = useAnalytics();

  const [selectedTimeframe, setSelectedTimeframe] = useState('week');
  const [comparisonPeriod, setComparisonPeriod] = useState('yesterday');

  // Avoid triggering a second fetch from the page. Context owns initial load.
  useEffect(() => {
    // no-op: keep hook so we can depend on role changes if needed later
  }, [currentUser?.role]);

  // Filter activities by timeframe, similar to Notifications.jsx filtering approach
  const filteredActivities = useMemo(() => {
    if (!activityStats.recentActivities || activityStats.recentActivities.length === 0) {
      return [];
    }

    const now = new Date();
    let cutoffDate;

    switch (selectedTimeframe) {
      case 'today':
        cutoffDate = startOfDay(now);
        break;
      case 'week':
        cutoffDate = startOfWeek(now, { weekStartsOn: 1 }); // Monday start
        break;
      case 'month':
        cutoffDate = startOfMonth(now);
        break;
      case 'year':
        cutoffDate = startOfYear(now);
        break;
      default:
        cutoffDate = startOfWeek(now, { weekStartsOn: 1 });
    }

    return activityStats.recentActivities.filter(activity => {
      try {
        const activityDate = parseBackendTimestamp(activity.timestamp);
        return activityDate && activityDate >= cutoffDate;
      } catch (error) {
        console.warn('Error parsing activity timestamp:', error);
        return false;
      }
    });
  }, [activityStats.recentActivities, selectedTimeframe]);

  // Memoize chart data to prevent unnecessary re-renders
  const chartData = useMemo(() => {
    if (!filteredActivities.length) {
      return {
        labels: [],
        datasets: [{
          label: 'Activities',
          data: [],
          backgroundColor: 'rgba(145, 64, 62, 0.8)',
          borderColor: 'rgba(145, 64, 62, 1)',
          borderWidth: 1
        }]
      };
    }

    // Group activities by day
    const activitiesByDay = {};
    filteredActivities.forEach(activity => {
      try {
        const activityDate = parseBackendTimestamp(activity.timestamp);
        if (activityDate) {
          const dayKey = format(activityDate, 'yyyy-MM-dd');
          activitiesByDay[dayKey] = (activitiesByDay[dayKey] || 0) + 1;
        }
      } catch (error) {
        console.warn('Error processing activity for chart:', error);
      }
    });

    const labels = Object.keys(activitiesByDay).sort();
    const data = labels.map(day => activitiesByDay[day]);

    return {
      labels: labels.map(day => format(parseISO(day), 'MMM dd')),
      datasets: [{
        label: 'Activities',
        data: data,
        backgroundColor: 'rgba(145, 64, 62, 0.8)',
        borderColor: 'rgba(145, 64, 62, 1)',
        borderWidth: 1
      }]
    };
  }, [filteredActivities]);

  // Memoize comparison metrics
  const comparisonMetrics = useMemo(() => {
    if (!activityStats.recentActivities) return null;

    const now = new Date();

    // Define current and comparison periods with actual dates
    let currentPeriodStart, currentPeriodEnd, comparisonPeriodStart, comparisonPeriodEnd;

    switch (comparisonPeriod) {
      case 'yesterday':
        currentPeriodStart = startOfDay(now);
        currentPeriodEnd = endOfDay(now);
        comparisonPeriodStart = startOfDay(subDays(now, 1));
        comparisonPeriodEnd = endOfDay(subDays(now, 1));
        break;
      case 'lastWeek':
        currentPeriodStart = startOfWeek(now);
        currentPeriodEnd = endOfWeek(now);
        comparisonPeriodStart = startOfWeek(subWeeks(now, 1));
        comparisonPeriodEnd = endOfWeek(subWeeks(now, 1));
        break;
      case 'lastMonth':
        currentPeriodStart = startOfMonth(now);
        currentPeriodEnd = endOfMonth(now);
        comparisonPeriodStart = startOfMonth(subMonths(now, 1));
        comparisonPeriodEnd = endOfMonth(subMonths(now, 1));
        break;
      case 'lastYear':
        currentPeriodStart = startOfYear(now);
        currentPeriodEnd = endOfYear(now);
        comparisonPeriodStart = startOfYear(subYears(now, 1));
        comparisonPeriodEnd = endOfYear(subYears(now, 1));
        break;
      default:
        return null;
    }

    // Filter activities for comparison period to get actual historical data  
    const comparisonActivities = activityStats.recentActivities.filter(activity => {
      if (!activity.timestamp) return false;
      const activityDate = new Date(activity.timestamp);
      return activityDate >= comparisonPeriodStart && activityDate <= comparisonPeriodEnd;
    });

    // Calculate comparison metrics from actual historical activities
    const calculateComparisonMetrics = () => {
      // For a new database, we have no historical data, so return all zeros
      // Activity logs don't represent actual user/engagement counts from previous periods

      // Only count actual broadcast activities from historical data
      const broadcastActivities = comparisonActivities.filter(a => 
        a.type && (a.type.includes('BROADCAST') || a.message.toLowerCase().includes('broadcast'))
      ).length;

      // Only count actual chat message activities from historical data  
      const messageActivities = comparisonActivities.filter(a => 
        a.message && (a.message.toLowerCase().includes('message') || a.message.toLowerCase().includes('chat'))
      ).length;

      // Return only real historical activity data - no fake metrics
      return {
        messageInteractions: messageActivities, // Only actual chat activities
        songRequests: 0, // No historical song request data available in activity logs
        broadcastActivities: broadcastActivities, // Only actual broadcast activities
        userInteractions: 0, // No way to get historical total user counts from activity logs
        comparisonPeriodDate: format(comparisonPeriodStart, 'MMM d'),
        comparisonPeriodEndDate: format(comparisonPeriodEnd, 'MMM d')
      };
    };

    const comparisonMetrics = calculateComparisonMetrics();

    // Calculate percentage changes
    const calculateChange = (current, comparison) => {
      // If no historical data exists, don't show percentage change
      if (comparison === 0) return 0;
      return ((current - comparison) / comparison) * 100;
    };

    return {
      current: {
        messageInteractions: engagementStats.totalChatMessages || 0,
        songRequests: engagementStats.totalSongRequests || 0,
        broadcastActivities: broadcastStats.totalBroadcasts || 0,
        userInteractions: userStats.totalUsers || 0,
        currentPeriodDate: format(currentPeriodStart, 'MMM d'),
        currentPeriodEndDate: format(currentPeriodEnd, 'MMM d')
      },
      comparison: comparisonMetrics,
      changes: {
        messageInteractions: calculateChange(engagementStats.totalChatMessages || 0, comparisonMetrics.messageInteractions),
        songRequests: calculateChange(engagementStats.totalSongRequests || 0, comparisonMetrics.songRequests),
        broadcastActivities: calculateChange(broadcastStats.totalBroadcasts || 0, comparisonMetrics.broadcastActivities),
        userInteractions: calculateChange(userStats.totalUsers || 0, comparisonMetrics.userInteractions)
      }
    };
  }, [activityStats.recentActivities, engagementStats.totalChatMessages, engagementStats.totalSongRequests, broadcastStats.totalBroadcasts, userStats.totalUsers, comparisonPeriod]);

  // Security check: Allow DJs, Moderators, and Admins
  if (!currentUser || (currentUser.role !== 'DJ' && currentUser.role !== 'ADMIN' && currentUser.role !== 'MODERATOR')) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <ShieldExclamationIcon className="h-16 w-16 mx-auto text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Access Restricted</h3>
          <p className="text-gray-600 dark:text-gray-400">The Analytics Dashboard is available to DJs, Moderators, and Administrators.</p>
        </div>
      </div>
    );
  }

  // Function to render a number with a + sign if positive
  const formatDelta = (num) => {
    if (num > 0) return `+${num}`;
    return num;
  };

  // Format time duration; show minutes with at most one decimal place
  const formatDuration = (totalMinutes) => {
    if (totalMinutes == null || isNaN(Number(totalMinutes))) return '0m';
    const minutes = Number(totalMinutes);
    if (minutes < 60) return `${minutes.toFixed(1)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const minsRounded = Number(mins.toFixed(1));
    return `${hours}h ${minsRounded}m`;
  };

  // Format percentage change with color and icon
  const formatPercentageChange = (change) => {
    const isPositive = change > 0;
    const isNeutral = change === 0;

    if (isNeutral) {
      return {
        value: '0%',
        color: 'text-gray-500 dark:text-gray-400',
        icon: null
      };
    }

    return {
      value: `${isPositive ? '+' : ''}${change.toFixed(1)}%`,
      color: isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      icon: isPositive ? ArrowUpIcon : ArrowDownIcon
    };
  };

  // Get comparison period label
  const getComparisonLabel = () => {
    switch (comparisonPeriod) {
      case 'yesterday': return { current: 'Today', comparison: 'Yesterday' };
      case 'lastWeek': return { current: 'This Week', comparison: 'Last Week' };
      case 'lastMonth': return { current: 'This Month', comparison: 'Last Month' };
      case 'lastYear': return { current: 'This Year', comparison: 'Last Year' };
      default: return { current: 'Current', comparison: 'Previous' };
    }
  };

  // Show loading state only on initial load
  if (loading && !lastUpdated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="flex flex-col items-center gap-4">
            <Spinner variant="primary" size="lg" />
            <span className="text-maroon-700 dark:text-maroon-300 font-medium">Loading real analytics data from database...</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            Fetching user statistics, broadcasts, and engagement metrics
          </p>
        </div>
      </div>
    );
  }

  // Show error state only on initial load failure
  if (error && !lastUpdated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 mx-auto text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Error Loading Analytics</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={refreshData}
            className="px-4 py-2 bg-maroon-600 text-white rounded-lg hover:bg-maroon-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between">
            <div className="flex items-center mb-4 sm:mb-0">
              <div className="p-2 bg-maroon-100 dark:bg-maroon-900/30 rounded-lg">
                <ChartBarIcon className="h-8 w-8 text-maroon-600 dark:text-maroon-400" />
              </div>
              <div className="ml-3">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics Dashboard</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {lastUpdated ? (
                    <>
                      <span className="inline-flex items-center">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                        Data loads on page view • Last updated: {format(new Date(lastUpdated), 'MMM d, yyyy • h:mm a')}
                      </span>
                    </>
                  ) : 'Loading analytics…'}
                </p>
              </div>
            </div>
            {/* Optional manual refresh */}
            <div className="flex items-center space-x-3">
              <button
                onClick={refreshData}
                disabled={loading}
                className="flex items-center px-4 py-2 bg-maroon-600 text-white rounded-lg hover:bg-maroon-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium">
                  {loading ? 'Refreshing…' : 'Refresh'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Show error message on refresh failure but still show data */}
        {error && lastUpdated && (
          <div className="mb-6 p-4 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-lg">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Some data couldn't be updated</p>
                <p className="text-sm">{error}</p>
                <p className="text-sm mt-1">Showing the most recent available data.</p>
              </div>
            </div>
          </div>
        )}

        {/* Show info message for non-admin users */}
        {currentUser && currentUser.role !== 'ADMIN' && (
          <div className="mb-6 p-4 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="p-1 bg-blue-200 dark:bg-blue-800 rounded-full">
                  <UsersIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="ml-3">
                <p className="font-medium">Limited Analytics View</p>
                <p className="text-sm">As a {currentUser.role.toLowerCase()}, you can see broadcast and engagement data. Complete user statistics are available to administrators only.</p>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="space-y-8">
          {/* Summary Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Users Card - Admins and Moderators */}
            {(currentUser?.role === 'ADMIN' || currentUser?.role === 'MODERATOR') && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Users</p>
                    <div className="flex items-baseline mt-1">
                      <p className="text-3xl font-bold text-gray-900 dark:text-white">{userStats.totalUsers || demographicStats.totalUsers || 0}</p>
                      <p className={`ml-2 text-sm font-medium ${(userStats.newUsersThisMonth || 0) > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {formatDelta(userStats.newUsersThisMonth)} this month
                      </p>
                    </div>
                  </div>
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <UsersIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-3">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{userStats.listeners}</p>
                      <p className="text-gray-500 dark:text-gray-400">Listeners</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{userStats.djs}</p>
                      <p className="text-gray-500 dark:text-gray-400">DJs</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{userStats.admins}</p>
                      <p className="text-gray-500 dark:text-gray-400">Admins</p>
                    </div>
                    <div className="col-span-3 grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{userStats.moderators}</p>
                        <p className="text-gray-500 dark:text-gray-400">Moderators</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Broadcasting Summary Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Broadcasts</p>
                  <div className="flex items-baseline mt-1">
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{broadcastStats.totalBroadcasts}</p>
                    <p className="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                      {broadcastStats.liveBroadcasts > 0 ? `${broadcastStats.liveBroadcasts} live now` : 'None live'}
                    </p>
                  </div>
                </div>
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <RadioIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-3">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{broadcastStats.upcomingBroadcasts}</p>
                    <p className="text-gray-500 dark:text-gray-400">Scheduled</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{broadcastStats.completedBroadcasts}</p>
                    <p className="text-gray-500 dark:text-gray-400">Completed</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{formatDuration(broadcastStats.averageDuration)}</p>
                    <p className="text-gray-500 dark:text-gray-400">Avg Duration</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Engagement Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Engagement</p>
                  <div className="flex items-baseline mt-1">
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{engagementStats.totalChatMessages}</p>
                    <p className="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                      Chat Messages
                    </p>
                  </div>
                </div>
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <ChatBubbleOvalLeftIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-3">
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{engagementStats.totalSongRequests}</p>
                    <p className="text-gray-500 dark:text-gray-400">Song Requests</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{formatDecimal(engagementStats.averageMessagesPerBroadcast, 3)}</p>
                    <p className="text-gray-500 dark:text-gray-400">Messages/Broadcast</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Activity</p>
                  <div className="flex items-baseline mt-1">
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{activityStats.todayActivities}</p>
                    <p className="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                      Today
                    </p>
                  </div>
                </div>
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <ClockIcon className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-3">
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{activityStats.weekActivities}</p>
                    <p className="text-gray-500 dark:text-gray-400">This Week</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{activityStats.monthActivities}</p>
                    <p className="text-gray-500 dark:text-gray-400">This Month</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Engagement Comparison Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6">
              <div className="flex items-center mb-4 lg:mb-0">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                  <PresentationChartBarIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="ml-3">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Engagement Metrics Comparison</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Compare audience engagement across time periods
                  </p>
                </div>
              </div>

              {/* Compact Segmented Time Range Control */}
              <div className="flex flex-col items-end space-y-2">
                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 text-sm">
                  <button
                    onClick={() => { setComparisonPeriod('yesterday'); setSelectedTimeframe('today'); }}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all duration-200 ${
                      comparisonPeriod === 'yesterday'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400'
                    }`}
                  >
                    1D
                  </button>
                  <button
                    onClick={() => { setComparisonPeriod('lastWeek'); setSelectedTimeframe('week'); }}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all duration-200 ${
                      comparisonPeriod === 'lastWeek'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400'
                    }`}
                  >
                    7D
                  </button>
                  <button
                    onClick={() => { setComparisonPeriod('lastMonth'); setSelectedTimeframe('month'); }}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all duration-200 ${
                      comparisonPeriod === 'lastMonth'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400'
                    }`}
                  >
                    30D
                  </button>
                  <button
                    onClick={() => { setComparisonPeriod('lastYear'); setSelectedTimeframe('year'); }}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all duration-200 ${
                      comparisonPeriod === 'lastYear'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400'
                    }`}
                  >
                    1Y
                  </button>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {comparisonMetrics?.current?.currentPeriodDate} vs {comparisonMetrics?.comparison?.comparisonPeriodDate}
                </div>
              </div>
            </div>

            {comparisonMetrics ? (
              <div className="space-y-6">
                {/* Professional Chart.js Implementation */}
                <div className="bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-600/50 rounded-2xl overflow-hidden shadow-xl">
                  <div className="p-6 lg:p-8">
                    {/* Chart Container */}
                    <div className="relative h-96 lg:h-[450px]">
                      <Bar
                        data={{
                          labels: ['Chat Messages', 'Song Requests', 'Broadcasts', 'Total Users'],
                          datasets: [
                            {
                              label: getComparisonLabel().current,
                              data: [
                                comparisonMetrics.current.messageInteractions,
                                comparisonMetrics.current.songRequests,
                                comparisonMetrics.current.broadcastActivities,
                                comparisonMetrics.current.userInteractions
                              ],
                              backgroundColor: [
                                'rgba(16, 185, 129, 0.8)', // Emerald
                                'rgba(139, 92, 246, 0.8)', // Purple
                                'rgba(59, 130, 246, 0.8)', // Blue
                                'rgba(245, 158, 11, 0.8)'  // Amber
                              ],
                              borderColor: [
                                'rgb(16, 185, 129)', // Emerald
                                'rgb(139, 92, 246)', // Purple
                                'rgb(59, 130, 246)', // Blue
                                'rgb(245, 158, 11)'  // Amber
                              ],
                              borderWidth: 2,
                              borderRadius: 8,
                              borderSkipped: false,
                            },
                            {
                              label: getComparisonLabel().comparison,
                              data: [
                                comparisonMetrics.comparison.messageInteractions,
                                comparisonMetrics.comparison.songRequests,
                                comparisonMetrics.comparison.broadcastActivities,
                                comparisonMetrics.comparison.userInteractions
                              ],
                              backgroundColor: [
                                'rgba(16, 185, 129, 0.4)', // Emerald (lighter)
                                'rgba(139, 92, 246, 0.4)', // Purple (lighter)
                                'rgba(59, 130, 246, 0.4)', // Blue (lighter)
                                'rgba(245, 158, 11, 0.4)'  // Amber (lighter)
                              ],
                              borderColor: [
                                'rgb(16, 185, 129)', // Emerald
                                'rgb(139, 92, 246)', // Purple
                                'rgb(59, 130, 246)', // Blue
                                'rgb(245, 158, 11)'  // Amber
                              ],
                              borderWidth: 1,
                              borderRadius: 8,
                              borderSkipped: false,
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          interaction: {
                            mode: 'index',
                            intersect: false,
                          },
                          scales: {
                            x: {
                              border: {
                                color: 'rgba(156, 163, 175, 0.3)',
                              },
                              grid: {
                                display: false,
                              },
                              ticks: {
                                color: 'rgb(156, 163, 175)',
                                font: {
                                  size: 12,
                                  weight: '500',
                                },
                                maxRotation: 0,
                                padding: 12,
                              },
                            },
                            y: {
                              border: {
                                color: 'rgba(156, 163, 175, 0.3)',
                              },
                              grid: {
                                color: 'rgba(156, 163, 175, 0.1)',
                                drawBorder: false,
                              },
                              ticks: {
                                color: 'rgb(156, 163, 175)',
                                font: {
                                  size: 11,
                                },
                                padding: 12,
                                callback: function(value) {
                                  if (value >= 1000) {
                                    return (value / 1000) + 'k';
                                  }
                                  return value;
                                }
                              },
                              beginAtZero: true,
                            }
                          },
                          plugins: {
                            legend: {
                              display: true,
                              position: 'top',
                              align: 'center',
                              labels: {
                                color: 'rgb(209, 213, 219)',
                                font: {
                                  size: 13,
                                  weight: '500',
                                },
                                padding: 20,
                                usePointStyle: true,
                                pointStyle: 'rect',
                                boxWidth: 12,
                                boxHeight: 12,
                              }
                            },
                            tooltip: {
                              backgroundColor: 'rgba(17, 24, 39, 0.95)',
                              titleColor: 'rgb(243, 244, 246)',
                              bodyColor: 'rgb(209, 213, 219)',
                              borderColor: 'rgba(75, 85, 99, 0.5)',
                              borderWidth: 1,
                              cornerRadius: 12,
                              padding: 12,
                              titleFont: {
                                size: 14,
                                weight: '600',
                              },
                              bodyFont: {
                                size: 13,
                                weight: '500',
                              },
                              displayColors: true,
                              callbacks: {
                                title: function(context) {
                                  return context[0].label;
                                },
                                label: function(context) {
                                  const datasetLabel = context.dataset.label;
                                  const value = context.formattedValue;
                                  const metricType = context.label;

                                  // Get percentage change for this metric
                                  let change = 0;
                                  if (metricType === 'Chat Messages') {
                                    change = comparisonMetrics.changes.messageInteractions;
                                  } else if (metricType === 'Song Requests') {
                                    change = comparisonMetrics.changes.songRequests;
                                  } else if (metricType === 'Broadcasts') {
                                    change = comparisonMetrics.changes.broadcastActivities;
                                  } else if (metricType === 'Total Users') {
                                    change = comparisonMetrics.changes.userInteractions;
                                  }

                                  const changeText = change !== 0 ? ` (${change > 0 ? '+' : ''}${change.toFixed(1)}%)` : '';
                                  return `${datasetLabel}: ${value}${context.datasetIndex === 0 ? changeText : ''}`;
                                },
                                afterBody: function(context) {
                                  if (context.length > 0) {
                                    const metricType = context[0].label;
                                    return `\n📊 ${metricType} comparison`;
                                  }
                                  return '';
                                }
                              }
                            }
                          },
                          layout: {
                            padding: {
                              top: 20,
                              bottom: 20,
                              left: 10,
                              right: 10,
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Enhanced Percentage Change Summary */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      label: 'Chat Messages',
                      change: comparisonMetrics.changes.messageInteractions,
                      current: comparisonMetrics.current.messageInteractions,
                      previous: comparisonMetrics.comparison.messageInteractions,
                      color: 'emerald',
                      icon: ChatBubbleOvalLeftIcon
                    },
                    {
                      label: 'Song Requests',
                      change: comparisonMetrics.changes.songRequests,
                      current: comparisonMetrics.current.songRequests,
                      previous: comparisonMetrics.comparison.songRequests,
                      color: 'purple',
                      icon: MusicalNoteIcon
                    },
                    {
                      label: 'Broadcasts',
                      change: comparisonMetrics.changes.broadcastActivities,
                      current: comparisonMetrics.current.broadcastActivities,
                      previous: comparisonMetrics.comparison.broadcastActivities,
                      color: 'blue',
                      icon: RadioIcon
                    },
                    {
                      label: 'Total Users',
                      change: comparisonMetrics.changes.userInteractions,
                      current: comparisonMetrics.current.userInteractions,
                      previous: comparisonMetrics.comparison.userInteractions,
                      color: 'amber',
                      icon: UsersIcon
                    }
                  ].map((metric, index) => {
                    const change = formatPercentageChange(metric.change);
                    const IconComponent = metric.icon;
                    const ChangeIcon = change.icon;

                    return (
                      <div key={index} className="bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-gray-600/50 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-all duration-200">
                                                 <div className="flex items-center justify-between mb-3">
                           <div className={
                             metric.color === 'emerald' ? 'p-2 bg-emerald-500/20 rounded-lg' :
                             metric.color === 'purple' ? 'p-2 bg-purple-500/20 rounded-lg' :
                             metric.color === 'blue' ? 'p-2 bg-blue-500/20 rounded-lg' :
                             'p-2 bg-amber-500/20 rounded-lg'
                           }>
                             <IconComponent className={
                               metric.color === 'emerald' ? 'h-4 w-4 text-emerald-400' :
                               metric.color === 'purple' ? 'h-4 w-4 text-purple-400' :
                               metric.color === 'blue' ? 'h-4 w-4 text-blue-400' :
                               'h-4 w-4 text-amber-400'
                             } />
                           </div>
                          {ChangeIcon && (
                            <div className={`flex items-center space-x-1 ${change.color}`}>
                              <ChangeIcon className="h-3 w-3" />
                              <span className="text-xs font-semibold">{change.value}</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-500">{metric.label}</p>
                          <div className="flex items-baseline space-x-2">
                            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{metric.current}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">vs {metric.previous}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Detailed Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Broadcast Activities */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg mr-3">
                          <RadioIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">Broadcast Activities</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Streaming & scheduling</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                          {comparisonMetrics.current.broadcastActivities}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">vs {comparisonMetrics.comparison.broadcastActivities}</p>
                      </div>

                      {(() => {
                        const change = formatPercentageChange(comparisonMetrics.changes.broadcastActivities);
                        const IconComponent = change.icon;
                        return (
                          <div className={`flex items-center ${change.color}`}>
                            {IconComponent && <IconComponent className="h-4 w-4 mr-1" />}
                            <span className="text-sm font-medium">{change.value}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* User Interactions */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg mr-3">
                          <UsersIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">User Interactions</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Registrations & logins</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                          {comparisonMetrics.current.userInteractions}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">vs {comparisonMetrics.comparison.userInteractions}</p>
                      </div>

                      {(() => {
                        const change = formatPercentageChange(comparisonMetrics.changes.userInteractions);
                        const IconComponent = change.icon;
                        return (
                          <div className={`flex items-center ${change.color}`}>
                            {IconComponent && <IconComponent className="h-4 w-4 mr-1" />}
                            <span className="text-sm font-medium">{change.value}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Message Interactions */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg mr-3">
                          <ChatBubbleOvalLeftIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">Message Interactions</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Chat & communication</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                          {comparisonMetrics.current.messageInteractions}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">vs {comparisonMetrics.comparison.messageInteractions}</p>
                      </div>

                      {(() => {
                        const change = formatPercentageChange(comparisonMetrics.changes.messageInteractions);
                        const IconComponent = change.icon;
                        return (
                          <div className={`flex items-center ${change.color}`}>
                            {IconComponent && <IconComponent className="h-4 w-4 mr-1" />}
                            <span className="text-sm font-medium">{change.value}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Insights */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="p-1 bg-blue-100 dark:bg-blue-900/50 rounded-lg mr-3">
                      <ChartBarIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                        Engagement Analysis ({comparisonMetrics.current.currentPeriodDate} vs {comparisonMetrics.comparison.comparisonPeriodDate})
                      </h4>
                      <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                        <p>
                          <strong>Chat Messages:</strong> {comparisonMetrics.current.messageInteractions} 
                          {comparisonMetrics.changes.messageInteractions !== 0 && (
                            <span className={comparisonMetrics.changes.messageInteractions > 0 ? 'text-green-600' : 'text-red-600'}>
                              {' '}({formatPercentageChange(comparisonMetrics.changes.messageInteractions).value})
                            </span>
                          )}
                        </p>

                        <p>
                          <strong>Song Requests:</strong> {comparisonMetrics.current.songRequests} 
                          {comparisonMetrics.changes.songRequests !== 0 && (
                            <span className={comparisonMetrics.changes.songRequests > 0 ? 'text-green-600' : 'text-red-600'}>
                              {' '}({formatPercentageChange(comparisonMetrics.changes.songRequests).value})
                            </span>
                          )}
                        </p>

                        <p>
                          <strong>Broadcasts:</strong> {comparisonMetrics.current.broadcastActivities} 
                          {comparisonMetrics.changes.broadcastActivities !== 0 && (
                            <span className={comparisonMetrics.changes.broadcastActivities > 0 ? 'text-green-600' : 'text-red-600'}>
                              {' '}({formatPercentageChange(comparisonMetrics.changes.broadcastActivities).value})
                            </span>
                          )}
                        </p>

                        <p>
                          <strong>Total Users:</strong> {comparisonMetrics.current.userInteractions}
                          {comparisonMetrics.changes.userInteractions !== 0 && (
                            <span className={comparisonMetrics.changes.userInteractions > 0 ? 'text-green-600' : 'text-red-600'}>
                              {' '}({formatPercentageChange(comparisonMetrics.changes.userInteractions).value})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <PresentationChartBarIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Historical Data</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Comparison charts will appear once there's historical activity data.
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Current period data is shown in the summary cards above.
                </p>
              </div>
            )}
          </div>

          {/* Demographics */}
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 mb-8 overflow-hidden relative">
            {/* Decorative background pattern */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/10 dark:to-purple-900/10 rounded-full blur-3xl opacity-30 -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-blue-100 to-cyan-100 dark:from-blue-900/10 dark:to-cyan-900/10 rounded-full blur-3xl opacity-30 translate-y-1/2 -translate-x-1/2"></div>
            
            {/* Header */}
            <div className="relative z-10 mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg">
                    <UsersIcon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Demographics</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Audience insights and distribution</p>
                  </div>
                </div>
                {demographicStats?.lastUpdated && (
                  <div className="px-3 py-1.5 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Last updated</p>
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{format(new Date(demographicStats.lastUpdated), 'MMM d • h:mm a')}</p>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400 mt-2">
                <div className="flex items-center">
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-1.5"></div>
                  <span>Overall app demographics</span>
                </div>
                <span className="text-gray-400">•</span>
                <a href="/broadcast-history" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium transition-colors">View Broadcast History</a>
                <button
                  type="button"
                  onClick={refreshDemographics}
                  className="ml-auto inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                  title="Refresh demographics"
                >
                  <ArrowPathIcon className="h-4 w-4 mr-1" /> Refresh
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {/* Total Users */}
              <div className="group bg-white dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02]">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm group-hover:shadow-md transition-shadow">
                    <UsersIcon className="h-5 w-5 text-white" />
                  </div>
                  <div className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-full">
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">100%</span>
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total Users</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{demographicStats?.totalUsers ?? 0}</p>
                <div className="mt-2 h-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"></div>
              </div>

              {/* Users with Birthdate */}
              <div className="group bg-white dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02]">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-sm group-hover:shadow-md transition-shadow">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="px-2 py-1 bg-purple-50 dark:bg-purple-900/30 rounded-full">
                    <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                      {demographicStats?.totalUsers > 0 ? Math.round((demographicStats?.usersWithBirthdate / demographicStats?.totalUsers) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">With Birthdate</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{demographicStats?.usersWithBirthdate ?? 0}</p>
                <div className="mt-2 h-1 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full" style={{width: `${demographicStats?.totalUsers > 0 ? (demographicStats?.usersWithBirthdate / demographicStats?.totalUsers) * 100 : 0}%`}}></div>
              </div>

              {/* Users with Gender */}
              <div className="group bg-white dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02]">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg shadow-sm group-hover:shadow-md transition-shadow">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="px-2 py-1 bg-pink-50 dark:bg-pink-900/30 rounded-full">
                    <span className="text-xs font-semibold text-pink-600 dark:text-pink-400">
                      {demographicStats?.totalUsers > 0 ? Math.round((demographicStats?.usersWithGender / demographicStats?.totalUsers) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">With Gender</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{demographicStats?.usersWithGender ?? 0}</p>
                <div className="mt-2 h-1 bg-gradient-to-r from-pink-500 to-pink-600 rounded-full" style={{width: `${demographicStats?.totalUsers > 0 ? (demographicStats?.usersWithGender / demographicStats?.totalUsers) * 100 : 0}%`}}></div>
              </div>
            </div>

            {/* Charts */}
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Age Groups Bar */}
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <ChartBarIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">Age Groups</h3>
                  </div>
                  <div className="px-2.5 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-full border border-blue-200 dark:border-blue-800">
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Distribution</span>
                  </div>
                </div>
                <div className="h-64">
                  <Bar
                    data={{
                      labels: ['Teens', 'Young Adults', 'Adults', 'Middle-Aged', 'Seniors', 'Unknown'],
                      datasets: [
                        {
                          label: 'Users',
                          data: [
                            demographicStats?.ageGroups?.teens || 0,
                            demographicStats?.ageGroups?.youngAdults || 0,
                            demographicStats?.ageGroups?.adults || 0,
                            demographicStats?.ageGroups?.middleAged || 0,
                            demographicStats?.ageGroups?.seniors || 0,
                            demographicStats?.ageGroups?.unknown || 0,
                          ],
                          backgroundColor: [
                            'rgba(59, 130, 246, 0.8)',
                            'rgba(99, 102, 241, 0.8)',
                            'rgba(139, 92, 246, 0.8)',
                            'rgba(168, 85, 247, 0.8)',
                            'rgba(192, 132, 252, 0.8)',
                            'rgba(156, 163, 175, 0.6)',
                          ],
                          borderColor: [
                            'rgb(59, 130, 246)',
                            'rgb(99, 102, 241)',
                            'rgb(139, 92, 246)',
                            'rgb(168, 85, 247)',
                            'rgb(192, 132, 252)',
                            'rgb(156, 163, 175)',
                          ],
                          borderWidth: 2,
                          borderRadius: 8,
                          borderSkipped: false,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { 
                        legend: { display: false },
                        tooltip: {
                          backgroundColor: 'rgba(17, 24, 39, 0.95)',
                          padding: 12,
                          titleColor: 'rgb(243, 244, 246)',
                          bodyColor: 'rgb(209, 213, 219)',
                          borderColor: 'rgba(75, 85, 99, 0.5)',
                          borderWidth: 1,
                          cornerRadius: 8,
                        }
                      },
                      scales: {
                        x: { 
                          grid: { display: false },
                          ticks: { 
                            color: 'rgb(107, 114, 128)',
                            font: { size: 11, weight: '500' }
                          }
                        },
                        y: { 
                          grid: { 
                            color: 'rgba(156,163,175,0.1)',
                            lineWidth: 1
                          },
                          beginAtZero: true,
                          ticks: { 
                            color: 'rgb(107, 114, 128)',
                            font: { size: 11, weight: '500' }
                          }
                        },
                      },
                    }}
                  />
                </div>
                <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
                  <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                    <span className="font-semibold text-blue-700 dark:text-blue-400">Age Ranges:</span> Teens 13–19 • Young Adults 20–29 • Adults 30–49 • Middle‑Aged 50–64 • Seniors 65+ • Unknown = no birthdate
                  </p>
                </div>
              </div>

              {/* Gender Donut */}
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
                      <svg className="h-4 w-4 text-pink-600 dark:text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                      </svg>
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">Gender Distribution</h3>
                  </div>
                  <div className="px-2.5 py-1 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 rounded-full border border-pink-200 dark:border-pink-800">
                    <span className="text-xs font-medium text-pink-700 dark:text-pink-300">Breakdown</span>
                  </div>
                </div>
                <div className="h-64 flex items-center justify-center">
                  <Doughnut
                    data={{
                      labels: ['Male', 'Female', 'Other', 'Unknown'],
                      datasets: [
                        {
                          label: 'Users',
                          data: [
                            demographicStats?.gender?.male || 0,
                            demographicStats?.gender?.female || 0,
                            demographicStats?.gender?.other || 0,
                            demographicStats?.gender?.unknown || 0,
                          ],
                          backgroundColor: [
                            'rgba(37, 99, 235, 0.85)',
                            'rgba(236, 72, 153, 0.85)',
                            'rgba(234, 179, 8, 0.85)',
                            'rgba(156, 163, 175, 0.65)',
                          ],
                          borderColor: [
                            'rgb(37, 99, 235)',
                            'rgb(236, 72, 153)',
                            'rgb(234, 179, 8)',
                            'rgb(156, 163, 175)',
                          ],
                          borderWidth: 3,
                          hoverOffset: 8,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { 
                          position: 'bottom',
                          labels: { 
                            color: 'rgb(107, 114, 128)',
                            font: { size: 12, weight: '500' },
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle',
                          }
                        },
                        tooltip: {
                          backgroundColor: 'rgba(17, 24, 39, 0.95)',
                          padding: 12,
                          titleColor: 'rgb(243, 244, 246)',
                          bodyColor: 'rgb(209, 213, 219)',
                          borderColor: 'rgba(75, 85, 99, 0.5)',
                          borderWidth: 1,
                          cornerRadius: 8,
                          callbacks: {
                            label: function(context) {
                              const label = context.label || '';
                              const value = context.parsed || 0;
                              const total = context.dataset.data.reduce((a, b) => a + b, 0);
                              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                              return `${label}: ${value} (${percentage}%)`;
                            }
                          }
                        }
                      },
                      cutout: '60%',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Fallback for no data */}
            {(!demographicStats || (!demographicStats.ageGroups && !demographicStats.gender)) && (
              <div className="relative z-10 mt-6 text-center p-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700">
                <UsersIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No demographics data available yet</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Data will appear once users provide demographic information</p>
              </div>
            )}
          </div>

          {/* Popular Broadcasts and Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Popular Broadcasts */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Most Popular Broadcasts</h2>
                <div className="bg-maroon-100 dark:bg-maroon-900/20 text-maroon-600 dark:text-maroon-400 text-sm font-medium px-3 py-1 rounded-full">
                  Top 5
                </div>
              </div>

              <div className="space-y-4">
                {mostPopularBroadcasts?.length > 0 ? mostPopularBroadcasts.map((broadcast, index) => (
                  <div key={broadcast.id} className="flex items-center space-x-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{index + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {broadcast.title || 'Untitled Broadcast'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        by {broadcast.djName || 'Unknown DJ'} • {broadcast.listenerCount || 0} Listeners
                      </p>
                    </div>
                    <div className={`flex-shrink-0 px-2 py-1 rounded-lg text-xs font-medium ${
                      broadcast.status === 'LIVE' 
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' 
                        : broadcast.status === 'SCHEDULED' 
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                        : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                    }`}>
                      {broadcast.status || 'COMPLETED'}
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8">
                    <RadioIcon className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-500 dark:text-gray-400">No broadcast data available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity Log - Using pattern from Notifications.jsx */}
            <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
                <div>
                  <select
                    value={selectedTimeframe}
                    onChange={(e) => setSelectedTimeframe(e.target.value)}
                    className="text-sm rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white py-1 px-2"
                  >
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                  </select>
                </div>
              </div>

              <EnhancedScrollArea className="max-h-80">
                <div className="space-y-4">
                {filteredActivities.length > 0 ? filteredActivities.map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      {activity.type === 'BROADCAST_START' && (
                        <div className="p-1 bg-green-100 dark:bg-green-900/30 rounded-lg">
                          <RadioIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                      )}
                      {activity.type === 'USER_LOGIN' && (
                        <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                          <UsersIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                      )}
                      {activity.type === 'BROADCAST_END' && (
                        <div className="p-1 bg-red-100 dark:bg-red-900/30 rounded-lg">
                          <CheckCircleIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                      )}
                      {activity.type === 'GENERAL' && (
                        <div className="p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                          <ClockIconOutline className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white">
                        {activity.message || 'Unknown activity'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {activity.username || 'Unknown user'} • {safeFormatInTimeZone(activity.timestamp, 'Asia/Manila', 'h:mm a')}
                      </p>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8">
                    <ClockIconOutline className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-500 dark:text-gray-400">No recent activity</p>
                  </div>
                )}
                </div>
              </EnhancedScrollArea>
            </div>
          </div>

          {/* Connection status indicator */}
          <div className="mt-4 text-center">
            <div className="inline-flex items-center space-x-2 text-sm">
              <div className={`h-2 w-2 rounded-full ${
                wsConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
              }`}></div>
              <span className={wsConnected ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}>
                {wsConnected 
                  ? 'WebSocket connected - Live chart updates available' 
                  : 'WebSocket disconnected - Manual refresh only'}
              </span>
              {lastUpdated && (
                <span className="text-gray-500 dark:text-gray-400 ml-2">
                  • Last refreshed: {safeFormatInTimeZone(lastUpdated, 'Asia/Manila', 'h:mm a')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
