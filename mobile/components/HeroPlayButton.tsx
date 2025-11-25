import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface HeroPlayButtonProps {
  isPlaying: boolean;
  isLoading: boolean;
  isLive: boolean;
  onPress: () => void;
  disabled?: boolean;
  broadcastTitle?: string;
  djName?: string;
  listenerCount?: number;
}

const HeroPlayButton: React.FC<HeroPlayButtonProps> = ({
  isPlaying,
  isLoading,
  isLive,
  onPress,
  disabled = false,
  broadcastTitle,
  djName,
  listenerCount,
}) => {
  if (!isLive) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.glowRing} />
      <View style={styles.pulseRing} />
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={onPress}
          disabled={disabled || isLoading}
          style={[
            styles.playButton,
            (disabled || isLoading) && styles.playButtonDisabled,
          ]}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={isPlaying ? ['#B5830F', '#91403E'] : ['#91403E', '#7A2F2D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            {isLoading ? (
              <ActivityIndicator size="large" color="#FFFFFF" />
            ) : (
              <>
                {isPlaying ? (
                  <Ionicons name="pause" size={56} color="#FFFFFF" />
                ) : (
                  <Ionicons name="play" size={56} color="#FFFFFF" />
                )}
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {isLive && (
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      )}

      {/* Broadcast info below button */}
      {(broadcastTitle || djName) && (
        <View style={styles.infoContainer}>
          {broadcastTitle && (
            <Text style={styles.broadcastTitle} numberOfLines={1}>
              {broadcastTitle}
            </Text>
          )}
          {djName && (
            <Text style={styles.djName} numberOfLines={1}>
              with {djName}
            </Text>
          )}
          {listenerCount !== undefined && listenerCount > 0 && (
            <View style={styles.listenerInfo}>
              <Ionicons name="people" size={14} color="#91403E" />
              <Text style={styles.listenerText}>{listenerCount} listening</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 40,
    position: 'relative',
    paddingHorizontal: 20,
  },
  glowRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#FFC30B33',
  },
  pulseRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#91403E22',
  },
  buttonContainer: {
    zIndex: 1,
  },
  playButton: {
    width: 150,
    height: 150,
    borderRadius: 75,
    overflow: 'hidden',
    shadowColor: '#91403E',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 16,
    borderWidth: 5,
    borderColor: '#FFC30B',
  },
  gradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonDisabled: {
    opacity: 0.6,
  },
  liveBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 24,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  infoContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  broadcastTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 6,
    textAlign: 'center',
  },
  djName: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 8,
  },
  listenerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 4,
  },
  listenerText: {
    fontSize: 13,
    color: '#91403E',
    fontWeight: '600',
    marginLeft: 6,
  },
});

export default HeroPlayButton;

