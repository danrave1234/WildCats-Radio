import React from 'react';
import { View } from 'react-native';

interface AnimatedAudioWaveProps {
  isPlaying: boolean;
  size?: number;
}

const AnimatedAudioWave: React.FC<AnimatedAudioWaveProps> = ({ isPlaying, size = 40 }) => {
  const segments = [0.25, 0.6, 0.9, 0.5, 0.7];
  const heights = segments.map(value => (isPlaying ? value : 0.3));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: size, justifyContent: 'center' }}>
      {heights.map((height, index) => (
        <View
          key={index}
          style={{
            width: 3,
            marginHorizontal: 2,
            height: size * height,
            backgroundColor: '#91403E',
            borderRadius: 1.5,
          }}
        />
      ))}
    </View>
  );
};

export default AnimatedAudioWave;

