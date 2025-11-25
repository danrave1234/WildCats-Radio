import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface AnimatedAudioWaveProps {
  isPlaying: boolean;
  size?: number;
}

const AnimatedAudioWave: React.FC<AnimatedAudioWaveProps> = ({ isPlaying, size = 40 }) => {
  const waveAnimations = useRef([
    new Animated.Value(0.3),
    new Animated.Value(0.5),
    new Animated.Value(0.8),
    new Animated.Value(0.4),
    new Animated.Value(0.6),
    new Animated.Value(0.7),
    new Animated.Value(0.5),
  ]).current;

  useEffect(() => {
    if (isPlaying) {
      const animations = waveAnimations.map((anim, index) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: Math.random() * 0.7 + 0.3,
              duration: 200 + Math.random() * 300,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: Math.random() * 0.7 + 0.3,
              duration: 200 + Math.random() * 300,
              useNativeDriver: true,
            }),
          ])
        )
      );

      animations.forEach((animation, index) => {
        setTimeout(() => animation.start(), index * 80);
      });

      return () => {
        animations.forEach(animation => animation.stop());
      };
    } else {
      waveAnimations.forEach(anim => {
        Animated.timing(anim, {
          toValue: 0.2,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [isPlaying, waveAnimations]);

  return (
    <View style={[styles.container, { height: size }]}>
      {waveAnimations.map((anim, index) => {
        const height = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [size * 0.15, size],
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.waveBar,
              {
                height: height,
                width: size * 0.12,
                borderRadius: size * 0.06,
                marginHorizontal: size * 0.04,
              },
            ]}
          >
            <LinearGradient
              colors={['#91403E', '#FFC30B', '#91403E']}
              start={{ x: 0, y: 1 }}
              end={{ x: 0, y: 0 }}
              style={styles.gradient}
            />
          </Animated.View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  waveBar: {
    overflow: 'hidden',
  },
  gradient: {
    width: '100%',
    height: '100%',
  },
});

export default AnimatedAudioWave;

