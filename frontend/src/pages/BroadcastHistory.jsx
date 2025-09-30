import { useState, useMemo, useEffect } from 'react';
import { useBroadcastHistory } from '../context/BroadcastHistoryContext';
import { analyticsService, broadcastService } from '../services/api/index.js';
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
  ShieldExclamationIcon,
  EyeIcon,
  ChatBubbleLeftRightIcon,
  MusicalNoteIcon,
  PlayIcon,
  StopIcon,
  UserIcon,
  Squares2X2Icon,
  ListBulletIcon,
  XMarkIcon,
  ArrowPathIcon
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
    detailedBroadcasts,
    selectedBroadcastAnalytics,
    stats,
    loading,
    error,
    fetchBroadcastHistory,
    fetchRecentBroadcastHistory,
    fetchBroadcastHistoryByType,
    fetchDetailedBroadcastAnalytics,
    fetchBroadcastAnalytics
  } = useBroadcastHistory();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [timeFilter, setTimeFilter] = useState('all');
  const [viewMode, setViewMode] = useState('notifications'); // 'notifications' | 'analytics' | 'broadcasts'
  const [selectedBroadcastId, setSelectedBroadcastId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [broadcastHistoryList, setBroadcastHistoryList] = useState([]); // ended broadcasts from Broadcast entity
  const [broadcastsLoading, setBroadcastsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [hasMore, setHasMore] = useState(true);

  const DAYS = 24 * 60 * 60 * 1000;
  const isExpiredByDate = (dateObj) => {
    if (!dateObj || isNaN(dateObj.getTime())) return false;
    return (Date.now() - dateObj.getTime()) > (7 * DAYS);
  };

  // Load analytics data when switching to analytics view
  useEffect(() => {
    if (viewMode === 'analytics') {
      fetchDetailedBroadcastAnalytics();
    }
  }, [viewMode, fetchDetailedBroadcastAnalytics]);

  // Load broadcasts history once; no auto-polling
  useEffect(() => {
    const loadBroadcasts = async () => {
      try {
        setBroadcastsLoading(true);
        const days = timeFilter === 'today' ? 1 : timeFilter === 'week' ? 7 : timeFilter === 'month' ? 30 : 365;
        // If unauthorized (403), show graceful empty state instead of spamming errors
        const resp = await broadcastService.getHistory(days, 0, size).catch((e) => {
          if (e?.response?.status === 403) {
            return { data: { content: [], last: true } };
          }
          throw e;
        });
        const content = resp.data?.content || resp.data || [];
        setBroadcastHistoryList(content);
        setPage(0);
        const last = resp.data?.last;
        setHasMore(Boolean(last === false && content.length > 0));
      } catch (e) {
        console.error('Failed to load broadcasts history', e);
      } finally {
        setBroadcastsLoading(false);
      }
    };
    loadBroadcasts();
  }, [timeFilter, size]);

  const loadMoreBroadcasts = async () => {
    if (!hasMore) return;
    try {
      const days = timeFilter === 'today' ? 1 : timeFilter === 'week' ? 7 : timeFilter === 'month' ? 30 : 365;
      const nextPage = page + 1;
      const resp = await broadcastService.getHistory(days, nextPage, size).catch((e) => {
        if (e?.response?.status === 403) {
          return { data: { content: [], last: true } };
        }
        throw e;
      });
      const content = resp.data?.content || [];
      setBroadcastHistoryList(prev => [...prev, ...content]);
      setPage(nextPage);
      const last = resp.data?.last;
      setHasMore(Boolean(last === false && content.length > 0));
    } catch (e) {
      console.error('Failed to load more broadcasts history', e);
      setHasMore(false);
    }
  };

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

  // Filter and sort analytics data
  const filteredAndSortedAnalytics = useMemo(() => {
    if (!detailedBroadcasts) return [];

    let filtered = [...detailedBroadcasts];

    // Apply search filter for analytics
    if (searchTerm) {
      filtered = filtered.filter(broadcast =>
        broadcast.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        broadcast.createdBy?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter for analytics
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(broadcast => broadcast.status === selectedFilter);
    }

    // Apply sorting for analytics
    filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.actualStart || b.scheduledStart) - new Date(a.actualStart || a.scheduledStart);
      } else if (sortBy === 'oldest') {
        return new Date(a.actualStart || a.scheduledStart) - new Date(b.actualStart || b.scheduledStart);
      } else if (sortBy === 'duration') {
        return (b.durationMinutes || 0) - (a.durationMinutes || 0);
      } else if (sortBy === 'interactions') {
        return (b.totalInteractions || 0) - (a.totalInteractions || 0);
      }
      return 0;
    });

    return filtered;
  }, [detailedBroadcasts, searchTerm, selectedFilter, sortBy]);

  // Filter and sort for broadcasts history (ended broadcasts)
  const filteredAndSortedBroadcasts = useMemo(() => {
    const list = [...broadcastHistoryList];
    let filtered = list;
    if (searchTerm) {
      filtered = filtered.filter(b => (b.title || '').toLowerCase().includes(searchTerm.toLowerCase()));
    }
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(b => (b.status || '').toUpperCase() === selectedFilter);
    }
    filtered.sort((a, b) => {
      const aTime = new Date(a.actualEnd || a.actualStart || a.scheduledStart).getTime();
      const bTime = new Date(b.actualEnd || b.actualStart || b.scheduledStart).getTime();
      if (sortBy === 'newest') return bTime - aTime;
      if (sortBy === 'oldest') return aTime - bTime;
      return 0;
    });
    return filtered;
  }, [broadcastHistoryList, searchTerm, selectedFilter, sortBy]);

  const handleDownloadChat = async (broadcastId) => {
    try {
      setDownloadingId(broadcastId);
      // Use broadcast-centric export endpoint
      const response = await broadcastService.exportChat(broadcastId);
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      try {
        const cd = response.headers && (response.headers['content-disposition'] || response.headers['Content-Disposition']);
        if (cd) {
          const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd);
          const encoded = match && (match[1] || match[2]);
          if (encoded) link.download = decodeURIComponent(encoded);
        }
      } catch {}
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      // If 404 or similar, likely cleaned up after 7 days
      alert('Chat messages may no longer be available for download (kept for 7 days).');
      console.error('Download chat error:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  // Try to map a notification to a broadcast by title and time proximity, then download
  const extractTitleFromMessage = (message = '') => {
    try {
      const parts = message.split(':');
      if (parts.length >= 2) {
        return parts.slice(1).join(':').trim();
      }
      return message.trim();
    } catch {
      return message?.trim() || '';
    }
  };

  const handleDownloadFromNotification = async (notification) => {
    const possibleTitle = extractTitleFromMessage(notification?.message || '');
    try {
      setDownloadingId(notification.id);
      // Use lightweight broadcasts endpoint to avoid heavy analytics and lazy-loading issues
      const resp = await broadcastService.getHistory(30);
      const list = resp?.data || [];
      const notifTime = parseBackendTimestamp(notification.timestamp)?.getTime?.() || 0;
      const candidates = list.filter((b) => (b.title || '').toLowerCase() === possibleTitle.toLowerCase());
      const best = (candidates.length ? candidates : list)
        .map((b) => {
          const t = new Date(b.actualStart || b.scheduledStart || b.createdAt || 0).getTime();
          return { b, dt: Math.abs((t || 0) - notifTime) };
        })
        .sort((a, b) => a.dt - b.dt)[0]?.b;

      if (!best?.id) throw new Error('Broadcast not found');

      const response = await broadcastService.exportChat(best.id);
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      try {
        const cd = response.headers && (response.headers['content-disposition'] || response.headers['Content-Disposition']);
        if (cd) {
          const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd);
          const encoded = match && (match[1] || match[2]);
          if (encoded) link.download = decodeURIComponent(encoded);
        }
      } catch {}
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Unable to download chat for this entry (may be unavailable after 7 days).');
      console.error('Download from notification error:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  // Security check: Allow DJs, Moderators, and Admins
  if (!currentUser || (currentUser.role !== 'DJ' && currentUser.role !== 'ADMIN' && currentUser.role !== 'MODERATOR')) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <ShieldExclamationIcon className="h-16 w-16 mx-auto text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Access Restricted</h3>
          <p className="text-gray-600 dark:text-gray-400">
            This feature is available to DJs, Moderators, and Administrators.
          </p>
        </div>
      </div>
    );
  }

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
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-maroon-100 dark:bg-maroon-900/30 rounded-lg">
                <RadioIcon className="h-8 w-8 text-maroon-600 dark:text-maroon-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Broadcast History</h1>
                <p className="text-gray-600 dark:text-gray-400">
                  {viewMode === 'notifications' ? 'Track all broadcast events and activities' : 'View detailed broadcast analytics and metrics'}
                </p>
              </div>
            </div>

            {/* Broadcast History - single view (no tabs) */}
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
                placeholder={viewMode === 'notifications' ? "Search broadcast history..." : "Search broadcasts by title or DJ..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Time Filter - Notifications and Broadcasts */}
            {true && (
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
            )}

            {/* Filter */}
            <div className="flex items-center space-x-2">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <select
                value={selectedFilter}
                onChange={(e) => {
                  setSelectedFilter(e.target.value);
                  if (viewMode === 'notifications') {
                    handleTypeFilter(e.target.value);
                  }
                }}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon-500"
              >
                {viewMode === 'notifications' ? (
                  <>
                    <option value="all">All Types</option>
                    <option value="BROADCAST_SCHEDULED">Scheduled</option>
                    <option value="BROADCAST_STARTING_SOON">Starting Soon</option>
                    <option value="BROADCAST_STARTED">Started</option>
                    <option value="BROADCAST_ENDED">Ended</option>
                    <option value="NEW_BROADCAST_POSTED">New Posted</option>
                  </>
                ) : (
                  <>
                    <option value="all">All Status</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="LIVE">Live</option>
                    <option value="ENDED">Ended</option>
                    <option value="TESTING">Testing</option>
                  </>
                )}
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
              {viewMode === 'analytics' && (
                <>
                  <option value="duration">By Duration</option>
                  <option value="interactions">By Interactions</option>
                </>
              )}
            </select>

            {/* Refresh button for analytics */}
            {viewMode === 'analytics' && (
              <button
                onClick={fetchDetailedBroadcastAnalytics}
                disabled={loading}
                className="flex items-center px-3 py-2 bg-maroon-600 text-white rounded-lg hover:bg-maroon-700 transition-colors disabled:opacity-50"
              >
                <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {
          // Broadcasts history view (from Broadcast entity)
          <div className="space-y-3">
            {broadcastsLoading ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-maroon-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading broadcasts…</p>
              </div>
            ) : filteredAndSortedBroadcasts.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <RadioIcon className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No broadcasts</h3>
                <p className="text-gray-600 dark:text-gray-400">Try adjusting your search or time filter.</p>
              </div>
            ) : (
              filteredAndSortedBroadcasts.map((b) => {
                const startForExpiry = parseBackendTimestamp(b.actualStart || b.scheduledStart);
                const expired = isExpiredByDate(startForExpiry);
                return (
                  <div key={b.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{b.title || 'Untitled Broadcast'}</h3>
                          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            <span className="mr-2">Status: {b.status}</span>
                            {b.createdBy?.firstname || b.createdBy?.lastname ? (
                              <span className="mr-2">• DJ: {`${b.createdBy?.firstname || ''} ${b.createdBy?.lastname || ''}`.trim()}</span>
                            ) : null}
                            {b.actualStart ? (
                              <span className="mr-2">• Started: {formatInTimeZone(parseBackendTimestamp(b.actualStart), 'Asia/Manila', 'MMM d, yyyy • h:mm a')}</span>
                            ) : null}
                            {b.actualEnd ? (
                              <span>• Ended: {formatInTimeZone(parseBackendTimestamp(b.actualEnd), 'Asia/Manila', 'MMM d, yyyy • h:mm a')}</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {expired ? (
                            <span className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-md" title="Chat download expired after 7 days">Expired</span>
                          ) : (
                            <button
                              onClick={() => handleDownloadChat(b.id)}
                              disabled={downloadingId === b.id}
                              className="px-3 py-1.5 text-sm bg-maroon-600 text-white rounded-md hover:bg-maroon-700 disabled:opacity-50"
                              title="Download chat messages as Excel (available for 7 days)"
                            >
                              {downloadingId === b.id ? 'Downloading...' : 'Download Chat'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        }

        {/* Load More */}
        {broadcastHistoryList.length > 0 && hasMore && (
          <div className="mt-6 text-center">
            <button
              onClick={loadMoreBroadcasts}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 
