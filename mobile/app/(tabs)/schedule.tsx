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
  Animated,
  Easing,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
import { getUpcomingBroadcasts, Broadcast } from '../../services/apiService';
import '../../global.css'; // Tailwind CSS

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Constants for calendar layout
const HORIZONTAL_PADDING_SCREEN = 20; // Corresponds to px-5 on the ScrollView
const PADDING_CALENDAR_CARD = 16;    // Adjusted for p-4 on the calendar grid container
const GAP_BETWEEN_CELLS = 8;         // Increased from 4 to 8 (corresponds to gap-2)
const NUM_DAYS_IN_WEEK = 7;

const calculateDayCellSize = () => {
  const availableWidthForGrid = SCREEN_WIDTH - (HORIZONTAL_PADDING_SCREEN * 2) - (PADDING_CALENDAR_CARD * 2);
  const totalGapSpace = GAP_BETWEEN_CELLS * (NUM_DAYS_IN_WEEK - 1);
  return Math.floor((availableWidthForGrid - totalGapSpace) / NUM_DAYS_IN_WEEK);
};

const DAY_CELL_SIZE = calculateDayCellSize();

const ScheduleScreen: React.FC = () => {
  const { authToken } = useAuth();
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
    if (!authToken) {
      setError('Authentication required.');
      setIsLoading(false);
      return;
    }
    
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    
    try {
      const result = await getUpcomingBroadcasts(authToken);
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
  }, [authToken]);

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
    // Ensure we get the day of the week correctly for start and end
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
      // If the same day is pressed again, deselect it
      setSelectedDate(null);
      setCurrentPage(0);
    } else {
      // Otherwise, select the new day
      setSelectedDate(day);
      setCurrentPage(0); // Reset to first page when selecting new date
      // If user clicks on a day from a different month (visible trailing/leading days)
      // then also navigate the calendar to that month.
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
          isSelectedDate && {
            transform: [{ scale: 0.98 }],
            shadowColor: '#B5830F',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
          }
        ]}
        onPress={() => handleDayPress(day)}
        activeOpacity={0.8}
      >
        <View 
          className={`
            w-full h-full items-center justify-center rounded-lg relative overflow-hidden
            ${isCurrentDisplayMonth ? 'bg-white' : 'bg-gray-100/50'} 
            ${isSelectedDate ? 'bg-mikado_yellow' : isTodayDate ? 'bg-cordovan/15' : ''}
            border border-transparent
            ${isSelectedDate ? 'border-mikado_yellow' : isTodayDate ? 'border-cordovan/40' : hasBroadcasts ? 'border-cordovan/20' : ''}
          `}
          style={[
            {
              width: DAY_CELL_SIZE,
              height: DAY_CELL_SIZE,
            },
            isSelectedDate && {
              shadowColor: '#B5830F',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: 4,
            },
            hasBroadcasts && !isSelectedDate && {
              backgroundColor: '#91403E05',
            }
          ]}
        >
          {/* Pulse effect for today */}
          {isTodayDate && !isSelectedDate && (
            <View 
              className="absolute inset-0 bg-cordovan/10 rounded-lg"
              style={{
                opacity: 0.6,
              }}
            />
          )}
          
          <Text
            className={`
              text-base font-semibold
              ${isSelectedDate ? 'text-black' : isTodayDate ? 'text-cordovan font-bold' : isCurrentDisplayMonth ? 'text-gray-700' : 'text-gray-400'}
            `}
          >
            {getDate(day)}
          </Text>
          
          {hasBroadcasts && (
            <View className="flex-row absolute bottom-1">
              {broadcastsOnDay.slice(0, 3).map((_, index) => (
                <View 
                  key={index}
                  className={`
                    w-1.5 h-1.5 rounded-full mx-0.5
                    ${isSelectedDate ? 'bg-black/70' : 'bg-cordovan'}
                  `}
                  style={{
                    shadowColor: isSelectedDate ? '#000' : '#91403E',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.3,
                    shadowRadius: 2,
                    elevation: 2,
                  }}
                />
              ))}
              {broadcastsOnDay.length > 3 && (
                <Text className={`text-[8px] ml-1 font-bold ${isSelectedDate ? 'text-black/70' : 'text-cordovan'}`}>
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

  // Pagination for selected date broadcasts
  const paginatedBroadcasts = useMemo(() => {
    const startIndex = currentPage * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return selectedDateBroadcasts.slice(startIndex, endIndex);
  }, [selectedDateBroadcasts, currentPage, ITEMS_PER_PAGE]);

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
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
        <ScrollView
          style={{ backgroundColor: '#F5F5F5' }}
          contentContainerStyle={{ 
            paddingBottom: 100,
            paddingTop: 20,
            paddingHorizontal: 20,
            backgroundColor: '#F5F5F5'
          }}
          showsVerticalScrollIndicator={false}
        >
          <ScheduleSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-anti-flash_white p-6 text-center">
        <Ionicons name="cloud-offline-outline" size={64} color="#7F1D1D" />
        <Text className="text-2xl font-semibold text-gray-800 mt-6 mb-2">Unable to Load Schedule</Text>
        <Text className="text-gray-600 mb-8 text-base leading-relaxed">{error}</Text>
        <TouchableOpacity
          className="bg-cordovan py-3 px-8 rounded-lg shadow-md active:opacity-80"
          onPress={() => fetchUpcomingBroadcasts()}
        >
          <Text className="text-white font-semibold text-base">Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      {/* Screen Title */}
      <View className="pt-2 pb-4 mb-2 px-5 bg-gray-100">
        <View>
          <Text className="text-3xl font-bold text-gray-800 mb-1">Broadcast Schedule</Text>
          <Text className="text-base text-gray-600">Discover upcoming shows and plan your listening</Text>
        </View>
      </View>
      
      <ScrollView 
        contentContainerStyle={{ paddingBottom: 120, paddingTop: Platform.OS === 'android' ? 12 : 6 }} 
        showsVerticalScrollIndicator={false}
        className="px-5"
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
        <View className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 mb-4 shadow-lg border border-white/20">
          <View className="flex-row justify-between items-center">
            <TouchableOpacity 
              onPress={handlePrevMonth} 
              className="bg-cordovan/10 p-3 rounded-full active:bg-cordovan/20 shadow-sm"
              style={{
                shadowColor: '#91403E',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <Ionicons name="chevron-back" size={22} color="#91403E" />
            </TouchableOpacity>
            
            <View className="items-center flex-1 mx-4">
              <Text className="text-2xl font-bold text-cordovan mb-1">
                {format(currentMonthDate, 'MMMM yyyy')}
              </Text>
              {!(isToday(currentMonthDate) && isSameMonth(currentMonthDate, new Date())) && 
               !isSameMonth(currentMonthDate, new Date()) && (
                   <TouchableOpacity 
                     onPress={handleGoToToday} 
                     className="bg-mikado_yellow/20 px-3 py-1 rounded-full active:bg-mikado_yellow/30"
                   >
                      <Text className="text-xs text-mikado_yellow font-bold tracking-wider">⏰ GO TO TODAY</Text>
                  </TouchableOpacity>
              )}
            </View>
            
            <TouchableOpacity 
              onPress={handleNextMonth} 
              className="bg-cordovan/10 p-3 rounded-full active:bg-cordovan/20 shadow-sm"
              style={{
                shadowColor: '#91403E',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <Ionicons name="chevron-forward" size={22} color="#91403E" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Calendar Grid Card*/}
        <View 
          className="bg-white rounded-3xl shadow-2xl mb-6 overflow-hidden border border-gray-100"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 12,
          }}
        >
          {/* Calendar Header with Gradient */}
          <View 
            className="px-4 py-3"
            style={{
              backgroundColor: '#91403E',
            }}
          >
            <View className="flex-row justify-center gap-2 mb-2">
              {weekdays.map(day => (
                <View 
                  key={day} 
                  style={[
                    styles.weekdayCell, 
                    {
                      width: DAY_CELL_SIZE,
                    }
                  ]}
                >
                  <Text className="text-xs font-bold text-white/95 tracking-wider">
                    {day.toUpperCase()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          
          {/* Day Cells Grid */}
          <View className="p-4 bg-gray-50/30">
            <View className="flex-row flex-wrap gap-2 justify-center">
              {daysForCalendarGrid.map(day => renderDayCell(day))}
            </View>
          </View>
        </View>

        {/* Upcoming Broadcasts for Selected Date */}
        {selectedDate && (
          <View className="mb-6">
            <View 
              className="bg-gradient-to-r from-cordovan/10 to-mikado_yellow/10 p-4 rounded-2xl mb-4"
              style={{
                backgroundColor: '#91403E08',
                borderWidth: 1,
                borderColor: '#91403E20',
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="bg-cordovan p-2 rounded-full mr-3">
                    <Ionicons name="calendar" size={20} color="white" />
                  </View>
                  <View>
                    <Text className="text-xl font-bold text-cordovan">
                      {format(selectedDate, 'EEEE, MMMM d')}
                    </Text>
                    <Text className="text-sm text-gray-600">
                      {selectedDateBroadcasts.length} show{selectedDateBroadcasts.length !== 1 ? 's' : ''} scheduled
                    </Text>
                  </View>
                </View>
                {isToday(selectedDate) && (
                  <View className="bg-mikado_yellow/20 px-3 py-1 rounded-full">
                    <Text className="text-xs font-bold text-mikado_yellow">TODAY</Text>
                  </View>
                )}
              </View>
            </View>
            
            {selectedDateBroadcasts.length > 0 ? (
              <>
                {paginatedBroadcasts.map((broadcast, index) => (
                  <TouchableOpacity
                    key={broadcast.id}
                    className="bg-white rounded-2xl shadow-lg mb-4 overflow-hidden active:scale-[0.98]"
                    style={{
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.1,
                      shadowRadius: 12,
                      elevation: 6,
                    }}
                    onPress={() => Alert.alert(broadcast.title, `${broadcast.description || 'No description.'}\n\nTime: ${format(parseISO(broadcast.scheduledStart), 'p')} - ${format(parseISO(broadcast.scheduledEnd), 'p')}\nDJ: ${broadcast.dj?.name || 'TBA'}`)}
                  >
                    {/* Card Header */}
                    <View 
                      className="px-4 py-3"
                      style={{
                        backgroundColor: isToday(parseISO(broadcast.scheduledStart)) && isSameDay(parseISO(broadcast.scheduledStart), selectedDate) 
                          ? '#B5830F' 
                          : '#91403E',
                      }}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center">
                          <Ionicons name="radio" size={18} color="white" />
                          <Text className="text-white font-bold ml-2 text-sm">
                            {format(parseISO(broadcast.scheduledStart), 'p')} - {format(parseISO(broadcast.scheduledEnd), 'p')}
                          </Text>
                        </View>
                        {isToday(parseISO(broadcast.scheduledStart)) && isSameDay(parseISO(broadcast.scheduledStart), selectedDate) && (
                          <View className="bg-white/20 px-2 py-1 rounded-full">
                            <Text className="text-white text-xs font-bold">TODAY</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    
                    {/* Card Content */}
                    <View className="p-4">
                      <View className="flex-row items-start">
                        <View className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center mr-4">
                          <Ionicons name="musical-notes" size={20} color="#91403E" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-lg font-bold text-gray-800 leading-tight mb-1">
                            {broadcast.title}
                          </Text>
                          <View className="flex-row items-center">
                            <Ionicons name="person-outline" size={14} color="#B5830F" />
                            <Text className="text-sm text-mikado_yellow font-semibold ml-1">
                              {broadcast.dj?.name || 'TBA'}
                            </Text>
                          </View>
                          {broadcast.description && (
                            <Text className="text-sm text-gray-600 mt-2 leading-relaxed" numberOfLines={2}>
                              {broadcast.description}
                            </Text>
                          )}
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
                
                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <View className="flex-row items-center justify-between mt-4 px-2">
                    <TouchableOpacity
                      onPress={handlePrevPage}
                      disabled={!canGoPrev}
                      className={`flex-row items-center px-4 py-3 rounded-xl ${canGoPrev ? 'bg-cordovan active:bg-cordovan/90' : 'bg-gray-200'}`}
                      style={{
                        shadowColor: canGoPrev ? '#91403E' : '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: canGoPrev ? 0.2 : 0.05,
                        shadowRadius: 4,
                        elevation: canGoPrev ? 4 : 1,
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
                      onPress={handleNextPage}
                      disabled={!canGoNext}
                      className={`flex-row items-center px-4 py-3 rounded-xl ${canGoNext ? 'bg-cordovan active:bg-cordovan/90' : 'bg-gray-200'}`}
                      style={{
                        shadowColor: canGoNext ? '#91403E' : '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: canGoNext ? 0.2 : 0.05,
                        shadowRadius: 4,
                        elevation: canGoNext ? 4 : 1,
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
                                 )}
               </>
            ) : (
              <View 
                className="bg-white rounded-2xl shadow-lg p-8 items-center"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.08,
                  shadowRadius: 12,
                  elevation: 4,
                }}
              >
                <View className="bg-gray-100 p-4 rounded-full mb-4">
                  <Ionicons name="calendar-outline" size={32} color="#6B7280" />
                </View>
                <Text className="text-lg font-semibold text-gray-700 mb-2">No Shows Scheduled</Text>
                <Text className="text-gray-500 text-center text-base leading-relaxed">
                  There are no shows scheduled for this day. Check out other dates!
                </Text>
              </View>
            )}
          </View>
        )}
        
         {!selectedDate && upcomingBroadcasts.length === 0 && !isLoading && (
          <>
            <View className="bg-gradient-to-r from-cordovan/5 to-mikado_yellow/5 p-4 rounded-2xl mb-4 border border-cordovan/10">
              <View className="flex-row items-center">
                <View className="bg-cordovan p-2 rounded-full mr-3">
                  <Ionicons name="radio" size={20} color="white" />
                </View>
                <View>
                  <Text className="text-xl font-bold text-cordovan">
                    Upcoming Broadcasts
                  </Text>
                  <Text className="text-sm text-gray-600">
                    Stay tuned for exciting shows
                  </Text>
                </View>
              </View>
            </View>
            
            <View 
              className="items-center justify-center py-16 bg-white rounded-3xl shadow-xl overflow-hidden relative"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.12,
                shadowRadius: 20,
                elevation: 10,
              }}
            >
              {/* Background Pattern */}
              <View className="absolute inset-0 opacity-5">
                <View className="absolute top-8 left-8 w-16 h-16 bg-cordovan rounded-full" />
                <View className="absolute bottom-12 right-12 w-12 h-12 bg-mikado_yellow rounded-full" />
                <View className="absolute top-20 right-20 w-8 h-8 bg-cordovan rounded-full" />
              </View>
              
              <View className="bg-cordovan/10 p-6 rounded-full mb-6">
                <Ionicons name="calendar-outline" size={48} color="#91403E" />
              </View>
              <Text className="text-2xl font-bold text-cordovan mb-3">No Shows Scheduled</Text>
              <Text className="text-gray-600 text-center px-8 text-base leading-relaxed mb-6">
                There are no upcoming broadcasts at the moment. 
              </Text>
              <Text className="text-sm text-gray-500 text-center px-4">
                🎵 Check back soon for exciting new shows! 🎵
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// StyleSheet for styles that are hard to do with dynamic Tailwind or for better organization
const styles = StyleSheet.create({
  dayCellTouchable: {
    width: DAY_CELL_SIZE,
    height: DAY_CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    // No margin here, gap on parent will handle it
  },
  weekdayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    height: DAY_CELL_SIZE / 2, // Make weekday header cells shorter
  }
});

export default ScheduleScreen; 