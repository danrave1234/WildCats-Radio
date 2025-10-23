import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { config } from '../config';
import { useAuth } from './AuthContext';
import { analyticsService } from '../services/api/index.js';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';

const AnalyticsContext = createContext();

// Cookie helper function (consistent with AuthContext)
const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return null;
};

// Get the proper WebSocket URL from config
const getWsUrl = () => {
  const sockJsBaseUrl = config.sockJsBaseUrl;
  return sockJsBaseUrl + '/ws-radio';
};

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
}

export function AnalyticsProvider({ children }) {
  const { isAuthenticated, currentUser } = useAuth();

  // State for analytics data
  const [userStats, setUserStats] = useState({
    totalUsers: 0,
    listeners: 0,
    djs: 0,
    admins: 0,
    moderators: 0,
    newUsersThisMonth: 0
  });

  const [broadcastStats, setBroadcastStats] = useState({
    totalBroadcasts: 0,
    liveBroadcasts: 0,
    upcomingBroadcasts: 0,
    completedBroadcasts: 0,
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

  // State for real-time metrics (separate from activity-based metrics)
  const [realtimeStats, setRealtimeStats] = useState({
    currentListeners: 0,
    streamLive: false,
    serverStatus: 'DOWN',
    lastUpdated: null
  });

  // State for demographic analytics (age groups)
  const [demographicStats, setDemographicStats] = useState({
    ageGroups: {
      teens: 0,
      youngAdults: 0,
      adults: 0,
      middleAged: 0,
      seniors: 0,
      unknown: 0
    },
    gender: {
      male: 0,
      female: 0,
      other: 0,
      unknown: 0
    },
    totalUsers: 0,
    usersWithBirthdate: 0,
    usersWithGender: 0,
    lastUpdated: null
  });

  const [mostPopularBroadcasts, setMostPopularBroadcasts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);

  // WebSocket reference
  const stompClientRef = useRef(null);
  const wsReconnectTimerRef = useRef(null);
  const fetchAbortControllerRef = useRef(null);

  // Function to refresh activity data from analytics endpoint
  const refreshActivityData = async () => {
    try {
      const response = await analyticsService.getActivityStats();
      const data = response.data || {};

      // Transform the recentActivities to match expected format for dashboard
      const recentActivities = (data.recentActivities || []).map(activity => ({
        id: activity.id,
        type: activity.activityType, // Maps activityType to type
        message: activity.description, // Maps description to message
        username: activity.user?.email || activity.user?.name || 'Unknown user', // Maps user info
        timestamp: activity.timestamp,
        user: activity.user // Keep full user object if needed
      }));

      console.log('Analytics: Refreshed activity stats:', {
        todayActivities: data.todayActivities || 0,
        weekActivities: data.weekActivities || 0,
        monthActivities: data.monthActivities || 0,
        recentActivities: recentActivities.length
      });

      setActivityStats({
        todayActivities: data.todayActivities || 0,
        weekActivities: data.weekActivities || 0,
        monthActivities: data.monthActivities || 0,
        recentActivities
      });

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Analytics: Error refreshing activity data:', error);
    }
  };

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
      const token = getCookie('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      // Create WebSocket connection
      const stompClient = Stomp.over(() => new SockJS(getWsUrl()));
      stompClient.reconnect_delay = 5000;
      stompClient.debug = () => {};

      stompClient.connect(headers, () => {
        console.log('Connected to analytics WebSocket');
        stompClientRef.current = stompClient;
        setWsConnected(true);

        // Subscribe to analytics updates
        stompClient.subscribe('/topic/analytics/broadcasts', message => {
          try {
            const data = JSON.parse(message.body);
            setBroadcastStats(prevStats => ({ ...prevStats, ...data }));
            setLastUpdated(new Date());
          } catch (error) {
            console.warn('Error processing broadcast stats update:', error);
          }
        });

        stompClient.subscribe('/topic/analytics/users', message => {
          try {
            const data = JSON.parse(message.body);
            setUserStats(prevStats => ({ ...prevStats, ...data }));
            setLastUpdated(new Date());
          } catch (error) {
            console.warn('Error processing user stats update:', error);
          }
        });

        stompClient.subscribe('/topic/analytics/engagement', message => {
          try {
            const data = JSON.parse(message.body);
            setEngagementStats(prevStats => ({ ...prevStats, ...data }));
            setLastUpdated(new Date());
          } catch (error) {
            console.warn('Error processing engagement stats update:', error);
          }
        });

        stompClient.subscribe('/topic/analytics/activity', message => {
          try {
            const data = JSON.parse(message.body);
            console.log('Analytics: Received activity update via WebSocket:', data);

            // Only update if we receive complete activity data via WebSocket
            if (data.recentActivities && Array.isArray(data.recentActivities)) {
              setActivityStats(prev => ({
                ...prev,
                todayActivities: data.todayActivities || prev.todayActivities,
                weekActivities: data.weekActivities || prev.weekActivities,
                monthActivities: data.monthActivities || prev.monthActivities,
                recentActivities: data.recentActivities
              }));
              setLastUpdated(new Date());
            }
            // No automatic refresh - user must manually refresh for new data
          } catch (error) {
            console.warn('Error processing activity update:', error);
          }
        });

        stompClient.subscribe('/topic/analytics/popular-broadcasts', message => {
          try {
            const data = JSON.parse(message.body);
            setMostPopularBroadcasts(data);
            setLastUpdated(new Date());
          } catch (error) {
            console.warn('Error processing popular broadcasts update:', error);
          }
        });

        // Subscribe to real-time metrics updates
        stompClient.subscribe('/topic/analytics/realtime', message => {
          try {
            const data = JSON.parse(message.body);
            console.log('Analytics: Received real-time update via WebSocket:', data);
            setRealtimeStats(prevStats => ({ ...prevStats, ...data }));
            setLastUpdated(new Date());
          } catch (error) {
            console.warn('Error processing real-time stats update:', error);
          }
        });

        // Subscribe to demographic analytics updates
        stompClient.subscribe('/topic/analytics/demographics', message => {
          try {
            const data = JSON.parse(message.body);
            console.log('Analytics: Received demographic update via WebSocket:', data);
            setDemographicStats(prevStats => ({ ...prevStats, ...data }));
            setLastUpdated(new Date());
          } catch (error) {
            console.warn('Error processing demographic stats update:', error);
          }
        });

        // Immediately ask server to push a fresh snapshot (avoids waiting for scheduler)
        try {
          stompClient.send('/app/analytics/refresh', {}, '{}');
        } catch (e) {
          console.warn('Analytics: initial refresh send failed', e);
        }

      }, error => {
        console.error('WebSocket connection error:', error);
        setWsConnected(false);
        wsReconnectTimerRef.current = setTimeout(() => {
          console.log('Attempting to reconnect analytics WebSocket...');
          connectWebSocket();
        }, 5000);
      });

    } catch (error) {
      console.error('WebSocket setup error:', error);
      setWsConnected(false);
      wsReconnectTimerRef.current = setTimeout(() => {
        console.log('Attempting to reconnect analytics WebSocket...');
        connectWebSocket();
      }, 5000);
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

  // Fetch initial analytics data using the new analytics API endpoints
  const fetchInitialData = async () => {
    console.log('Analytics: fetchInitialData called');
    setLoading(true);
    setError(null);

    try {
      // Check user permissions
      if (!currentUser) {
        setLoading(false);
        return;
      }

      const role = currentUser.role;
      const canViewAnalytics = role === 'DJ' || role === 'ADMIN' || role === 'MODERATOR';
      const isAdmin = role === 'ADMIN';

      // If user doesn't have proper permissions, set default values and return
      if (!canViewAnalytics) {
        setLoading(false);
        return;
        }

      // Cancel any in-flight requests before starting a new batch
      if (fetchAbortControllerRef.current) {
        try { fetchAbortControllerRef.current.abort(); } catch (e) {}
      }
      fetchAbortControllerRef.current = new AbortController();
      const { signal } = fetchAbortControllerRef.current;

      // Fetch analytics data from the API endpoints
      const promises = [];

      // DJ/Admin/Moderator can access core analytics endpoints
      if (canViewAnalytics) {
        promises.push(
          analyticsService.getBroadcastStats({ signal })
            .then(response => ({ type: 'broadcasts', data: response.data }))
            .catch(err => ({ type: 'broadcasts', error: err })),

          analyticsService.getEngagementStats({ signal })
            .then(response => ({ type: 'engagement', data: response.data }))
            .catch(err => ({ type: 'engagement', error: err })),

          analyticsService.getDemographicAnalytics({ signal })
            .then(response => ({ type: 'demographics', data: response.data }))
            .catch(err => ({ type: 'demographics', error: err })),

          // Use analytics endpoint for activity stats (accessible to DJ and ADMIN)
          analyticsService.getActivityStats({ limit: 200, signal })
            .then(response => {
              const data = response.data || {};

              // The analytics endpoint already provides the counts and recentActivities
              // Transform the recentActivities to match expected format for dashboard
              const recentActivities = (data.recentActivities || []).map(activity => ({
                id: activity.id,
                type: activity.activityType, // Maps activityType to type
                message: activity.description, // Maps description to message
                username: activity.user?.email || activity.user?.name || 'Unknown user', // Maps user info
                timestamp: activity.timestamp,
                user: activity.user // Keep full user object if needed
              }));

              console.log('Analytics: Transformed recent activities:', recentActivities);

              return { 
                type: 'activity', 
                data: {
                  todayActivities: data.todayActivities || 0,
                  weekActivities: data.weekActivities || 0,
                  monthActivities: data.monthActivities || 0,
                  recentActivities
                }
              };
            })
            .catch(err => ({ type: 'activity', error: err })),

          analyticsService.getPopularBroadcasts({ signal })
            .then(response => ({ type: 'popular', data: response.data }))
            .catch(err => ({ type: 'popular', error: err }))
        );
          }

      // Only admins can access user stats
      if (isAdmin) {
        promises.push(
          analyticsService.getUserStats({ signal })
            .then(response => ({ type: 'users', data: response.data }))
            .catch(err => ({ type: 'users', error: err }))
        );
      }

      if (promises.length === 0) {
        setLoading(false);
        return;
            }

      const results = await Promise.all(promises);

      // Process results
      results.forEach(result => {
        if (result.error) {
          return;
        }

        const { type, data } = result;

        switch (type) {
          case 'broadcasts':
            setBroadcastStats(data);
            break;
          case 'users':
            setUserStats(data);
            break;
          case 'engagement':
            setEngagementStats(data);
            break;
          case 'demographics':
            setDemographicStats(data);
            break;
          case 'activity':
            setActivityStats(data);
            break;
          case 'popular':
            setMostPopularBroadcasts(data);
            break;
        }
      });

      setLastUpdated(new Date());
    } catch (err) {
      setError('Failed to load analytics data. Please check your connection and try again.');
    } finally {
      setLoading(false);
      // Clear controller if it belongs to this fetch
      if (fetchAbortControllerRef.current && fetchAbortControllerRef.current.signal.aborted) {
        fetchAbortControllerRef.current = null;
      }
    }
  };

  // Fetch once on mount and when user/role becomes available; skip WebSocket usage per new requirement
  useEffect(() => {
    if (isAuthenticated && currentUser && (currentUser.role === 'DJ' || currentUser.role === 'ADMIN' || currentUser.role === 'MODERATOR')) {
      fetchInitialData();
    }

    return () => {
      if (fetchAbortControllerRef.current) {
        try { fetchAbortControllerRef.current.abort(); } catch (e) {}
      }
    };
  }, [isAuthenticated, currentUser?.id, currentUser?.role]);

  // Function to manually refresh data (HTTP only)
  const refreshData = async () => {
    if (!isAuthenticated || !currentUser) return;
    if (currentUser.role !== 'DJ' && currentUser.role !== 'ADMIN') return;
    await fetchInitialData();
  };

  // Refresh demographics only (lightweight, allowed for DJ/ADMIN/MODERATOR)
  const refreshDemographics = async () => {
    if (!isAuthenticated || !currentUser) return;
    const role = currentUser.role;
    const canViewAnalytics = role === 'DJ' || role === 'ADMIN' || role === 'MODERATOR';
    if (!canViewAnalytics) return;
    try {
      const response = await analyticsService.getDemographicAnalytics();
      const data = response.data || {};
      setDemographicStats(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Analytics: Error refreshing demographic stats:', error);
    }
  };

  const value = {
    userStats,
    broadcastStats,
    engagementStats,
    activityStats,
    realtimeStats,
    demographicStats,
    mostPopularBroadcasts,
    loading,
    error,
    lastUpdated,
    wsConnected,
    refreshData,
    refreshActivityData,
    refreshDemographics
  };

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
} 
