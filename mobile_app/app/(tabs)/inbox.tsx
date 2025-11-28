import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Platform,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import {
  NotificationDTO,
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../services/userService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type FilterTab = 'all' | 'unread' | 'read';
type SortOption = 'newest' | 'oldest' | 'unread';

const notificationTypeIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  BROADCAST_SCHEDULED: 'calendar-outline',
  BROADCAST_STARTING_SOON: 'alert-circle-outline',
  BROADCAST_STARTED: 'radio',
  BROADCAST_ENDED: 'volume-high-outline',
  NEW_BROADCAST_POSTED: 'information-circle-outline',
  USER_REGISTERED: 'person-outline',
  GENERAL: 'information-circle-outline',
  default: 'notifications-outline',
};

const notificationTypeColors: Record<string, { bg: string; iconColor: string }> = {
  BROADCAST_SCHEDULED: { bg: 'rgba(37, 99, 235, 0.15)', iconColor: '#2563EB' },
  BROADCAST_STARTING_SOON: { bg: 'rgba(217, 119, 6, 0.15)', iconColor: '#D97706' },
  BROADCAST_STARTED: { bg: 'rgba(22, 163, 74, 0.15)', iconColor: '#16A34A' },
  BROADCAST_ENDED: { bg: 'rgba(220, 38, 38, 0.15)', iconColor: '#DC2626' },
  NEW_BROADCAST_POSTED: { bg: 'rgba(147, 51, 234, 0.15)', iconColor: '#9333EA' },
  USER_REGISTERED: { bg: 'rgba(79, 70, 229, 0.15)', iconColor: '#4F46E5' },
  GENERAL: { bg: 'rgba(75, 85, 99, 0.15)', iconColor: '#94a3b8' },
  default: { bg: 'rgba(75, 85, 99, 0.15)', iconColor: '#94a3b8' },
};

const parseBackendTimestamp = (timestamp: string | null | undefined): Date | null => {
  if (!timestamp) return null;
  try {
    return parseISO(timestamp);
  } catch {
    return null;
  }
};

const formatNotificationType = (type: string): string => {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};

