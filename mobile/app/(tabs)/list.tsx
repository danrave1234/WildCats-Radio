import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import ListSkeleton from '../../components/ListSkeleton';
import {
  Broadcast,
  getAllBroadcasts,
  getUpcomingBroadcasts,
  getLiveBroadcasts,
} from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import '../../global.css';
import { format, parseISO, isAfter, isBefore, addDays } from 'date-fns';

type FilterTab = 'all' | 'live' | 'upcoming' | 'recent';

interface TabDefinition {
  key: FilterTab;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface BroadcastSection {
  title: string;
  data: Broadcast[];
  type: string;
  totalCount: number;
}

const ListScreen: React.FC = () => {
  const router = useRouter();
  const { authToken } = useAuth();
  const insets = useSafeAreaInsets();
  const { tab } = useLocalSearchParams<{ tab?: FilterTab }>();

  const [activeFilter, setActiveFilter] = useState<FilterTab>(tab || 'recent');
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [liveBroadcasts, setLiveBroadcasts] = useState<Broadcast[]>([]);
  const [upcomingBroadcasts, setUpcomingBroadcasts] = useState<Broadcast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination states for All tab sections
  const [upcomingPage, setUpcomingPage] = useState(0);
  const [recentPage, setRecentPage] = useState(0);
  const ITEMS_PER_PAGE = 5;

  // Animation states for tab underline
  const [tabLayouts, setTabLayouts] = useState<Record<FilterTab, { x: number; width: number } | undefined>>({} as Record<FilterTab, { x: number; width: number } | undefined>);
  const underlinePosition = useRef(new Animated.Value(0)).current;
  const underlineWidth = useRef(new Animated.Value(0)).current;
  const [isInitialLayoutDone, setIsInitialLayoutDone] = useState(false);

  const tabDefinitions: TabDefinition[] = useMemo(() => [
    { key: 'recent', name: 'History', icon: 'time-outline' },
  ], []);

  // Animate tab underline
  useEffect(() => {
    const currentTabLayout = tabLayouts[activeFilter];
    if (currentTabLayout && currentTabLayout.width > 0) {
      if (!isInitialLayoutDone && activeFilter === tabDefinitions[0].key) {
        underlinePosition.setValue(currentTabLayout.x);
        underlineWidth.setValue(currentTabLayout.width);
        setIsInitialLayoutDone(true);
      } else if (isInitialLayoutDone) {
        Animated.parallel([
          Animated.timing(underlinePosition, {
            toValue: currentTabLayout.x,
            duration: 250,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false, // Must be false for layout properties
          }),
          Animated.timing(underlineWidth, {
            toValue: currentTabLayout.width,
            duration: 250,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false, // Must be false for layout properties
          }),
        ]).start();
      }
    }
  }, [activeFilter, tabLayouts, isInitialLayoutDone, tabDefinitions, underlinePosition, underlineWidth]);

  const fetchBroadcasts = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      const token = authToken || null;
      const [allResult, liveResult, upcomingResult] = await Promise.all([
        getAllBroadcasts(token),
        getLiveBroadcasts(token),
        getUpcomingBroadcasts(token),
      ]);

      if ('error' in allResult) {
        setError(allResult.error);
        setBroadcasts([]);
      } else {
        setBroadcasts(allResult);
      }

      if ('error' in liveResult) {
        console.warn('Live broadcasts error:', liveResult.error);
        setLiveBroadcasts([]);
      } else {
        setLiveBroadcasts(liveResult);
      }

      if ('error' in upcomingResult) {
        console.warn('Upcoming broadcasts error:', upcomingResult.error);
        setUpcomingBroadcasts([]);
      } else {
        setUpcomingBroadcasts(upcomingResult);
      }
    } catch (err) {
      setError('Failed to load broadcasts');
      console.error('Fetch broadcasts error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [authToken]);

  useEffect(() => {
    fetchBroadcasts();
  }, [fetchBroadcasts]);

  // Handle tab parameter changes
  useEffect(() => {
    if (tab && tab !== activeFilter) {
      setActiveFilter(tab);
      // Reset pagination when changing tabs via parameter
      setUpcomingPage(0);
      setRecentPage(0);
    }
  }, [tab]);

  const onRefresh = useCallback(() => {
    fetchBroadcasts(true);
  }, [fetchBroadcasts]);

  const categorizedBroadcasts = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = addDays(now, -7);

    if (activeFilter === 'all') {
      // Categorize all broadcasts for the "All" tab
      const live = liveBroadcasts;
      const upcoming = upcomingBroadcasts;
      const recent = broadcasts.filter(broadcast => {
        if (!broadcast.actualEnd) return false;
        try {
          const endDate = parseISO(broadcast.actualEnd);
          return isAfter(endDate, sevenDaysAgo) && isBefore(endDate, now);
        } catch {
          return false;
        }
      });
      const past = broadcasts.filter(broadcast => {
        if (!broadcast.actualEnd) return false;
        try {
          const endDate = parseISO(broadcast.actualEnd);
          return isBefore(endDate, sevenDaysAgo);
        } catch {
          return false;
        }
      });

      const sections = [];
      if (live.length > 0) sections.push({ title: 'Live Now', data: live, type: 'live', totalCount: live.length });
      if (upcoming.length > 0) {
        const paginatedUpcoming = upcoming.slice(upcomingPage * ITEMS_PER_PAGE, (upcomingPage + 1) * ITEMS_PER_PAGE);
        sections.push({ title: 'Coming Up', data: paginatedUpcoming, type: 'upcoming', totalCount: upcoming.length });
      }
      if (recent.length > 0) {
        const paginatedRecent = recent.slice(recentPage * ITEMS_PER_PAGE, (recentPage + 1) * ITEMS_PER_PAGE);
        sections.push({ title: 'Recent Shows', data: paginatedRecent, type: 'recent', totalCount: recent.length });
      }
      if (past.length > 0) sections.push({ title: 'Past Broadcasts', data: past.slice(0, 10), type: 'past', totalCount: past.length }); // Limit past shows

      return sections;
    }

    // For other filters, return simple array
    switch (activeFilter) {
      case 'recent':
        return broadcasts.filter(broadcast => {
          if (!broadcast.actualEnd) return false;
          try {
            const endDate = parseISO(broadcast.actualEnd);
            return isBefore(endDate, now); // include all past broadcasts
          } catch {
            return false;
          }
        });
      default:
        return [];
    }
  }, [activeFilter, broadcasts, upcomingPage, recentPage]);

