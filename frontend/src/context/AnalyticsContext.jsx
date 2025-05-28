import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  broadcastService, 
  authService, 
  activityLogService,
  chatService,
  songRequestService
} from '../services/api';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import { config } from '../config';
import { useAuth } from './AuthContext';

const AnalyticsContext = createContext();

// Get the proper WebSocket URL from config
const getWsUrl = () => {
  const wsBaseUrl = config.wsBaseUrl;
  const cleanHost = wsBaseUrl.replace(/^(https?:\/\/|wss?:\/\/)/, '');
  const isSecure = window.location.protocol === 'https:';
  // SockJS requires http/https protocol, not ws/wss
  const protocol = isSecure ? 'https:' : 'http:';
  return `${protocol}//${cleanHost}/ws-radio`;
};

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
}

export function AnalyticsProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [userStats, setUserStats] = useState({
    totalUsers: 0,
    listeners: 0,
    djs: 0,
    admins: 0,
    newUsersThisMonth: 0
  });

  const [broadcastStats, setBroadcastStats] = useState({
    totalBroadcasts: 0,
    liveBroadcasts: 0,
    upcomingBroadcasts: 0,
    completedBroadcasts: 0,
    totalDuration: 0,
    averageDuration: 0
  });

  const [engagementStats, setEngagementStats] = useState({
    totalSongRequests: 0,
    averageRequestsPerBroadcast: 0,
    totalChatMessages: 0,
    averageMessagesPerBroadcast: 0
  });

  const [activityStats, setActivityStats] = useState({
    recentActivities: [],
    todayActivities: 0,
    weekActivities: 0,
    monthActivities: 0
  });

  const [mostPopularBroadcasts, setMostPopularBroadcasts] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);

  // WebSocket reference
  const stompClientRef = useRef(null);
  const wsReconnectTimerRef = useRef(null);

  // Connect to WebSocket for real-time analytics updates
  const connectWebSocket = () => {
    if (stompClientRef.current && stompClientRef.current.connected) {
      return;
    }

    try {
      // Clear any reconnection timer
      if (wsReconnectTimerRef.current) {
        clearTimeout(wsReconnectTimerRef.current);
      }

      // Get authentication token from cookies
      const getCookie = (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
        return null;
      };

      const token = getCookie('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      // Create WebSocket connection with factory function for proper auto-reconnect support
      const stompClient = Stomp.over(() => new SockJS(getWsUrl()));

      // Enable auto-reconnect with 5 second delay
      stompClient.reconnect_delay = 5000;

      // Disable debug logging
      stompClient.debug = () => {};

      stompClient.connect(headers, () => {
        console.log('Connected to analytics WebSocket');
        stompClientRef.current = stompClient;
        setWsConnected(true);

        // Subscribe to analytics updates
        stompClient.subscribe('/topic/analytics/broadcasts', message => {
          try {
            const data = JSON.parse(message.body);
            setBroadcastStats(prevStats => ({
              ...prevStats,
              ...data
            }));
            setLastUpdated(new Date());
          } catch (error) {
            console.warn('Error processing broadcast stats update:', error);
          }
        });

        // Subscribe to user stats updates
        stompClient.subscribe('/topic/analytics/users', message => {
          try {
            const data = JSON.parse(message.body);
            setUserStats(prevStats => ({
              ...prevStats,
              ...data
            }));
            setLastUpdated(new Date());
          } catch (error) {
            console.warn('Error processing user stats update:', error);
          }
        });

        // Subscribe to engagement stats updates
        stompClient.subscribe('/topic/analytics/engagement', message => {
          try {
            const data = JSON.parse(message.body);
            setEngagementStats(prevStats => ({
              ...prevStats,
              ...data
            }));
            setLastUpdated(new Date());
          } catch (error) {
            console.warn('Error processing engagement stats update:', error);
          }
        });

        // Subscribe to activity updates
        stompClient.subscribe('/topic/analytics/activity', message => {
          try {
            const data = JSON.parse(message.body);

            // Update recent activities with new activity at top
            if (data.newActivity) {
              setActivityStats(prev => ({
                ...prev,
                recentActivities: [data.newActivity, ...prev.recentActivities.slice(0, 9)],
                todayActivities: data.todayActivities || prev.todayActivities,
                weekActivities: data.weekActivities || prev.weekActivities,
                monthActivities: data.monthActivities || prev.monthActivities
              }));
            } else {
              // Just update counts
              setActivityStats(prev => ({
                ...prev,
                todayActivities: data.todayActivities || prev.todayActivities,
                weekActivities: data.weekActivities || prev.weekActivities,
                monthActivities: data.monthActivities || prev.monthActivities
              }));
            }

            setLastUpdated(new Date());
          } catch (error) {
            console.warn('Error processing activity update:', error);
          }
        });

        // Subscribe to popular broadcasts updates
        stompClient.subscribe('/topic/analytics/popular-broadcasts', message => {
          try {
            const data = JSON.parse(message.body);
            setMostPopularBroadcasts(data);
            setLastUpdated(new Date());
          } catch (error) {
            console.warn('Error processing popular broadcasts update:', error);
          }
        });

      }, error => {
        console.error('WebSocket connection error:', error);
        setWsConnected(false);

        // Schedule reconnection attempt
        wsReconnectTimerRef.current = setTimeout(() => {
          console.log('Attempting to reconnect analytics WebSocket...');
          connectWebSocket();
        }, 5000); // Try to reconnect after 5 seconds
      });

    } catch (error) {
      console.error('WebSocket setup error:', error);
      setWsConnected(false);

      // Schedule reconnection attempt
      wsReconnectTimerRef.current = setTimeout(() => {
        console.log('Attempting to reconnect analytics WebSocket...');
        connectWebSocket();
      }, 5000); // Try to reconnect after 5 seconds
    }
  };

  // Disconnect WebSocket
  const disconnectWebSocket = () => {
    if (stompClientRef.current && stompClientRef.current.connected) {
      stompClientRef.current.disconnect();
      stompClientRef.current = null;
      setWsConnected(false);
    }

    if (wsReconnectTimerRef.current) {
      clearTimeout(wsReconnectTimerRef.current);
      wsReconnectTimerRef.current = null;
    }
  };

  // Function to fetch initial analytics data from real database
  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);

    try {
      const currentUserResponse = await authService.getCurrentUser();
      const currentUser = currentUserResponse.data;

      if (currentUser) {
        // Fetch all real data in parallel from correct database tables
        const fetchPromises = [
          broadcastService.getAll()
        ];

        // Fetch activity logs based on user role
        if (currentUser.role === 'ADMIN') {
          fetchPromises.unshift(authService.getAllUsers());
          fetchPromises.push(activityLogService.getLogs()); // Admin gets all activity logs
        } else {
          fetchPromises.push(activityLogService.getUserLogs(currentUser.id)); // Non-admin gets only their logs
        }

        const responses = await Promise.allSettled(fetchPromises);

        // Map responses based on user role
        let allUsersResponse, broadcastsResponse, activityLogsResponse;

        if (currentUser.role === 'ADMIN') {
          [allUsersResponse, broadcastsResponse, activityLogsResponse] = responses;
        } else {
          [broadcastsResponse, activityLogsResponse] = responses;
          allUsersResponse = { status: 'rejected' }; // Don't have user data for non-admins
        }

        // Process real user statistics
        if (allUsersResponse.status === 'fulfilled' && allUsersResponse.value.data) {
          const users = allUsersResponse.value.data;

          // Calculate real user statistics
          const listeners = users.filter(user => user.role === 'LISTENER').length;
          const djs = users.filter(user => user.role === 'DJ').length;
          const admins = users.filter(user => user.role === 'ADMIN').length;

          // Calculate new users this month
          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const newUsersThisMonth = users.filter(user => {
            if (!user.createdAt) return false;
            const userCreatedDate = new Date(user.createdAt);
            return userCreatedDate >= monthStart;
          }).length;

          setUserStats({
            totalUsers: users.length,
            listeners,
            djs,
            admins,
            newUsersThisMonth
          });
        } else {
          // For non-admin users or if user data fetch fails, show limited stats
          setUserStats({
            totalUsers: currentUser.role === 'ADMIN' ? 0 : 1, // Non-admins only see themselves
            listeners: currentUser.role === 'LISTENER' ? 1 : 0,
            djs: currentUser.role === 'DJ' ? 1 : 0,
            admins: currentUser.role === 'ADMIN' ? 1 : 0,
            newUsersThisMonth: 0 // Can't calculate without full user data
          });
        }

        // Process real broadcast statistics
        if (broadcastsResponse.status === 'fulfilled' && broadcastsResponse.value.data) {
          const broadcasts = broadcastsResponse.value.data;

          const liveBroadcasts = broadcasts.filter(b => b.status === 'LIVE');
          const upcomingBroadcasts = broadcasts.filter(b => b.status === 'SCHEDULED');
          const completedBroadcasts = broadcasts.filter(b => b.status === 'COMPLETED');

          // Calculate total duration and average from completed broadcasts
          let totalDuration = 0;
          let validDurationCount = 0;

          completedBroadcasts.forEach(broadcast => {
            if (broadcast.actualStart && broadcast.actualEnd) {
              const start = new Date(broadcast.actualStart);
              const end = new Date(broadcast.actualEnd);
              const duration = Math.round((end - start) / (1000 * 60)); // Duration in minutes
              if (duration > 0 && duration < 1440) { // Valid duration (less than 24 hours)
                totalDuration += duration;
                validDurationCount++;
              }
            }
          });

          const averageDuration = validDurationCount > 0 ? Math.round(totalDuration / validDurationCount) : 0;

          setBroadcastStats({
            totalBroadcasts: broadcasts.length,
            liveBroadcasts: liveBroadcasts.length,
            upcomingBroadcasts: upcomingBroadcasts.length,
            completedBroadcasts: completedBroadcasts.length,
            totalDuration,
            averageDuration
          });

          // Set popular broadcasts based on real data
          const sortedBroadcasts = [...broadcasts]
            .map(broadcast => ({
              ...broadcast,
              listenerCount: broadcast.listenerCount || 0,
              djName: broadcast.djName || broadcast.createdBy?.name || 'Unknown DJ'
            }))
            .sort((a, b) => b.listenerCount - a.listenerCount)
            .slice(0, 5);

          setMostPopularBroadcasts(sortedBroadcasts);

          // Calculate real engagement statistics from actual database data
          let totalChatMessages = 0;
          let totalSongRequests = 0;
          let broadcastsWithChats = 0;
          let broadcastsWithRequests = 0;

          try {
            // Fetch all song requests from the new analytics endpoint
            const songRequestResponse = await songRequestService.getStats();
            if (songRequestResponse.data) {
              totalSongRequests = songRequestResponse.data.totalSongRequests || 0;

              // Calculate broadcasts with song requests
              const allSongRequests = songRequestResponse.data.allRequests || [];
              const broadcastsWithRequestsSet = new Set(allSongRequests.map(req => req.broadcastId));
              broadcastsWithRequests = broadcastsWithRequestsSet.size;
            }
          } catch (error) {
            console.warn('Failed to fetch song request stats:', error);
            // Set default values for song request stats when access is forbidden (403)
            // This endpoint requires DJ or ADMIN role
            if (error.response && error.response.status === 403) {
              console.info('Access to song request stats is restricted to DJ and ADMIN users');
              totalSongRequests = 0;
              broadcastsWithRequests = 0;
            }
          }

          // Fetch chat messages for all broadcasts to get accurate counts
          const chatPromises = broadcasts.map(async (broadcast) => {
            try {
              const chatResponse = await chatService.getMessages(broadcast.id);
              return {
                broadcastId: broadcast.id,
                chatCount: chatResponse.data ? chatResponse.data.length : 0
              };
            } catch (error) {
              console.warn(`Failed to fetch chat for broadcast ${broadcast.id}:`, error);
              return {
                broadcastId: broadcast.id,
                chatCount: 0
              };
            }
          });

          const chatResults = await Promise.allSettled(chatPromises);

          chatResults.forEach((result) => {
            if (result.status === 'fulfilled') {
              const data = result.value;
              if (data.chatCount > 0) {
                totalChatMessages += data.chatCount;
                broadcastsWithChats++;
              }
            }
          });

          const averageMessagesPerBroadcast = broadcastsWithChats > 0 ? 
            Math.round(totalChatMessages / broadcastsWithChats) : 0;
          const averageRequestsPerBroadcast = broadcastsWithRequests > 0 ? 
            Math.round(totalSongRequests / broadcastsWithRequests) : 0;

          setEngagementStats({
            totalChatMessages,
            totalSongRequests,
            averageMessagesPerBroadcast,
            averageRequestsPerBroadcast
          });
        } else {
          // Fallback if broadcast data fetch fails
          setBroadcastStats({
            totalBroadcasts: 0,
            liveBroadcasts: 0,
            upcomingBroadcasts: 0,
            completedBroadcasts: 0,
            totalDuration: 0,
            averageDuration: 0
          });

          setEngagementStats({
            totalChatMessages: 0,
            totalSongRequests: 0,
            averageMessagesPerBroadcast: 0,
            averageRequestsPerBroadcast: 0
          });

          setMostPopularBroadcasts([]);
        }

        // Process real activity data from Activity Logs database
        if (activityLogsResponse.status === 'fulfilled' && activityLogsResponse.value.data) {
          const activityLogs = activityLogsResponse.value.data;

          const activities = activityLogs.map(log => ({
            type: log.activityType || 'GENERAL',
            message: log.description || 'System activity',
            username: log.user?.name || log.user?.username || 'System',
            timestamp: log.timestamp
          })).slice(0, 20); // Get recent activities for display

          // Calculate activity counts by timeframe from real data
          const now = new Date();
          const todayStart = new Date(now);
          todayStart.setHours(0, 0, 0, 0);

          const weekStart = new Date(now);
          weekStart.setDate(weekStart.getDate() - 7);

          const monthStart = new Date(now);
          monthStart.setDate(1);

          const todayActivities = activityLogs.filter(log => {
            if (!log.timestamp) return false;
            return new Date(log.timestamp) >= todayStart;
          }).length;

          const weekActivities = activityLogs.filter(log => {
            if (!log.timestamp) return false;
            return new Date(log.timestamp) >= weekStart;
          }).length;

          const monthActivities = activityLogs.filter(log => {
            if (!log.timestamp) return false;
            return new Date(log.timestamp) >= monthStart;
          }).length;

          setActivityStats({
            recentActivities: activities,
            todayActivities,
            weekActivities,
            monthActivities
          });
        } else {
          // Fallback if activity logs fetch fails
          setActivityStats({
            recentActivities: [],
            todayActivities: 0,
            weekActivities: 0,
            monthActivities: 0
          });
        }
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching real analytics data:', err);
      setError('Failed to load analytics data. Please check your connection and try again.');

      // Set empty fallback data on error
      setUserStats({
        totalUsers: 0,
        listeners: 0,
        djs: 0,
        admins: 0,
        newUsersThisMonth: 0
      });

      setBroadcastStats({
        totalBroadcasts: 0,
        liveBroadcasts: 0,
        upcomingBroadcasts: 0,
        completedBroadcasts: 0,
        totalDuration: 0,
        averageDuration: 0
      });

      setEngagementStats({
        totalChatMessages: 0,
        totalSongRequests: 0,
        averageMessagesPerBroadcast: 0,
        averageRequestsPerBroadcast: 0
      });

      setActivityStats({
        recentActivities: [],
        todayActivities: 0,
        weekActivities: 0,
        monthActivities: 0
      });

      setMostPopularBroadcasts([]);
    } finally {
      setLoading(false);
    }
  };

  // Connect to WebSocket and fetch initial data on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchInitialData();
      connectWebSocket();
    }

    return () => {
      disconnectWebSocket();
    };
  }, [isAuthenticated]);

  // Function to manually refresh data
  const refreshData = async () => {
    setLoading(true);

    try {
      await fetchInitialData();

      // Reconnect WebSocket if not connected
      if (!wsConnected) {
        disconnectWebSocket(); // Clean up any existing connection attempts
        connectWebSocket();    // Try to reconnect
      }
    } finally {
      setLoading(false);
    }
  };

  const value = {
    userStats,
    broadcastStats,
    engagementStats,
    activityStats,
    mostPopularBroadcasts,
    loading,
    error,
    lastUpdated,
    wsConnected,
    refreshData
  };

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
} 
