import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedAudioWave from './AnimatedAudioWave';

interface NowPlayingCardProps {
  songTitle?: string;
  artist?: string;
  isPlaying: boolean;
  listenerCount?: number;
}

const NowPlayingCard: React.FC<NowPlayingCardProps> = ({
  songTitle,
  artist,
  isPlaying,
  listenerCount = 0,
}) => {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FFFFFF', '#F9FAFB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={['#91403E', '#7A2F2D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGradient}
            >
              <Ionicons name="musical-notes" size={26} color="#FFFFFF" />
            </LinearGradient>
          </View>
          <View style={styles.textContainer}>
            <View style={styles.labelContainer}>
              <View style={styles.liveIndicator} />
              <Text style={styles.label}>NOW PLAYING</Text>
            </View>
            {songTitle ? (
              <>
                <Text style={styles.songTitle} numberOfLines={2}>
                  {songTitle}
                </Text>
                {artist && (
                  <Text style={styles.artist} numberOfLines={1}>
                    {artist}
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.defaultText}>WildCat Radio Live Stream</Text>
            )}
          </View>
          {isPlaying && (
            <View style={styles.waveContainer}>
              <AnimatedAudioWave isPlaying={isPlaying} size={36} />
            </View>
          )}
        </View>
        {listenerCount > 0 && (
          <View style={styles.listenerBadge}>
            <Ionicons name="people" size={16} color="#91403E" />
            <Text style={styles.listenerText}>{listenerCount} listening</Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#91403E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  gradient: {
    padding: 22,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginRight: 16,
    shadowColor: '#91403E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#91403E',
    letterSpacing: 1.8,
  },
  songTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
    lineHeight: 26,
  },
  artist: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '600',
  },
  defaultText: {
    fontSize: 17,
    color: '#6B7280',
    fontWeight: '600',
  },
  waveContainer: {
    marginLeft: 12,
    justifyContent: 'center',
  },
  listenerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  listenerText: {
    fontSize: 13,
    color: '#91403E',
    fontWeight: '700',
    marginLeft: 6,
  },
});

export default NowPlayingCard;

