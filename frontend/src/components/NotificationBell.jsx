import { Bell, CheckCircle, Trash2 } from 'lucide-react';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { useNotifications } from '../context/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';
import { useState } from 'react';

export default function NotificationBell() {
    const { notifications, unreadCount, markAsRead, markAllAsRead, clearAllNotifications } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);
    
    // Get the latest 10 notifications
    const latestNotifications = notifications.slice(0, 10);

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

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <button
                    className="relative rounded-full h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 flex-shrink-0 text-maroon-600 bg-maroon-100 hover:bg-maroon-200 transition-all duration-300 flex items-center justify-center focus:outline-none focus:ring-0"
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
                sideOffset={8}
                className="w-80 p-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 !rounded-none"
            >
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-maroon-600 dark:text-maroon-400">
                            Notifications
                        </h3>
                        <div className="flex items-center space-x-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllAsRead}
                                    className="text-sm font-medium text-maroon-600 hover:text-maroon-700 dark:text-maroon-400 dark:hover:text-maroon-300 flex items-center transition-colors duration-200 hover:bg-maroon-100 dark:hover:bg-maroon-900/30 px-2 py-1 !rounded-none"
                                >
                                    <CheckCircleIcon className="h-4 w-4 mr-1" />
                                    Mark all read
                                </button>
                            )}
                            {notifications.length > 0 && (
                                <button
                                    onClick={handleClearAll}
                                    className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex items-center transition-colors duration-200 hover:bg-red-100 dark:hover:bg-red-900/30 px-2 py-1 !rounded-none"
                                >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Clear all
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Notifications List */}
                <div className="max-h-96 overflow-y-auto">
                    {latestNotifications.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                            <Bell className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                            <p className="font-medium">No notifications</p>
                            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                                We'll notify you when something happens
                            </p>
                        </div>
                    ) : (
                        latestNotifications.map((notification, index) => (
                            <div
                                key={notification.id}
                                onClick={() => handleNotificationClick(notification)}
                                className={`px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150 border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
                                    !notification.read ? 'bg-maroon-50/50 dark:bg-maroon-900/20 border-l-4 border-l-maroon-500' : ''
                                }`}
                            >
                                <div className="flex items-start space-x-3">
                                    {!notification.read && (
                                        <span className="h-2 w-2 mt-2 !rounded-none bg-maroon-500 flex-shrink-0"></span>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                                {notification.type?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()) || 'Notification'}
                                            </p>
                                            <span className="text-xs text-gray-400 dark:text-gray-500 ml-2 flex-shrink-0">
                                                {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                                            {notification.message}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                {latestNotifications.length > 0 && (
                    <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                        <Link
                            to="/notifications"
                            onClick={() => setIsOpen(false)}
                            className="w-full text-center py-2 px-3 block text-sm font-medium text-maroon-600 hover:text-maroon-700 dark:text-maroon-400 dark:hover:text-maroon-300 hover:underline hover:-translate-y-0.5 !rounded-none transition-all duration-200"
                        >
                            View all notifications →
                        </Link>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
} 