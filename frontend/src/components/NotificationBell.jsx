import { 
  Bell, 
  CheckCircle, 
  Trash2,
  Calendar,
  AlertTriangle,
  Mic,
  Volume2,
  Info,
  User,
  Settings,
  Radio,
  MessageSquare,
  Users,
  ChevronDown
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';
import { useState, useMemo } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { parseISO } from 'date-fns';

// CSS animation for notification bell shake
const bellShakeStyles = `
  @keyframes notificationShake {
    0%, 100% { transform: rotate(0deg); }
    10% { transform: rotate(-3deg); }
    20% { transform: rotate(3deg); }
    30% { transform: rotate(-3deg); }
    40% { transform: rotate(3deg); }
    50% { transform: rotate(-2deg); }
    60% { transform: rotate(2deg); }
    70% { transform: rotate(-1deg); }
    80% { transform: rotate(1deg); }
    90% { transform: rotate(0deg); }
  }

  .notification-shake .bell-icon {
    animation: notificationShake 0.8s ease-in-out infinite;
    animation-delay: 2s;
    transform-origin: center;
  }

  .notification-scroll {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 #f1f5f9;
  }

  .notification-scroll::-webkit-scrollbar {
    width: 8px;
  }

  .notification-scroll::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 4px;
  }

  .notification-scroll::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }

  .notification-scroll::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
`;

const notificationTypeIcons = {
  BROADCAST_SCHEDULED: Calendar,
  BROADCAST_STARTING_SOON: AlertTriangle,
  BROADCAST_STARTED: Mic,
  BROADCAST_ENDED: Volume2,
  NEW_BROADCAST_POSTED: Info,
  ANNOUNCEMENT: Info,
  ANNOUNCEMENT_PUBLISHED: Info,
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
  ANNOUNCEMENT: { bg: 'bg-maroon-100 dark:bg-maroon-900/20', icon: 'text-maroon-600' },
  ANNOUNCEMENT_PUBLISHED: { bg: 'bg-maroon-100 dark:bg-maroon-900/20', icon: 'text-maroon-600' },
  USER_REGISTERED: { bg: 'bg-indigo-100 dark:bg-indigo-900/20', icon: 'text-indigo-500' },
  GENERAL: { bg: 'bg-gray-100 dark:bg-gray-900/20', icon: 'text-gray-500' },
  default: { bg: 'bg-maroon-100 dark:bg-maroon-900/20', icon: 'text-maroon-600' }
};

// Helper to parse backend timestamp (treat backend LocalDateTime as local time)
const parseBackendTimestamp = (timestamp) => {
  if (!timestamp) return null;
  return parseISO(timestamp);
};

export default function NotificationBell() {
    const { 
        unreadCount, 
        markAsRead, 
        markAllAsRead,
        deleteNotification,
        combinedNotifications
    } = useNotifications();
    const { isAuthenticated } = useAuth();
    
    const [isOpen, setIsOpen] = useState(false);
    const [swipeStates, setSwipeStates] = useState({}); // Track swipe state for each notification

    const handleMarkAllAsRead = async () => {
        try {
            await markAllAsRead();
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    };

    const handleMarkAsRead = async (notificationId) => {
        try {
            await markAsRead(notificationId);
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const handleDeleteNotification = async (notificationId) => {
        try {
            await deleteNotification(notificationId);
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    const handleNotificationClick = (notification) => {
        if (!notification.read) {
            handleMarkAsRead(notification.id);
        }
        // Handle navigation or action based on notification type
        if (notification.link) {
            window.location.href = notification.link;
        }
        setIsOpen(false); // Close popover after clicking notification
    };

    const popoverNotifications = useMemo(() => {
        return combinedNotifications
            .filter((notification) => notification?.isAnnouncement || !notification?.read)
            .slice(0, 10);
    }, [combinedNotifications]);

    const getNotificationIcon = (type) => {
        const IconComponent = notificationTypeIcons[type] || notificationTypeIcons.default;
        return IconComponent;
    };

    const getNotificationColor = (type) => {
        return notificationTypeColors[type] || notificationTypeColors.default;
    };

    // Swipe handling functions
    const handleSwipeStart = (notificationId, clientX) => {
        setSwipeStates(prev => ({
            ...prev,
            [notificationId]: {
                startX: clientX,
                currentX: clientX,
                isDragging: true,
                offset: 0
            }
        }));
    };

    const handleSwipeMove = (notificationId, clientX) => {
        setSwipeStates(prev => {
            const current = prev[notificationId];
            if (!current?.isDragging) return prev;
            
            const offset = clientX - current.startX;
            return {
                ...prev,
                [notificationId]: {
                    ...current,
                    currentX: clientX,
                    offset: offset
                }
            };
        });
    };

    const handleSwipeEnd = (notificationId) => {
        const swipeState = swipeStates[notificationId];
        if (!swipeState?.isDragging) return;

        const swipeThreshold = 100; // Minimum distance to trigger mark as read
        const swipeDistance = Math.abs(swipeState.offset);

        if (swipeDistance >= swipeThreshold) {
            // Mark as read and remove from list
            handleMarkAsRead(notificationId);
        }

        // Reset swipe state
        setSwipeStates(prev => ({
            ...prev,
            [notificationId]: {
                startX: 0,
                currentX: 0,
                isDragging: false,
                offset: 0
            }
        }));
    };

    // Mouse event handlers
    const handleMouseDown = (e, notificationId) => {
        e.preventDefault();
        handleSwipeStart(notificationId, e.clientX);
        
        const handleMouseMove = (e) => handleSwipeMove(notificationId, e.clientX);
        const handleMouseUp = () => {
            handleSwipeEnd(notificationId);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Touch event handlers
    const handleTouchStart = (e, notificationId) => {
        const touch = e.touches[0];
        handleSwipeStart(notificationId, touch.clientX);
    };

    const handleTouchMove = (e, notificationId) => {
        const touch = e.touches[0];
        handleSwipeMove(notificationId, touch.clientX);
    };

    const handleTouchEnd = (notificationId) => {
        handleSwipeEnd(notificationId);
    };

    return (
        <>
            {/* Inject CSS animation styles */}
            <style>{bellShakeStyles}</style>
            
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <button
                        className={`relative rounded-full h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 flex-shrink-0 text-foreground bg-transparent hover:bg-muted transition-all duration-300 flex items-center justify-center focus:outline-none focus:ring-0 hover:scale-105 ${isOpen ? 'scale-105' : ''} ${unreadCount > 0 ? 'notification-shake' : ''}`}
                        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
                    >
                        <Bell className="bell-icon h-4 w-4 sm:h-5 sm:w-5" />
                        
                        {/* Notification Badge */}
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 h-5 w-5 sm:h-6 sm:w-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold animate-pulse">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </button>
                </PopoverTrigger>
                
            <PopoverContent 
                    align="end" 
                    sideOffset={12}
                    className="w-[420px] max-h-[520px] p-0 border border-border bg-card text-card-foreground shadow-xl !rounded-none"
                >
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-border bg-muted">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <h3 className="text-base font-semibold">
                                    Notifications
                                </h3>
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
                    <div className={`${(!isAuthenticated || popoverNotifications.length === 0) ? 'p-4' : 'max-h-96 overflow-y-auto notification-scroll'}`}>
                        {!isAuthenticated ? (
                            <div className="flex flex-col items-center justify-center text-center p-8">
                                <div className="relative mb-4">
                                    <Bell className="h-12 w-12 text-muted-foreground mx-auto" />
                                </div>
                                <h3 className="text-lg font-medium mb-2">Sign in to view notifications</h3>
                                <a href="/login" className="text-sm text-maroon-600 hover:underline">Login</a>
                            </div>
                        ) : (popoverNotifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-center p-8">
                                <div className="relative mb-4">
                                    <Bell className="h-12 w-12 text-muted-foreground mx-auto" />
                                    <div className="absolute -top-1 -right-1 h-4 w-4 bg-muted rounded-full"></div>
                                </div>
                                <h3 className="text-lg font-medium mb-2">No unread notifications</h3>
                                <p className="text-sm text-muted-foreground max-w-xs">
                                    You're all caught up! New notifications will appear here.
                                </p>
                            </div>
                        ) : (
                            popoverNotifications
                              .map((notification, index) => {
                                const swipeState = swipeStates[notification.id] || { offset: 0, isDragging: false };
                                const opacity = swipeState.isDragging ? Math.max(0.3, 1 - Math.abs(swipeState.offset) / 200) : 1;
                                const transform = `translateX(${swipeState.offset}px)`;
                                
                                return (
                                <div
                                    key={notification.id}
                                    className="group relative px-4 py-4 cursor-pointer transition-all duration-300 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100/50 border-b border-gray-100 last:border-b-0 select-none"
                                    style={{
                                        transform: transform,
                                        opacity: opacity,
                                        transition: swipeState.isDragging ? 'none' : 'all 0.3s ease'
                                    }}
                                    onClick={() => !swipeState.isDragging && handleNotificationClick(notification)}
                                    onMouseDown={(e) => handleMouseDown(e, notification.id)}
                                    onTouchStart={(e) => handleTouchStart(e, notification.id)}
                                    onTouchMove={(e) => handleTouchMove(e, notification.id)}
                                    onTouchEnd={() => handleTouchEnd(notification.id)}
                                >
                                    {/* Swipe indicators */}
                                    {swipeState.isDragging && Math.abs(swipeState.offset) > 50 && (
                                        <>
                                            <div className={`absolute left-2 top-1/2 transform -translate-y-1/2 transition-all duration-200 ${
                                                Math.abs(swipeState.offset) >= 100 ? 'text-green-600 scale-110' : 'text-green-500 opacity-70'
                                            }`}>
                                                <CheckCircle className="h-6 w-6" />
                                            </div>
                                            <div className={`absolute right-2 top-1/2 transform -translate-y-1/2 transition-all duration-200 ${
                                                Math.abs(swipeState.offset) >= 100 ? 'text-green-600 scale-110' : 'text-green-500 opacity-70'
                                            }`}>
                                                <CheckCircle className="h-6 w-6" />
                                            </div>
                                            {Math.abs(swipeState.offset) >= 100 && (
                                                <div className="absolute inset-0 bg-green-100 bg-opacity-50 flex items-center justify-center">
                                                    <span className="text-green-700 font-semibold text-sm">Release to mark as read</span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    
                                    {/* Background gradient overlay on hover */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-wildcats-maroon/0 to-wildcats-maroon/0 group-hover:from-wildcats-maroon/5 group-hover:to-transparent transition-all duration-300 pointer-events-none"></div>
                                    
                                    <div className="relative flex items-start space-x-4">
                                        {/* Icon with enhanced styling */}
                                        <div className="flex-shrink-0 mt-1">
                                            <div className={`w-10 h-10 ${getNotificationColor(notification.type).bg} rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:scale-105`}>
                                                {(() => {
                                                    const IconComponent = getNotificationIcon(notification.type);
                                                    return <IconComponent className={`h-5 w-5 ${getNotificationColor(notification.type).icon}`} />;
                                                })()}
                                            </div>
                                        </div>
                                        
                                        {/* Content with improved layout */}
                                        <div className="flex-1 min-w-0 space-y-2">
                                            {/* Message with better typography */}
                                            <div className="flex items-start justify-between gap-3">
                                                <h4 className="text-sm font-semibold leading-5 group-hover:text-wildcats-maroon transition-colors duration-200">
                                                    {notification.message}
                                                </h4>
                                                
                                                {/* Unread indicator with pulse effect */}
                                                {!notification.read && (
                                                    <div className="w-3 h-3 bg-wildcats-yellow rounded-full flex-shrink-0 mt-0.5 animate-pulse shadow-sm">
                                                        <div className="w-full h-full bg-wildcats-yellow rounded-full animate-ping opacity-30"></div>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Enhanced timestamp section */}
                                            <div className="flex items-center justify-between text-xs">
                                                <div className="flex items-center space-x-2">
                                                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-muted text-muted-foreground font-medium">
                                                        {formatInTimeZone(parseBackendTimestamp(notification.timestamp), 'Asia/Manila', 'MMM dd, yyyy')}
                                                    </span>
                                                    <span className="text-muted-foreground">•</span>
                                                    <span className="text-muted-foreground font-medium">
                                                        {formatInTimeZone(parseBackendTimestamp(notification.timestamp), 'Asia/Manila', 'h:mm a')}
                                                    </span>
                                                </div>
                                                
                                                <span className="text-muted-foreground font-medium bg-muted px-2 py-1 rounded-md transition-colors duration-200">
                                                    {formatDistanceToNow(parseBackendTimestamp(notification.timestamp), { addSuffix: true })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Hover indicator line */}
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-wildcats-maroon transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                                </div>
                            )})
                        ))}
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
        </>
    );
} 