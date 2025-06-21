import { 
  Bell, 
  CheckCircle, 
  Trash2,
  Calendar,
  AlertTriangle,
  Mic,
  Volume2,
  Info,
  User
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { formatDistanceToNow, format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';
import { useState, useEffect } from 'react';

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
  BROADCAST_SCHEDULED: { bg: 'bg-blue-100 dark:bg-blue-900/20', icon: 'text-blue-500' },
  BROADCAST_STARTING_SOON: { bg: 'bg-yellow-100 dark:bg-yellow-900/20', icon: 'text-yellow-500' },
  BROADCAST_STARTED: { bg: 'bg-green-100 dark:bg-green-900/20', icon: 'text-green-500' },
  BROADCAST_ENDED: { bg: 'bg-red-100 dark:bg-red-900/20', icon: 'text-red-500' },
  NEW_BROADCAST_POSTED: { bg: 'bg-purple-100 dark:bg-purple-900/20', icon: 'text-purple-500' },
  USER_REGISTERED: { bg: 'bg-indigo-100 dark:bg-indigo-900/20', icon: 'text-indigo-500' },
  GENERAL: { bg: 'bg-gray-100 dark:bg-gray-900/20', icon: 'text-gray-500' },
  default: { bg: 'bg-maroon-100 dark:bg-maroon-900/20', icon: 'text-maroon-600' }
};

export default function NotificationBell() {
    const { 
        notifications, 
        unreadCount, 
        markAsRead, 
        markAllAsRead, 
        clearAllNotifications, 
        fetchNotifications,
        isConnected 
    } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // Get the latest 10 unread notifications
    const latestNotifications = notifications.filter(n => !n.read).slice(0, 10);

    // Refresh notifications when popover is opened
    useEffect(() => {
        if (isOpen && !isRefreshing) {
            setIsRefreshing(true);
            fetchNotifications().finally(() => {
                setIsRefreshing(false);
            });
        }
    }, [isOpen, fetchNotifications, isRefreshing]);

    const handleNotificationClick = (notification) => {
        if (!notification.read) {
            markAsRead(notification.id);
        }
        // Handle navigation or action based on notification type
        if (notification.link) {
            window.location.href = notification.link;
        }
        setIsOpen(false); // Close popover after clicking notification
    };

    const handleMarkAllAsRead = () => {
        markAllAsRead();
        // Keep popover open to show the updated state
    };

    const handleClearAll = () => {
        clearAllNotifications();
        // Keep popover open to show the updated state
    };

    const getNotificationIcon = (type) => {
        const IconComponent = notificationTypeIcons[type] || notificationTypeIcons.default;
        return IconComponent;
    };

    const getNotificationColor = (type) => {
        return notificationTypeColors[type] || notificationTypeColors.default;
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
            <button
                    className={`relative rounded-full h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 flex-shrink-0 text-maroon-600 bg-white hover:bg-gray-100 transition-all duration-300 flex items-center justify-center focus:outline-none focus:ring-0 hover:scale-110 hover:-translate-y-1 hover:shadow-lg ${isOpen ? 'scale-110 -translate-y-1 shadow-lg' : ''}`}
                aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
            >
                    <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 h-4 w-4 sm:h-5 sm:w-5 bg-red-500 text-white text-[10px] sm:text-xs rounded-full flex items-center justify-center font-medium">
                            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
                )}
                    <span className="sr-only">Notifications</span>
            </button>
            </PopoverTrigger>
            
            <PopoverContent 
                align="end" 
                sideOffset={12}
                className="w-96 p-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl rounded-none"
            >
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                Notifications
                            </h3>
                            {unreadCount > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-maroon-600 text-white">
                                    {unreadCount}
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllAsRead}
                                className="text-sm font-medium text-maroon-600 hover:text-maroon-700 dark:text-maroon-400 dark:hover:text-maroon-300 transition-all duration-200 hover:-translate-y-0.5 hover:underline hover:underline-offset-2"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>
                </div>

                {/* Notifications List */}
                <div className={`${latestNotifications.length === 0 ? '' : 'h-96 overflow-y-auto'}`}>
                    {latestNotifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center p-8 h-96">
                            <div className="relative mb-4">
                                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                                    <Bell className="h-6 w-6 text-gray-400 dark:text-gray-600" />
                                </div>
                            </div>
                            <h4 className="font-semibold text-gray-900 dark:text-white text-base mb-2">No notifications</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed">
                                You're all caught up! We'll notify you when something important happens.
                            </p>
                        </div>
                        ) : (
                        latestNotifications.map((notification, index) => (
                            <div
                                key={notification.id}
                                onClick={() => handleNotificationClick(notification)}
                                className="px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200 border-b border-gray-200 dark:border-gray-700 last:border-b-0 group relative"
                            >
                                <div className="flex items-start space-x-3">
                                    {/* Icon */}
                                    <div className="flex-shrink-0 mt-0.5">
                                        <div className={`w-8 h-8 ${getNotificationColor(notification.type).bg} rounded-lg flex items-center justify-center`}>
                                            {(() => {
                                                const IconComponent = getNotificationIcon(notification.type);
                                                return <IconComponent className={`h-4 w-4 ${getNotificationColor(notification.type).icon}`} />;
                                            })()}
                                        </div>
                                    </div>
                                    
                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                {/* Full notification message */}
                                                <p className="text-sm text-gray-900 dark:text-white font-medium mb-2 leading-relaxed">
                                                    {notification.message}
                                                </p>
                                                
                                                {/* Formatted timestamp */}
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                                        {format(new Date(notification.timestamp), 'MMM dd, yyyy • h:mm a')}
                                                    </span>
                                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                                        {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            {/* Unread indicator */}
                                            {!notification.read && (
                                                <div className="w-2 h-2 bg-maroon-600 rounded-full flex-shrink-0 mt-1 ml-3"></div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-maroon-300 dark:border-maroon-600 bg-maroon-600 dark:bg-maroon-700">
                    <Link
                        to="/notifications"
                        onClick={() => setIsOpen(false)}
                        className="w-full text-center py-2 px-3 block text-sm font-normal text-yellow-400 transition-all duration-200 hover:-translate-y-0.5 hover:underline hover:underline-offset-2"
                    >
                        View all notifications →
                    </Link>
                </div>
            </PopoverContent>
        </Popover>
    );
} 