import { useState } from 'react';
import { useAnalytics } from '../context/AnalyticsContext';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/ui/spinner';
import { EnhancedScrollArea } from '../components/ui/enhanced-scroll-area';
import { format, startOfDay, startOfWeek, startOfMonth, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import {
  ChartBarIcon,
  RadioIcon,
  ClockIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  ChatBubbleOvalLeftIcon,
  MusicalNoteIcon,
  ClockIcon as ClockIconOutline,
  SignalIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

// Format a number to up to 3 decimal places
const formatDecimal = (value, maxFractionDigits = 3) => {
  const num = Number(value);
  if (!isFinite(num)) return '0';
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits
  });
};

// Helper to parse backend timestamp
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

export default function DJAnalyticsDashboard() {
  const { currentUser } = useAuth();
  const { 
    broadcastStats,
    engagementStats,
    activityStats,
    mostPopularBroadcasts,
    realtimeStats,
    loading,
    error,
    lastUpdated,
    refreshData
  } = useAnalytics();

  const [selectedTimeframe, setSelectedTimeframe] = useState('week');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'broadcasts', 'engagement'

  // Security check: Only DJs, Moderators, and Admins
  if (!currentUser || (currentUser.role !== 'DJ' && currentUser.role !== 'ADMIN' && currentUser.role !== 'MODERATOR')) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <ShieldExclamationIcon className="h-16 w-16 mx-auto text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Access Restricted</h3>
          <p className="text-gray-600 dark:text-gray-400">This page is only available to DJs, Moderators, and Admins.</p>
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

  // Show loading state only on initial load
  if (loading && !lastUpdated) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="flex flex-col items-center gap-4">
            <Spinner variant="primary" size="lg" />
            <span className="text-maroon-700 dark:text-maroon-300 font-medium">Loading your analytics...</span>
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
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Your Analytics</h1>
                <span className="px-3 py-1 bg-maroon-100 dark:bg-maroon-900/30 text-maroon-700 dark:text-maroon-300 rounded-full text-xs font-semibold">
                  Personal Dashboard
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {lastUpdated ? (
                  <span className="inline-flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                    Your broadcast analytics • Last updated: {format(new Date(lastUpdated), 'MMM d, yyyy • h:mm a')}
                  </span>
                ) : 'Loading analytics…'}
              </p>
            </div>
            <button
              onClick={refreshData}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-maroon-600 text-white rounded-lg hover:bg-maroon-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium">{loading ? 'Refreshing…' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-lg mr-3">
              <ChartBarIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">Your Personal Analytics</p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                This dashboard shows analytics only for your own broadcasts. Track your performance, engagement, and activity.
              </p>
            </div>
          </div>
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

        {/* Tabs Navigation */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          <nav className="flex space-x-8 -mb-px min-w-max">
            {[
              { id: 'overview', label: 'Overview', icon: ChartBarIcon },
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

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
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
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Your Live Listeners</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{realtimeStats.currentListeners || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {realtimeStats.streamLive ? 'Your stream is live' : 'Your stream is offline'}
                </p>
              </div>

              {/* Your Broadcasts */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <RadioIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  {broadcastStats.liveBroadcasts > 0 && (
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full text-xs font-medium">
                      {broadcastStats.liveBroadcasts} live
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Your Broadcasts</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{broadcastStats.totalBroadcasts || 0}</p>
                <div className="flex items-center gap-4 mt-3 text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-white">{broadcastStats.completedBroadcasts || 0}</span> completed
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-white">{broadcastStats.upcomingBroadcasts || 0}</span> scheduled
                  </span>
                </div>
              </div>

              {/* Engagement */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg mb-4">
                  <ChatBubbleOvalLeftIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Your Messages</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{engagementStats.totalChatMessages || 0}</p>
                <div className="flex items-center gap-4 mt-3 text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-white">{engagementStats.totalSongRequests || 0}</span> requests
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    Avg: <span className="font-medium text-gray-900 dark:text-white">{formatDecimal(engagementStats.averageMessagesPerBroadcast, 1)}</span>
                  </span>
                </div>
              </div>

              {/* Activity */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg mb-4">
                  <ClockIcon className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Today's Activity</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{activityStats.todayActivities || 0}</p>
                <div className="flex items-center gap-4 mt-3 text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-white">{activityStats.weekActivities || 0}</span> this week
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-white">{activityStats.monthActivities || 0}</span> this month
                  </span>
                </div>
              </div>
            </div>

            {/* Broadcast Performance & Popular Broadcasts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Broadcast Performance */}
              <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your Broadcast Performance</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Average Duration</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatDuration(broadcastStats.averageDuration)}</p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Completed</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{broadcastStats.completedBroadcasts || 0}</p>
                  </div>
                </div>
                {mostPopularBroadcasts && mostPopularBroadcasts.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Your Most Popular Broadcasts</h3>
                    <div className="space-y-3">
                      {mostPopularBroadcasts.slice(0, 3).map((broadcast, index) => (
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
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">{engagementStats.totalChatMessages || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Song Requests</span>
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">{engagementStats.totalSongRequests || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Live Broadcasts</span>
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">{broadcastStats.liveBroadcasts || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Avg Messages/Broadcast</span>
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">{formatDecimal(engagementStats.averageMessagesPerBroadcast, 1)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Broadcasts Tab */}
        {activeTab === 'broadcasts' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Your Broadcast Analytics</h2>
              
              {/* Broadcast Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-1">Total Broadcasts</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{broadcastStats.totalBroadcasts || 0}</p>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">Live Now</p>
                  <p className="text-2xl font-bold text-red-900 dark:text-red-100">{broadcastStats.liveBroadcasts || 0}</p>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Scheduled</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{broadcastStats.upcomingBroadcasts || 0}</p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">Completed</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">{broadcastStats.completedBroadcasts || 0}</p>
                </div>
              </div>

              {/* Average Duration & Popular Broadcasts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Average Broadcast Duration</h3>
                  <p className="text-4xl font-bold text-maroon-600 dark:text-maroon-400">{formatDuration(broadcastStats.averageDuration)}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Based on all your completed broadcasts</p>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Your Most Popular Broadcasts</h3>
                  {mostPopularBroadcasts && mostPopularBroadcasts.length > 0 ? (
                    <div className="space-y-3">
                      {mostPopularBroadcasts.map((broadcast, index) => (
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
            </div>
          </div>
        )}

        {/* Engagement Tab */}
        {activeTab === 'engagement' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Your Engagement Metrics</h2>
              
              {/* Engagement Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between mb-2">
                    <ChatBubbleOvalLeftIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">Your Chat Messages</p>
                  <p className="text-3xl font-bold text-green-900 dark:text-green-100">{engagementStats.totalChatMessages || 0}</p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                    Avg: {formatDecimal(engagementStats.averageMessagesPerBroadcast, 1)} per broadcast
                  </p>
                </div>
                <div className="p-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between mb-2">
                    <MusicalNoteIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-1">Your Song Requests</p>
                  <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">{engagementStats.totalSongRequests || 0}</p>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                    Avg: {formatDecimal(engagementStats.averageRequestsPerBroadcast, 1)} per broadcast
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
                    {activityStats.recentActivities && activityStats.recentActivities.length > 0 ? (
                      activityStats.recentActivities
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
                                  <ChartBarIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
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

