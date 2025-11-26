import React from 'react';
import { View, StyleSheet } from 'react-native';

interface AnimatedAudioWaveProps {
  isPlaying: boolean;
  size?: number;
}

const AnimatedAudioWave: React.FC<AnimatedAudioWaveProps> = ({ isPlaying, size = 40 }) => {
  const segments = [0.2, 0.45, 0.75, 0.6, 0.9, 0.5, 0.35];
  const heights = segments.map(value => (isPlaying ? value : 0.25));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', height: size }}>
      {heights.map((height, index) => (
        <View
          key={index}
          style={[
            styles.waveBar,
            {
              height: size * height,
              width: size * 0.12,
              marginHorizontal: size * 0.04,
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  waveBar: {
    borderRadius: 4,
    backgroundColor: '#91403E',
  },
});

export default AnimatedAudioWave;

