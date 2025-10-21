import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, SafeAreaView, ScrollView, ActivityIndicator, TouchableOpacity, Platform, Image, RefreshControl, AppState, AppStateStatus } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getLiveBroadcasts, getAllBroadcasts, Broadcast } from '../../services/apiService'; // Assuming apiService exports these
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeSkeleton from '../../components/HomeSkeleton';
import '../../global.css'; // Tailwind CSS
import { format, parseISO, formatDistanceToNowStrict, isToday, isYesterday, differenceInDays } from 'date-fns';

const HomeScreen: React.FC = () => {
  const router = useRouter();
  const { authToken } = useAuth();
  const insets = useSafeAreaInsets();
  const [liveBroadcasts, setLiveBroadcasts] = useState<Broadcast[]>([]);
  const [recentBroadcasts, setRecentBroadcasts] = useState<Broadcast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Real-time update refs
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const isLive = liveBroadcasts.length > 0;
  const currentLiveBroadcast = isLive ? liveBroadcasts[0] : null;

  const fetchData = useCallback(async (showRefreshing = false, isBackgroundUpdate = false) => {
    if (!authToken) {
      setError('Authentication token not found. Please log in.');
      setIsLoading(false);
      return;
    }
    
    if (showRefreshing) setIsRefreshing(true);
    else if (!isBackgroundUpdate) setIsLoading(true);
    setError(null);
    try {
      const [liveRes, recentRes] = await Promise.all([
        getLiveBroadcasts(authToken),
        getAllBroadcasts(authToken),
      ]);

      if ('error' in liveRes) {
        setError(prevError => prevError ? `${prevError}; ${liveRes.error}` : liveRes.error);
      } else {
        setLiveBroadcasts(liveRes);
      }

      if ('error' in recentRes) {
        setError(prevError => prevError ? `${prevError}; ${recentRes.error}` : recentRes.error);
      } else {
        const sortedRecent = recentRes
          .sort((a: Broadcast, b: Broadcast) => {
            const dateA = new Date(a.actualStart || a.scheduledStart).getTime();
            const dateB = new Date(b.actualStart || b.scheduledStart).getTime();
            return dateB - dateA;
          })
          .slice(0, 3);
        setRecentBroadcasts(sortedRecent);
      }
    } catch (apiError: any) {
      if (!isBackgroundUpdate) {
        setError(apiError.message || 'An unexpected error occurred while fetching data.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [authToken]);

  const onRefresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  // Start polling for live broadcast updates
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    // Poll every 30 seconds for live broadcast status
    pollIntervalRef.current = setInterval(() => {
      fetchData(false, true); // Background update
    }, 30000);
  }, [fetchData]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground, refresh data and start polling
        fetchData(false, true);
        startPolling();
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background, stop polling to save battery
        stopPolling();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [fetchData, startPolling, stopPolling]);

  // Initial data fetch and start polling
  useEffect(() => {
    fetchData();
    startPolling();
    
    // Cleanup on unmount
    return () => {
      stopPolling();
    };
  }, [fetchData, startPolling, stopPolling]);

  const formatRelativeTime = (dateString: string): string => {
    const date = parseISO(dateString);
    if (isToday(date)) {
      return 'Today';
    }
    if (isYesterday(date)) {
      return 'Yesterday';
    }
    const daysAgo = differenceInDays(new Date(), date);
    if (daysAgo > 1 && daysAgo <= 7) {
        return `${daysAgo} days ago`;
    }
    return format(date, 'MMM d'); // Fallback for older dates
  };

  const renderBroadcastTimeInfo = (broadcast: Broadcast): string => {
    if (broadcast.actualStart && !broadcast.actualEnd) { // Live
      return `Started ${formatDistanceToNowStrict(parseISO(broadcast.actualStart))} ago`;
    }
    // For recent/ended or upcoming, use the relative time formatter
    return formatRelativeTime(broadcast.actualStart || broadcast.scheduledStart);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
        <ScrollView
          style={{ backgroundColor: '#F5F5F5' }}
          contentContainerStyle={{ 
            paddingBottom: 120 + insets.bottom,
            paddingTop: 12 + insets.top,
            paddingHorizontal: 20,
            backgroundColor: '#F5F5F5'
          }}
          showsVerticalScrollIndicator={false}
        >
          <HomeSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error && !isLoading) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-anti-flash_white p-6 text-center">
        <Ionicons name="cloud-offline-outline" size={64} color="#7F1D1D" />
        <Text className="text-2xl font-semibold text-gray-800 mt-6 mb-2">Unable to Load Dashboard</Text>
        <Text className="text-gray-600 mb-8 text-base leading-relaxed">{error}</Text>
        <TouchableOpacity
            className="bg-cordovan py-3 px-8 rounded-lg shadow-md active:opacity-80"
            onPress={() => fetchData()}
        >
             <Text className="text-white font-semibold text-base">Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <ScrollView
        style={{ backgroundColor: '#F5F5F5' }} // Add background to ScrollView
        contentContainerStyle={{ 
          paddingBottom: 120 + insets.bottom, // Add bottom safe area for home indicator
          paddingTop: Platform.OS === 'android' ? 12 : 6, // Tight spacing like schedule page
          paddingHorizontal: 20,
          backgroundColor: '#F5F5F5' // Ensure content area has background
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={['#91403E']}
            tintColor="#91403E"
            title="Pull to refresh dashboard"
            titleColor="#91403E"
          />
        }
      >
        {/* Welcome Message */}
        <View className="mb-4">
          <Text className="text-3xl font-bold text-gray-800">Welcome, Listener!</Text>
          <Text className="text-base text-gray-600">Here's what's happening with Wildcat Radio.</Text>
        </View>

        {/* Logo */}
        <View className="items-center mb-4">
          <Image 
            source={require('../../assets/images/wildcat_radio_logo_transparent.png')}
            style={{ width: 260, height: 160 }}
            resizeMode="contain"
          />
        </View>

        {/* Broadcast Status Card */}
        <View style={{ 
          backgroundColor: 'white', 
          padding: 20, 
          borderRadius: 16, 
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1F2937' }}>Broadcast Status</Text>
            <TouchableOpacity
              style={{
                backgroundColor: '#91403E',
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 8,
                flexDirection: 'row',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.2,
                shadowRadius: 2,
                elevation: 2
              }}
              onPress={() => router.push('/broadcast' as any)}
            >
              {!!isLive && (
                <View style={{
                  backgroundColor: '#F4D03F',
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                  borderRadius: 4,
                  marginRight: 8,
                  flexDirection: 'row',
                  alignItems: 'center'
                }}>
                  <Text style={{ color: 'black', fontWeight: 'bold', fontSize: 12, letterSpacing: 1 }}>LIVE</Text>
                </View>
              )}
              <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>Listen Now</Text>
              <Ionicons name="headset-outline" size={18} color="white" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>

          {isLive && currentLiveBroadcast ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Ionicons name="radio-outline" size={30} color="#91403E" style={{ marginRight: 14 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#91403E', lineHeight: 24 }}>{currentLiveBroadcast.title}</Text>
                <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 2 }}>
                  with {currentLiveBroadcast.dj?.name || 'Wildcat Radio'} • {renderBroadcastTimeInfo(currentLiveBroadcast)}
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Ionicons name="radio-outline" size={30} color="#6B7280" style={{ marginRight: 14 }} />
              <Text style={{ fontSize: 18, color: '#6B7280' }}>Currently Off Air</Text>
            </View>
          )}
        </View>
        {/* Recent Broadcasts Section */}
        <View className="mb-4">
          {/* Header for Recent Broadcasts */}
          <View className="flex-row justify-between items-center mb-3.5 px-1">
            <Text className="text-xl font-bold text-cordovan">Recent Broadcasts</Text>
            <TouchableOpacity 
              onPress={() => router.push('/list?tab=recent')}
              className="py-2 px-3 rounded-lg bg-cordovan/5 border border-cordovan/20"
              activeOpacity={0.6}
            >
              <View className="flex-row items-center">
                <Text className="text-sm font-semibold text-cordovan mr-1">See All</Text>
                <Ionicons name="chevron-forward" size={16} color="#91403E" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Recent Broadcasts Card */}
          <View className="bg-white p-5 rounded-2xl shadow-lg"> {/* Removed mb-7 from here */}
            {recentBroadcasts && recentBroadcasts.length > 0 ? 
              recentBroadcasts.map((item, index) => (
                <React.Fragment key={item.id}>
                  <TouchableOpacity
                    className="flex-row items-center py-4 active:bg-gray-50 rounded-lg -mx-1.5 px-1.5"
                    onPress={() => console.log("Tapped recent broadcast:", item.title)}
                  >
                    <View className="bg-cordovan w-10 h-10 rounded-full items-center justify-center mr-4 shadow-sm">
                      <Ionicons name="disc-outline" size={20} color="white" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-lg font-bold text-gray-800 leading-snug">{item.title}</Text>
                      <Text className="text-sm text-gray-600 mt-0.5">
                        {item.dj?.name || 'Wildcat Radio'} • {renderBroadcastTimeInfo(item)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {index < recentBroadcasts.length - 1 && (
                    <View className="h-px bg-gray-200 my-1 border-0 border-t border-dashed border-gray-300 mx-4" />
                  )}
                </React.Fragment>
              ))
             : 
              <Text className="text-base text-gray-600 py-4 text-center">No recent broadcasts to display.</Text>
            }
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default HomeScreen; 