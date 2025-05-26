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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
const PADDING_CALENDAR_CARD = 12;    // Corresponds to p-3 on the calendar card View
const GAP_BETWEEN_CELLS = 4;         // Corresponds to gap-1 in Tailwind (0.25rem = 4px)
const NUM_DAYS_IN_WEEK = 7;

const calculateDayCellSize = () => {
  const availableWidthForGrid = SCREEN_WIDTH - (HORIZONTAL_PADDING_SCREEN * 2) - (PADDING_CALENDAR_CARD * 2);
  const totalGapSpace = GAP_BETWEEN_CELLS * (NUM_DAYS_IN_WEEK - 1);
  return Math.floor((availableWidthForGrid - totalGapSpace) / NUM_DAYS_IN_WEEK);
};

const DAY_CELL_SIZE = calculateDayCellSize();

const ScheduleScreen: React.FC = () => {
  const { authToken } = useAuth();
  const [upcomingBroadcasts, setUpcomingBroadcasts] = useState<Broadcast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const fetchUpcomingBroadcasts = useCallback(async () => {
    if (!authToken) {
      setError('Authentication required.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const result = await getUpcomingBroadcasts(authToken);
    if ('error' in result) {
      setError(result.error);
    } else {
      setUpcomingBroadcasts(result);
    }
    setIsLoading(false);
  }, [authToken]);

  useEffect(() => {
    fetchUpcomingBroadcasts();
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
    } else {
      // Otherwise, select the new day
      setSelectedDate(day);
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

    return (
      <TouchableOpacity
        key={dateKey}
        style={styles.dayCellTouchable}
        onPress={() => handleDayPress(day)}
        activeOpacity={0.7}
      >
        <View 
          className={`
            w-full h-full items-center justify-center rounded-lg
            ${isCurrentDisplayMonth ? 'bg-white' : 'bg-gray-100'} 
            ${isSelectedDate ? 'bg-mikado_yellow' : isTodayDate ? 'bg-cordovan/10' : ''}
            border border-transparent
            ${isSelectedDate ? 'border-mikado_yellow-500' : isTodayDate ? 'border-cordovan/30' : ''}
          `}
        >
          <Text
            className={`
              text-sm font-medium
              ${isSelectedDate ? 'text-black' : isTodayDate ? 'text-cordovan font-bold' : isCurrentDisplayMonth ? 'text-gray-700' : 'text-gray-400'}
            `}
          >
            {getDate(day)}
          </Text>
          {broadcastsOnDay.length > 0 && isCurrentDisplayMonth && (
            <View 
              className={`
                w-1.5 h-1.5 rounded-full mt-0.5
                ${isSelectedDate ? 'bg-black/60' : 'bg-cordovan'}
              `}
            />
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

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-anti-flash_white">
        <ActivityIndicator size="large" color="#91403E" />
        <Text className="mt-4 text-gray-600 text-lg">Loading Schedule...</Text>
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
          onPress={fetchUpcomingBroadcasts}
        >
          <Text className="text-white font-semibold text-base">Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <SafeAreaView className="flex-1 bg-anti-flash_white">
      <ScrollView 
        contentContainerStyle={{ paddingBottom: 120, paddingTop: Platform.OS === 'android' ? 12 : 6 }} 
        showsVerticalScrollIndicator={false}
        className="px-5"
      >
        {/* Screen Title */}
        <View className="pt-4 pb-3 mb-1 flex-row items-center">
          <Text className="text-3xl font-bold text-gray-800">Broadcast Schedule</Text>
        </View>

        {/* Month Navigation */}
        <View className="flex-row justify-between items-center py-3 mb-2">
          <TouchableOpacity onPress={handlePrevMonth} className="p-2 rounded-full active:bg-gray-200">
            <Ionicons name="chevron-back-outline" size={26} color="#91403E" />
          </TouchableOpacity>
          <View className="items-center">
            <Text className="text-lg font-bold text-cordovan">
              {format(currentMonthDate, 'MMMM yyyy')}
            </Text>
            {!(isToday(currentMonthDate) && isSameMonth(currentMonthDate, new Date())) && 
             !isSameMonth(currentMonthDate, new Date()) && (
                 <TouchableOpacity onPress={handleGoToToday} className="mt-0.5">
                    <Text className="text-xs text-mikado_yellow font-semibold active:opacity-70">GO TO TODAY</Text>
                </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={handleNextMonth} className="p-2 rounded-full active:bg-gray-200">
            <Ionicons name="chevron-forward-outline" size={26} color="#91403E" />
          </TouchableOpacity>
        </View>

        {/* Calendar Grid Card*/}
        <View className="bg-white p-3 rounded-xl shadow-lg mb-6">
          {/* Weekday Headers */}
          <View className="flex-row mb-1">
            {weekdays.map(day => (
              <View key={day} style={[styles.weekdayCell, {width: DAY_CELL_SIZE}]}>
                <Text className="text-xs font-medium text-cordovan/90">
                  {day}
                </Text>
              </View>
            ))}
          </View>
          {/* Day Cells Grid */}
          <View className="flex-row flex-wrap gap-1 justify-start">
            {daysForCalendarGrid.map(day => renderDayCell(day))}
          </View>
        </View>

        {/* Upcoming Broadcasts for Selected Date */}
        {selectedDate && (
          <View className="mb-6">
            <View className="flex-row items-center mb-3">
              <Ionicons name="easel-outline" size={22} color="#91403E" className="mr-2"/>
              <Text className="text-lg font-bold text-cordovan">
                Shows on {format(selectedDate, 'MMMM d')}
              </Text>
            </View>
            {selectedDateBroadcasts.length > 0 ? (
              selectedDateBroadcasts.map(broadcast => (
                <TouchableOpacity
                  key={broadcast.id}
                  className="bg-white p-4 rounded-lg shadow-md mb-3 flex-row items-center active:bg-gray-50"
                  onPress={() => Alert.alert(broadcast.title, `${broadcast.description || 'No description.'}\n\nTime: ${format(parseISO(broadcast.scheduledStart), 'p')} - ${format(parseISO(broadcast.scheduledEnd), 'p')}\nDJ: ${broadcast.dj?.name || 'TBA'}`)}
                >
                  <View className={`w-11 h-11 rounded-lg items-center justify-center mr-3 ${isToday(parseISO(broadcast.scheduledStart)) && isSameDay(parseISO(broadcast.scheduledStart), selectedDate) ? 'bg-mikado_yellow' : 'bg-cordovan' }`}>
                    <Ionicons name="calendar-outline" size={20} color="white" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-800 leading-snug">{broadcast.title}</Text>
                    <Text className="text-sm text-gray-600 mt-0.5">
                      {format(parseISO(broadcast.scheduledStart), 'p')} - {format(parseISO(broadcast.scheduledEnd), 'p')}
                    </Text>
                    {broadcast.dj?.name && <Text className="text-xs text-mikado_yellow/90 font-medium mt-0.5">DJ: {broadcast.dj.name}</Text>}
                  </View>
                  <Ionicons name="chevron-forward-outline" size={22} color="#A0A0A0" />
                </TouchableOpacity>
              ))
            ) : (
              <View className="bg-white p-6 rounded-lg shadow-md items-center">
                <Ionicons name="information-circle-outline" size={32} color="#6B7280" className="mb-2" />
                <Text className="text-gray-600 text-center text-base">No upcoming shows scheduled for this day.</Text>
              </View>
            )}
          </View>
        )}
        
         {!selectedDate && upcomingBroadcasts.length === 0 && !isLoading && (
          <>
            <View className="flex-row items-center mb-3 mt-2">
              <Ionicons name="easel-outline" size={22} color="#91403E" className="mr-2"/>
              <Text className="text-lg font-bold text-cordovan">
                Upcoming Broadcasts
              </Text>
            </View>
            <View className="items-center justify-center py-10 bg-white rounded-lg shadow-md">
              <Ionicons name="calendar-outline" size={48} color="#91403E" />
              <Text className="text-xl font-semibold text-cordovan mt-4">No Upcoming Broadcasts</Text>
              <Text className="text-gray-600 mt-2 text-center px-4">There are no shows scheduled at the moment. Please check back later!</Text>
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
    // No margin here, gap on parent will handle it
  },
  weekdayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    height: DAY_CELL_SIZE / 2, // Make weekday header cells shorter
  }
});

export default ScheduleScreen; 