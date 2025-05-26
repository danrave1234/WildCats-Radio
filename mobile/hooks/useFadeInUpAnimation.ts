import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

interface AnimationProps {
  delay?: number;
  duration?: number;
  initialY?: number;
}

export const useFadeInUpAnimation = ({
  delay = 0,
  duration = 500,
  initialY = 20,
}: AnimationProps = {}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(initialY)).current;

  useEffect(() => {
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
  }, [opacity, translateY, delay, duration]);

  return {
    opacity,
    transform: [{ translateY }],
  };
}; 