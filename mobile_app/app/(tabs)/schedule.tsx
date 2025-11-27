import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Alert,
  Platform,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import ScheduleSkeleton from '../../components/ScheduleSkeleton';
import {
  format,
  parseISO,
  isToday,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  getDay,
  getDate,
} from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { getUpcomingBroadcasts, Broadcast } from '../../services/userService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Constants for calendar layout
const HORIZONTAL_PADDING_SCREEN = 20;
const PADDING_CALENDAR_CARD = 16;
const GAP_BETWEEN_CELLS = 8;
const NUM_DAYS_IN_WEEK = 7;

const calculateDayCellSize = () => {
  const availableWidthForGrid = SCREEN_WIDTH - (HORIZONTAL_PADDING_SCREEN * 2) - (PADDING_CALENDAR_CARD * 2);
  const totalGapSpace = GAP_BETWEEN_CELLS * (NUM_DAYS_IN_WEEK - 1);
  return Math.floor((availableWidthForGrid - totalGapSpace) / NUM_DAYS_IN_WEEK);
};

const DAY_CELL_SIZE = calculateDayCellSize();

const ScheduleScreen: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const params = useLocalSearchParams();
  const [upcomingBroadcasts, setUpcomingBroadcasts] = useState<Broadcast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const ITEMS_PER_PAGE = 5;

  const fetchUpcomingBroadcasts = useCallback(async (showRefreshing = false) => {
    if (!isAuthenticated) {
      setError('Authentication required.');
      setIsLoading(false);
      return;
    }
    
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    
    try {
      const result = await getUpcomingBroadcasts();
      if ('error' in result) {
        setError(result.error);
      } else {
        setUpcomingBroadcasts(result);
      }
    } catch (err) {
      setError('Failed to load schedule');
      console.error('Fetch schedule error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchUpcomingBroadcasts();
  }, [fetchUpcomingBroadcasts]);

  // Handle date parameter from navigation
  useEffect(() => {
    if (params.date && typeof params.date === 'string') {
      try {
        const targetDate = parseISO(params.date);
        setCurrentMonthDate(startOfMonth(targetDate));
        setSelectedDate(targetDate);
        setCurrentPage(0);
      } catch (error) {
        console.warn('Error parsing date parameter:', error);
      }
    }
  }, [params.date]);

  const onRefresh = useCallback(() => {
    fetchUpcomingBroadcasts(true);
  }, [fetchUpcomingBroadcasts]);

  const broadcastsByDate = useMemo(() => {
    const grouped: { [key: string]: Broadcast[] } = {};
    upcomingBroadcasts.forEach(broadcast => {
      const dateKey = format(parseISO(broadcast.scheduledStart), 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(broadcast);
    });
    return grouped;
  }, [upcomingBroadcasts]);

  const daysForCalendarGrid = useMemo(() => {
    const monthStart = startOfMonth(currentMonthDate);
    const monthEnd = endOfMonth(currentMonthDate);
    const firstDayOfMonth = getDay(monthStart);
    const lastDayOfMonth = getDay(monthEnd);

    const startDate = new Date(monthStart);
    startDate.setDate(startDate.getDate() - firstDayOfMonth);

    const endDate = new Date(monthEnd);
    endDate.setDate(endDate.getDate() + (6 - lastDayOfMonth));
    
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonthDate]);

  const handlePrevMonth = () => {
    setCurrentMonthDate(prev => subMonths(prev, 1));
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(prev => addMonths(prev, 1));
    setSelectedDate(null);
  };
  
  const handleGoToToday = () => {
    const today = new Date();
    setCurrentMonthDate(today);
    setSelectedDate(today);
  };

  const handleDayPress = (day: Date) => {
    if (selectedDate && isSameDay(day, selectedDate)) {
      setSelectedDate(null);
      setCurrentPage(0);
    } else {
      setSelectedDate(day);
      setCurrentPage(0);
      if (!isSameMonth(day, currentMonthDate)) {
          setCurrentMonthDate(startOfMonth(day)); 
      }
    }
  };

  const renderDayCell = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const broadcastsOnDay = broadcastsByDate[dateKey] || [];
    const isCurrentDisplayMonth = isSameMonth(day, currentMonthDate);
    const isTodayDate = isToday(day);
    const isSelectedDate = selectedDate ? isSameDay(day, selectedDate) : false;
    const hasBroadcasts = broadcastsOnDay.length > 0 && isCurrentDisplayMonth;

    return (
      <TouchableOpacity
        key={dateKey}
        style={[
          styles.dayCellTouchable,
          isSelectedDate && styles.dayCellSelected,
        ]}
        onPress={() => handleDayPress(day)}
        activeOpacity={0.8}
      >
        <View 
          style={[
            styles.dayCell,
            {
              width: DAY_CELL_SIZE,
              height: DAY_CELL_SIZE,
            },
            !isCurrentDisplayMonth && styles.dayCellOtherMonth,
            isSelectedDate && styles.dayCellSelectedBg,
            isTodayDate && !isSelectedDate && styles.dayCellToday,
            hasBroadcasts && !isSelectedDate && styles.dayCellHasBroadcasts,
          ]}
        >
          {isTodayDate && !isSelectedDate && (
            <View style={styles.dayCellTodayOverlay} />
          )}
          
          <Text
            style={[
              styles.dayCellText,
              isSelectedDate && styles.dayCellTextSelected,
              isTodayDate && !isSelectedDate && styles.dayCellTextToday,
              !isCurrentDisplayMonth && styles.dayCellTextOtherMonth,
            ]}
          >
            {getDate(day)}
          </Text>
          
          {hasBroadcasts && (
            <View style={styles.dayCellDots}>
              {broadcastsOnDay.slice(0, 3).map((_, index) => (
                <View 
                  key={index}
                  style={[
                    styles.dayCellDot,
                    isSelectedDate && styles.dayCellDotSelected,
                  ]}
                />
              ))}
              {broadcastsOnDay.length > 3 && (
                <Text style={[
                  styles.dayCellDotCount,
                  isSelectedDate && styles.dayCellDotCountSelected,
                ]}>
                  +{broadcastsOnDay.length - 3}
                </Text>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const selectedDateBroadcasts = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return broadcastsByDate[dateKey] || [];
  }, [selectedDate, broadcastsByDate]);

  const paginatedBroadcasts = useMemo(() => {
    const startIndex = currentPage * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return selectedDateBroadcasts.slice(startIndex, endIndex);
  }, [selectedDateBroadcasts, currentPage]);

  const totalPages = Math.ceil(selectedDateBroadcasts.length / ITEMS_PER_PAGE);
  const canGoNext = currentPage < totalPages - 1;
  const canGoPrev = currentPage > 0;

  const handleNextPage = () => {
    if (canGoNext) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (canGoPrev) {
      setCurrentPage(prev => prev - 1);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ScheduleSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={64} color="#7F1D1D" />
          <Text style={styles.errorTitle}>Unable to Load Schedule</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => fetchUpcomingBroadcasts()}
          >
            <Text style={styles.errorButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

      {/* Screen Title */}
      <View style={styles.titleSection}>
        <Text style={styles.title}>Broadcast Schedule</Text>
        <Text style={styles.subtitle}>Discover upcoming shows and plan your listening</Text>
      </View>
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={['#91403E']}
            tintColor="#91403E"
            title="Pull to refresh schedule"
            titleColor="#91403E"
          />
        }
      >
        {/* Month Navigation */}
        <View style={styles.monthNavigation}>
          <TouchableOpacity 
            onPress={handlePrevMonth} 
            style={styles.monthNavButton}
          >
            <Ionicons name="chevron-back" size={22} color="#91403E" />
          </TouchableOpacity>
          
          <View style={styles.monthNavCenter}>
            <Text style={styles.monthNavTitle}>
              {format(currentMonthDate, 'MMMM yyyy')}
            </Text>
            {!(isToday(currentMonthDate) && isSameMonth(currentMonthDate, new Date())) && 
             !isSameMonth(currentMonthDate, new Date()) && (
                <TouchableOpacity 
                  onPress={handleGoToToday} 
                  style={styles.goToTodayButton}
                >
                  <Text style={styles.goToTodayText}>⏰ GO TO TODAY</Text>
                </TouchableOpacity>
            )}
          </View>
          
          <TouchableOpacity 
            onPress={handleNextMonth} 
            style={styles.monthNavButton}
          >
            <Ionicons name="chevron-forward" size={22} color="#91403E" />
          </TouchableOpacity>
        </View>

        {/* Calendar Grid Card*/}
        <View style={styles.calendarCard}>
          {/* Calendar Header */}
          <View style={styles.calendarHeader}>
            <View style={styles.weekdayRow}>
              {weekdays.map(day => (
                <View 
                  key={day} 
                  style={[
                    styles.weekdayCell,
                    { width: DAY_CELL_SIZE },
                  ]}
                >
                  <Text style={styles.weekdayText}>
                    {day.toUpperCase()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          
          {/* Day Cells Grid */}
          <View style={styles.calendarGrid}>
            <View style={styles.dayCellsContainer}>
              {daysForCalendarGrid.map(day => renderDayCell(day))}
            </View>
          </View>
        </View>

        {/* Upcoming Broadcasts for Selected Date */}
        {selectedDate && (
          <View style={styles.selectedDateSection}>
            <View style={styles.selectedDateHeader}>
              <View style={styles.selectedDateHeaderLeft}>
                <View style={styles.selectedDateIcon}>
                  <Ionicons name="calendar" size={20} color="white" />
                </View>
                <View>
                  <Text style={styles.selectedDateTitle}>
                    {format(selectedDate, 'EEEE, MMMM d')}
                  </Text>
                  <Text style={styles.selectedDateSubtitle}>
                    {selectedDateBroadcasts.length} show{selectedDateBroadcasts.length !== 1 ? 's' : ''} scheduled
                  </Text>
                </View>
              </View>
              {isToday(selectedDate) && (
                <View style={styles.todayBadge}>
                  <Text style={styles.todayBadgeText}>TODAY</Text>
                </View>
              )}
            </View>
            
            {selectedDateBroadcasts.length > 0 ? (
              <>
                {paginatedBroadcasts.map((broadcast) => (
                  <TouchableOpacity
                    key={broadcast.id}
                    style={styles.broadcastCard}
                    onPress={() => Alert.alert(
                      broadcast.title, 
                      `${broadcast.description || 'No description.'}\n\nTime: ${format(parseISO(broadcast.scheduledStart), 'p')} - ${format(parseISO(broadcast.scheduledEnd), 'p')}\nDJ: ${broadcast.dj?.name || 'TBA'}`
                    )}
                  >
                    {/* Card Header */}
                    <View style={[
                      styles.broadcastCardHeader,
                      isToday(parseISO(broadcast.scheduledStart)) && isSameDay(parseISO(broadcast.scheduledStart), selectedDate) 
                        ? styles.broadcastCardHeaderToday
                        : styles.broadcastCardHeaderNormal,
                    ]}>
                      <View style={styles.broadcastCardHeaderRow}>
                        <View style={styles.broadcastCardHeaderLeft}>
                          <Ionicons name="radio" size={18} color="white" />
                          <Text style={styles.broadcastCardTime}>
                            {format(parseISO(broadcast.scheduledStart), 'p')} - {format(parseISO(broadcast.scheduledEnd), 'p')}
                          </Text>
                        </View>
                        {isToday(parseISO(broadcast.scheduledStart)) && isSameDay(parseISO(broadcast.scheduledStart), selectedDate) && (
                          <View style={styles.broadcastTodayBadge}>
                            <Text style={styles.broadcastTodayBadgeText}>TODAY</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    
                    {/* Card Content */}
                    <View style={styles.broadcastCardContent}>
                      <View style={styles.broadcastCardContentRow}>
                        <View style={styles.broadcastCardIcon}>
                          <Ionicons name="musical-notes" size={20} color="#91403E" />
                        </View>
                        <View style={styles.broadcastCardTextContainer}>
                          <Text style={styles.broadcastCardTitle}>
                            {broadcast.title}
                          </Text>
                          <View style={styles.broadcastCardDJRow}>
                            <Ionicons name="person-outline" size={14} color="#B5830F" />
                            <Text style={styles.broadcastCardDJ}>
                              {broadcast.dj?.name || 'TBA'}
                            </Text>
                          </View>
                          {broadcast.description && (
                            <Text style={styles.broadcastCardDescription} numberOfLines={2}>
                              {broadcast.description}
                            </Text>
                          )}
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
                
                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <View style={styles.paginationContainer}>
                    <TouchableOpacity
                      onPress={handlePrevPage}
                      disabled={!canGoPrev}
                      style={[
                        styles.paginationButton,
                        canGoPrev ? styles.paginationButtonActive : styles.paginationButtonDisabled,
                      ]}
                    >
                      <Ionicons 
                        name="chevron-back" 
                        size={18} 
                        color={canGoPrev ? "white" : "#94a3b8"} 
                      />
                      <Text style={[
                        styles.paginationButtonText,
                        canGoPrev ? styles.paginationButtonTextActive : styles.paginationButtonTextDisabled,
                      ]}>
                        Previous
                      </Text>
                    </TouchableOpacity>
                    
                    <View style={styles.paginationInfo}>
                      <Text style={styles.paginationInfoText}>
                        Page {currentPage + 1} of {totalPages}
                      </Text>
                    </View>
                    
                    <TouchableOpacity
                      onPress={handleNextPage}
                      disabled={!canGoNext}
                      style={[
                        styles.paginationButton,
                        canGoNext ? styles.paginationButtonActive : styles.paginationButtonDisabled,
                      ]}
                    >
                      <Text style={[
                        styles.paginationButtonText,
                        canGoNext ? styles.paginationButtonTextActive : styles.paginationButtonTextDisabled,
                      ]}>
                        Next
                      </Text>
                      <Ionicons 
                        name="chevron-forward" 
                        size={18} 
                        color={canGoNext ? "white" : "#94a3b8"} 
                      />
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.noShowsCard}>
                <View style={styles.noShowsIcon}>
                  <Ionicons name="calendar-outline" size={32} color="#94a3b8" />
                </View>
                <Text style={styles.noShowsTitle}>No Shows Scheduled</Text>
                <Text style={styles.noShowsText}>
                  There are no shows scheduled for this day. Check out other dates!
                </Text>
              </View>
            )}
          </View>
        )}
        
        {!selectedDate && upcomingBroadcasts.length === 0 && !isLoading && (
          <>
            <View style={styles.upcomingHeader}>
              <View style={styles.upcomingHeaderLeft}>
                <View style={styles.upcomingHeaderIcon}>
                  <Ionicons name="radio" size={20} color="white" />
                </View>
                <View>
                  <Text style={styles.upcomingHeaderTitle}>
                    Upcoming Broadcasts
                  </Text>
                  <Text style={styles.upcomingHeaderSubtitle}>
                    Stay tuned for exciting shows
                  </Text>
                </View>
              </View>
            </View>
            
            <View style={styles.emptyStateCard}>
              <View style={styles.emptyStateIcon}>
                <Ionicons name="calendar-outline" size={48} color="#91403E" />
              </View>
              <Text style={styles.emptyStateTitle}>No Shows Scheduled</Text>
              <Text style={styles.emptyStateText}>
                There are no upcoming broadcasts at the moment. 
              </Text>
              <Text style={styles.emptyStateSubtext}>
                🎵 Check back soon for exciting new shows! 🎵
              </Text>
            </View>
          </>
        )}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 120,
    paddingTop: Platform.OS === 'android' ? 12 : 6,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  titleSection: {
    paddingTop: 24,
    paddingBottom: 16,
    marginBottom: 8,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e2e8f0',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
  },
  monthNavigation: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthNavButton: {
    backgroundColor: 'rgba(145, 64, 62, 0.1)',
    padding: 12,
    borderRadius: 999,
    shadowColor: '#91403E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  monthNavCenter: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 16,
  },
  monthNavTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#91403E',
    marginBottom: 4,
  },
  goToTodayButton: {
    backgroundColor: 'rgba(181, 131, 15, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  goToTodayText: {
    fontSize: 10,
    color: '#B5830F',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  calendarCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    marginBottom: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  calendarHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#91403E',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  weekdayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    height: DAY_CELL_SIZE / 2,
  },
  weekdayText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.95)',
    letterSpacing: 1,
  },
  calendarGrid: {
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  dayCellsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  dayCellTouchable: {
    width: DAY_CELL_SIZE,
    height: DAY_CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: {
    transform: [{ scale: 0.98 }],
    shadowColor: '#B5830F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  dayCell: {
    width: DAY_CELL_SIZE,
    height: DAY_CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    position: 'relative',
    overflow: 'hidden',
  },
  dayCellOtherMonth: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  dayCellSelectedBg: {
    backgroundColor: '#B5830F',
    borderColor: '#B5830F',
    shadowColor: '#B5830F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  dayCellToday: {
    borderColor: 'rgba(145, 64, 62, 0.4)',
  },
  dayCellHasBroadcasts: {
    backgroundColor: 'rgba(145, 64, 62, 0.05)',
  },
  dayCellTodayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(145, 64, 62, 0.1)',
    borderRadius: 8,
    opacity: 0.6,
  },
  dayCellText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  dayCellTextSelected: {
    color: '#000000',
    fontWeight: 'bold',
  },
  dayCellTextToday: {
    color: '#91403E',
    fontWeight: 'bold',
  },
  dayCellTextOtherMonth: {
    color: 'rgba(148, 163, 184, 0.4)',
  },
  dayCellDots: {
    position: 'absolute',
    bottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayCellDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#91403E',
    marginHorizontal: 2,
    shadowColor: '#91403E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  dayCellDotSelected: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  dayCellDotCount: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#91403E',
    marginLeft: 4,
  },
  dayCellDotCountSelected: {
    color: 'rgba(0, 0, 0, 0.7)',
  },
  selectedDateSection: {
    marginBottom: 24,
  },
  selectedDateHeader: {
    backgroundColor: 'rgba(145, 64, 62, 0.08)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(145, 64, 62, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedDateHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedDateIcon: {
    backgroundColor: '#91403E',
    padding: 8,
    borderRadius: 999,
    marginRight: 12,
  },
  selectedDateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#91403E',
  },
  selectedDateSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  todayBadge: {
    backgroundColor: 'rgba(181, 131, 15, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  todayBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#B5830F',
  },
  broadcastCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  broadcastCardHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  broadcastCardHeaderNormal: {
    backgroundColor: '#91403E',
  },
  broadcastCardHeaderToday: {
    backgroundColor: '#B5830F',
  },
  broadcastCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  broadcastCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  broadcastCardTime: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 8,
  },
  broadcastTodayBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  broadcastTodayBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  broadcastCardContent: {
    padding: 16,
  },
  broadcastCardContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  broadcastCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  broadcastCardTextContainer: {
    flex: 1,
  },
  broadcastCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e2e8f0',
    marginBottom: 4,
    lineHeight: 24,
  },
  broadcastCardDJRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  broadcastCardDJ: {
    fontSize: 14,
    color: '#B5830F',
    fontWeight: '600',
    marginLeft: 4,
  },
  broadcastCardDescription: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
    lineHeight: 20,
  },
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 8,
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  paginationButtonActive: {
    backgroundColor: '#91403E',
    shadowColor: '#91403E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  paginationButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  paginationButtonText: {
    marginLeft: 4,
    fontWeight: '600',
  },
  paginationButtonTextActive: {
    color: 'white',
  },
  paginationButtonTextDisabled: {
    color: '#94a3b8',
  },
  paginationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  paginationInfoText: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  noShowsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  noShowsIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    borderRadius: 999,
    marginBottom: 16,
  },
  noShowsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 8,
  },
  noShowsText: {
    color: '#94a3b8',
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
  },
  upcomingHeader: {
    backgroundColor: 'rgba(145, 64, 62, 0.05)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(145, 64, 62, 0.1)',
  },
  upcomingHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upcomingHeaderIcon: {
    backgroundColor: '#91403E',
    padding: 8,
    borderRadius: 999,
    marginRight: 12,
  },
  upcomingHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#91403E',
  },
  upcomingHeaderSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  emptyStateCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  emptyStateIcon: {
    backgroundColor: 'rgba(145, 64, 62, 0.1)',
    padding: 24,
    borderRadius: 999,
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#91403E',
    marginBottom: 12,
  },
  emptyStateText: {
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 32,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 16,
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
});

export default ScheduleScreen;
