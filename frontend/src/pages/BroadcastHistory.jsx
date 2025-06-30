import { useState, useMemo } from 'react';
import { useBroadcastHistory } from '../context/BroadcastHistoryContext';
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow, format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { parseISO } from 'date-fns';
import { 
  RadioIcon, 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  ExclamationTriangleIcon,
  InformationCircleIcon,
  MicrophoneIcon,
  CalendarIcon,
  SpeakerWaveIcon,
  ChartBarIcon,
  ClockIcon,
  ShieldExclamationIcon
} from '@heroicons/react/24/outline';

const broadcastTypeIcons = {
  BROADCAST_SCHEDULED: CalendarIcon,
  BROADCAST_STARTING_SOON: ExclamationTriangleIcon,
  BROADCAST_STARTED: MicrophoneIcon,
  BROADCAST_ENDED: SpeakerWaveIcon,
  NEW_BROADCAST_POSTED: InformationCircleIcon,
  default: RadioIcon
};

const broadcastTypeColors = {
  BROADCAST_SCHEDULED: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
  BROADCAST_STARTING_SOON: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30',
  BROADCAST_STARTED: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
  BROADCAST_ENDED: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
  NEW_BROADCAST_POSTED: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30',
  default: 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30'
};

// Helper to parse backend timestamp as UTC
const parseBackendTimestamp = (timestamp) => {
  if (!timestamp) return null;
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(timestamp)) {
    return parseISO(timestamp);
  }
  return parseISO(timestamp + 'Z');
};

export default function BroadcastHistory() {
  const { currentUser } = useAuth();
  const { 
    broadcastHistory, 
    stats,
    loading,
    error,
    fetchBroadcastHistory,
    fetchRecentBroadcastHistory,
    fetchBroadcastHistoryByType
  } = useBroadcastHistory();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [timeFilter, setTimeFilter] = useState('all');

  // Security check: Only allow DJs and Admins to access this feature
  if (!currentUser || (currentUser.role !== 'DJ' && currentUser.role !== 'ADMIN')) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <ShieldExclamationIcon className="h-16 w-16 mx-auto text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Access Restricted</h3>
          <p className="text-gray-600 dark:text-gray-400">
            This feature is only available to DJs and Administrators.
          </p>
        </div>
      </div>
    );
  }

  const filteredAndSortedHistory = useMemo(() => {
    let filtered = broadcastHistory;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(broadcast =>
        broadcast.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        broadcast.type.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply type filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(broadcast => broadcast.type === selectedFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.timestamp) - new Date(a.timestamp);
      } else if (sortBy === 'oldest') {
        return new Date(a.timestamp) - new Date(b.timestamp);
      }
      return 0;
    });

    return filtered;
  }, [broadcastHistory, searchTerm, selectedFilter, sortBy]);

  const getBroadcastIcon = (type) => {
    const IconComponent = broadcastTypeIcons[type] || broadcastTypeIcons.default;
    return IconComponent;
  };

  const getBroadcastColor = (type) => {
    return broadcastTypeColors[type] || broadcastTypeColors.default;
  };

  const formatBroadcastType = (type) => {
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleTimeFilterChange = (filter) => {
    setTimeFilter(filter);
    switch (filter) {
      case 'today':
        fetchRecentBroadcastHistory(1);
        break;
      case 'week':
        fetchRecentBroadcastHistory(7);
        break;
      case 'month':
        fetchRecentBroadcastHistory(30);
        break;
      case 'all':
      default:
        fetchBroadcastHistory();
        break;
    }
  };

  const handleTypeFilter = (type) => {
    setSelectedFilter(type);
    if (type === 'all') {
      fetchBroadcastHistory();
    } else {
      fetchBroadcastHistoryByType(type);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-maroon-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading broadcast history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 mx-auto text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Error Loading History</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchBroadcastHistory}
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
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-maroon-100 dark:bg-maroon-900/30 rounded-lg">
              <RadioIcon className="h-8 w-8 text-maroon-600 dark:text-maroon-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Broadcast History</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Track all broadcast events and activities
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <ChartBarIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalBroadcasts}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <CalendarIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Scheduled</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.scheduledCount}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <MicrophoneIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Started</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.startedCount}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <SpeakerWaveIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Ended</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.endedCount}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <ClockIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Recent</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.recentActivity}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search and Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            {/* Search */}
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search broadcast history..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Time Filter */}
            <select
              value={timeFilter}
              onChange={(e) => handleTimeFilterChange(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>

            {/* Type Filter */}
            <div className="flex items-center space-x-2">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <select
                value={selectedFilter}
                onChange={(e) => handleTypeFilter(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon-500"
              >
                <option value="all">All Types</option>
                <option value="BROADCAST_SCHEDULED">Scheduled</option>
                <option value="BROADCAST_STARTING_SOON">Starting Soon</option>
                <option value="BROADCAST_STARTED">Started</option>
                <option value="BROADCAST_ENDED">Ended</option>
                <option value="NEW_BROADCAST_POSTED">New Posted</option>
              </select>
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>

        {/* Broadcast History List */}
        <div className="space-y-3">
          {filteredAndSortedHistory.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <RadioIcon className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {searchTerm || selectedFilter !== 'all' ? 'No matching broadcasts' : 'No broadcast history'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {searchTerm || selectedFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria.' 
                  : 'Broadcast events will appear here when they occur.'}
              </p>
            </div>
          ) : (
            filteredAndSortedHistory.map((broadcast) => {
              const IconComponent = getBroadcastIcon(broadcast.type);
              
              return (
                <div
                  key={broadcast.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-all duration-200 hover:shadow-md"
                >
                  <div className="p-6">
                    <div className="flex items-start space-x-4">
                      {/* Icon */}
                      <div className={`flex-shrink-0 p-2 rounded-lg ${getBroadcastColor(broadcast.type)}`}>
                        <IconComponent className="h-6 w-6" />
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {formatBroadcastType(broadcast.type)}
                              </span>
                            </div>
                            <p className="text-gray-900 dark:text-white font-medium mb-1">
                              {broadcast.message}
                            </p>
                            <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                              <span>{formatInTimeZone(parseBackendTimestamp(broadcast.timestamp), 'Asia/Manila', 'MMM d, yyyy • h:mm a')}</span>
                              <span>•</span>
                              <span>{formatDistanceToNow(parseBackendTimestamp(broadcast.timestamp), { addSuffix: true })}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
} 