const InboxScreen: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterTab>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [selectedNotifications, setSelectedNotifications] = useState<number[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isConnected] = useState(true); // TODO: Implement WebSocket connection status
  const pageSize = 20;

  const fetchNotifications = useCallback(async (showRefreshing = false, pageNum = 0) => {
    if (!isAuthenticated) {
      setError('Authentication required');
      setIsLoading(false);
      return;
    }

    try {
      if (showRefreshing) setIsRefreshing(true);
      else if (pageNum === 0) setIsLoading(true);
      setError(null);

      const notificationsResult = await getNotifications(pageNum, pageSize);
      const unreadCountResult = await getUnreadCount();

      if ('error' in notificationsResult) {
        setError(notificationsResult.error || 'Failed to fetch notifications');
        if (pageNum === 0) setNotifications([]);
      } else {
        const newNotifications = notificationsResult.content || [];
        if (pageNum === 0) {
          setNotifications(newNotifications);
        } else {
          setNotifications(prev => {
            const existingIds = new Set(prev.map(n => n.id));
            const filtered = newNotifications.filter(n => !existingIds.has(n.id));
            return [...prev, ...filtered];
          });
        }
        setPage(pageNum);
        setHasMore(!notificationsResult.last);
      }

      if (typeof unreadCountResult === 'object' && 'error' in unreadCountResult) {
        console.warn('Unread count error:', unreadCountResult.error);
        setUnreadCount(0);
      } else {
        setUnreadCount(unreadCountResult);
      }
    } catch (err) {
      setError('Failed to load notifications');
      console.error('Fetch notifications error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isAuthenticated, pageSize]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = useCallback(() => {
    fetchNotifications(true, 0);
  }, [fetchNotifications]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore && !isRefreshing) {
      fetchNotifications(false, page + 1);
    }
  }, [isLoading, hasMore, isRefreshing, page, fetchNotifications]);

  const handleMarkAsRead = useCallback(async (notificationId: number) => {
    try {
      const result = await markNotificationAsRead(notificationId);
      if ('error' in result) {
        console.error('Failed to mark as read:', result.error);
        return;
      }
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Mark as read error:', err);
    }
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      const result = await markAllNotificationsAsRead();
      if (typeof result === 'object' && 'error' in result) {
        console.error('Failed to mark all as read:', result.error);
        return;
      }
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Mark all as read error:', err);
    }
  }, []);

  const handleSelectNotification = useCallback((notificationId: number) => {
    setSelectedNotifications(prev =>
      prev.includes(notificationId)
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    );
  }, []);

  const handleMarkSelectedAsRead = useCallback(async () => {
    for (const id of selectedNotifications) {
      await handleMarkAsRead(id);
    }
    setSelectedNotifications([]);
  }, [selectedNotifications, handleMarkAsRead]);

  const filteredAndSortedNotifications = useMemo(() => {
    let filtered = [...notifications];

    if (searchTerm) {
      filtered = filtered.filter(
        notification =>
          notification.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
          notification.type.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedFilter === 'unread') {
      filtered = filtered.filter(notification => !notification.read);
    } else if (selectedFilter === 'read') {
      filtered = filtered.filter(notification => notification.read);
    }

    filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        const aTs = parseBackendTimestamp(a.timestamp);
        const bTs = parseBackendTimestamp(b.timestamp);
        if (!aTs || !bTs) return 0;
        return bTs.getTime() - aTs.getTime();
      } else if (sortBy === 'oldest') {
        const aTs = parseBackendTimestamp(a.timestamp);
        const bTs = parseBackendTimestamp(b.timestamp);
        if (!aTs || !bTs) return 0;
        return aTs.getTime() - bTs.getTime();
      } else if (sortBy === 'unread') {
        return (b.read ? 1 : 0) - (a.read ? 1 : 0);
      }
      return 0;
    });

    return filtered;
  }, [notifications, searchTerm, selectedFilter, sortBy]);

  const getNotificationIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    return notificationTypeIcons[type] || notificationTypeIcons.default;
  };

  const getNotificationColor = (type: string) => {
    return notificationTypeColors[type] || notificationTypeColors.default;
  };

  const renderEmptyState = () => {
    const emptyMessages = {
      all: { icon: 'notifications-outline', message: 'No notifications', subtitle: "You'll see notifications here when they arrive." },
      unread: { icon: 'checkmark-circle-outline', message: 'All caught up!', subtitle: 'You have no unread notifications.' },
      read: { icon: 'notifications-outline', message: 'No read notifications', subtitle: 'You have no read notifications yet.' },
    };
    const { icon, message, subtitle } = emptyMessages[selectedFilter] || emptyMessages.all;

    return (
      <View style={styles.emptyStateContainer}>
        <Ionicons name={icon as any} size={64} color="#94a3b8" />
        <Text style={styles.emptyStateTitle}>{message}</Text>
        <Text style={styles.emptyStateSubtitle}>{subtitle}</Text>
      </View>
    );
  };

  if (isLoading && !isRefreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#91403E" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && notifications.length === 0 && isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={64} color="#7F1D1D" />
          <Text style={styles.errorTitle}>Unable to Load Notifications</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => fetchNotifications()}
          >
            <Text style={styles.errorButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Show blurred background with Login/Sign Up buttons when not authenticated
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Base black background */}
        <View style={styles.backgroundBase} />
        
        {/* Radial gradient overlay - top center */}
        <LinearGradient
          colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.gradientOverlay1}
        />
        
        {/* Maroon gradient - bottom left */}
        <LinearGradient
          colors={['rgba(127,29,29,0.35)', 'transparent']}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientMaroon1}
        />
        
        {/* Yellow gradient - top right */}
        <LinearGradient
          colors={['rgba(251,191,36,0.18)', 'transparent']}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.gradientYellow1}
        />
        
        {/* Large maroon/yellow gradient blur - top right */}
        <LinearGradient
          colors={['rgba(251,191,36,0.50)', 'rgba(127,29,29,0.45)', 'transparent']}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.gradientBlur1}
        />
        
        {/* Large maroon/rose gradient blur - bottom left */}
        <LinearGradient
          colors={['rgba(127,29,29,0.60)', 'rgba(225,29,72,0.45)', 'transparent']}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientBlur2}
        />

        {/* Blur overlay */}
        <View style={styles.blurOverlay} />
        
        {/* Content with blur effect */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        >
          {/* Header */}
          <View style={styles.headerSection}>
            <Text style={styles.title}>Notifications</Text>
            <Text style={styles.subtitle}>Stay updated with latest news</Text>
          </View>
        </ScrollView>

        {/* Login/Sign Up buttons overlay */}
        <View style={styles.authOverlay}>
          <View style={styles.authCard}>
            <Ionicons name="lock-closed-outline" size={48} color="#91403E" />
            <Text style={styles.authTitle}>Sign In Required</Text>
            <Text style={styles.authSubtitle}>
              Please sign in to view your notifications
            </Text>
            <View style={styles.authButtons}>
              <TouchableOpacity
                style={styles.authLoginButton}
                onPress={() => router.push('/auth/login' as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.authLoginButtonText}>Log in</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.authSignupButton}
                onPress={() => router.push('/auth/signup' as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.authSignupButtonText}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Base black background */}
      <View style={styles.backgroundBase} />
      
      {/* Radial gradient overlay - top center */}
      <LinearGradient
        colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.gradientOverlay1}
      />
      
      {/* Maroon gradient - bottom left */}
      <LinearGradient
        colors={['rgba(127,29,29,0.35)', 'transparent']}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientMaroon1}
      />
      
      {/* Yellow gradient - top right */}
      <LinearGradient
        colors={['rgba(251,191,36,0.18)', 'transparent']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradientYellow1}
      />
      
      {/* Large maroon/yellow gradient blur - top right */}
      <LinearGradient
        colors={['rgba(251,191,36,0.50)', 'rgba(127,29,29,0.45)', 'transparent']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradientBlur1}
      />
      
      {/* Large maroon/rose gradient blur - bottom left */}
      <LinearGradient
        colors={['rgba(127,29,29,0.60)', 'rgba(225,29,72,0.45)', 'transparent']}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientBlur2}
      />

      {/* Header */}
      <View style={styles.headerSection}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Notifications</Text>
            <View style={styles.headerSubtitleRow}>
              <Text style={styles.subtitle}>
                {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
              </Text>
              <View style={[styles.connectionIndicator, { backgroundColor: isConnected ? '#16A34A' : '#D97706' }]} />
            </View>
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={handleMarkAllAsRead}
              style={styles.markAllButton}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="white" />
              <Text style={styles.markAllButtonText}>Mark All Read</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search and Filter Bar */}
        <View style={styles.searchFilterContainer}>
          {/* Search */}
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={20} color="#94a3b8" style={styles.searchIcon} />
            <TextInput
              placeholder="Search notifications..."
              value={searchTerm}
              onChangeText={setSearchTerm}
              style={styles.searchInput}
              placeholderTextColor="#94a3b8"
            />
          </View>

          {/* Filter and Sort */}
          <View style={styles.filterRow}>
            <View style={styles.filterContainer}>
              <Ionicons name="filter-outline" size={18} color="#94a3b8" style={styles.filterIcon} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                <View style={styles.filterButtons}>
                  {(['all', 'unread', 'read'] as FilterTab[]).map((filter) => (
                    <TouchableOpacity
                      key={filter}
                      onPress={() => setSelectedFilter(filter)}
                      style={[
                        styles.filterButton,
                        selectedFilter === filter && styles.filterButtonActive,
                      ]}
                    >
                      <Text style={[
                        styles.filterButtonText,
                        selectedFilter === filter && styles.filterButtonTextActive,
                      ]}>
                        {filter.charAt(0).toUpperCase() + filter.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
            <TouchableOpacity
              onPress={() => {
                const options: SortOption[] = ['newest', 'oldest', 'unread'];
                const currentIndex = options.indexOf(sortBy);
                const nextIndex = (currentIndex + 1) % options.length;
                setSortBy(options[nextIndex]);
              }}
              style={styles.sortButton}
            >
              <Text style={styles.sortButtonText}>
                {sortBy === 'newest' ? 'Newest' : sortBy === 'oldest' ? 'Oldest' : 'Unread'} First
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bulk Actions */}
        {selectedNotifications.length > 0 && (
          <View style={styles.bulkActionsContainer}>
            <Text style={styles.bulkActionsText}>
              {selectedNotifications.length} notification{selectedNotifications.length > 1 ? 's' : ''} selected
            </Text>
            <View style={styles.bulkActionsButtons}>
              <TouchableOpacity
                onPress={handleMarkSelectedAsRead}
                style={styles.bulkActionButton}
              >
                <Text style={styles.bulkActionButtonText}>Mark as Read</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSelectedNotifications([])}
                style={[styles.bulkActionButton, styles.bulkActionButtonCancel]}
              >
                <Text style={styles.bulkActionButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Notifications List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 100 + insets.bottom },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={['#91403E']}
            tintColor="#91403E"
            title="Pull to refresh notifications"
            titleColor="#91403E"
          />
        }
        showsVerticalScrollIndicator={false}
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const paddingToBottom = 20;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
            loadMore();
          }
        }}
        scrollEventThrottle={400}
      >
        {filteredAndSortedNotifications.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.notificationsList}>
            {filteredAndSortedNotifications.map((notification) => {
              const iconName = getNotificationIcon(notification.type);
              const colors = getNotificationColor(notification.type);
              const isSelected = selectedNotifications.includes(notification.id);
              const timestamp = parseBackendTimestamp(notification.timestamp);

              return (
                <TouchableOpacity
                  key={notification.id}
                  onPress={() => {
                    if (!notification.read) {
                      handleMarkAsRead(notification.id);
                    }
                  }}
                  activeOpacity={0.7}
                  style={[
                    styles.notificationCard,
                    !notification.read && styles.notificationCardUnread,
                    isSelected && styles.notificationCardSelected,
                  ]}
                >
                  {!notification.read && <View style={styles.unreadIndicator} />}
                  <View style={styles.notificationContent}>
                    <View style={styles.notificationRow}>
                      {/* Checkbox */}
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleSelectNotification(notification.id);
                        }}
                        style={styles.checkboxContainer}
                        activeOpacity={0.7}
                      >
                        <View style={[
                          styles.checkbox,
                          isSelected && styles.checkboxSelected,
                        ]}>
                          {isSelected && (
                            <Ionicons name="checkmark" size={14} color="white" />
                          )}
                        </View>
                      </TouchableOpacity>

                      {/* Icon Container */}
                      <View style={[
                        styles.iconContainer,
                        { backgroundColor: colors.bg },
                      ]}>
                        <Ionicons name={iconName} size={24} color={colors.iconColor} />
                      </View>

                      {/* Content */}
                      <View style={styles.notificationTextContainer}>
                        <View style={styles.notificationHeaderRow}>
                          <View style={styles.notificationHeaderLeft}>
                            <View style={styles.notificationTypeRow}>
                              <Text style={[
                                styles.notificationType,
                                { color: colors.iconColor },
                              ]}>
                                {formatNotificationType(notification.type)}
                              </Text>
                              {!notification.read && (
                                <View style={styles.unreadDot} />
                              )}
                            </View>
                            <Text style={styles.notificationMessage} numberOfLines={3}>
                              {notification.message}
                            </Text>
                          </View>
                          {!notification.read && (
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(notification.id);
                              }}
                              style={styles.markReadButton}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="checkmark-circle" size={20} color="#91403E" />
                            </TouchableOpacity>
                          )}
                        </View>
                        {timestamp && (
                          <View style={styles.timestampRow}>
                            <Ionicons name="time-outline" size={14} color="#94a3b8" />
                            <Text style={styles.timestamp}>
                              {formatDistanceToNow(timestamp, { addSuffix: false })}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Load More */}
        {hasMore && filteredAndSortedNotifications.length > 0 && (
          <View style={styles.loadMoreContainer}>
            <TouchableOpacity
              onPress={loadMore}
              disabled={isLoading}
              style={styles.loadMoreButton}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#91403E" />
              ) : (
                <Text style={styles.loadMoreText}>Load more</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Connection status indicator */}
        <View style={styles.connectionStatusContainer}>
          <View style={styles.connectionStatusRow}>
            <View style={[
              styles.connectionStatusDot,
              { backgroundColor: isConnected ? '#16A34A' : '#D97706' },
            ]} />
            <Text style={[
              styles.connectionStatusText,
              { color: isConnected ? '#16A34A' : '#D97706' },
            ]}>
              {isConnected
                ? 'Real-time updates active'
                : 'Using periodic updates (every 30 seconds)'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backgroundBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  gradientOverlay1: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.4,
  },
  gradientMaroon1: {
    position: 'absolute',
    bottom: -SCREEN_HEIGHT * 0.3,
    left: -SCREEN_WIDTH * 0.2,
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_HEIGHT * 0.8,
    opacity: 0.3,
  },
  gradientYellow1: {
    position: 'absolute',
    top: -SCREEN_HEIGHT * 0.2,
    right: -SCREEN_WIDTH * 0.15,
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_HEIGHT * 0.7,
    opacity: 0.3,
  },
  gradientBlur1: {
    position: 'absolute',
    top: -SCREEN_HEIGHT * 0.3,
    right: -SCREEN_WIDTH * 0.15,
    width: SCREEN_WIDTH * 1.2,
    height: SCREEN_HEIGHT * 0.8,
    opacity: 0.4,
  },
  gradientBlur2: {
    position: 'absolute',
    bottom: -SCREEN_HEIGHT * 0.4,
    left: -SCREEN_WIDTH * 0.2,
    width: SCREEN_WIDTH * 1.2,
    height: SCREEN_HEIGHT * 1.0,
    opacity: 0.3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94a3b8',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#000000',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#e2e8f0',
    marginTop: 24,
    marginBottom: 8,
  },
  errorText: {
    color: '#94a3b8',
    marginBottom: 32,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  errorButton: {
    backgroundColor: '#91403E',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    shadowColor: '#91403E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  errorButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  headerSection: {
    paddingTop: 24,
    paddingBottom: 16,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e2e8f0',
    marginBottom: 4,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  connectionIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#91403E',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  markAllButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 14,
  },
  searchFilterContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#e2e8f0',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  filterIcon: {
    marginRight: 8,
  },
  filterScroll: {
    flex: 1,
  },
  filterButtons: {
    flexDirection: 'row',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#91403E',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
  },
  bulkActionsContainer: {
    marginTop: 8,
    padding: 16,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
  },
  bulkActionsText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#60A5FA',
    marginBottom: 12,
  },
  bulkActionsButtons: {
    flexDirection: 'row',
  },
  bulkActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    marginRight: 8,
  },
  bulkActionButtonCancel: {
    backgroundColor: '#6B7280',
  },
  bulkActionButtonText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
  },
  notificationsList: {
    paddingHorizontal: 16,
  },
  notificationCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    position: 'relative',
  },
  notificationCardUnread: {
    borderColor: 'rgba(145, 64, 62, 0.2)',
    backgroundColor: 'rgba(145, 64, 62, 0.03)',
  },
  notificationCardSelected: {
    borderColor: '#2563EB',
    borderWidth: 2,
  },
  unreadIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#91403E',
  },
  notificationContent: {
    padding: 16,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94a3b8',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#2563EB',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  notificationHeaderLeft: {
    flex: 1,
  },
  notificationTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  notificationType: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#91403E',
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e2e8f0',
    lineHeight: 20,
  },
  markReadButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(145, 64, 62, 0.1)',
    marginLeft: 8,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 6,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 300,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e2e8f0',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    color: '#94a3b8',
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  loadMoreContainer: {
    marginTop: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  loadMoreButton: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
  },
  loadMoreText: {
    color: '#e2e8f0',
    fontWeight: '500',
  },
  connectionStatusContainer: {
    marginTop: 32,
    marginBottom: 16,
    alignItems: 'center',
  },
  connectionStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  connectionStatusText: {
    fontSize: 14,
  },
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 5,
  },
  authOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    paddingHorizontal: 32,
  },
  authCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e2e8f0',
    marginTop: 16,
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  authButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  authLoginButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(145, 64, 62, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authLoginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#91403E',
  },
  authSignupButton: {
    flex: 1,
    backgroundColor: '#91403E',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#91403E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  authSignupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default InboxScreen;
