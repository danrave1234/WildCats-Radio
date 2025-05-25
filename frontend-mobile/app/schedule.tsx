import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  SafeAreaView, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  FlatList,
  Alert,
  Dimensions
} from 'react-native';
import { ColorPalette } from '@/constants/ColorPalette';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { format, isToday, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isThisMonth } from 'date-fns';
import { useBroadcasts } from '@/services/api/hooks/useBroadcasts';
import { useAuth } from '@/app/_layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_CELL_SIZE = (SCREEN_WIDTH - 60) / 7;

type BroadcastItem = {
  id: number;
  title: string;
  description: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  dj?: { name: string; id: number };
};

type ViewMode = 'calendar' | 'list';

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const { isLoggedIn } = useAuth();
  const { useAllBroadcasts } = useBroadcasts();
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { data: broadcasts, isLoading, error } = useAllBroadcasts();

  // Calculate bottom padding to avoid tab bar overlap
  const bottomPadding = insets.bottom + 80;
  
  // Filter broadcasts by month for calendar view
  const broadcastsByDate = React.useMemo(() => {
    if (!broadcasts) return {};
    
    const result: { [key: string]: BroadcastItem[] } = {};
    broadcasts?.forEach(broadcast => {
      const date = broadcast.scheduledStart.split('T')[0];
      if (!result[date]) {
        result[date] = [];
      }
      result[date].push(broadcast);
    });
    
    return result;
  }, [broadcasts]);

  // Generate days for calendar view
  const daysInMonth = React.useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    
    // Get all days in the current month
    const days = eachDayOfInterval({ start, end });
    
    // Add days before to complete the week (if month doesn't start on Sunday)
    const dayOfWeek = start.getDay();
    let daysBefore = [];
    if (dayOfWeek > 0) {
      const prevMonth = subMonths(start, 1);
      const prevMonthEnd = endOfMonth(prevMonth);
      const daysToAdd = dayOfWeek;
      for (let i = daysToAdd - 1; i >= 0; i--) {
        const day = new Date(prevMonthEnd);
        day.setDate(prevMonthEnd.getDate() - i);
        daysBefore.push(day);
      }
    }
    
    // Add days after to complete the week (if month doesn't end on Saturday)
    const lastDayOfWeek = end.getDay();
    let daysAfter = [];
    if (lastDayOfWeek < 6) {
      const daysToAdd = 6 - lastDayOfWeek;
      for (let i = 1; i <= daysToAdd; i++) {
        const day = new Date(end);
        day.setDate(end.getDate() + i);
        daysAfter.push(day);
      }
    }
    
    return [...daysBefore, ...days, ...daysAfter];
  }, [currentMonth]);

  // Calendar navigation
  const goToPreviousMonth = () => {
    setCurrentMonth(prevMonth => subMonths(prevMonth, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prevMonth => addMonths(prevMonth, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  // Show broadcast details
  const showBroadcastDetails = (broadcast: BroadcastItem) => {
    const startTime = new Date(broadcast.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTime = new Date(broadcast.scheduledEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = new Date(broadcast.scheduledStart).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    
    Alert.alert(
      broadcast.title,
      `${broadcast.description}\n\nTime: ${startTime} - ${endTime}\nDate: ${date}\nDJ: ${broadcast.dj?.name || 'TBA'}\nStatus: ${broadcast.status}`,
      [{ text: 'Close', style: 'cancel' }]
    );
  };

  // Render calendar day cell
  const renderCalendarDay = (day: Date, index: number) => {
    const dateString = format(day, 'yyyy-MM-dd');
    const dayBroadcasts = broadcastsByDate[dateString] || [];
    const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
    const isTodayDate = isToday(day);
    
    return (
      <View 
        key={index} 
        style={[
          styles.calendarDay,
          !isCurrentMonth && styles.calendarDayOtherMonth,
          isTodayDate && styles.calendarDayToday
        ]}
      >
        <View style={styles.calendarDayHeader}>
          <Text style={[
            styles.calendarDayText,
            !isCurrentMonth && styles.calendarDayTextOtherMonth,
            isTodayDate && styles.calendarDayTextToday
          ]}>
            {day.getDate()}
          </Text>
          
          {dayBroadcasts.length > 0 && (
            <View style={styles.calendarDayDot} />
          )}
        </View>
      </View>
    );
  };

  // Render a broadcast item in list view
  const renderBroadcastItem = ({ item }: { item: BroadcastItem }) => {
    const startTime = new Date(item.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTime = new Date(item.scheduledEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = new Date(item.scheduledStart).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    
    const isLive = item.status === 'LIVE';
    
    return (
      <TouchableOpacity 
        style={[
          styles.broadcastItem,
          isLive && styles.broadcastItemLive
        ]}
        onPress={() => showBroadcastDetails(item)}
      >
        {isLive && (
          <View style={styles.liveIndicatorContainer}>
            <View style={styles.liveIndicator} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
        
        <View style={styles.broadcastContent}>
          <View style={styles.broadcastTimeBar}>
            <Text style={styles.broadcastTimeText}>{startTime}</Text>
            <View style={styles.broadcastTimeLine} />
            <Text style={styles.broadcastTimeText}>{endTime}</Text>
          </View>
          
          <View style={styles.broadcastInfo}>
            <Text style={styles.broadcastTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.broadcastDate}>{date}</Text>
            <Text style={styles.broadcastDescription} numberOfLines={2}>{item.description}</Text>
            
            <View style={styles.broadcastFooter}>
              <View style={styles.broadcastDjContainer}>
                <Ionicons name="person-outline" size={16} color={ColorPalette.cordovan[400]} />
                <Text style={styles.broadcastDj}>{item.dj?.name || 'TBA'}</Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Empty states with improved visuals
  const renderEmptyCalendarState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="mic-outline" size={60} color={ColorPalette.white.DEFAULT} />
      </View>
      <Text style={styles.emptyText}>No broadcasts scheduled</Text>
      <Text style={styles.emptySubtext}>
        There are currently no broadcasts scheduled for this month. Check back
        later or contact a DJ or admin to schedule a broadcast.
      </Text>
    </View>
  );

  const renderEmptyListState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="calendar-outline" size={60} color={ColorPalette.white.DEFAULT} />
      </View>
      <Text style={styles.emptyText}>No broadcasts scheduled</Text>
      <Text style={styles.emptySubtext}>
        There are currently no broadcasts scheduled. Check back
        later or contact a DJ or admin to schedule a broadcast.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Broadcast Schedule</Text>
        
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewToggleButton, viewMode === 'calendar' && styles.viewToggleButtonActive]}
            onPress={() => setViewMode('calendar')}
          >
            <Ionicons 
              name="calendar-outline" 
              size={18} 
              color={viewMode === 'calendar' ? ColorPalette.white.DEFAULT : ColorPalette.cordovan[400]} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.viewToggleButton, viewMode === 'list' && styles.viewToggleButtonActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons 
              name="list-outline" 
              size={18} 
              color={viewMode === 'list' ? ColorPalette.white.DEFAULT : ColorPalette.cordovan[400]} 
            />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomPadding }
        ]}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={ColorPalette.cordovan[400]} />
            <Text style={styles.loadingText}>Loading schedule...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={ColorPalette.cordovan[500]} />
            <Text style={styles.errorText}>Failed to load broadcasts</Text>
            <Text style={styles.errorSubtext}>Please try again later</Text>
          </View>
        ) : (
          <>
            {viewMode === 'calendar' ? (
              <View style={styles.calendarContainer}>
                {/* Month information displayed at the top of the calendar content */}
                <View style={styles.monthDisplay}>
                  <TouchableOpacity 
                    style={styles.monthArrow}
                    onPress={goToPreviousMonth}
                  >
                    <Ionicons name="chevron-back" size={22} color={ColorPalette.cordovan[400]} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.monthTitleContainer}
                    onPress={goToToday}
                  >
                    <Text style={styles.monthTitle}>
                      {format(currentMonth, 'MMMM yyyy')}
                    </Text>
                    {!isThisMonth(currentMonth) && (
                      <TouchableOpacity 
                        style={styles.todayButton} 
                        onPress={goToToday}
                      >
                        <Text style={styles.todayButtonText}>Today</Text>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.monthArrow}
                    onPress={goToNextMonth}
                  >
                    <Ionicons name="chevron-forward" size={22} color={ColorPalette.cordovan[400]} />
                  </TouchableOpacity>
                </View>
                
                {/* Calendar View */}
                <View style={styles.calendarPanel}>
                  {/* Week day headers */}
                  <View style={styles.weekdayHeader}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                      <Text key={index} style={styles.weekdayHeaderText}>{day}</Text>
                    ))}
                  </View>
                  
                  {/* Calendar grid */}
                  <View style={styles.calendarGrid}>
                    {daysInMonth.map((day, index) => renderCalendarDay(day, index))}
                  </View>
                </View>
                
                {/* Broadcasts for the month */}
                {Object.keys(broadcastsByDate).length > 0 ? (
                  <View style={styles.broadcastsContainer}>
                    <Text style={styles.broadcastsTitle}>
                      Upcoming Broadcasts
                    </Text>
                    
                    <FlatList
                      data={broadcasts?.filter(b => {
                        // Show broadcasts for the selected month
                        const broadcastDate = new Date(b.scheduledStart);
                        return broadcastDate.getMonth() === currentMonth.getMonth() &&
                              broadcastDate.getFullYear() === currentMonth.getFullYear();
                      })}
                      keyExtractor={item => item.id.toString()}
                      renderItem={renderBroadcastItem}
                      contentContainerStyle={styles.broadcastsList}
                      scrollEnabled={false}
                    />
                  </View>
                ) : (
                  renderEmptyCalendarState()
                )}
              </View>
            ) : (
              <View style={styles.listContainer}>
                <FlatList
                  data={broadcasts || []}
                  keyExtractor={item => item.id.toString()}
                  renderItem={renderBroadcastItem}
                  contentContainerStyle={styles.broadcastsList}
                  scrollEnabled={false}
                  ListEmptyComponent={renderEmptyListState}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ColorPalette.antiFlashWhite[700],
  },
  scrollContent: {
    padding: 20,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: ColorPalette.white.DEFAULT,
    borderBottomWidth: 1,
    borderBottomColor: ColorPalette.antiFlashWhite[400],
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: ColorPalette.cordovan.DEFAULT,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: ColorPalette.antiFlashWhite[500],
    borderRadius: 12,
    padding: 2,
  },
  viewToggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggleButtonActive: {
    backgroundColor: ColorPalette.cordovan[500],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: ColorPalette.black[700],
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: 'bold',
    color: ColorPalette.cordovan[500],
  },
  errorSubtext: {
    marginTop: 8,
    fontSize: 16,
    color: ColorPalette.black[700],
    textAlign: 'center',
  },
  
  // Calendar View Styles
  calendarContainer: {
    flex: 1,
  },
  monthDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  monthArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ColorPalette.white.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  monthTitleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: ColorPalette.antiFlashWhite[500],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: ColorPalette.cordovan[500],
  },
  todayButton: {
    backgroundColor: ColorPalette.cordovan[500],
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  todayButtonText: {
    color: ColorPalette.white.DEFAULT,
    fontSize: 12,
    fontWeight: 'bold',
  },
  calendarPanel: {
    backgroundColor: ColorPalette.white.DEFAULT,
    borderRadius: 16,
    padding: 16,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  weekdayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  weekdayHeaderText: {
    width: DAY_CELL_SIZE,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: ColorPalette.cordovan[400],
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  calendarDay: {
    width: DAY_CELL_SIZE,
    height: DAY_CELL_SIZE,
    margin: 2,
    borderRadius: 12,
    backgroundColor: ColorPalette.white.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  calendarDayOtherMonth: {
    backgroundColor: ColorPalette.antiFlashWhite[600],
    opacity: 0.6,
  },
  calendarDayToday: {
    backgroundColor: ColorPalette.white.DEFAULT,
    borderColor: ColorPalette.mikadoYellow[500],
    borderWidth: 2,
    shadowColor: ColorPalette.mikadoYellow[400],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  calendarDayHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: '600',
    color: ColorPalette.black[600],
  },
  calendarDayTextOtherMonth: {
    color: ColorPalette.black[800],
    fontWeight: '400',
  },
  calendarDayTextToday: {
    color: ColorPalette.cordovan[500],
    fontWeight: 'bold',
  },
  calendarDayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ColorPalette.mikadoYellow[600],
    position: 'absolute',
    bottom: -10,
  },
  
  // Broadcasts Containers
  broadcastsContainer: {
    marginTop: 24,
  },
  broadcastsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: ColorPalette.cordovan[500],
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: ColorPalette.antiFlashWhite[600],
  },
  broadcastsList: {
    paddingBottom: 20,
  },
  listContainer: {
    flex: 1,
  },
  
  // Broadcast Item Styles
  broadcastItem: {
    backgroundColor: ColorPalette.white.DEFAULT,
    borderRadius: 16,
    marginBottom: 14,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
    borderLeftWidth: 4,
    borderLeftColor: ColorPalette.cordovan[300],
  },
  broadcastItemLive: {
    borderColor: ColorPalette.mikadoYellow[500],
    borderWidth: 2,
    borderLeftWidth: 4,
    borderLeftColor: ColorPalette.mikadoYellow[600],
    backgroundColor: ColorPalette.antiFlashWhite[800],
  },
  liveIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ColorPalette.mikadoYellow[500],
    paddingHorizontal: 10,
    paddingVertical: 4,
    position: 'absolute',
    top: 0,
    right: 0,
    borderBottomLeftRadius: 10,
    zIndex: 1,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ColorPalette.cordovan[600],
    marginRight: 4,
  },
  liveText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: ColorPalette.cordovan[300],
  },
  broadcastContent: {
    flexDirection: 'row',
    padding: 16,
  },
  broadcastTimeBar: {
    alignItems: 'center',
    marginRight: 16,
    width: 40,
  },
  broadcastTimeText: {
    fontSize: 12,
    fontWeight: '600',
    color: ColorPalette.cordovan[500],
  },
  broadcastTimeLine: {
    width: 2,
    flex: 1,
    backgroundColor: ColorPalette.cordovan[300],
    marginVertical: 4,
  },
  broadcastInfo: {
    flex: 1,
  },
  broadcastTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: ColorPalette.black[600],
    marginBottom: 4,
  },
  broadcastDate: {
    fontSize: 12,
    color: ColorPalette.cordovan[400],
    marginBottom: 6,
  },
  broadcastDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: ColorPalette.black[700],
    marginBottom: 12,
  },
  broadcastFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  broadcastDjContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ColorPalette.antiFlashWhite[600],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  broadcastDj: {
    fontSize: 12,
    color: ColorPalette.cordovan[500],
    marginLeft: 4,
    fontWeight: '500',
  },
  
  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: ColorPalette.white.DEFAULT,
    borderRadius: 20,
    marginTop: 24,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: ColorPalette.antiFlashWhite[600],
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: ColorPalette.cordovan[500],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: ColorPalette.cordovan[400],
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: ColorPalette.black[700],
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
}); 