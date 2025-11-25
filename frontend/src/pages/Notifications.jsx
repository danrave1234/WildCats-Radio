import { useState, useMemo } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { parseISO } from 'date-fns';
import { 
  Bell, 
  Search, 
  Filter, 
  CheckCircle,
  Check,
  Trash,
  Archive,
  AlertTriangle,
  Info,
  Mic,
  User,
  Calendar,
  Volume2,
  RefreshCw
} from 'lucide-react';

const notificationTypeIcons = {
  BROADCAST_SCHEDULED: Calendar,
  BROADCAST_STARTING_SOON: AlertTriangle,
  BROADCAST_STARTED: Mic,
  BROADCAST_ENDED: Volume2,
  NEW_BROADCAST_POSTED: Info,
  USER_REGISTERED: User,
  GENERAL: Info,
  default: Bell
};

const notificationTypeColors = {
  BROADCAST_SCHEDULED: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
  BROADCAST_STARTING_SOON: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30',
  BROADCAST_STARTED: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
  BROADCAST_ENDED: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
  NEW_BROADCAST_POSTED: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30',
  USER_REGISTERED: 'text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30',
  GENERAL: 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30',
  default: 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30'
};

// Helper to parse backend timestamp (treat backend LocalDateTime as local time)
const parseBackendTimestamp = (timestamp) => {
  if (!timestamp) return null;
  return parseISO(timestamp);
};

