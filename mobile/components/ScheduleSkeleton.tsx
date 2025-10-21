import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonLoader from './SkeletonLoader';

const ScheduleSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Screen title skeleton */}
      <View style={styles.titleSection}>
        <SkeletonLoader height={32} width="60%" style={styles.titleSkeleton} />
        <SkeletonLoader height={20} width="80%" style={styles.subtitleSkeleton} />
      </View>

      {/* Calendar header skeleton */}
      <View style={styles.calendarSection}>
        <View style={styles.calendarHeader}>
          <SkeletonLoader height={24} width="40%" />
          <SkeletonLoader height={32} width={120} borderRadius={16} />
        </View>
        <View style={styles.calendarGrid}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
            <View key={`schedule-skeleton-day-${index}`} style={styles.dayHeader}>
              <SkeletonLoader height={20} width={20} borderRadius={10} />
            </View>
          ))}
        </View>
        <View style={styles.calendarDays}>
          {Array.from({ length: 35 }, (_, index) => (
            <View key={index} style={styles.dayCell}>
              <SkeletonLoader height={32} width={32} borderRadius={16} />
            </View>
          ))}
        </View>
      </View>

      {/* Schedule events skeleton */}
      <View style={styles.eventsSection}>
        <SkeletonLoader height={24} width="50%" style={styles.sectionTitle} />
        {[1, 2, 3, 4].map((item) => (
          <View key={item} style={styles.eventCard}>
            <View style={styles.eventHeader}>
              <SkeletonLoader height={20} width="60%" />
              <SkeletonLoader height={16} width={80} borderRadius={8} />
            </View>
            <SkeletonLoader height={18} width="90%" style={styles.eventText} />
            <SkeletonLoader height={18} width="70%" style={styles.eventText} />
            <View style={styles.eventFooter}>
              <SkeletonLoader height={16} width="40%" />
              <SkeletonLoader height={16} width="30%" />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 6,
    backgroundColor: '#F5F5F5',
  },
  titleSection: {
    paddingTop: 8,
    paddingBottom: 16,
    marginBottom: 8,
    paddingHorizontal: 20,
    backgroundColor: '#F5F5F5',
  },
  titleSkeleton: {
    marginBottom: 8,
  },
  subtitleSkeleton: {
    marginBottom: 16,
  },
  calendarSection: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  dayHeader: {
    alignItems: 'center',
    width: 40,
  },
  calendarDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  dayCell: {
    alignItems: 'center',
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 8,
  },
  eventsSection: {
    flex: 1,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  eventCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  eventText: {
    marginBottom: 8,
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
});

export default ScheduleSkeleton;
