import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonLoader from './SkeletonLoader';

const BroadcastSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Hero Card Skeleton - Matches renderListenHero */}
      <View style={styles.heroCard}>
        {/* Live Status Pill and Listener Count */}
        <View style={styles.heroHeaderRow}>
          <SkeletonLoader height={28} width={100} borderRadius={14} />
          <SkeletonLoader height={20} width={80} borderRadius={10} />
        </View>

        {/* Large Play Button Section */}
        <View style={styles.heroPlaySection}>
          <SkeletonLoader height={64} width={64} borderRadius={32} style={styles.playIconSkeleton} />
          <View style={styles.heroTextSection}>
            <SkeletonLoader height={18} width={120} borderRadius={9} style={styles.heroLabel} />
            <SkeletonLoader height={24} width="80%" borderRadius={12} style={styles.heroTitle} />
            <SkeletonLoader height={16} width="60%" borderRadius={8} style={styles.heroSubtitle} />
          </View>
          <SkeletonLoader height={28} width={28} borderRadius={14} style={styles.heroRightIcon} />
        </View>
      </View>

      {/* Tabs Bar Skeleton */}
      <View style={styles.tabsBar}>
        <SkeletonLoader height={48} width="33%" borderRadius={0} />
        <SkeletonLoader height={48} width="33%" borderRadius={0} />
        <SkeletonLoader height={48} width="34%" borderRadius={0} />
      </View>

      {/* Tab Content Skeleton - Chat Tab (default) */}
      <View style={styles.tabContent}>
        {/* Chat Messages Skeleton */}
        <View style={styles.chatMessagesContainer}>
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <View key={item} style={styles.chatMessageRow}>
              <SkeletonLoader height={32} width={32} borderRadius={16} style={styles.avatarSkeleton} />
              <View style={styles.messageBubble}>
                <SkeletonLoader height={14} width={60} borderRadius={7} style={styles.messageSender} />
                <SkeletonLoader height={16} width={Math.random() * 200 + 100} borderRadius={8} style={styles.messageText} />
                <SkeletonLoader height={12} width={50} borderRadius={6} style={styles.messageTime} />
              </View>
            </View>
          ))}
        </View>

        {/* Chat Input Skeleton */}
        <View style={styles.chatInputContainer}>
          <SkeletonLoader height={48} width="100%" borderRadius={24} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  // Hero Card Skeleton - Matches the gradient hero card
  heroCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 0,
    borderRadius: 24,
    padding: 20,
    backgroundColor: '#1F2937', // Dark background to match gradient
    minHeight: 180,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroPlaySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playIconSkeleton: {
    marginRight: 16,
  },
  heroTextSection: {
    flex: 1,
    marginRight: 12,
  },
  heroLabel: {
    marginBottom: 8,
  },
  heroTitle: {
    marginBottom: 6,
  },
  heroSubtitle: {
    marginTop: 4,
  },
  heroRightIcon: {
    // Radio icon on the right
  },
  // Tabs Bar Skeleton
  tabsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginTop: 0,
  },
  // Tab Content Skeleton
  tabContent: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: 12,
  },
  chatMessagesContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  chatMessageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  avatarSkeleton: {
    marginRight: 12,
  },
  messageBubble: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messageSender: {
    marginBottom: 6,
  },
  messageText: {
    marginBottom: 4,
  },
  messageTime: {
    marginTop: 4,
  },
  chatInputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
});

export default BroadcastSkeleton;