  const handleBroadcastPress = (broadcast: Broadcast) => {
    // If it's an upcoming broadcast, redirect to schedule with the date
    if (broadcast.status === 'SCHEDULED' && broadcast.scheduledStart) {
      try {
        const broadcastDate = parseISO(broadcast.scheduledStart);
        const dateParam = format(broadcastDate, 'yyyy-MM-dd');
        router.push(`/schedule?date=${dateParam}`);
        return;
      } catch (error) {
        console.warn('Error parsing broadcast date:', error);
      }
    }
    
    // For live broadcasts or fallback, go to broadcast screen
    router.push(`/broadcast?broadcastId=${broadcast.id}`);
  };

  // Pagination handlers
  const handleUpcomingNextPage = () => {
    const totalUpcoming = upcomingBroadcasts.length;
    const maxPage = Math.ceil(totalUpcoming / ITEMS_PER_PAGE) - 1;
    if (upcomingPage < maxPage) {
      setUpcomingPage(prev => prev + 1);
    }
  };

  const handleUpcomingPrevPage = () => {
    if (upcomingPage > 0) {
      setUpcomingPage(prev => prev - 1);
    }
  };

  const handleRecentNextPage = () => {
    const now = new Date();
    const recentBroadcasts = broadcasts.filter(broadcast => {
      if (!broadcast.actualEnd) return false;
      try {
        const endDate = parseISO(broadcast.actualEnd);
        return isBefore(endDate, now);
      } catch {
        return false;
      }
    });
    const maxPage = Math.ceil(recentBroadcasts.length / ITEMS_PER_PAGE) - 1;
    if (recentPage < maxPage) {
      setRecentPage(prev => prev + 1);
    }
  };

  const handleRecentPrevPage = () => {
    if (recentPage > 0) {
      setRecentPage(prev => prev - 1);
    }
  };

