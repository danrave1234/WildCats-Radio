import { useState, useEffect, useMemo } from 'react';
import { useAnalytics } from '../context/AnalyticsContext';
import { useAuth } from '../context/AuthContext';
import { authService, analyticsService } from '../services/api/index';
import { analyticsApi } from '../services/api/analyticsApi';
import { broadcastService } from '../services/api/index';
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
  PointElement,
  LineElement,
  Filler,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  Filler
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
  ArrowDownIcon,
  SignalIcon,
  DevicePhoneMobileIcon,
  ChevronDownIcon
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

// Helper to parse backend timestamp as local time
const parseBackendTimestamp = (timestamp) => {
  if (!timestamp) return null;
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(timestamp)) {
    return parseISO(timestamp);
  }
  return new Date(timestamp);
};

// Safe date formatting helper
const safeFormatInTimeZone = (timestamp, timezone, formatStr) => {
  try {
    const parsedDate = parseBackendTimestamp(timestamp);
    if (!parsedDate || isNaN(parsedDate.getTime())) {
      return 'Invalid date';
    }
    return formatInTimeZone(parsedDate, timezone, formatStr);
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
    realtimeStats,
    loading,
    error,
    lastUpdated,
    refreshData,
    refreshDemographics
  } = useAnalytics();

  const [selectedTimeframe, setSelectedTimeframe] = useState('week');
  const [comparisonPeriod, setComparisonPeriod] = useState('lastWeek');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'demographics', 'broadcasts', 'engagement'
  const [selectedDJId, setSelectedDJId] = useState(null); // null = overall, number = specific DJ
  const [djs, setDjs] = useState([]);
  const [loadingDJs, setLoadingDJs] = useState(false);
  const [filteredStats, setFilteredStats] = useState(null); // Store filtered stats when a DJ is selected
  const [loadingFilteredStats, setLoadingFilteredStats] = useState(false); // Loading state for filtered stats
  const [filteredStatsError, setFilteredStatsError] = useState(null); // Error state for filtered stats
  const [selectedBroadcastId, setSelectedBroadcastId] = useState(null); // Selected broadcast for DJ period breakdown
  const [djPeriodAnalytics, setDJPeriodAnalytics] = useState(null); // DJ period analytics for selected broadcast
  const [loadingDJPeriods, setLoadingDJPeriods] = useState(false);

  // Fetch DJs list on mount
  useEffect(() => {
    const fetchDJs = async () => {
      setLoadingDJs(true);
      try {
        const response = await authService.getUsersByRole('DJ');
        setDjs(response.data || []);
      } catch (error) {
        console.error('Error fetching DJs:', error);
      } finally {
        setLoadingDJs(false);
      }
    };
    fetchDJs();
  }, []);

  // Fetch filtered stats when DJ is selected
  useEffect(() => {
    if (selectedDJId === null) {
      setFilteredStats(null);
      return;
    }

    const fetchFilteredStats = async () => {
      setLoadingFilteredStats(true);
      setFilteredStatsError(null);
      try {
        const [broadcastRes, engagementRes, activityRes, popularRes] = await Promise.all([
          analyticsService.getBroadcastStats({ params: { userId: selectedDJId } }),
          analyticsService.getEngagementStats({ params: { userId: selectedDJId } }),
          analyticsService.getActivityStats({ userId: selectedDJId }),
          analyticsService.getPopularBroadcasts({ params: { userId: selectedDJId } }),
        ]);

        // Transform activity stats to match expected format
        const activityData = activityRes.data || {};
        const recentActivities = (activityData.recentActivities || []).map(activity => ({
          id: activity.id,
          type: activity.activityType,
          message: activity.description,
          username: activity.user?.email || activity.user?.name || 'Unknown user',
          timestamp: activity.timestamp,
          user: activity.user
        }));

        setFilteredStats({
          broadcastStats: broadcastRes.data || {},
          engagementStats: engagementRes.data || {},
          activityStats: {
            todayActivities: activityData.todayActivities || 0,
            weekActivities: activityData.weekActivities || 0,
            monthActivities: activityData.monthActivities || 0,
            recentActivities
          },
          mostPopularBroadcasts: popularRes.data || []
        });
      } catch (error) {
        console.error('Error fetching filtered stats:', error);
        setFilteredStatsError('Failed to load DJ analytics');
      } finally {
        setLoadingFilteredStats(false);
      }
    };

    fetchFilteredStats();
  }, [selectedDJId]);

  // Use filtered stats if a DJ is selected, otherwise use context stats
  const displayBroadcastStats = selectedDJId ? (filteredStats?.broadcastStats || broadcastStats) : broadcastStats;
  const displayEngagementStats = selectedDJId ? (filteredStats?.engagementStats || engagementStats) : engagementStats;
  const displayActivityStats = selectedDJId ? (filteredStats?.activityStats || activityStats) : activityStats;
  const displayMostPopularBroadcasts = selectedDJId ? (filteredStats?.mostPopularBroadcasts || mostPopularBroadcasts) : mostPopularBroadcasts;

  // Get selected DJ name
  const selectedDJName = selectedDJId ? djs.find(dj => dj.id === selectedDJId)?.name || djs.find(dj => dj.id === selectedDJId)?.email : null;

  // Security check: Only Admin and Moderator
  if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'MODERATOR')) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <ShieldExclamationIcon className="h-16 w-16 mx-auto text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Access Restricted</h3>
          <p className="text-gray-600 dark:text-gray-400">The Analytics Dashboard is available to Administrators and Moderators only. DJs should use the DJ Analytics page.</p>
        </div>
      </div>
    );
  }

  // Format time duration
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

  // Show loading state only on initial load
  if (loading && !lastUpdated) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="flex flex-col items-center gap-4">
            <Spinner variant="primary" size="lg" />
            <span className="text-maroon-700 dark:text-maroon-300 font-medium">Loading analytics data...</span>
          </div>
        </div>
      </div>
    );
  }

  // Show error state only on initial load failure
  if (error && !lastUpdated) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics Dashboard</h1>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  selectedDJId 
                    ? 'bg-maroon-100 dark:bg-maroon-900/30 text-maroon-700 dark:text-maroon-300'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                }`}>
                  {selectedDJId ? `${selectedDJName || 'DJ'} Analytics` : 'Overall Analytics'}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* DJ Selector */}
                <div className="relative">
                  <select
                    value={selectedDJId || ''}
                    onChange={(e) => setSelectedDJId(e.target.value ? Number(e.target.value) : null)}
                    disabled={loadingDJs}
                    className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-gray-900 dark:text-white hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">All DJs (Overall)</option>
                    {djs.map(dj => (
                      <option key={dj.id} value={dj.id}>
                        {dj.name || dj.email}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400 pointer-events-none" />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {lastUpdated ? (
                    <span className="inline-flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                      {selectedDJId ? `${selectedDJName || 'DJ'}'s analytics` : 'All DJs\' analytics'} • Last updated: {format(new Date(lastUpdated), 'MMM d, yyyy • h:mm a')}
                    </span>
                  ) : 'Loading analytics…'}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (selectedDJId) {
                  // Refresh filtered stats
                  const fetchFilteredStats = async () => {
                    setLoadingFilteredStats(true);
                    setFilteredStatsError(null);
                    try {
                      const [broadcastRes, engagementRes, activityRes, popularRes] = await Promise.all([
                        analyticsService.getBroadcastStats({ params: { userId: selectedDJId } }),
                        analyticsService.getEngagementStats({ params: { userId: selectedDJId } }),
                        analyticsService.getActivityStats({ userId: selectedDJId }),
                        analyticsService.getPopularBroadcasts({ params: { userId: selectedDJId } }),
                      ]);

                      const activityData = activityRes.data || {};
                      const recentActivities = (activityData.recentActivities || []).map(activity => ({
                        id: activity.id,
                        type: activity.activityType,
                        message: activity.description,
                        username: activity.user?.email || activity.user?.name || 'Unknown user',
                        timestamp: activity.timestamp,
                        user: activity.user
                      }));

                      setFilteredStats({
                        broadcastStats: broadcastRes.data || {},
                        engagementStats: engagementRes.data || {},
                        activityStats: {
                          todayActivities: activityData.todayActivities || 0,
                          weekActivities: activityData.weekActivities || 0,
                          monthActivities: activityData.monthActivities || 0,
                          recentActivities
                        },
                        mostPopularBroadcasts: popularRes.data || []
                      });
                    } catch (error) {
                      console.error('Error refreshing filtered stats:', error);
                      setFilteredStatsError('Failed to refresh DJ analytics');
                    } finally {
                      setLoadingFilteredStats(false);
                    }
                  };
                  fetchFilteredStats();
                } else {
                  refreshData();
                }
              }}
              disabled={loading || loadingFilteredStats}
              className="flex items-center px-4 py-2 bg-maroon-600 text-white rounded-lg hover:bg-maroon-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowPathIcon className={`h-4 w-4 mr-2 ${(loading || loadingFilteredStats) ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium">{(loading || loadingFilteredStats) ? 'Refreshing…' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 -mb-px">
            {[
              { id: 'overview', label: 'Overview', icon: ChartBarIcon },
              { id: 'demographics', label: 'Demographics', icon: UsersIcon },
              { id: 'broadcasts', label: 'Broadcasts', icon: RadioIcon },
              { id: 'engagement', label: 'Engagement', icon: ChatBubbleOvalLeftIcon },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-1 py-4 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-maroon-600 text-maroon-600 dark:text-maroon-400 dark:border-maroon-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Error/Warning Messages */}
        {error && lastUpdated && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5 text-yellow-600 dark:text-yellow-400" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">Some data couldn't be updated</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Filtered Stats Error Messages */}
        {filteredStatsError && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5 text-yellow-600 dark:text-yellow-400" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">Failed to load DJ analytics</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">{filteredStatsError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Info Banner */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
              <div className="flex items-start">
                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg mr-3">
                  <UsersIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200 mb-1">Overall Analytics</p>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300">
                    This dashboard shows aggregated analytics across all DJs and broadcasts. You can view overall performance, user demographics, and system-wide engagement metrics.
                  </p>
                </div>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Live Listeners */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <SignalIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  {realtimeStats.streamLive && (
                    <span className="flex items-center px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full text-xs font-medium">
                      <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-1.5 animate-pulse"></span>
                      LIVE
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Live Listeners</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{realtimeStats.currentListeners || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {realtimeStats.streamLive ? 'Stream is live' : 'Stream is offline'}
                </p>
              </div>

              {/* Total Broadcasts */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <RadioIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  {displayBroadcastStats.liveBroadcasts > 0 && (
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full text-xs font-medium">
                      {displayBroadcastStats.liveBroadcasts} live
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total Broadcasts</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{displayBroadcastStats.totalBroadcasts || 0}</p>
                <div className="flex items-center gap-4 mt-3 text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-white">{displayBroadcastStats.completedBroadcasts || 0}</span> completed
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-white">{displayBroadcastStats.upcomingBroadcasts || 0}</span> scheduled
                  </span>
                </div>
              </div>

              {/* Engagement */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg mb-4">
                  <ChatBubbleOvalLeftIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total Messages</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{displayEngagementStats.totalChatMessages || 0}</p>
                <div className="flex items-center gap-4 mt-3 text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-white">{displayEngagementStats.totalSongRequests || 0}</span> requests
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    Avg: <span className="font-medium text-gray-900 dark:text-white">{formatDecimal(displayEngagementStats.averageMessagesPerBroadcast, 1)}</span>
                  </span>
                </div>
              </div>

              {/* Total Users */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg mb-4">
                  <UsersIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total Users</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{userStats.totalUsers || demographicStats.totalUsers || 0}</p>
                <div className="flex items-center gap-4 mt-3 text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-white">{userStats.listeners || 0}</span> listeners
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-white">{userStats.djs || 0}</span> DJs
                  </span>
                </div>
              </div>
            </div>

            {/* Broadcast Performance & Popular Broadcasts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Broadcast Performance */}
              <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Broadcast Performance</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Average Duration</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatDuration(displayBroadcastStats.averageDuration)}</p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Completed</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{displayBroadcastStats.completedBroadcasts || 0}</p>
                  </div>
                </div>
                {displayMostPopularBroadcasts && displayMostPopularBroadcasts.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Most Popular Broadcasts</h3>
                    <div className="space-y-3">
                      {displayMostPopularBroadcasts.slice(0, 3).map((broadcast, index) => (
                        <div key={broadcast.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-maroon-100 dark:bg-maroon-900/30 flex items-center justify-center">
                              <span className="text-sm font-medium text-maroon-600 dark:text-maroon-400">{index + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{broadcast.title || 'Untitled'}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{broadcast.listenerCount || 0} listeners</p>
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            broadcast.status === 'LIVE' 
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' 
                              : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                          }`}>
                            {broadcast.status || 'COMPLETED'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Stats</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Chat Messages</span>
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">{displayEngagementStats.totalChatMessages || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Song Requests</span>
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">{displayEngagementStats.totalSongRequests || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Avg Messages/Broadcast</span>
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">{formatDecimal(displayEngagementStats.averageMessagesPerBroadcast, 1)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Demographics Tab */}
        {activeTab === 'demographics' && (
          <div className="space-y-6">
            {/* Demographics Header */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Audience Demographics</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">User distribution and characteristics</p>
                </div>
                <button
                  onClick={refreshDemographics}
                  className="flex items-center px-3 py-2 text-sm bg-maroon-600 text-white rounded-lg hover:bg-maroon-700 transition-colors"
                >
                  <ArrowPathIcon className="h-4 w-4 mr-2" />
                  Refresh
                </button>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Total Users</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{demographicStats?.totalUsers || 0}</p>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-1">With Birthdate</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{demographicStats?.usersWithBirthdate || 0}</p>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                    {demographicStats?.totalUsers > 0 
                      ? Math.round((demographicStats?.usersWithBirthdate / demographicStats?.totalUsers) * 100) 
                      : 0}% of total
                  </p>
                </div>
                <div className="p-4 bg-pink-50 dark:bg-pink-900/20 rounded-lg border border-pink-200 dark:border-pink-800">
                  <p className="text-sm font-medium text-pink-600 dark:text-pink-400 mb-1">With Gender</p>
                  <p className="text-2xl font-bold text-pink-900 dark:text-pink-100">{demographicStats?.usersWithGender || 0}</p>
                  <p className="text-xs text-pink-600 dark:text-pink-400 mt-1">
                    {demographicStats?.totalUsers > 0 
                      ? Math.round((demographicStats?.usersWithGender / demographicStats?.totalUsers) * 100) 
                      : 0}% of total
                  </p>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Age Groups Chart */}
                <div className="bg-white dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Age Distribution</h3>
                  <div className="h-80">
                    <Bar
                      data={{
                        labels: ['Teens (13-19)', 'Young Adults (20-29)', 'Adults (30-49)', 'Middle-Aged (50-64)', 'Seniors (65+)', 'Unknown'],
                        datasets: [{
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
                        }],
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
                              font: { size: 11, weight: '500' },
                              maxRotation: 45,
                              minRotation: 45,
                            }
                          },
                          y: {
                            grid: { color: 'rgba(156,163,175,0.1)' },
                            beginAtZero: true,
                            ticks: {
                              color: 'rgb(107, 114, 128)',
                              font: { size: 11 },
                            }
                          },
                        },
                      }}
                    />
                  </div>
                </div>

                {/* Gender Distribution Chart */}
                <div className="bg-white dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Gender Distribution</h3>
                  <div className="h-80 flex items-center justify-center">
                    <Doughnut
                      data={{
                        labels: ['Male', 'Female', 'Other', 'Unknown'],
                        datasets: [{
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
                        }],
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

              {/* No Data Message */}
              {(!demographicStats || (!demographicStats.ageGroups && !demographicStats.gender)) && (
                <div className="text-center p-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <UsersIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No demographics data available yet</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Data will appear once users provide demographic information</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Broadcasts Tab */}
        {activeTab === 'broadcasts' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Broadcast Analytics</h2>
              
              {/* Broadcast Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-1">Total Broadcasts</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{displayBroadcastStats.totalBroadcasts || 0}</p>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">Live Now</p>
                  <p className="text-2xl font-bold text-red-900 dark:text-red-100">{displayBroadcastStats.liveBroadcasts || 0}</p>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Scheduled</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{displayBroadcastStats.upcomingBroadcasts || 0}</p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">Completed</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">{displayBroadcastStats.completedBroadcasts || 0}</p>
                </div>
              </div>

              {/* Average Duration & Popular Broadcasts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Average Broadcast Duration</h3>
                  <p className="text-4xl font-bold text-maroon-600 dark:text-maroon-400">{formatDuration(displayBroadcastStats.averageDuration)}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Based on all completed broadcasts</p>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Most Popular Broadcasts</h3>
                  {displayMostPopularBroadcasts && displayMostPopularBroadcasts.length > 0 ? (
                    <div className="space-y-3">
                      {displayMostPopularBroadcasts.map((broadcast, index) => (
                        <div key={broadcast.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-maroon-100 dark:bg-maroon-900/30 flex items-center justify-center">
                              <span className="text-sm font-medium text-maroon-600 dark:text-maroon-400">{index + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{broadcast.title || 'Untitled'}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{broadcast.djName || 'Unknown DJ'} • {broadcast.listenerCount || 0} listeners</p>
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            broadcast.status === 'LIVE' 
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' 
                              : broadcast.status === 'SCHEDULED'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                              : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                          }`}>
                            {broadcast.status || 'COMPLETED'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <RadioIcon className="h-10 w-10 mx-auto mb-2" />
                      <p className="text-sm">No broadcast data available</p>
                    </div>
                  )}
                </div>
              </div>

              {/* DJ Period Breakdown Section */}
              <div className="mt-6">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">DJ Period Breakdown</h3>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Broadcast to View DJ Periods
                  </label>
                  <select
                    value={selectedBroadcastId || ''}
                    onChange={async (e) => {
                      const broadcastId = e.target.value ? Number(e.target.value) : null;
                      setSelectedBroadcastId(broadcastId);
                      if (broadcastId) {
                        setLoadingDJPeriods(true);
                        try {
                          const response = await analyticsApi.getDJPeriodAnalytics(broadcastId);
                          setDJPeriodAnalytics(response.data);
                        } catch (error) {
                          console.error('Error fetching DJ period analytics:', error);
                          setDJPeriodAnalytics(null);
                        } finally {
                          setLoadingDJPeriods(false);
                        }
                      } else {
                        setDJPeriodAnalytics(null);
                      }
                    }}
                    className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-maroon-500"
                  >
                    <option value="">-- Select Broadcast --</option>
                    {displayMostPopularBroadcasts && displayMostPopularBroadcasts.length > 0 && displayMostPopularBroadcasts.map(broadcast => (
                      <option key={broadcast.id} value={broadcast.id}>
                        {broadcast.title || 'Untitled'} ({broadcast.status || 'COMPLETED'})
                      </option>
                    ))}
                  </select>
                </div>

                {loadingDJPeriods && (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                    Loading DJ period analytics...
                  </div>
                )}

                {djPeriodAnalytics && djPeriodAnalytics.djPeriods && djPeriodAnalytics.djPeriods.length > 0 && (
                  <div className="space-y-4">
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                        DJ Periods Breakdown
                      </h4>
                      <div className="space-y-3">
                        {djPeriodAnalytics.djPeriods.map((period, index) => (
                          <div
                            key={index}
                            className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {period.djName || period.djEmail}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {period.startTime && format(new Date(period.startTime), 'MMM d, h:mm a')} - {' '}
                                  {period.endTime ? format(new Date(period.endTime), 'MMM d, h:mm a') : 'Ongoing'}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-maroon-600 dark:text-maroon-400">
                                  {period.durationMinutes || 0} min
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Messages:</span>
                                <span className="ml-1 font-medium text-gray-900 dark:text-white">
                                  {period.chatMessages || 0}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Requests:</span>
                                <span className="ml-1 font-medium text-gray-900 dark:text-white">
                                  {period.songRequests || 0}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Engagement:</span>
                                <span className="ml-1 font-medium text-gray-900 dark:text-white">
                                  {formatDecimal(period.engagementRate || 0, 2)}/min
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Chart visualization */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                        Duration by DJ
                      </h4>
                      <div className="h-64">
                        <Bar
                          data={{
                            labels: djPeriodAnalytics.djPeriods.map(p => p.djName || p.djEmail),
                            datasets: [{
                              label: 'Duration (minutes)',
                              data: djPeriodAnalytics.djPeriods.map(p => p.durationMinutes || 0),
                              backgroundColor: 'rgba(139, 69, 19, 0.8)',
                              borderColor: 'rgb(139, 69, 19)',
                              borderWidth: 2,
                              borderRadius: 8,
                            }],
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
                              }
                            },
                            scales: {
                              y: {
                                beginAtZero: true,
                                ticks: { color: 'rgb(107, 114, 128)' },
                                grid: { color: 'rgba(156,163,175,0.1)' }
                              },
                              x: {
                                ticks: { color: 'rgb(107, 114, 128)', maxRotation: 45, minRotation: 45 },
                                grid: { display: false }
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedBroadcastId && !loadingDJPeriods && djPeriodAnalytics && (!djPeriodAnalytics.djPeriods || djPeriodAnalytics.djPeriods.length === 0) && (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    No DJ periods found for this broadcast (no handovers recorded).
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Engagement Tab */}
        {activeTab === 'engagement' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Engagement Metrics</h2>
              
              {/* Engagement Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between mb-2">
                    <ChatBubbleOvalLeftIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">Total Chat Messages</p>
                  <p className="text-3xl font-bold text-green-900 dark:text-green-100">{displayEngagementStats.totalChatMessages || 0}</p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                    Avg: {formatDecimal(displayEngagementStats.averageMessagesPerBroadcast, 1)} per broadcast
                  </p>
                </div>
                <div className="p-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between mb-2">
                    <MusicalNoteIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-1">Total Song Requests</p>
                  <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">{displayEngagementStats.totalSongRequests || 0}</p>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                    Avg: {formatDecimal(displayEngagementStats.averageRequestsPerBroadcast, 1)} per broadcast
                  </p>
                </div>
              </div>

              {/* Recent Activity */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
                  <select
                    value={selectedTimeframe}
                    onChange={(e) => setSelectedTimeframe(e.target.value)}
                    className="text-sm rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white py-1 px-2"
                  >
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="year">This Year</option>
                  </select>
                </div>
                <EnhancedScrollArea className="max-h-96">
                  <div className="space-y-3">
                    {displayActivityStats.recentActivities && displayActivityStats.recentActivities.length > 0 ? (
                      displayActivityStats.recentActivities
                        .filter(activity => {
                          if (!activity.timestamp) return false;
                          const activityDate = parseBackendTimestamp(activity.timestamp);
                          if (!activityDate) return false;
                          const now = new Date();
                          let cutoffDate;
                          switch (selectedTimeframe) {
                            case 'today': cutoffDate = startOfDay(now); break;
                            case 'week': cutoffDate = startOfWeek(now, { weekStartsOn: 1 }); break;
                            case 'month': cutoffDate = startOfMonth(now); break;
                            case 'year': cutoffDate = startOfYear(now); break;
                            default: cutoffDate = startOfWeek(now, { weekStartsOn: 1 });
                          }
                          return activityDate >= cutoffDate;
                        })
                        .slice(0, 20)
                        .map((activity, index) => (
                          <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
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
                              {!activity.type || activity.type === 'GENERAL' && (
                                <div className="p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                  <ClockIconOutline className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 dark:text-white">{activity.message || 'Unknown activity'}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {activity.username || 'Unknown user'} • {safeFormatInTimeZone(activity.timestamp, 'Asia/Manila', 'h:mm a')}
                              </p>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <ClockIconOutline className="h-10 w-10 mx-auto mb-2" />
                        <p className="text-sm">No recent activity</p>
                      </div>
                    )}
                  </div>
                </EnhancedScrollArea>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
