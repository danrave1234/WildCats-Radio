import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonLoader from './SkeletonLoader';

const ListSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Screen title skeleton */}
      <View style={styles.titleSection}>
        <SkeletonLoader height={32} width="60%" style={styles.titleSkeleton} />
        <SkeletonLoader height={20} width="80%" style={styles.subtitleSkeleton} />
      </View>

      {/* Filter tabs skeleton */}
      <View style={styles.filterSection}>
        <View style={styles.filterTabs}>
          {['All', 'Live', 'Upcoming', 'Recent'].map((tab, index) => (
            <View key={`list-skeleton-tab-${index}`} style={styles.filterTab}>
              <SkeletonLoader height={40} width={80} borderRadius={20} />
            </View>
          ))}
        </View>
      </View>

      {/* Broadcast cards skeleton */}
      <View style={styles.cardsSection}>
        {[1, 2, 3, 4, 5].map((item) => (
          <View key={item} style={styles.broadcastCard}>
            <View style={styles.cardHeader}>
              <SkeletonLoader height={24} width="70%" />
              <SkeletonLoader height={20} width={60} borderRadius={12} />
            </View>
            <SkeletonLoader height={18} width="90%" style={styles.cardText} />
            <SkeletonLoader height={18} width="60%" style={styles.cardText} />
            <View style={styles.cardFooter}>
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
  },
  titleSection: {
    paddingTop: 8,
    paddingBottom: 16,
    marginBottom: 8,
    paddingHorizontal: 20,
    backgroundColor: '#F9FAFB',
  },
  titleSkeleton: {
    marginBottom: 8,
  },
  subtitleSkeleton: {
    marginBottom: 16,
  },
  filterSection: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  filterTabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
  },
  filterTab: {
    marginHorizontal: 4,
  },
  cardsSection: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: 20,
    backgroundColor: '#F9FAFB',
  },
  broadcastCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardText: {
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
});

export default ListSkeleton;
