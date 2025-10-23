import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonLoader from './SkeletonLoader';

const ProfileSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Header section skeleton */}
      <View style={styles.headerSection}>
        <SkeletonLoader height={96} width={96} borderRadius={48} style={styles.avatarSkeleton} />
        <SkeletonLoader height={24} width="60%" style={styles.nameSkeleton} />
        <SkeletonLoader height={18} width="80%" style={styles.memberSkeleton} />
      </View>

      {/* Stats section skeleton */}
      <View style={styles.statsSection}>
        <View style={styles.statItem}>
          <SkeletonLoader height={32} width={40} style={styles.statNumber} />
          <SkeletonLoader height={16} width={60} style={styles.statLabel} />
        </View>
        <View style={styles.statItem}>
          <SkeletonLoader height={32} width={40} style={styles.statNumber} />
          <SkeletonLoader height={16} width={60} style={styles.statLabel} />
        </View>
        <View style={styles.statItem}>
          <SkeletonLoader height={32} width={40} style={styles.statNumber} />
          <SkeletonLoader height={16} width={60} style={styles.statLabel} />
        </View>
      </View>

      {/* Profile details skeleton */}
      <View style={styles.detailsSection}>
        <SkeletonLoader height={24} width="40%" style={styles.sectionTitle} />
        <View style={styles.detailItem}>
          <SkeletonLoader height={20} width="30%" style={styles.detailLabel} />
          <SkeletonLoader height={20} width="70%" style={styles.detailValue} />
        </View>
        <View style={styles.detailItem}>
          <SkeletonLoader height={20} width="30%" style={styles.detailLabel} />
          <SkeletonLoader height={20} width="70%" style={styles.detailValue} />
        </View>
        <View style={styles.detailItem}>
          <SkeletonLoader height={20} width="30%" style={styles.detailLabel} />
          <SkeletonLoader height={20} width="70%" style={styles.detailValue} />
        </View>
      </View>

      {/* Activity section skeleton */}
      <View style={styles.activitySection}>
        <SkeletonLoader height={24} width="50%" style={styles.sectionTitle} />
        {[1, 2, 3].map((item) => (
          <View key={item} style={styles.activityItem}>
            <SkeletonLoader height={60} width="100%" borderRadius={12} />
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
    backgroundColor: '#F3F4F6',
  },
  headerSection: {
    backgroundColor: 'white',
    paddingTop: 64,
    paddingBottom: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarSkeleton: {
    marginBottom: 16,
  },
  nameSkeleton: {
    marginBottom: 8,
  },
  memberSkeleton: {
    marginBottom: 16,
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
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
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    marginBottom: 8,
  },
  statLabel: {
    marginBottom: 4,
  },
  detailsSection: {
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
  sectionTitle: {
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    marginBottom: 4,
  },
  detailValue: {
    marginBottom: 4,
  },
  activitySection: {
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
  activityItem: {
    marginBottom: 12,
  },
});

export default ProfileSkeleton;
