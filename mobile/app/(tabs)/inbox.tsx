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
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import '../../global.css';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import {
  NotificationDTO,
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../services/apiService';

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
  BROADCAST_SCHEDULED: { bg: 'bg-blue-100', iconColor: '#2563EB' },
  BROADCAST_STARTING_SOON: { bg: 'bg-yellow-100', iconColor: '#D97706' },
  BROADCAST_STARTED: { bg: 'bg-green-100', iconColor: '#16A34A' },
  BROADCAST_ENDED: { bg: 'bg-red-100', iconColor: '#DC2626' },
  NEW_BROADCAST_POSTED: { bg: 'bg-purple-100', iconColor: '#9333EA' },
  USER_REGISTERED: { bg: 'bg-indigo-100', iconColor: '#4F46E5' },
  GENERAL: { bg: 'bg-gray-100', iconColor: '#4B5563' },
  default: { bg: 'bg-gray-100', iconColor: '#4B5563' },
};

// Helper to parse backend timestamp
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

const NotificationsScreen: React.FC = () => {
  const router = useRouter();
  const { authToken } = useAuth();
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
    if (!authToken) {
      setError('Authentication required');
      setIsLoading(false);
      return;
    }

    try {
      if (showRefreshing) setIsRefreshing(true);
      else if (pageNum === 0) setIsLoading(true);
      setError(null);

      const notificationsResult = await getNotifications(authToken, pageNum, pageSize);
      const unreadCountResult = await getUnreadCount(authToken);

      if ('error' in notificationsResult) {
        setError(notificationsResult.error);
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
  }, [authToken, pageSize]);

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
    if (!authToken) return;

    try {
      const result = await markNotificationAsRead(notificationId, authToken);
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
  }, [authToken]);

  const handleMarkAllAsRead = useCallback(async () => {
    if (!authToken) return;

    try {
      const result = await markAllNotificationsAsRead(authToken);
      if (typeof result === 'object' && 'error' in result) {
        console.error('Failed to mark all as read:', result.error);
        return;
      }

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Mark all as read error:', err);
    }
  }, [authToken]);

  const handleSelectNotification = useCallback((notificationId: number) => {
    setSelectedNotifications(prev =>
      prev.includes(notificationId)
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    );
  }, []);

  const handleMarkSelectedAsRead = useCallback(async () => {
    if (!authToken) return;

    for (const id of selectedNotifications) {
      await handleMarkAsRead(id);
    }
    setSelectedNotifications([]);
  }, [selectedNotifications, authToken, handleMarkAsRead]);

  const filteredAndSortedNotifications = useMemo(() => {
    let filtered = [...notifications];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        notification =>
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
        return (b.read ? 1 : 0) - (a.read ? 1 : 0); // Unread first
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
      <View className="flex-1 justify-center items-center p-5">
        <Ionicons name={icon as any} size={64} color="#A0A0A0" className="mb-4" />
        <Text className="text-2xl font-bold text-gray-700 mb-2 text-center">{message}</Text>
        <Text className="text-gray-500 text-center text-base leading-relaxed px-4">
          {subtitle}
        </Text>
      </View>
    );
  };

  if (isLoading && !isRefreshing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB', paddingTop: insets.top }}>
        <Stack.Screen
          options={{
            title: 'Notifications',
            headerShadowVisible: false,
          }}
        />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#91403E" />
          <Text className="text-gray-600 mt-4">Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && notifications.length === 0) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-gray-50 p-6">
        <Ionicons name="cloud-offline-outline" size={64} color="#7F1D1D" />
        <Text className="text-2xl font-semibold text-gray-800 mt-6 mb-2">Unable to Load Notifications</Text>
        <Text className="text-gray-600 mb-8 text-base leading-relaxed text-center">{error}</Text>
        <TouchableOpacity
          className="bg-cordovan py-3 px-8 rounded-lg shadow-md active:opacity-80"
          onPress={() => fetchNotifications()}
        >
          <Text className="text-white font-semibold text-base">Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <Stack.Screen
        options={{
          title: 'Notifications',
          headerShadowVisible: false,
        }}
      />

      {/* Header */}
      <View className="px-5 pt-6 pb-4 bg-gray-50 border-b border-gray-200">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center flex-1">
            <View className="flex-1">
              <Text className="text-3xl font-bold text-gray-900">Notifications</Text>
              <View className="flex-row items-center mt-1">
                <Text className="text-gray-600 text-sm">
                  {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
                </Text>
                <View
                  className={`w-2 h-2 rounded-full ml-2 ${
                    isConnected ? 'bg-green-500' : 'bg-yellow-500'
                  }`}
                />
              </View>
            </View>
          </View>

          <View className="flex-row items-center space-x-2">
            {unreadCount > 0 && (
              <TouchableOpacity
                onPress={handleMarkAllAsRead}
                className="flex-row items-center px-4 py-2 bg-cordovan rounded-lg active:opacity-80"
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="white" />
                <Text className="text-white font-semibold ml-2">Mark All Read</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Search and Filter Bar */}
        <View className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-2">
          {/* Search */}
          <View className="flex-row items-center mb-3">
            <Ionicons name="search-outline" size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search notifications..."
              value={searchTerm}
              onChangeText={setSearchTerm}
              className="flex-1 text-gray-900"
              style={{ fontSize: 16 }}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Filter and Sort */}
          <View className="flex-row items-center space-x-3">
            <View className="flex-row items-center flex-1">
              <Ionicons name="filter-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
                <View className="flex-row space-x-2">
                  {(['all', 'unread', 'read'] as FilterTab[]).map((filter) => (
                    <TouchableOpacity
                      key={filter}
                      onPress={() => setSelectedFilter(filter)}
                      className={`px-4 py-2 rounded-lg ${
                        selectedFilter === filter
                          ? 'bg-cordovan'
                          : 'bg-gray-100'
                      }`}
                    >
                      <Text
                        className={`text-sm font-medium ${
                          selectedFilter === filter ? 'text-white' : 'text-gray-700'
                        }`}
                      >
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
              className="px-3 py-2 bg-gray-100 rounded-lg"
            >
              <Text className="text-sm font-medium text-gray-700">
                {sortBy === 'newest' ? 'Newest' : sortBy === 'oldest' ? 'Oldest' : 'Unread'} First
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bulk Actions */}
        {selectedNotifications.length > 0 && (
          <View className="mt-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-medium text-blue-900">
                {selectedNotifications.length} notification{selectedNotifications.length > 1 ? 's' : ''} selected
              </Text>
              <View className="flex-row space-x-2">
                <TouchableOpacity
                  onPress={handleMarkSelectedAsRead}
                  className="px-3 py-1 bg-blue-600 rounded active:opacity-80"
                >
                  <Text className="text-sm text-white font-medium">Mark as Read</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSelectedNotifications([])}
                  className="px-3 py-1 bg-gray-600 rounded active:opacity-80"
                >
                  <Text className="text-sm text-white font-medium">Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Notifications List */}
      <ScrollView
        className="flex-1"
        style={{ backgroundColor: '#F9FAFB' }}
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: 100 + insets.bottom,
        }}
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
          <View className="px-4 space-y-3">
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
                  style={{
                    shadowColor: !notification.read ? '#91403E' : '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: !notification.read ? 0.1 : 0.05,
                    shadowRadius: 8,
                    elevation: !notification.read ? 4 : 2,
                  }}
                  className={`bg-white rounded-xl border ${
                    !notification.read
                      ? 'border-cordovan/20 bg-cordovan/3'
                      : 'border-gray-200/60'
                  } ${isSelected ? 'border-blue-500 border-2' : ''} mb-3`}
                >
                  <View className="p-4">
                    <View className="flex-row items-start">
                      {/* Checkbox */}
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleSelectNotification(notification.id);
                        }}
                        className="mr-3 mt-1"
                        activeOpacity={0.7}
                      >
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 6,
                            borderWidth: 2,
                            borderColor: isSelected ? '#2563EB' : '#D1D5DB',
                            backgroundColor: isSelected ? '#2563EB' : 'transparent',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {isSelected && (
                            <Ionicons name="checkmark" size={14} color="white" />
                          )}
                        </View>
                      </TouchableOpacity>

                      {/* Icon Container */}
                      <View
                        className={`rounded-xl ${colors.bg} mr-3`}
                        style={{
                          width: 48,
                          height: 48,
                          alignItems: 'center',
                          justifyContent: 'center',
                          shadowColor: colors.iconColor,
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.15,
                          shadowRadius: 4,
                          elevation: 3,
                        }}
                      >
                        <Ionicons name={iconName} size={24} color={colors.iconColor} />
                      </View>

                      {/* Content */}
                      <View className="flex-1">
                        {/* Header Row */}
                        <View className="flex-row items-start justify-between mb-2">
                          <View className="flex-1">
                            <View className="flex-row items-center mb-1.5">
                              <Text
                                className="text-xs font-semibold uppercase tracking-wide"
                                style={{
                                  color: colors.iconColor,
                                  fontSize: 11,
                                }}
                              >
                                {formatNotificationType(notification.type)}
                              </Text>
                              {!notification.read && (
                                <View
                                  className="ml-2"
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 4,
                                    backgroundColor: '#91403E',
                                  }}
                                />
                              )}
                            </View>
                            <Text
                              className="text-gray-900 font-semibold mb-2 leading-tight"
                              style={{
                                fontSize: 15,
                                lineHeight: 20,
                              }}
                              numberOfLines={3}
                            >
                              {notification.message}
                            </Text>
                          </View>

                          {/* Mark as Read Button */}
                          {!notification.read && (
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(notification.id);
                              }}
                              className="ml-2 p-1.5 rounded-lg bg-cordovan/10 active:bg-cordovan/20"
                              activeOpacity={0.7}
                            >
                              <Ionicons name="checkmark-circle" size={20} color="#91403E" />
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Timestamp Row */}
                        {timestamp && (
                          <View className="flex-row items-center mt-1" style={{ marginLeft: 0 }}>
                            <Ionicons name="time-outline" size={14} color="#9CA3AF" />
                            <Text
                              className="text-gray-500 ml-1.5"
                              style={{ fontSize: 12 }}
                            >
                              {formatDistanceToNow(timestamp, { addSuffix: false })}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Unread Indicator Bar */}
                  {!notification.read && (
                    <View
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 3,
                        backgroundColor: '#91403E',
                        borderTopLeftRadius: 12,
                        borderBottomLeftRadius: 12,
                      }}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Load More */}
        {hasMore && filteredAndSortedNotifications.length > 0 && (
          <View className="mt-6 mb-4 items-center">
            <TouchableOpacity
              onPress={loadMore}
              disabled={isLoading}
              className="px-6 py-2 bg-gray-200 rounded-lg active:opacity-80"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#91403E" />
              ) : (
                <Text className="text-gray-800 font-medium">Load more</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Connection status indicator */}
        <View className="mt-8 mb-4 items-center">
          <View className="flex-row items-center space-x-2">
            <View
              className={`h-2 w-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-yellow-500'
              }`}
            />
            <Text className={`text-sm ${isConnected ? 'text-green-600' : 'text-yellow-600'}`}>
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
    backgroundColor: '#F9FAFB',
  },
});

export default NotificationsScreen;
