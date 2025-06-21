import { createContext, useContext, useState, useEffect } from 'react';
import api, { notificationService } from '../services/api';
import { useAuth } from './AuthContext';

const BroadcastHistoryContext = createContext();

export const useBroadcastHistory = () => {
  const context = useContext(BroadcastHistoryContext);
  if (!context) {
    throw new Error('useBroadcastHistory must be used within a BroadcastHistoryProvider');
  }
  return context;
};

export const BroadcastHistoryProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [broadcastHistory, setBroadcastHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Define broadcast-related notification types
  const BROADCAST_TYPES = [
    'BROADCAST_SCHEDULED',
    'BROADCAST_STARTING_SOON',
    'BROADCAST_STARTED',
    'BROADCAST_ENDED',
    'NEW_BROADCAST_POSTED'
  ];

  const fetchBroadcastHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use the existing notification service to get all notifications
      const response = await notificationService.getAll();
      
      // Filter to only broadcast-related notifications
      const broadcastNotifications = response.data.filter(notification =>
        BROADCAST_TYPES.includes(notification.type)
      );
      
      // Sort by newest first
      broadcastNotifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      setBroadcastHistory(broadcastNotifications);
    } catch (err) {
      console.error('Error fetching broadcast history:', err);
      setError('Failed to fetch broadcast history');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentBroadcastHistory = async (days = 7) => {
    try {
      setLoading(true);
      setError(null);
      
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);
      
      const response = await notificationService.getRecent(sinceDate.toISOString());
      
      // Filter to only broadcast-related notifications
      const broadcastNotifications = response.data.filter(notification =>
        BROADCAST_TYPES.includes(notification.type)
      );
      
      // Sort by newest first
      broadcastNotifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      setBroadcastHistory(broadcastNotifications);
    } catch (err) {
      console.error('Error fetching recent broadcast history:', err);
      setError('Failed to fetch recent broadcast history');
    } finally {
      setLoading(false);
    }
  };

  const fetchBroadcastHistoryByType = async (type) => {
    try {
      setLoading(true);
      setError(null);
      
      if (!BROADCAST_TYPES.includes(type)) {
        throw new Error('Invalid broadcast type');
      }
      
      const response = await notificationService.getByType(type);
      
      // Sort by newest first
      const sortedHistory = response.data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      setBroadcastHistory(sortedHistory);
    } catch (err) {
      console.error('Error fetching broadcast history by type:', err);
      setError('Failed to fetch broadcast history by type');
    } finally {
      setLoading(false);
    }
  };

  const fetchBroadcastStats = async () => {
    try {
      // Get all notifications and calculate stats
      const response = await notificationService.getAll();
      
      // Filter to only broadcast-related notifications
      const broadcastNotifications = response.data.filter(notification =>
        BROADCAST_TYPES.includes(notification.type)
      );
      
      const totalBroadcasts = broadcastNotifications.length;
      const scheduledCount = broadcastNotifications.filter(n => n.type === 'BROADCAST_SCHEDULED').length;
      const startedCount = broadcastNotifications.filter(n => n.type === 'BROADCAST_STARTED').length;
      const endedCount = broadcastNotifications.filter(n => n.type === 'BROADCAST_ENDED').length;
      
      // Get recent activity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentActivity = broadcastNotifications.filter(n =>
        new Date(n.timestamp) >= thirtyDaysAgo
      ).length;
      
      setStats({
        totalBroadcasts,
        scheduledCount,
        startedCount,
        endedCount,
        recentActivity
      });
    } catch (err) {
      console.error('Error fetching broadcast stats:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchBroadcastHistory();
      fetchBroadcastStats();
    }
  }, [isAuthenticated]);

  const value = {
    broadcastHistory,
    stats,
    loading,
    error,
    fetchBroadcastHistory,
    fetchRecentBroadcastHistory,
    fetchBroadcastHistoryByType,
    fetchBroadcastStats,
  };

  return (
    <BroadcastHistoryContext.Provider value={value}>
      {children}
    </BroadcastHistoryContext.Provider>
  );
}; 