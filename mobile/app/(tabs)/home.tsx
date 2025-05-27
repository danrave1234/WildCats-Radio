import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, SafeAreaView, ScrollView, ActivityIndicator, TouchableOpacity, Platform, Image, RefreshControl, AppState, AppStateStatus } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getLiveBroadcasts, getAllBroadcasts, Broadcast } from '../../services/apiService'; // Assuming apiService exports these
import '../../global.css'; // Tailwind CSS
import { format, parseISO, formatDistanceToNowStrict, isToday, isYesterday, differenceInDays } from 'date-fns';

const HomeScreen: React.FC = () => {
  const router = useRouter();
  const { authToken } = useAuth();
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
      <SafeAreaView className="flex-1 justify-center items-center bg-anti-flash_white">
        <ActivityIndicator size="large" color="#91403E" />
        <Text className="mt-4 text-gray-600 text-lg">Loading Dashboard...</Text>
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
    <SafeAreaView className="flex-1 bg-anti-flash_white">
      {/* <Stack.Screen options={{ headerShown: false }} /> */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120, paddingTop: 12 }}
        showsVerticalScrollIndicator={false}
        className="px-5 md:px-7"
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
        <View className="mb-6">
          <Text className="text-3xl font-bold text-gray-800">Welcome, Listener!</Text>
          <Text className="text-gray-600">Here's what's happening with Wildcat Radio.</Text>
        </View>

        {/* Logo */}
        <View className="items-center mb-7">
          <Image 
            source={require('../../assets/images/wildcat_radio_logo_transparent.png')}
            className="w-65 h-40" // Adjust width and height as needed
            resizeMode="contain"
          />
        </View>

        {/* Broadcast Status Card */}
        <View className="bg-white p-5 rounded-2xl shadow-lg mb-7"> {/* Slightly more rounded, increased padding/margin */}
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold text-gray-800">Broadcast Status</Text>
            <TouchableOpacity
              className="bg-cordovan py-2.5 px-4 rounded-lg flex-row items-center shadow-md active:opacity-80"
              onPress={() => router.push('/broadcast' as any)}
            >
              {!!isLive && (
                <View className="bg-mikado_yellow py-1 px-2.5 rounded mr-2 flex-row items-center self-stretch">
                  <Text className="text-black font-extrabold text-xs tracking-wider">LIVE</Text>
                </View>
              )}
              <Text className="text-white font-semibold text-sm">Listen Now</Text>
              <Ionicons name="headset-outline" size={18} color="white" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>

          {isLive && currentLiveBroadcast ? (
            <View className="flex-row items-center mt-1">
              <Ionicons name="radio-outline" size={30} color="#91403E" className="mr-3.5" />
              <View className="flex-1">
                <Text className="text-lg font-bold text-cordovan leading-tight">{currentLiveBroadcast.title}</Text>
                <Text className="text-sm text-gray-600 mt-0.5">
                  with {currentLiveBroadcast.dj?.name || 'Wildcat Radio'} • {renderBroadcastTimeInfo(currentLiveBroadcast)}
                </Text>
              </View>
            </View>
          ) : (
            <View className="flex-row items-center mt-1">
              <Ionicons name="radio-outline" size={30} color="#6B7280" className="mr-3.5" />
              <Text className="text-lg text-gray-700">Currently Off Air</Text>
            </View>
          )}
        </View>
        {/* Recent Broadcasts Section */}
        <View className="mb-7">
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
            {recentBroadcasts.length > 0 ? 
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
                      <Text className="text-base font-semibold text-gray-800 leading-snug">{item.title}</Text>
                      <Text className="text-sm text-gray-600 mt-0.5">
                        {item.dj?.name || 'Wildcat Radio'} • {renderBroadcastTimeInfo(item)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward-outline" size={22} color="#A0A0A0" />
                  </TouchableOpacity>
                  {index < recentBroadcasts.length - 1 && (
                    <View className="h-px bg-gray-200 my-1 border-0 border-t border-dashed border-gray-300 mx-4" />
                  )}
                </React.Fragment>
              ))
             : 
              <Text className="text-gray-600 py-4 text-center">No recent broadcasts to display.</Text>
            }
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default HomeScreen; 