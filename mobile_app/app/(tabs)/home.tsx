import React, { useEffect, useState, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Image,
  RefreshControl,
  StyleSheet,
  Dimensions,
  Animated,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getAllAnnouncements, AnnouncementDTO } from '../../services/userService';
import { useAuth } from '../../context/AuthContext';

const { width, height } = Dimensions.get('window');

const HomeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [announcements, setAnnouncements] = useState<AnnouncementDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 10;
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementDTO | null>(null);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

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
      const date = new Date(dateString);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[date.getMonth()];
      const day = date.getDate();
      const year = date.getFullYear();
      
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const minutesStr = minutes < 10 ? `0${minutes}` : minutes;
      
      return `${month} ${day}, ${year} • ${hours}:${minutesStr} ${ampm}`;
    } catch {
      return dateString;
    }
  };

  // Loading skeleton with shimmer effect
  const LoadingSkeleton = () => {
    const shimmerOpacity = shimmerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0.7],
    });

    return (
      <View style={styles.skeletonContainer}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.skeletonCard}>
            <Animated.View style={[styles.skeletonImage, { opacity: shimmerOpacity }]} />
            <View style={styles.skeletonContent}>
              <Animated.View style={[styles.skeletonLine1, { opacity: shimmerOpacity }]} />
              <Animated.View style={[styles.skeletonLine2, { opacity: shimmerOpacity }]} />
              <Animated.View style={[styles.skeletonLine3, { opacity: shimmerOpacity }]} />
              <Animated.View style={[styles.skeletonLine4, { opacity: shimmerOpacity }]} />
            </View>
          </View>
        ))}
      </View>
    );
  };

  if (isLoading && announcements.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Background gradients */}
        <View style={styles.backgroundBase} />
        <LinearGradient colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.gradientOverlay1} />
        <LinearGradient colors={['rgba(127,29,29,0.3)', 'transparent']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.gradientMaroon1} />
        <LinearGradient colors={['rgba(251,191,36,0.18)', 'transparent']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={styles.gradientYellow1} />
        <LinearGradient colors={['rgba(251,191,36,0.4)', 'rgba(127,29,29,0.3)', 'transparent']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={styles.gradientBlur1} />
        <LinearGradient colors={['rgba(127,29,29,0.3)', 'rgba(225,29,72,0.2)', 'transparent']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.gradientBlur2} />

        {/* Home Title - Fixed at top */}
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Home</Text>
          {!isAuthenticated && (
            <View style={styles.headerAuthButtons}>
              <TouchableOpacity
                style={styles.headerLoginButton}
                onPress={() => router.push('/auth/login' as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.headerLoginButtonText}>Log in</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerSignupButton}
                onPress={() => router.push('/auth/signup' as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.headerSignupButtonText}>Sign up</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Screen Title - Scrollable */}
          <View style={styles.titleContainer}>
            <LinearGradient
              colors={['rgba(255, 195, 11, 0.1)', 'rgba(145, 64, 62, 0.05)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.titleGradientBackground}
            />
            <View style={styles.titleRow}>
              <LinearGradient
                colors={['rgba(255, 195, 11, 0.25)', 'rgba(255, 195, 11, 0.15)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.titleIconContainer}
              >
                <Ionicons name="radio" size={26} color="#FFC30B" />
              </LinearGradient>
              <View style={styles.titleTextContainer}>
                <Text style={styles.title}>Welcome to WildCat Radio</Text>
                <View style={styles.titleUnderline} />
              </View>
            </View>
            <View style={styles.subtitleContainer}>
              <Ionicons name="sparkles" size={14} color="#FFC30B" style={styles.subtitleIcon} />
              <Text style={styles.subtitle}>Stay connected with the latest news and announcements</Text>
            </View>
          </View>
          
          <LoadingSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error && announcements.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Background gradients */}
        <View style={styles.backgroundBase} />
        <LinearGradient colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.gradientOverlay1} />
        <LinearGradient colors={['rgba(127,29,29,0.3)', 'transparent']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.gradientMaroon1} />
        <LinearGradient colors={['rgba(251,191,36,0.18)', 'transparent']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={styles.gradientYellow1} />
        <LinearGradient colors={['rgba(251,191,36,0.4)', 'rgba(127,29,29,0.3)', 'transparent']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={styles.gradientBlur1} />
        <LinearGradient colors={['rgba(127,29,29,0.3)', 'rgba(225,29,72,0.2)', 'transparent']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.gradientBlur2} />

        {/* Home Title - Fixed at top */}
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Home</Text>
          {!isAuthenticated && (
            <View style={styles.headerAuthButtons}>
              <TouchableOpacity
                style={styles.headerLoginButton}
                onPress={() => router.push('/auth/login' as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.headerLoginButtonText}>Log in</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerSignupButton}
                onPress={() => router.push('/auth/signup' as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.headerSignupButtonText}>Sign up</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Screen Title - Scrollable */}
          <View style={styles.titleContainer}>
            <LinearGradient
              colors={['rgba(255, 195, 11, 0.1)', 'rgba(145, 64, 62, 0.05)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.titleGradientBackground}
            />
            <View style={styles.titleRow}>
              <LinearGradient
                colors={['rgba(255, 195, 11, 0.25)', 'rgba(255, 195, 11, 0.15)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.titleIconContainer}
              >
                <Ionicons name="radio" size={26} color="#FFC30B" />
              </LinearGradient>
              <View style={styles.titleTextContainer}>
                <Text style={styles.title}>Welcome to WildCats Radio</Text>
                <View style={styles.titleUnderline} />
              </View>
            </View>
            <View style={styles.subtitleContainer}>
              <Ionicons name="sparkles" size={14} color="#FFC30B" style={styles.subtitleIcon} />
              <Text style={styles.subtitle}>Stay connected with the latest news and announcements</Text>
            </View>
          </View>

          <View style={styles.errorContainer}>
          <View style={styles.errorIconContainer}>
            <Ionicons name="cloud-offline-outline" size={48} color="#91403E" />
          </View>
          <Text style={styles.errorTitle}>Unable to Load Announcements</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            activeOpacity={0.8}
            onPress={() => fetchAnnouncements(0)}
          >
            <LinearGradient
              colors={['#A04A47', '#91403E', '#7F1D1D']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.retryButtonGradient}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </LinearGradient>
          </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Background gradients */}
      <View style={styles.backgroundBase} />
      <LinearGradient colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.gradientOverlay1} />
      <LinearGradient colors={['rgba(127,29,29,0.3)', 'transparent']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.gradientMaroon1} />
      <LinearGradient colors={['rgba(251,191,36,0.18)', 'transparent']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={styles.gradientYellow1} />
      <LinearGradient colors={['rgba(251,191,36,0.4)', 'rgba(127,29,29,0.3)', 'transparent']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={styles.gradientBlur1} />
      <LinearGradient colors={['rgba(127,29,29,0.3)', 'rgba(225,29,72,0.2)', 'transparent']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.gradientBlur2} />

      {/* Home Title - Fixed at top */}
      <View style={styles.headerTitleContainer}>
        <Text style={styles.headerTitle}>Home</Text>
        {!isAuthenticated && (
          <View style={styles.headerAuthButtons}>
            <TouchableOpacity
              style={styles.headerLoginButton}
              onPress={() => router.push('/auth/login' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.headerLoginButtonText}>Log in</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerSignupButton}
              onPress={() => router.push('/auth/signup' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.headerSignupButtonText}>Sign up</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
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
        {/* Screen Title - Scrollable */}
        <View style={styles.titleContainer}>
          <LinearGradient
            colors={['rgba(255, 195, 11, 0.1)', 'rgba(145, 64, 62, 0.05)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.titleGradientBackground}
          />
          <View style={styles.titleRow}>
            <LinearGradient
              colors={['rgba(255, 195, 11, 0.25)', 'rgba(255, 195, 11, 0.15)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.titleIconContainer}
            >
              <Ionicons name="radio" size={26} color="#FFC30B" />
            </LinearGradient>
            <View style={styles.titleTextContainer}>
              <Text style={styles.title}>Welcome to WildCats Radio</Text>
              <View style={styles.titleUnderline} />
            </View>
          </View>
          <View style={styles.subtitleContainer}>
            <Ionicons name="sparkles" size={14} color="#FFC30B" style={styles.subtitleIcon} />
            <Text style={styles.subtitle}>Stay connected with the latest news and announcements</Text>
          </View>
        </View>

        {announcements.length === 0 ? (
          <View style={styles.emptyContainer}>
            <LinearGradient
              colors={['rgba(145, 64, 62, 0.2)', 'rgba(255, 195, 11, 0.1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.emptyIconGradient}
            >
              <Ionicons name="megaphone-outline" size={48} color="#FFC30B" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>No Announcements Yet</Text>
            <Text style={styles.emptyText}>
              Check back later for updates from WildCats Radio
            </Text>
          </View>
        ) : (
          <View style={styles.announcementsContainer}>
            {announcements.map((announcement, index) => (
              <TouchableOpacity
                key={`announcement-${announcement.id}-${index}`}
                style={styles.announcementCard}
                activeOpacity={0.92}
                onPress={() => {
                  setSelectedAnnouncement(announcement);
                  setShowAnnouncementModal(true);
                }}
              >
                {/* Card glow effect for pinned items */}
                {announcement.pinned && (
                  <LinearGradient
                    colors={['rgba(255, 195, 11, 0.15)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardGlow}
                  />
                )}
                
                {/* Image with gradient overlay */}
                {announcement.imageUrl && (
                  <View style={styles.imageContainer}>
                    <Image
                      source={{ uri: announcement.imageUrl }}
                      style={styles.announcementImage}
                      resizeMode="cover"
                      onError={(e) => {
                        console.log('Image failed to load:', announcement.imageUrl);
                      }}
                    />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.6)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={styles.imageOverlay}
                    />
                    {announcement.pinned && (
                      <View style={styles.pinBadge}>
                        <LinearGradient
                          colors={['#FFC30B', '#FFB800', '#FFA500']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.pinBadgeGradient}
                        >
                          <Ionicons name="pin" size={14} color="#000000" />
                          <Text style={styles.pinText}>PINNED</Text>
                        </LinearGradient>
                      </View>
                    )}
                  </View>
                )}

                {/* Content */}
                <View style={styles.announcementContent}>
                  {/* Title */}
                  <View style={styles.announcementHeader}>
                    <View style={styles.titleWrapper}>
                      {!announcement.imageUrl && announcement.pinned && (
                        <View style={styles.pinContainer}>
                          <LinearGradient
                            colors={['#FFC30B', '#FFB800', '#FFA500']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.pinGradient}
                          >
                            <Ionicons name="pin" size={12} color="#000000" />
                          </LinearGradient>
                        </View>
                      )}
                      <Text style={styles.announcementTitle} numberOfLines={2}>
                        {announcement.title}
                      </Text>
                    </View>
                  </View>

                  {/* Content */}
                  <Text style={styles.announcementBody} numberOfLines={3}>
                    {announcement.content.replace(/\s+$/g, '')}
                  </Text>

                  {/* Footer */}
                  <View style={styles.announcementFooter}>
                    <View style={styles.footerLeft}>
                      <LinearGradient
                        colors={['rgba(145, 64, 62, 0.35)', 'rgba(255, 195, 11, 0.2)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.authorIconGradient}
                      >
                        <Ionicons name="person" size={13} color="#FFC30B" />
                      </LinearGradient>
                      <Text style={styles.authorName} numberOfLines={1}>
                        {announcement.createdByName || 'WildCats Radio'}
                      </Text>
                    </View>
                    
                    <View style={styles.footerRight}>
                      <View style={styles.timeIconContainer}>
                        <Ionicons name="time-outline" size={14} color="#94a3b8" />
                      </View>
                      <Text style={styles.dateText}>
                        {formatDate(announcement.publishedAt || announcement.createdAt)}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}

            {/* Load More Indicator */}
            {hasMore && (
              <View style={styles.loadMoreContainer}>
                {isLoading ? (
                  <ActivityIndicator size="small" color="#91403E" />
                ) : (
                  <TouchableOpacity
                    onPress={loadMore}
                    style={styles.loadMoreButton}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={['rgba(145, 64, 62, 0.3)', 'rgba(145, 64, 62, 0.2)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.loadMoreButtonGradient}
                    >
                      <Text style={styles.loadMoreButtonText}>Load More</Text>
                      <Ionicons name="chevron-down" size={16} color="#91403E" style={{ marginLeft: 8 }} />
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* End of List Message */}
            {!hasMore && announcements.length > 0 && (
              <View style={styles.endOfListContainer}>
                <View style={styles.endOfListDivider} />
                <Text style={styles.endOfListText}>You've reached the end</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Announcement Detail Modal */}
      <Modal
        visible={showAnnouncementModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowAnnouncementModal(false);
          setSelectedAnnouncement(null);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Background gradients - same as profile modals */}
          <View style={styles.modalBackgroundBase} />
          <LinearGradient
            colors={['rgba(15,23,42,0.95)', 'rgba(2,6,23,0.95)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.modalGradientOverlay1}
          />
          <LinearGradient
            colors={['rgba(127,29,29,0.35)', 'transparent']}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={styles.modalGradientMaroon1}
          />
          <LinearGradient
            colors={['rgba(251,191,36,0.18)', 'transparent']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.modalGradientYellow1}
          />
          <LinearGradient
            colors={['rgba(251,191,36,0.50)', 'rgba(127,29,29,0.45)', 'transparent']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.modalGradientBlur1}
          />
          <LinearGradient
            colors={['rgba(127,29,29,0.60)', 'rgba(225,29,72,0.45)', 'transparent']}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={styles.modalGradientBlur2}
          />

          <TouchableOpacity 
            onPress={() => {
              setShowAnnouncementModal(false);
              setSelectedAnnouncement(null);
            }}
            style={styles.modalCloseButton}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color="#94a3b8" />
          </TouchableOpacity>

          <ScrollView 
            style={styles.modalScrollView} 
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {selectedAnnouncement && (
              <View style={styles.modalContent}>
                {/* Image */}
                {selectedAnnouncement.imageUrl && (
                  <View style={styles.modalImageContainer}>
                    <Image
                      source={{ uri: selectedAnnouncement.imageUrl }}
                      style={styles.modalImage}
                      resizeMode="cover"
                    />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.6)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={styles.modalImageOverlay}
                    />
                    {selectedAnnouncement.pinned && (
                      <View style={styles.modalPinBadge}>
                        <LinearGradient
                          colors={['#FFC30B', '#FFB800', '#FFA500']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.modalPinBadgeGradient}
                        >
                          <Ionicons name="pin" size={14} color="#000000" />
                          <Text style={styles.modalPinText}>PINNED</Text>
                        </LinearGradient>
                      </View>
                    )}
                  </View>
                )}

                {/* Title */}
                <View style={styles.modalHeader}>
                  {!selectedAnnouncement.imageUrl && selectedAnnouncement.pinned && (
                    <View style={styles.modalPinContainer}>
                      <LinearGradient
                        colors={['#FFC30B', '#FFB800', '#FFA500']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.modalPinGradient}
                      >
                        <Ionicons name="pin" size={12} color="#000000" />
                      </LinearGradient>
                    </View>
                  )}
                  <Text style={styles.modalTitle}>{selectedAnnouncement.title}</Text>
                </View>

                {/* Author and Date */}
                <View style={styles.modalMeta}>
                  <View style={styles.modalMetaLeft}>
                    <LinearGradient
                      colors={['rgba(145, 64, 62, 0.35)', 'rgba(255, 195, 11, 0.2)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.modalAuthorIconGradient}
                    >
                      <Ionicons name="person" size={13} color="#FFC30B" />
                    </LinearGradient>
                    <Text style={styles.modalAuthorName}>
                      {selectedAnnouncement.createdByName || 'WildCats Radio'}
                    </Text>
                  </View>
                  
                  <View style={styles.modalMetaRight}>
                    <Ionicons name="time-outline" size={14} color="#94a3b8" />
                    <Text style={styles.modalDateText}>
                      {formatDate(selectedAnnouncement.publishedAt || selectedAnnouncement.createdAt)}
                    </Text>
                  </View>
                </View>

                {/* Divider */}
                <View style={styles.modalDivider} />

                {/* Full Content */}
                <Text style={styles.modalBodyText}>
                  {selectedAnnouncement.content}
                </Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    bottom: -height * 0.3,
    left: -width * 0.2,
    width: width * 0.8,
    height: height * 0.8,
    opacity: 0.3,
  },
  gradientYellow1: {
    position: 'absolute',
    top: -height * 0.2,
    right: -width * 0.15,
    width: width * 0.7,
    height: height * 0.7,
    opacity: 0.3,
  },
  gradientBlur1: {
    position: 'absolute',
    top: -height * 0.3,
    right: -width * 0.15,
    width: width * 1.2,
    height: height * 0.8,
    opacity: 0.4,
  },
  gradientBlur2: {
    position: 'absolute',
    bottom: -height * 0.4,
    left: -width * 0.2,
    width: width * 1.2,
    height: height * 1.0,
    opacity: 0.3,
  },
  headerTitleContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    zIndex: 10,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e2e8f0',
  },
  headerAuthButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerLoginButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(145, 64, 62, 0.5)',
  },
  headerLoginButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#91403E',
  },
  headerSignupButton: {
    backgroundColor: '#91403E',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    shadowColor: '#91403E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  headerSignupButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  titleContainer: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 24 : 16,
    paddingBottom: 28,
    marginBottom: 12,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    marginHorizontal: 4,
  },
  titleGradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    zIndex: 1,
  },
  titleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    shadowColor: '#FFC30B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  titleTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#e2e8f0',
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  titleUnderline: {
    height: 3,
    width: 60,
    backgroundColor: '#FFC30B',
    borderRadius: 2,
    marginTop: 6,
    shadowColor: '#FFC30B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  subtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 62,
    zIndex: 1,
  },
  subtitleIcon: {
    marginRight: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  skeletonContainer: {
    gap: 20,
  },
  skeletonCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  skeletonImage: {
    width: '100%',
    height: 200,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  skeletonContent: {
    padding: 24,
    gap: 14,
  },
  skeletonLine1: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    height: 22,
    width: '75%',
    borderRadius: 6,
  },
  skeletonLine2: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    height: 16,
    width: '100%',
    borderRadius: 6,
  },
  skeletonLine3: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    height: 16,
    width: '85%',
    borderRadius: 6,
  },
  skeletonLine4: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    height: 14,
    width: '40%',
    borderRadius: 6,
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 10,
  },
  errorIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(145, 64, 62, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    color: '#94a3b8',
    marginBottom: 32,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 300,
  },
  retryButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  retryButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  emptyContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 24,
    padding: 48,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 8,
  },
  emptyIconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 10,
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  announcementsContainer: {
    gap: 20,
  },
  announcementCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    position: 'relative',
  },
  cardGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 24,
    zIndex: 0,
  },
  imageContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    position: 'relative',
  },
  announcementImage: {
    width: '100%',
    height: undefined,
    aspectRatio: 16 / 9,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  pinBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#FFC30B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  pinBadgeGradient: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pinText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.5,
  },
  announcementContent: {
    padding: 26,
    zIndex: 1,
  },
  announcementHeader: {
    marginBottom: 16,
  },
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  announcementTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: '#e2e8f0',
    flex: 1,
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  pinContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#FFC30B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    marginTop: 2,
  },
  pinGradient: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  announcementBody: {
    fontSize: 15.5,
    color: '#94a3b8',
    lineHeight: 25,
    marginBottom: 20,
    letterSpacing: 0.15,
  },
  announcementFooter: {
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 18,
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  authorIconGradient: {
    padding: 9,
    borderRadius: 22,
    marginRight: 12,
    shadowColor: '#91403E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  authorName: {
    fontSize: 14.5,
    color: '#cbd5e1',
    flex: 1,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  timeIconContainer: {
    marginRight: 4,
  },
  dateText: {
    fontSize: 12.5,
    color: '#94a3b8',
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  loadMoreContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  loadMoreButton: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#91403E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  loadMoreButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreButtonText: {
    color: '#91403E',
    fontWeight: '800',
    fontSize: 15.5,
    letterSpacing: 0.3,
  },
  endOfListContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  endOfListDivider: {
    width: 60,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
  },
  endOfListText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  // Modal styles - matching profile modals
  modalContainer: {
    flex: 1,
    backgroundColor: '#020617',
  },
  modalBackgroundBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#020617',
  },
  modalGradientOverlay1: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.7,
  },
  modalGradientMaroon1: {
    position: 'absolute',
    bottom: -height * 0.3,
    left: -width * 0.2,
    width: width * 0.8,
    height: height * 0.8,
    opacity: 0.7,
  },
  modalGradientYellow1: {
    position: 'absolute',
    top: -height * 0.2,
    right: -width * 0.15,
    width: width * 0.7,
    height: height * 0.7,
    opacity: 0.7,
  },
  modalGradientBlur1: {
    position: 'absolute',
    top: -height * 0.3,
    right: -width * 0.15,
    width: width * 1.2,
    height: height * 0.8,
    opacity: 0.8,
  },
  modalGradientBlur2: {
    position: 'absolute',
    bottom: -height * 0.4,
    left: -width * 0.2,
    width: width * 1.2,
    height: height * 1.0,
    opacity: 0.7,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    paddingBottom: 40,
    paddingTop: 16,
  },
  modalContent: {
    padding: 24,
  },
  modalImageContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    position: 'relative',
  },
  modalImage: {
    width: '100%',
    height: undefined,
    aspectRatio: 16 / 9,
  },
  modalImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  modalPinBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#FFC30B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  modalPinBadgeGradient: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalPinText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 10,
  },
  modalPinContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#FFC30B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    marginTop: 2,
  },
  modalPinGradient: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#e2e8f0',
    flex: 1,
    lineHeight: 36,
    letterSpacing: -0.4,
  },
  modalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalAuthorIconGradient: {
    padding: 9,
    borderRadius: 22,
    marginRight: 12,
    shadowColor: '#91403E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  modalAuthorName: {
    fontSize: 15,
    color: '#cbd5e1',
    flex: 1,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  modalMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  modalDateText: {
    fontSize: 13,
    color: '#94a3b8',
    marginLeft: 6,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  modalDivider: {
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 24,
  },
  modalBodyText: {
    fontSize: 16,
    color: '#94a3b8',
    lineHeight: 26,
    letterSpacing: 0.15,
  },
});

export default HomeScreen;