export default function Notifications() {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    fetchNotifications,
    isConnected,
    hasMore,
    loadMoreNotifications,
    combinedNotifications
  } = useNotifications();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedNotifications, setSelectedNotifications] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ✅ PHASE 6: Performance optimization - limit rendered notifications for large lists
  const MAX_RENDERED_NOTIFICATIONS = 100; // Render max 100 notifications at once

  // Manual refresh function
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchNotifications();
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredAndSortedNotifications = useMemo(() => {
    let filtered = notifications;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(notification =>
        notification.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notification.type.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (selectedFilter === 'unread') {
      filtered = filtered.filter(notification => !notification.read);
    } else if (selectedFilter === 'read') {
      filtered = filtered.filter(notification => notification.read);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        const aTs = a.timestamp;
        const bTs = b.timestamp;
        return new Date(bTs) - new Date(aTs);
      } else if (sortBy === 'oldest') {
        const aTs = a.timestamp;
        const bTs = b.timestamp;
        return new Date(aTs) - new Date(bTs);
      } else if (sortBy === 'unread') {
        return b.read - a.read; // Unread first
      }
      return 0;
    });

    return filtered;
  }, [notifications, searchTerm, selectedFilter, sortBy]);

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
  };

  const handleSelectNotification = (notificationId) => {
    setSelectedNotifications(prev => 
      prev.includes(notificationId)
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    );
  };

  const handleMarkSelectedAsRead = () => {
    selectedNotifications.forEach(id => {
      const notification = notifications.find(n => n.id === id);
      if (notification && !notification.read) {
        markAsRead(id);
      }
    });
    setSelectedNotifications([]);
  };

  const getNotificationIcon = (type) => {
    const IconComponent = notificationTypeIcons[type] || notificationTypeIcons.default;
    return IconComponent;
  };

  const getNotificationColor = (type) => {
    return notificationTypeColors[type] || notificationTypeColors.default;
  };

  const formatNotificationType = (type) => {
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-maroon-100 dark:bg-maroon-900/30 rounded-lg">
                <Bell className="h-8 w-8 text-maroon-600 dark:text-maroon-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Notifications</h1>
                <p className="text-gray-600 dark:text-gray-400 flex items-center space-x-2">
                  <span>
                    {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
                  </span>
                  <div className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-green-500' : 'bg-yellow-500'
                  }`} title={isConnected ? 'Real-time updates active' : 'Using periodic updates'} />
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Manual Refresh Button - Only show when WebSocket disconnected */}
              {!isConnected && (
                <button
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Manual refresh (WebSocket disconnected)"
                >
                  <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              )}
              
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center space-x-2 px-4 py-2 bg-maroon-600 text-white rounded-lg hover:bg-maroon-700 transition-colors"
                >
                  <CheckCircle className="h-5 w-5" />
                  <span>Mark All Read</span>
                </button>
              )}
            </div>
          </div>

          {/* Search and Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon-500"
              >
                <option value="all">All</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
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
              <option value="unread">Unread First</option>
            </select>
          </div>

          {/* Bulk Actions */}
          {selectedNotifications.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
                  {selectedNotifications.length} notification{selectedNotifications.length > 1 ? 's' : ''} selected
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={handleMarkSelectedAsRead}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Mark as Read
                  </button>
                  <button
                    onClick={() => setSelectedNotifications([])}
                    className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

          {/* Notifications List (includes recent announcements from last 7 days) */}
        <div className="space-y-3">
          {(() => {
            const list = (() => {
              let arr = [...combinedNotifications];
              if (searchTerm) {
                arr = arr.filter(n => (n.message||'').toLowerCase().includes(searchTerm.toLowerCase()) || (n.type||'').toLowerCase().includes(searchTerm.toLowerCase()));
              }
              if (selectedFilter === 'unread') arr = arr.filter(n => !n.read && !String(n.id).startsWith('ann-'));
              if (selectedFilter === 'read') arr = arr.filter(n => n.read || String(n.id).startsWith('ann-'));

              if (sortBy === 'oldest') arr = arr.slice().reverse();
              if (sortBy === 'unread') arr = arr.slice().sort((a,b)=> (a.read?1:0)-(b.read?1:0));

              // ✅ PHASE 6: Performance optimization - limit rendered notifications
              const hasMoreToShow = arr.length > MAX_RENDERED_NOTIFICATIONS;
              const displayedList = hasMoreToShow ? arr.slice(0, MAX_RENDERED_NOTIFICATIONS) : arr;

              return { items: displayedList, total: arr.length, hasMoreToShow };
            })();
            return list.items.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <Bell className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {searchTerm || selectedFilter !== 'all' ? 'No matching notifications' : 'No notifications'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {searchTerm || selectedFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria.' 
                  : 'You\'ll see notifications here when they arrive.'}
              </p>
            </div>
          ) : (
            list.items.map((notification) => {
              const IconComponent = getNotificationIcon(notification.type);
              const isSelected = selectedNotifications.includes(notification.id);
              
              return (
                <div
                  key={notification.id}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border transition-all duration-200 hover:shadow-md ${
                    !notification.read 
                      ? 'border-maroon-200 dark:border-maroon-700 bg-maroon-50/30 dark:bg-maroon-900/10' 
                      : 'border-gray-200 dark:border-gray-700'
                  } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                >
                  <div className="p-6">
                    <div className="flex items-start space-x-4">
                      {/* Checkbox */}
                      <div className="flex-shrink-0 pt-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectNotification(notification.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                        />
                      </div>

                      {/* Icon */}
                      <div className={`flex-shrink-0 p-2 rounded-lg ${getNotificationColor(notification.type)}`}>
                        <IconComponent className="h-6 w-6" />
                      </div>

                      {/* Content */}
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => {
                          if (String(notification.id).startsWith('ann-')) {
                            window.location.href = '/announcements';
                            return;
                          }
                          handleNotificationClick(notification)
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {formatNotificationType(notification.type)}
                              </span>
                              {!notification.read && !String(notification.id).startsWith('ann-') && (
                                <span className="inline-block h-2 w-2 bg-maroon-500 rounded-full"></span>
                              )}
                            </div>
                            <p className="text-gray-900 dark:text-white font-medium mb-1">
                              {notification.message}
                            </p>
                            <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                              <span>{formatInTimeZone(parseBackendTimestamp(notification.timestamp), 'Asia/Manila', 'MMM d, yyyy • h:mm a')}</span>
                              <span>•</span>
                              <span>{formatDistanceToNow(parseBackendTimestamp(notification.timestamp), { addSuffix: true })}</span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center space-x-2 ml-4">
                            {!notification.read && !String(notification.id).startsWith('ann-') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(notification.id);
                                }}
                                className="p-1 text-gray-400 hover:text-maroon-600 dark:hover:text-maroon-400 transition-colors"
                                title="Mark as read"
                              >
                                <Check className="h-5 w-5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )})()}

          {/* ✅ PHASE 6: Show message when notifications are limited for performance */}
          {(() => {
            const list = (() => {
              let arr = [...combinedNotifications];
              if (searchTerm) {
                arr = arr.filter(n => (n.message||'').toLowerCase().includes(searchTerm.toLowerCase()) || (n.type||'').toLowerCase().includes(searchTerm.toLowerCase()));
              }
              if (selectedFilter === 'unread') arr = arr.filter(n => !n.read && !String(n.id).startsWith('ann-'));
              if (selectedFilter === 'read') arr = arr.filter(n => n.read || String(n.id).startsWith('ann-'));

              if (sortBy === 'oldest') arr = arr.slice().reverse();
              if (sortBy === 'unread') arr = arr.slice().sort((a,b)=> (a.read?1:0)-(b.read?1:0));

              const hasMoreToShow = arr.length > MAX_RENDERED_NOTIFICATIONS;
              const hiddenCount = arr.length - MAX_RENDERED_NOTIFICATIONS;

              return { hasMoreToShow, hiddenCount };
            })();

            return list.hasMoreToShow ? (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700 text-center">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Showing {MAX_RENDERED_NOTIFICATIONS} of {list.hiddenCount + MAX_RENDERED_NOTIFICATIONS} notifications.
                  Consider using filters or search to find specific notifications.
                </p>
              </div>
            ) : null;
          })()}
        </div>

        

        {/* Load More */}
        {hasMore && (
          <div className="mt-6 text-center">
            <button
              onClick={loadMoreNotifications}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white"
            >
              Load more
            </button>
          </div>
        )}


        {/* Connection status indicator */}
        <div className="mt-8 text-center space-y-2">
          <div className="inline-flex items-center space-x-2 text-sm">
            <div className={`h-2 w-2 rounded-full ${
              isConnected
                ? 'bg-green-500 animate-pulse'
                : 'bg-yellow-500'
            }`}></div>
            <span className={isConnected ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}>
              {isConnected ? 'Real-time updates active' : 'Using periodic updates (every 30 seconds)'}
            </span>
          </div>
          {isConnected && (
            <p className="text-xs text-muted-foreground">
              Notifications sync across all your devices • Instant updates when actions occur
            </p>
          )}
          {!isConnected && (
            <p className="text-xs text-muted-foreground">
              Manual refresh available above • Updates may be delayed
            </p>
          )}
        </div>
      </div>
    </div>
  );
} 