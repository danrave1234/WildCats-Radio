import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonLoader from './SkeletonLoader';

const BroadcastSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* ON AIR Banner Skeleton */}
      <View style={styles.onAirBanner}>
        <SkeletonLoader height={24} width="40%" style={styles.onAirText} />
      </View>

      {/* Station Branding Skeleton */}
      <View style={styles.stationBranding}>
        <SkeletonLoader height={48} width="80%" style={styles.stationName} />
        <SkeletonLoader height={24} width="60%" style={styles.liveText} />
      </View>

      {/* Show Information Poster Card Skeleton */}
      <View style={styles.posterCard}>
        {/* Show Title Section */}
        <View style={styles.showTitleSection}>
          <SkeletonLoader height={64} width={64} borderRadius={32} style={styles.radioIcon} />
          <SkeletonLoader height={32} width="90%" style={styles.showTitle} />
          <View style={styles.djSection}>
            <SkeletonLoader height={24} width={40} borderRadius={12} style={styles.djBadge} />
            <SkeletonLoader height={20} width="50%" style={styles.djName} />
          </View>
        </View>

        {/* Now Playing Section */}
        <View style={styles.nowPlayingSection}>
          <View style={styles.nowPlayingHeader}>
            <SkeletonLoader height={16} width="30%" style={styles.nowPlayingLabel} />
            <SkeletonLoader height={20} width={60} borderRadius={10} style={styles.audioWave} />
          </View>
          <SkeletonLoader height={24} width="80%" style={styles.songTitle} />
          <SkeletonLoader height={18} width="60%" style={styles.artistName} />
        </View>

        {/* Call to Action Button */}
        <SkeletonLoader height={56} width="100%" borderRadius={16} style={styles.ctaButton} />
      </View>

      {/* Audio Controls Skeleton */}
      <View style={styles.audioControls}>
        <SkeletonLoader height={60} width={60} borderRadius={30} style={styles.playButton} />
        <View style={styles.audioInfo}>
          <SkeletonLoader height={20} width="70%" style={styles.audioTitle} />
          <SkeletonLoader height={16} width="50%" style={styles.audioSubtitle} />
        </View>
        <SkeletonLoader height={40} width={40} borderRadius={20} style={styles.volumeButton} />
      </View>

      {/* Audio Wave Skeleton */}
      <View style={styles.audioWaveSection}>
        <SkeletonLoader height={40} width="100%" borderRadius={8} />
      </View>

      {/* Chat Section Skeleton */}
      <View style={styles.chatSection}>
        <View style={styles.chatHeader}>
          <SkeletonLoader height={24} width="30%" />
          <SkeletonLoader height={20} width={60} borderRadius={10} />
        </View>
        
        {/* Chat Messages Skeleton */}
        <View style={styles.chatMessages}>
          {[1, 2, 3, 4, 5].map((item) => (
            <View key={item} style={styles.chatMessage}>
              <SkeletonLoader height={16} width={24} borderRadius={12} style={styles.avatarSkeleton} />
              <View style={styles.messageContent}>
                <SkeletonLoader height={16} width="60%" style={styles.messageText} />
                <SkeletonLoader height={14} width="40%" style={styles.messageTime} />
              </View>
            </View>
          ))}
        </View>

        {/* Chat Input Skeleton */}
        <View style={styles.chatInput}>
          <SkeletonLoader height={48} width="100%" borderRadius={24} />
        </View>
      </View>

      {/* Tabs Skeleton */}
      <View style={styles.tabsSection}>
        <View style={styles.tabButtons}>
          <SkeletonLoader height={40} width={80} borderRadius={20} style={styles.tabButton} />
          <SkeletonLoader height={40} width={80} borderRadius={20} style={styles.tabButton} />
          <SkeletonLoader height={40} width={80} borderRadius={20} style={styles.tabButton} />
        </View>
      </View>

      {/* Tab Content Skeleton */}
      <View style={styles.tabContent}>
        <SkeletonLoader height={200} width="100%" borderRadius={12} style={styles.contentCard} />
        <SkeletonLoader height={150} width="100%" borderRadius={12} style={styles.contentCard} />
        <SkeletonLoader height={120} width="100%" borderRadius={12} style={styles.contentCard} />
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
  onAirBanner: {
    alignItems: 'center',
    marginBottom: 16,
  },
  onAirText: {
    marginBottom: 8,
  },
  stationBranding: {
    alignItems: 'center',
    marginBottom: 24,
  },
  stationName: {
    marginBottom: 8,
  },
  liveText: {
    marginBottom: 16,
  },
  posterCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 20,
  },
  showTitleSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  radioIcon: {
    marginBottom: 16,
  },
  showTitle: {
    marginBottom: 16,
  },
  djSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  djBadge: {
    marginRight: 8,
  },
  djName: {
    marginBottom: 8,
  },
  nowPlayingSection: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  nowPlayingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  nowPlayingLabel: {
    marginRight: 12,
  },
  audioWave: {
    marginLeft: 'auto',
  },
  songTitle: {
    marginBottom: 8,
  },
  artistName: {
    marginBottom: 8,
  },
  ctaButton: {
    marginBottom: 8,
  },
  audioControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  playButton: {
    marginRight: 16,
  },
  audioInfo: {
    flex: 1,
  },
  audioTitle: {
    marginBottom: 4,
  },
  audioSubtitle: {
    marginBottom: 8,
  },
  volumeButton: {
    marginLeft: 16,
  },
  audioWaveSection: {
    marginBottom: 20,
  },
  chatSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chatMessages: {
    marginBottom: 16,
  },
  chatMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  avatarSkeleton: {
    marginRight: 12,
  },
  messageContent: {
    flex: 1,
  },
  messageText: {
    marginBottom: 4,
  },
  messageTime: {
    marginBottom: 8,
  },
  chatInput: {
    marginTop: 8,
  },
  tabsSection: {
    marginBottom: 20,
  },
  tabButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabButton: {
    marginHorizontal: 4,
  },
  tabContent: {
    flex: 1,
  },
  contentCard: {
    marginBottom: 16,
  },
});

export default BroadcastSkeleton;