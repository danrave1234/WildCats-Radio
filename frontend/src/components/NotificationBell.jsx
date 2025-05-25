import { BellIcon, BellAlertIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useNotifications } from '../context/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

export default function NotificationBell() {
    const { notifications, unreadCount, isOpen, setIsOpen, markAsRead, markAllAsRead } = useNotifications();

    const handleNotificationClick = (notification) => {
        if (!notification.read) {
            markAsRead(notification.id);
        }
        // Handle navigation or action based on notification type
        if (notification.link) {
            window.location.href = notification.link;
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700 focus:outline-none relative"
                aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
            >
                {unreadCount > 0 ? (
                    <BellAlertIcon className="h-6 w-6 text-maroon-600 dark:text-maroon-400" />
                ) : (
                    <BellIcon className="h-6 w-6" />
                )}
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-maroon-600 text-white text-xs font-medium flex items-center justify-center">
            {unreadCount}
          </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-lg ring-1 ring-black ring-opacity-5 z-50 border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-maroon-50 to-gold-50 dark:from-maroon-900/30 dark:to-gold-900/20">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                                <BellIcon className="h-5 w-5 mr-2 text-maroon-600 dark:text-maroon-400" />
                                Notifications
                            </h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-sm font-medium text-maroon-600 hover:text-maroon-700 dark:text-maroon-400 dark:hover:text-maroon-300 flex items-center"
                                >
                                    <CheckCircleIcon className="h-4 w-4 mr-1" />
                                    Mark all read
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                        {notifications.length === 0 ? (
                            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                                <BellIcon className="h-12 w-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                                <p>No notifications</p>
                            </div>
                        ) : (
                            notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    onClick={() => handleNotificationClick(notification)}
                                    className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150 ${
                                        !notification.read ? 'bg-maroon-50/50 dark:bg-maroon-900/20' : ''
                                    }`}
                                >
                                    <div className="flex items-start">
                                        {!notification.read && (
                                            <span className="h-2 w-2 mt-1.5 mr-2 rounded-full bg-maroon-500 flex-shrink-0"></span>
                                        )}
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                {notification.title}
                                            </p>
                                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                                {notification.message}
                                            </p>
                                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {notifications.length > 0 && (
                        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                            <Link
                                to="/notifications"
                                onClick={() => setIsOpen(false)}
                                className="w-full text-center py-1.5 px-2 block text-sm font-medium text-maroon-600 hover:text-maroon-700 dark:text-maroon-400 dark:hover:text-maroon-300 hover:bg-maroon-50 dark:hover:bg-maroon-900/20 rounded-md transition-colors"
                            >
                                View all notifications
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
} 