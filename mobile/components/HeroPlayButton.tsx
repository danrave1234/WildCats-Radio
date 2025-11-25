import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, ActivityIndicator } from 'react-native';
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
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation when live
  useEffect(() => {
    if (isLive && !isPlaying) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isLive, isPlaying, pulseAnim]);

  // Glow animation
  useEffect(() => {
    if (isLive) {
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: false,
          }),
        ])
      );
      glow.start();
      return () => glow.stop();
    }
  }, [isLive, glowAnim]);

  // Subtle rotation animation for play icon
  useEffect(() => {
    if (isPlaying) {
      const rotate = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 20000,
          useNativeDriver: true,
          easing: Animated.Easing.linear,
        })
      );
      rotate.start();
      return () => rotate.stop();
    } else {
      rotateAnim.setValue(0);
    }
  }, [isPlaying, rotateAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  if (!isLive) {
    return null;
  }

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.5],
  });

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      {/* Outer glow rings */}
      <Animated.View
        style={[
          styles.glowRing,
          {
            transform: [{ scale: pulseAnim }],
            opacity: glowOpacity,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.pulseRing,
          {
            transform: [{ scale: pulseAnim }],
            opacity: isPlaying ? 0.2 : 0.4,
          },
        ]}
      />
      
      <Animated.View
        style={[
          styles.buttonContainer,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <TouchableOpacity
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
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
              <Animated.View style={{ transform: [{ rotate }] }}>
                {isPlaying ? (
                  <Ionicons name="pause" size={56} color="#FFFFFF" />
                ) : (
                  <Ionicons name="play" size={56} color="#FFFFFF" />
                )}
              </Animated.View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
      
      {/* Live badge with pulse */}
      {isLive && (
        <Animated.View
          style={[
            styles.liveBadge,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.liveDot,
              {
                opacity: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
              },
            ]}
          />
          <Text style={styles.liveText}>LIVE</Text>
        </Animated.View>
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
    backgroundColor: '#FFC30B',
  },
  pulseRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#91403E',
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

