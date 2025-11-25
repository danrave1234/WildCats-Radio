import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

interface AnimationProps {
  delay?: number;
  duration?: number;
  initialY?: number;
  enabled?: boolean; // allow callers to disable animations safely
}

export const useFadeInUpAnimation = ({
  delay = 0,
  duration = 500,
  initialY = 20,
  enabled = false,
}: AnimationProps = {}) => {
  // Always create values but default them to the end-state when disabled
  const opacity = useRef(new Animated.Value(enabled ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(enabled ? initialY : 0)).current;

  useEffect(() => {
    if (!enabled) return; // No-op when disabled
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [opacity, translateY, delay, duration, enabled]);

  return {
    opacity,
    transform: [{ translateY }],
  };
}; 