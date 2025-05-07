import React, { useEffect } from 'react';
import { Animated, StyleSheet, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from './ThemedText';
import { useColorScheme } from '../hooks/useColorScheme';

type ToastProps = {
  visible: boolean;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  onClose: () => void;
};

export default function Toast({ 
  visible, 
  message, 
  type = 'success', 
  duration = 3000, 
  onClose 
}: ToastProps) {
  const colorScheme = useColorScheme();
  const translateYAnim = new Animated.Value(100);
  const opacityAnim = new Animated.Value(0);

  useEffect(() => {
    if (visible) {
      // Show toast animation
      Animated.parallel([
        Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Hide toast after duration
      const timer = setTimeout(() => {
        hideToast();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateYAnim, {
        toValue: 100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  if (!visible) return null;

  // Set colors based on toast type
  const getBackgroundColor = () => {
    if (colorScheme === 'dark') {
      switch (type) {
        case 'success': return 'rgba(6, 95, 70, 0.8)';
        case 'error': return 'rgba(153, 27, 27, 0.8)';
        case 'warning': return 'rgba(146, 64, 14, 0.8)';
        case 'info': return 'rgba(30, 58, 138, 0.8)';
        default: return 'rgba(6, 95, 70, 0.8)';
      }
    } else {
      switch (type) {
        case 'success': return '#ECFDF5';
        case 'error': return '#FEF2F2';
        case 'warning': return '#FFFBEB';
        case 'info': return '#EFF6FF';
        default: return '#ECFDF5';
      }
    }
  };

  const getIconName = () => {
    switch (type) {
      case 'success': return 'checkmark-circle';
      case 'error': return 'close-circle';
      case 'warning': return 'warning';
      case 'info': return 'information-circle';
      default: return 'checkmark-circle';
    }
  };

  const getIconColor = () => {
    if (colorScheme === 'dark') {
      switch (type) {
        case 'success': return '#A7F3D0';
        case 'error': return '#FECACA';
        case 'warning': return '#FED7AA';
        case 'info': return '#BFDBFE';
        default: return '#A7F3D0';
      }
    } else {
      switch (type) {
        case 'success': return '#10B981';
        case 'error': return '#EF4444';
        case 'warning': return '#F59E0B';
        case 'info': return '#3B82F6';
        default: return '#10B981';
      }
    }
  };

  const getTextColor = () => {
    if (colorScheme === 'dark') {
      return '#FFFFFF';
    } else {
      switch (type) {
        case 'success': return '#065F46';
        case 'error': return '#B91C1C';
        case 'warning': return '#92400E';
        case 'info': return '#1E3A8A';
        default: return '#065F46';
      }
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: translateYAnim }],
          opacity: opacityAnim,
          backgroundColor: getBackgroundColor(),
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons name={getIconName()} size={24} color={getIconColor()} style={styles.icon} />
        <ThemedText style={[styles.message, { color: getTextColor() }]}>
          {message}
        </ThemedText>
        <TouchableOpacity onPress={hideToast}>
          <Ionicons name="close" size={20} color={getTextColor()} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
});