  const getStatusBadge = (broadcast: Broadcast) => {
    const status = broadcast.status?.toUpperCase();
    switch (status) {
      case 'LIVE':
        return (
          <View className="bg-red-500 px-2 py-1 rounded-full flex-row items-center">
            <View className="w-1.5 h-1.5 bg-white rounded-full mr-1" />
            <Text className="text-white text-xs font-bold">LIVE</Text>
          </View>
        );
      case 'SCHEDULED':
        return (
          <View className="bg-blue-500 px-2 py-1 rounded-full">
            <Text className="text-white text-xs font-medium">UPCOMING</Text>
          </View>
        );
      case 'ENDED':
        return (
          <View className="bg-amber-500 px-2 py-1 rounded-full">
            <Text className="text-white text-xs font-medium">ENDED</Text>
          </View>
        );
      default:
        return null;
    }
  };

  const formatBroadcastTime = (broadcast: Broadcast) => {
    try {
      if (broadcast.status === 'LIVE' && broadcast.actualStart) {
        return `Started ${format(parseISO(broadcast.actualStart), 'p')}`;
      }
      if (broadcast.scheduledStart) {
        return format(parseISO(broadcast.scheduledStart), 'MMM d, yyyy • p');
      }
      return 'Time TBA';
    } catch {
      return 'Time TBA';
    }
  };

