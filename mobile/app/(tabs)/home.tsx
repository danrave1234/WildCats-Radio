import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, SafeAreaView, ScrollView, ActivityIndicator, TouchableOpacity, Platform, Image, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getAllAnnouncements, AnnouncementDTO } from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import '../../global.css';
import { format, parseISO } from 'date-fns';

const AnnouncementsScreen: React.FC = () => {
  const { authToken } = useAuth();
  const insets = useSafeAreaInsets();
  const [announcements, setAnnouncements] = useState<AnnouncementDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 10;

  const fetchAnnouncements = useCallback(async (page = 0, showRefreshing = false) => {
    try {
      if (showRefreshing) setIsRefreshing(true);
      else if (page === 0) setIsLoading(true);
      
      setError(null);
      const result = await getAllAnnouncements(page, pageSize);

      if ('error' in result) {
        setError(result.error || 'Failed to load announcements');
        setAnnouncements([]);
      } else {
        // Sort announcements: pinned first, then by date
        const sortedAnnouncements = (result.content || []).sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime();
        });

        if (page === 0) {
          setAnnouncements(sortedAnnouncements);
        } else {
          // Merge new announcements, avoiding duplicates by ID
          setAnnouncements(prev => {
            const existingIds = new Set(prev.map(a => a.id));
            const newAnnouncements = sortedAnnouncements.filter(a => !existingIds.has(a.id));
            return [...prev, ...newAnnouncements];
          });
        }
        
        setTotalPages(result.totalPages || 0);
        setCurrentPage(page);
        setHasMore(page < (result.totalPages || 0) - 1);
      }
    } catch (apiError: any) {
      setError(apiError.message || 'An unexpected error occurred while fetching announcements.');
      if (page === 0) setAnnouncements([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    fetchAnnouncements(0, true);
  }, [fetchAnnouncements]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchAnnouncements(currentPage + 1);
    }
  }, [isLoading, hasMore, currentPage, fetchAnnouncements]);

  useEffect(() => {
    fetchAnnouncements(0);
  }, []);

  const formatDate = (dateString: string): string => {
    try {
      const date = parseISO(dateString);
      return format(date, 'MMM d, yyyy • h:mm a');
    } catch {
      return dateString;
    }
  };

  // Loading skeleton
  const LoadingSkeleton = () => (
    <View style={{ gap: 16 }}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={{
          backgroundColor: 'white',
          borderRadius: 16,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3
        }}>
          <View style={{ backgroundColor: '#E5E7EB', width: '100%', height: 192 }} />
          <View style={{ padding: 20, gap: 12 }}>
            <View style={{ backgroundColor: '#E5E7EB', height: 24, width: '75%', borderRadius: 4 }} />
            <View style={{ backgroundColor: '#E5E7EB', height: 16, width: '100%', borderRadius: 4 }} />
            <View style={{ backgroundColor: '#E5E7EB', height: 16, width: '85%', borderRadius: 4 }} />
            <View style={{ backgroundColor: '#E5E7EB', height: 12, width: '33%', borderRadius: 4, marginTop: 8 }} />
          </View>
        </View>
      ))}
    </View>
  );

  if (isLoading && announcements.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        {/* Screen Title */}
        <View className="pt-2 pb-4 mb-2 px-5 bg-gray-50">
          <View>
            <Text className="text-3xl font-bold text-gray-800 mb-1">Welcome to WildCats Radio</Text>
            <Text className="text-base text-gray-600">Stay connected with the latest news and announcements</Text>
          </View>
        </View>
        
        <ScrollView
          style={{ backgroundColor: '#F9FAFB' }}
          contentContainerStyle={{ 
            paddingBottom: 120 + insets.bottom,
            paddingTop: 16,
            paddingHorizontal: 16,
            backgroundColor: '#F9FAFB'
          }}
          showsVerticalScrollIndicator={false}
        >
          <LoadingSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error && announcements.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        {/* Screen Title */}
        <View className="pt-2 pb-4 mb-2 px-5 bg-gray-50">
          <View>
            <Text className="text-3xl font-bold text-gray-800 mb-1">Welcome to WildCats Radio</Text>
            <Text className="text-base text-gray-600">Stay connected with the latest news and announcements</Text>
          </View>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Ionicons name="cloud-offline-outline" size={64} color="#7F1D1D" />
          <Text style={{ fontSize: 24, fontWeight: '600', color: '#1F2937', marginTop: 24, marginBottom: 8 }}>Unable to Load Announcements</Text>
          <Text style={{ color: '#6B7280', marginBottom: 32, fontSize: 16, lineHeight: 24, textAlign: 'center' }}>{error}</Text>
          <TouchableOpacity
            style={{
              backgroundColor: '#91403E',
              paddingVertical: 12,
              paddingHorizontal: 32,
              borderRadius: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 3
            }}
            activeOpacity={0.8}
            onPress={() => fetchAnnouncements(0)}
          >
            <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        {/* Screen Title */}
        <View className="pt-6 pb-4 mb-2 px-5 bg-gray-50">
          <View>
            <Text className="text-3xl font-bold text-gray-800 mb-1">Welcome to WildCat Radio</Text>
            <Text className="text-base text-gray-600">Stay connected with the latest news and announcements</Text>
          </View>
        </View>

      <ScrollView
        style={{ backgroundColor: '#F9FAFB' }}
        contentContainerStyle={{ 
          paddingBottom: 120 + insets.bottom,
          paddingTop: 16,
          paddingHorizontal: 16,
          backgroundColor: '#F9FAFB'
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={['#91403E']}
            tintColor="#91403E"
            title="Pull to refresh"
            titleColor="#91403E"
          />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const paddingToBottom = 20;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
            loadMore();
          }
        }}
        scrollEventThrottle={400}
      >
        {announcements.length === 0 ? (
          <View style={{
            backgroundColor: 'white',
            borderRadius: 16,
            padding: 48,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 3
          }}>
            <View style={{
              backgroundColor: '#F3F4F6',
              padding: 24,
              borderRadius: 999,
              marginBottom: 16
            }}>
              <Ionicons name="megaphone-outline" size={48} color="#9CA3AF" />
            </View>
            <Text style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: '#1F2937',
              marginBottom: 8
            }}>No Announcements Yet</Text>
            <Text style={{
              color: '#6B7280',
              textAlign: 'center'
            }}>
              Check back later for updates from WildCats Radio
            </Text>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            {announcements.map((announcement, index) => (
              <View
                key={`announcement-${announcement.id}-${index}`}
                style={{
                  backgroundColor: 'white',
                  borderRadius: 16,
                  overflow: 'hidden',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 8,
                  elevation: 3
                }}
              >
                {/* Image */}
                {announcement.imageUrl && (
                  <View style={{ width: '100%', backgroundColor: '#E5E7EB' }}>
                    <Image
                      source={{ uri: announcement.imageUrl }}
                      style={{ width: '100%', height: undefined, aspectRatio: 16/9 }}
                      resizeMode="cover"
                      onError={(e) => {
                        console.log('Image failed to load:', announcement.imageUrl);
                      }}
                    />
                  </View>
                )}

                {/* Content */}
                <View style={{ padding: 20 }}>
                  {/* Title with Pin Icon */}
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#111827', flex: 1, lineHeight: 26 }}>
                      {announcement.title}
                    </Text>
                    {announcement.pinned && (
                      <View style={{ marginLeft: 8, backgroundColor: 'rgba(145, 64, 62, 0.1)', padding: 6, borderRadius: 8 }}>
                        <Ionicons name="pin" size={16} color="#91403E" />
                      </View>
                    )}
                  </View>

                  {/* Content */}
                  <Text style={{ fontSize: 16, color: '#374151', lineHeight: 24, marginBottom: 16 }}>
                    {announcement.content.replace(/\s+$/g, '')}
                  </Text>

                  {/* Footer */}
                  <View style={{ borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 12, marginTop: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View style={{ backgroundColor: 'rgba(145, 64, 62, 0.1)', padding: 6, borderRadius: 999, marginRight: 8 }}>
                          <Ionicons name="person" size={12} color="#91403E" />
                        </View>
                        <Text style={{ fontSize: 14, color: '#6B7280', flex: 1 }} numberOfLines={1}>
                          {announcement.createdByName || 'WildCats Radio'}
                        </Text>
                      </View>
                      
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                        <Ionicons name="time-outline" size={12} color="#6B7280" />
                        <Text style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 4 }}>
                          {formatDate(announcement.publishedAt || announcement.createdAt)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            ))}

            {/* Load More Indicator */}
            {hasMore && (
              <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                {isLoading ? (
                  <ActivityIndicator size="small" color="#91403E" />
                ) : (
                  <TouchableOpacity
                    onPress={loadMore}
                    style={{
                      backgroundColor: 'rgba(145, 64, 62, 0.1)',
                      paddingVertical: 8,
                      paddingHorizontal: 24,
                      borderRadius: 8
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: '#91403E', fontWeight: '600' }}>Load More</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* End of List Message */}
            {!hasMore && announcements.length > 0 && (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Text style={{ color: '#9CA3AF', fontSize: 14 }}>You've reached the end</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default AnnouncementsScreen;
