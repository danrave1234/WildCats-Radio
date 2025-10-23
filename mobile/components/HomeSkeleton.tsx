import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonLoader from './SkeletonLoader';

const HomeSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Welcome section skeleton */}
      <View style={styles.welcomeSection}>
        <SkeletonLoader height={32} width="60%" style={styles.titleSkeleton} />
        <SkeletonLoader height={20} width="80%" style={styles.subtitleSkeleton} />
      </View>

      {/* Logo skeleton */}
      <View style={styles.logoSection}>
        <SkeletonLoader height={160} width={260} borderRadius={12} />
      </View>

      {/* Broadcast status card skeleton */}
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <SkeletonLoader height={24} width="40%" />
          <SkeletonLoader height={36} width={100} borderRadius={8} />
        </View>
        <SkeletonLoader height={20} width="90%" style={styles.statusText} />
        <SkeletonLoader height={20} width="70%" style={styles.statusText} />
      </View>

      {/* Live broadcast card skeleton */}
      <View style={styles.liveCard}>
        <View style={styles.liveHeader}>
          <SkeletonLoader height={20} width="30%" />
          <SkeletonLoader height={24} width={60} borderRadius={12} />
        </View>
        <SkeletonLoader height={18} width="85%" style={styles.liveText} />
        <SkeletonLoader height={18} width="60%" style={styles.liveText} />
        <View style={styles.liveFooter}>
          <SkeletonLoader height={16} width="40%" />
          <SkeletonLoader height={32} width={80} borderRadius={16} />
        </View>
      </View>

      {/* Recent broadcasts section skeleton */}
      <View style={styles.recentSection}>
        <SkeletonLoader height={24} width="50%" style={styles.sectionTitle} />
        {[1, 2, 3].map((item) => (
          <View key={item} style={styles.recentItem}>
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
    paddingHorizontal: 20,
    paddingTop: 6,
    backgroundColor: '#F5F5F5',
  },
  welcomeSection: {
    marginBottom: 24,
  },
  titleSkeleton: {
    marginBottom: 8,
  },
  subtitleSkeleton: {
    marginBottom: 16,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  statusCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusText: {
    marginBottom: 8,
  },
  liveCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  liveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  liveText: {
    marginBottom: 8,
  },
  liveFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  recentSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  recentItem: {
    marginBottom: 12,
  },
});

export default HomeSkeleton;