  const renderSectionHeader = (title: string, type: string, isFirst: boolean = false, count?: number) => {
    const getSectionIcon = (sectionType: string) => {
      switch (sectionType) {
        case 'live': return 'radio-outline';
        case 'upcoming': return 'time-outline';
        case 'recent': return 'calendar-outline';
        case 'past': return 'library-outline';
        default: return 'list-outline';
      }
    };

    // Clean styling for main sections - no card background
    if (type === 'upcoming' || type === 'live' || type === 'recent') {
      const getIconColor = (sectionType: string) => {
        switch (sectionType) {
          case 'live': return '#EF4444'; // Red for live
          case 'upcoming': return '#3B82F6'; // Blue for upcoming
          case 'recent': return '#F59E0B'; // Amber for recent
          default: return '#6B7280';
        }
      };

      const getBackgroundColor = (sectionType: string) => {
        switch (sectionType) {
          case 'live': return 'bg-red-500/10'; 
          case 'upcoming': return 'bg-blue-500/10';
          case 'recent': return 'bg-amber-500/10';
          default: return 'bg-gray-500/10';
        }
      };

      return (
        <View className={`mx-4 mb-4 ${isFirst ? 'mt-0' : 'mt-8'}`}>
          <View className="flex-row items-center justify-between px-1 py-2">
            <View className="flex-row items-center flex-1">
              <View 
                className={`${getBackgroundColor(type)} p-3 rounded-full mr-3`}
              >
                <Ionicons 
                  name={getSectionIcon(type) as any} 
                  size={26} 
                  color={getIconColor(type)} 
                />
              </View>
              <View>
                <Text className="text-2xl font-bold text-gray-900 mb-1">
                  {title}
                </Text>
                {count !== undefined && (
                  <Text className="text-sm text-gray-600">
                    {count} show{count !== 1 ? 's' : ''} available
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View className={`mx-4 mb-4 ${isFirst ? 'mt-0' : 'mt-8'}`}>
        <View 
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-gray-100"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <View 
                className="bg-cordovan p-3 rounded-full mr-4"
                style={{
                  shadowColor: '#91403E',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 4,
                }}
              >
                <Ionicons 
                  name={getSectionIcon(type) as any} 
                  size={22} 
                  color="white" 
                />
              </View>
              <View>
                <Text className="text-xl font-bold text-gray-900 mb-1">
                  {title}
                </Text>
                {count !== undefined && (
                  <Text className="text-sm text-gray-600">
                    {count} show{count !== 1 ? 's' : ''} available
                  </Text>
                )}
              </View>
            </View>
            {type === 'live' && (
              <View className="bg-red-500 px-3 py-2 rounded-full shadow-md">
                <View className="flex-row items-center">
                  <View className="w-2 h-2 bg-white rounded-full mr-2" />
                  <Text className="text-white text-xs font-bold tracking-wider">LIVE</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderBroadcastCard = (broadcast: Broadcast, sectionType?: string) => {
    const isRecent = sectionType === 'recent';
    
    if (isRecent) {
      return (
        <View
          key={broadcast.id}
          className="mx-4 mb-6"
        >
      {/* Modern ShadCN-inspired Card */}
      <View 
        className="bg-white rounded-xl border border-gray-200/60 overflow-hidden"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        {/* Status Strip */}
        {broadcast.status === 'LIVE' && (
          <View 
            className="h-1"
            style={{
              backgroundColor: '#EF4444',
            }}
          />
        )}
        {broadcast.status === 'SCHEDULED' && (
          <View 
            className="h-1"
            style={{
              backgroundColor: '#3B82F6',
            }}
          />
        )}
        {broadcast.status === 'ENDED' && (
          <View 
            className="h-1"
            style={{
              backgroundColor: '#F59E0B',
            }}
          />
        )}

        {/* Main Content */}
        <View className="p-6">
          {/* Header with Avatar and Status */}
          <View className="flex-row items-start justify-between mb-4">
            <View className="flex-row items-center flex-1">
              {/* Elegant Avatar */}
              <View 
                className={`w-10 h-10 rounded-full items-center justify-center mr-4 shadow-sm ${
                  broadcast.status === 'LIVE' ? 'bg-cordovan' : 'bg-cordovan'
                }`}
              >
                <Ionicons 
                  name={broadcast.status === 'LIVE' ? "radio" : "disc-outline"} 
                  size={20} 
                  color="white"
                />
              </View>

              {/* Title and DJ Info */}
              <View className="flex-1">
                <Text 
                  className="text-lg font-bold text-gray-900 leading-tight mb-1" 
                  numberOfLines={2}
                  style={{ fontSize: 18, lineHeight: 24 }}
                >
                  {broadcast.title}
                </Text>
                
                {/* DJ Badge */}
                <View className="flex-row items-center">
                  <View 
                    className="bg-mikado_yellow/15 px-3 py-1.5 rounded-full flex-row items-center"
                    style={{
                      borderWidth: 1,
                      borderColor: '#B5830F20',
                    }}
                  >
                    <View 
                      className="w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: '#B5830F' }}
                    />
                    <Text 
                      className="text-mikado_yellow font-semibold text-xs tracking-wide"
                      style={{ fontSize: 12 }}
                    >
                      {broadcast.dj?.name || 'WILDCAT RADIO'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Status Badge */}
            <View className="ml-3">
              {broadcast.status === 'LIVE' ? (
                <View 
                  className="bg-red-500 px-3 py-2 rounded-full flex-row items-center"
                  style={{
                    shadowColor: '#EF4444',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 4,
                    elevation: 3,
                  }}
                >
                  <View className="w-2 h-2 bg-white rounded-full mr-2" />
                  <Text className="text-white text-xs font-bold tracking-wider">LIVE</Text>
                </View>
              ) : broadcast.status?.toUpperCase() === 'SCHEDULED' ? (
                <View 
                  className="bg-blue-500 px-3 py-2 rounded-full"
                  style={{
                    shadowColor: '#3B82F6',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                    elevation: 3,
                  }}
                >
                  <Text className="text-white text-xs font-medium tracking-wider">
                    UPCOMING
                  </Text>
                </View>
              ) : broadcast.status?.toUpperCase() === 'ENDED' ? (
                <View className="bg-amber-500 px-3 py-2 rounded-full">
                  <Text className="text-white text-xs font-medium">
                    ENDED
                  </Text>
                </View>
              ) : (
                <View className="bg-gray-100 px-3 py-2 rounded-full">
                  <Text className="text-gray-600 text-xs font-medium">
                    {broadcast.status?.toUpperCase() || 'SCHEDULED'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Description */}
          {broadcast.description && (
            <Text 
              className="text-gray-600 leading-relaxed mb-4" 
              numberOfLines={2}
              style={{ fontSize: 14, lineHeight: 20 }}
            >
              {broadcast.description}
            </Text>
          )}

          {/* Time and Action Section */}
          <View className="flex-row items-center justify-between">
            {/* Time Info */}
            <View className="flex-row items-center flex-1">
              <View className="bg-gray-50 p-2 rounded-lg mr-3">
                <Ionicons name="time-outline" size={16} color="#6B7280" />
              </View>
              <View>
                <Text className="text-xs text-gray-500 font-medium mb-0.5">
                  {broadcast.status === 'LIVE' ? 'Started at' : 'Scheduled for'}
                </Text>
                <Text 
                  className="text-sm font-semibold text-gray-800"
                  style={{ fontSize: 13 }}
                >
                  {formatBroadcastTime(broadcast)}
                </Text>
              </View>
            </View>

            {/* Action Button */}
            {broadcast.status === 'LIVE' ? (
              <View 
                className="bg-gradient-to-r from-mikado_yellow to-mikado_yellow/90 px-4 py-2.5 rounded-xl flex-row items-center"
                style={{
                  shadowColor: '#B5830F',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <MaterialCommunityIcons name="broadcast" size={16} color="white" />
                <Text className="text-white font-bold text-xs ml-1.5 tracking-wide">
                  JOIN
                </Text>
              </View>
            ) : !isRecent ? (
              <View className="bg-gray-50 p-2.5 rounded-xl">
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </View>
            ) : null}
          </View>
        </View>

        {/* Live Pulse Animation */}
        {broadcast.status === 'LIVE' && (
          <View 
            className="absolute top-3 left-3 w-3 h-3 bg-red-500 rounded-full"
            style={{
              shadowColor: '#EF4444',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 6,
              elevation: 4,
            }}
          />
        )}
      </View>
        </View>
      );
    }
    
    return (
      <Pressable
        key={broadcast.id}
        style={({ pressed }) => [
          {
            transform: [{ scale: pressed ? 0.985 : 1 }],
            opacity: pressed ? 0.95 : 1,
          },
        ]}
        onPress={() => handleBroadcastPress(broadcast)}
        className="mx-4 mb-6"
      >
        {/* Modern ShadCN-inspired Card */}
        <View 
          className="bg-white rounded-xl border border-gray-200/60 overflow-hidden"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          {/* Status Strip */}
          {broadcast.status === 'LIVE' && (
            <View 
              className="h-1"
              style={{
                backgroundColor: '#EF4444',
              }}
            />
          )}
          {broadcast.status === 'SCHEDULED' && (
            <View 
              className="h-1"
              style={{
                backgroundColor: '#3B82F6',
              }}
            />
          )}
          {broadcast.status === 'ENDED' && (
            <View 
              className="h-1"
              style={{
                backgroundColor: '#F59E0B',
              }}
            />
          )}

          {/* Main Content */}
          <View className="p-6">
            {/* Header with Avatar and Status */}
            <View className="flex-row items-start justify-between mb-4">
              <View className="flex-row items-center flex-1">
                                 {/* Elegant Avatar */}
                 <View 
                   className={`w-10 h-10 rounded-full items-center justify-center mr-4 shadow-sm ${
                     broadcast.status === 'LIVE' ? 'bg-cordovan' : 'bg-cordovan'
                   }`}
                 >
                   <Ionicons 
                     name={broadcast.status === 'LIVE' ? "radio" : "disc-outline"} 
                     size={20} 
                     color="white"
                   />
                 </View>

                {/* Title and DJ Info */}
                <View className="flex-1">
                  <Text 
                    className="text-lg font-bold text-gray-900 leading-tight mb-1" 
                    numberOfLines={2}
                    style={{ fontSize: 18, lineHeight: 24 }}
                  >
                    {broadcast.title}
                  </Text>
                  
                  {/* DJ Badge */}
                  <View className="flex-row items-center">
                    <View 
                      className="bg-mikado_yellow/15 px-3 py-1.5 rounded-full flex-row items-center"
                      style={{
                        borderWidth: 1,
                        borderColor: '#B5830F20',
                      }}
                    >
                      <View 
                        className="w-2 h-2 rounded-full mr-2"
                        style={{ backgroundColor: '#B5830F' }}
                      />
                      <Text 
                        className="text-mikado_yellow font-semibold text-xs tracking-wide"
                        style={{ fontSize: 12 }}
                      >
                        {broadcast.dj?.name || 'WILDCAT RADIO'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Status Badge */}
              <View className="ml-3">
                {broadcast.status === 'LIVE' ? (
                  <View 
                    className="bg-red-500 px-3 py-2 rounded-full flex-row items-center"
                    style={{
                      shadowColor: '#EF4444',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.25,
                      shadowRadius: 4,
                      elevation: 3,
                    }}
                  >
                    <View className="w-2 h-2 bg-white rounded-full mr-2" />
                    <Text className="text-white text-xs font-bold tracking-wider">LIVE</Text>
                  </View>
                ) : broadcast.status?.toUpperCase() === 'SCHEDULED' ? (
                  <View 
                    className="bg-blue-500 px-3 py-2 rounded-full"
                    style={{
                      shadowColor: '#3B82F6',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.2,
                      shadowRadius: 4,
                      elevation: 3,
                    }}
                  >
                    <Text className="text-white text-xs font-medium tracking-wider">
                      UPCOMING
                    </Text>
                  </View>
                ) : broadcast.status?.toUpperCase() === 'ENDED' ? (
                  <View className="bg-amber-500 px-3 py-2 rounded-full">
                    <Text className="text-white text-xs font-medium">
                      ENDED
                    </Text>
                  </View>
                ) : (
                  <View className="bg-gray-100 px-3 py-2 rounded-full">
                    <Text className="text-gray-600 text-xs font-medium">
                      {broadcast.status?.toUpperCase() || 'SCHEDULED'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Description */}
            {broadcast.description && (
              <Text 
                className="text-gray-600 leading-relaxed mb-4" 
                numberOfLines={2}
                style={{ fontSize: 14, lineHeight: 20 }}
              >
                {broadcast.description}
              </Text>
            )}

            {/* Time and Action Section */}
            <View className="flex-row items-center justify-between">
              {/* Time Info */}
              <View className="flex-row items-center flex-1">
                <View className="bg-gray-50 p-2 rounded-lg mr-3">
                  <Ionicons name="time-outline" size={16} color="#6B7280" />
                </View>
                <View>
                  <Text className="text-xs text-gray-500 font-medium mb-0.5">
                    {broadcast.status === 'LIVE' ? 'Started at' : 'Scheduled for'}
                  </Text>
                  <Text 
                    className="text-sm font-semibold text-gray-800"
                    style={{ fontSize: 13 }}
                  >
                    {formatBroadcastTime(broadcast)}
                  </Text>
                </View>
              </View>

              {/* Action Button */}
              {broadcast.status === 'LIVE' ? (
                <View 
                  className="bg-gradient-to-r from-mikado_yellow to-mikado_yellow/90 px-4 py-2.5 rounded-xl flex-row items-center"
                  style={{
                    shadowColor: '#B5830F',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                    elevation: 3,
                  }}
                >
                  <MaterialCommunityIcons name="broadcast" size={16} color="white" />
                  <Text className="text-white font-bold text-xs ml-1.5 tracking-wide">
                    JOIN
                  </Text>
                </View>
              ) : (
                <View className="bg-gray-50 p-2.5 rounded-xl">
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </View>
              )}
            </View>
          </View>

          {/* Live Pulse Animation */}
          {broadcast.status === 'LIVE' && (
            <View 
              className="absolute top-3 left-3 w-3 h-3 bg-red-500 rounded-full"
              style={{
                shadowColor: '#EF4444',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 6,
                elevation: 4,
              }}
            />
          )}
        </View>
      </Pressable>
    );
  };

  const renderPaginationControls = (type: string, totalCount: number, currentPage: number, onNext: () => void, onPrev: () => void) => {
    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
    const canGoNext = currentPage < totalPages - 1;
    const canGoPrev = currentPage > 0;

    if (totalPages <= 1) return null;

    return (
      <View className="mx-4 mt-4 mb-2">
        <View className="flex-row items-center justify-between px-2">
          <TouchableOpacity
            onPress={onPrev}
            disabled={!canGoPrev}
            className={`flex-row items-center justify-center py-3 rounded-xl flex-1 mr-3 ${canGoPrev ? 'bg-cordovan active:bg-cordovan/90' : 'bg-gray-200'}`}
            style={{
              shadowColor: canGoPrev ? '#91403E' : '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: canGoPrev ? 0.2 : 0.05,
              shadowRadius: 4,
              elevation: canGoPrev ? 4 : 1,
              minWidth: 100,
            }}
          >
            <Ionicons 
              name="chevron-back" 
              size={18} 
              color={canGoPrev ? "white" : "#9CA3AF"} 
            />
            <Text className={`ml-1 font-semibold ${canGoPrev ? 'text-white' : 'text-gray-400'}`}>
              Previous
            </Text>
          </TouchableOpacity>
          
          <View className="flex-row items-center px-4">
            <Text className="text-gray-600 font-medium">
              Page {currentPage + 1} of {totalPages}
            </Text>
          </View>
          
          <TouchableOpacity
            onPress={onNext}
            disabled={!canGoNext}
            className={`flex-row items-center justify-center py-3 rounded-xl flex-1 ml-3 ${canGoNext ? 'bg-cordovan active:bg-cordovan/90' : 'bg-gray-200'}`}
            style={{
              shadowColor: canGoNext ? '#91403E' : '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: canGoNext ? 0.2 : 0.05,
              shadowRadius: 4,
              elevation: canGoNext ? 4 : 1,
              minWidth: 100,
            }}
          >
            <Text className={`mr-1 font-semibold ${canGoNext ? 'text-white' : 'text-gray-400'}`}>
              Next
            </Text>
            <Ionicons 
              name="chevron-forward" 
              size={18} 
              color={canGoNext ? "white" : "#9CA3AF"} 
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    const emptyMessages = {
      all: { icon: 'list-outline', message: 'No Broadcasts Found', subtitle: 'Check back soon for exciting shows!' },
      live: { icon: 'radio-outline', message: 'Currently Off Air', subtitle: 'There are no live broadcasts at the moment. Please check the schedule or try again later.' },
      upcoming: { icon: 'time-outline', message: 'No Upcoming Shows', subtitle: 'There are no upcoming broadcasts scheduled. New shows will be added soon.' },
      recent: { icon: 'time-outline', message: 'No Past Broadcasts', subtitle: 'No broadcasts have ended yet. Please check back later.' },
    };

    const { icon, message, subtitle } = emptyMessages[activeFilter];

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
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB', paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <Stack.Screen 
          options={{ 
            title: 'History',
            headerShadowVisible: false,
          }} 
        />
        <ScrollView
          style={{ backgroundColor: '#F9FAFB' }}
          contentContainerStyle={{ 
            paddingBottom: 100 + insets.bottom,
            backgroundColor: '#F9FAFB'
          }}
          showsVerticalScrollIndicator={false}
        >
          <ListSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error && broadcasts.length === 0) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-anti-flash_white p-6 text-center">
        <Ionicons name="cloud-offline-outline" size={64} color="#7F1D1D" />
        <Text className="text-2xl font-semibold text-gray-800 mt-6 mb-2">Unable to Load Broadcasts</Text>
        <Text className="text-gray-600 mb-8 text-base leading-relaxed">{error}</Text>
        <TouchableOpacity
          className="bg-cordovan py-3 px-8 rounded-lg shadow-md active:opacity-80"
          onPress={() => fetchBroadcasts()}
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
          title: 'History',
          headerShadowVisible: false,
        }} 
      />
      
      {/* Screen Title */}
      <View className="pt-6 pb-4 mb-2 px-5 bg-gray-50">
        <View>
          <Text className="text-3xl font-bold text-gray-800 mb-1">Broadcast History</Text>
          <Text className="text-base text-gray-600">Explore past broadcasts</Text>
        </View>
      </View>
      
      {/* Filter Tabs */}
      <View 
        className="bg-white border-b border-gray-200 relative shadow-sm"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        <View 
          className="flex-row py-4 px-2"
          onLayout={(event) => {
            // Store parent container layout for reference
            const { x: parentX, width: parentWidth } = event.nativeEvent.layout;
          }}
        >
          {tabDefinitions.map((tab, index) => (
            <View 
              key={tab.key}
              className="flex-1 px-1"
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                // Use actual measured position from the parent container
                setTabLayouts((prev) => ({
                  ...prev,
                  [tab.key]: { x: x + 4, width: width - 8 }, // Account for px-1 padding
                }));
              }}
            >
              <Pressable
                style={({ pressed }) => [
                  { 
                    opacity: pressed && Platform.OS === 'ios' ? 0.7 : 1,
                  },
                ]}
                className={`items-center justify-center py-3 px-2 flex-row rounded-2xl min-h-[44px] ${
                  activeFilter === tab.key ? 'bg-cordovan/10' : 'bg-transparent'
                }`}
                onPress={() => {
                  setActiveFilter(tab.key);
                  // Reset pagination when switching tabs
                  setUpcomingPage(0);
                  setRecentPage(0);
                }}
                android_ripple={{ color: 'rgba(0,0,0,0.05)' }}
              >
                <Ionicons
                  name={tab.icon}
                  size={18}
                  color={activeFilter === tab.key ? '#91403E' : '#6B7280'}
                />
                <Text
                  className={`ml-1.5 text-xs font-semibold ${
                    activeFilter === tab.key ? 'text-cordovan' : 'text-gray-600'
                  }`}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {tab.name}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
        
        {/* Animated Underline */}
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 0,
            height: 4,
            backgroundColor: '#B5830F',
            borderTopLeftRadius: 2,
            borderTopRightRadius: 2,
            left: underlinePosition,
            width: underlineWidth,
          }}
        />
      </View>

      {/* Broadcasts List */}
      {activeFilter === 'all' ? (
        <ScrollView
          className="flex-1"
          style={{ backgroundColor: '#F9FAFB' }} // Add background to ScrollView
          contentContainerStyle={{ 
            paddingTop: 16, 
            paddingBottom: 100 + insets.bottom,
            backgroundColor: '#F9FAFB' // Ensure content area has background
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={['#91403E']}
              tintColor="#91403E"
              title="Pull to refresh broadcasts"
              titleColor="#91403E"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {(() => {
            const sections = categorizedBroadcasts as BroadcastSection[];
            return sections.length === 0 ? (
              renderEmptyState()
            ) : (
              sections.map((section, sectionIndex) => (
                <View key={`section-${sectionIndex}`}>
                  {renderSectionHeader(section.title, section.type, sectionIndex === 0, section.totalCount)}
                  {section.data.map((broadcast) => renderBroadcastCard(broadcast, section.type))}
                  {section.type === 'upcoming' && renderPaginationControls(
                    section.type, 
                    section.totalCount, 
                    upcomingPage, 
                    handleUpcomingNextPage, 
                    handleUpcomingPrevPage
                  )}
                  {section.type === 'recent' && renderPaginationControls(
                    section.type, 
                    section.totalCount, 
                    recentPage, 
                    handleRecentNextPage, 
                    handleRecentPrevPage
                  )}
                </View>
              ))
            );
          })()}
        </ScrollView>
      ) : (
        // Render non-scrollable content for individual tabs
        <View className="flex-1">
          {/* Tab Header - Always shown */}
          {(() => {
            const broadcasts = categorizedBroadcasts as Broadcast[];
            
            const getTabTitle = (filter: FilterTab) => {
              switch (filter) {
                case 'live': return 'Live Shows';
                case 'upcoming': return 'Upcoming Shows';
                case 'recent': return 'Recent Shows';
                default: return 'Shows';
              }
            };

            const getTabIcon = (filter: FilterTab) => {
              switch (filter) {
                case 'live': return 'radio-outline';
                case 'upcoming': return 'time-outline';
                case 'recent': return 'calendar-outline';
                default: return 'list-outline';
              }
            };

            const getIconColor = (filter: FilterTab) => {
              switch (filter) {
                case 'live': return '#EF4444';
                case 'upcoming': return '#3B82F6';
                case 'recent': return '#F59E0B';
                default: return '#6B7280';
              }
            };

            const getBackgroundColor = (filter: FilterTab) => {
              switch (filter) {
                case 'live': return 'bg-red-500/10';
                case 'upcoming': return 'bg-blue-500/10';
                case 'recent': return 'bg-amber-500/10';
                default: return 'bg-gray-500/10';
              }
            };

            return (
              <View className="mx-4 mb-4 mt-4">
                <View className="flex-row items-center px-1 py-2">
                  <View className={`${getBackgroundColor(activeFilter)} p-3 rounded-full mr-3`}>
                    <Ionicons 
                      name={getTabIcon(activeFilter) as any} 
                      size={26} 
                      color={getIconColor(activeFilter)} 
                    />
                  </View>
                  <View>
                    <Text className="text-2xl font-bold text-gray-900 mb-1">
                      {getTabTitle(activeFilter)}
                    </Text>
                    <Text className="text-sm text-gray-600">
                      {broadcasts.length} show{broadcasts.length !== 1 ? 's' : ''} available
                    </Text>
                  </View>
                </View>
              </View>
            );
          })()}
          
          <ScrollView
            className="flex-1"
            style={{ backgroundColor: '#F9FAFB' }} // Add background to ScrollView
            contentContainerStyle={{ 
              paddingBottom: 100 + insets.bottom,
              backgroundColor: '#F9FAFB' // Ensure content area has background
            }}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                colors={['#91403E']}
                tintColor="#91403E"
                title="Pull to refresh broadcasts"
                titleColor="#91403E"
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {(() => {
              const broadcasts = categorizedBroadcasts as Broadcast[];
              return broadcasts.length === 0 ? (
                renderEmptyState()
              ) : (
                broadcasts.map((broadcast) => renderBroadcastCard(broadcast, activeFilter))
              );
            })()}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
});

export default ListScreen; 