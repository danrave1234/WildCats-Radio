import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useColorScheme } from '../hooks/useColorScheme';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import Colors from '../constants/Colors';

interface AudioPlayerProps {
  streamUrl: string;
  title: string;
  artist?: string;
  showControls?: boolean;
}

const AudioPlayer = ({ streamUrl, title, artist, showControls = true }: AudioPlayerProps) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const colorScheme = useColorScheme();
  
  // Animation for the audio bars
  const [animations] = useState({
    bar1: new Animated.Value(3),
    bar2: new Animated.Value(15),
    bar3: new Animated.Value(10),
    bar4: new Animated.Value(17),
    bar5: new Animated.Value(5),
  });

  // Set up audio session
  useEffect(() => {
    async function configureAudio() {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        playThroughEarpieceAndroid: false,
      });
    }
    configureAudio();
  }, []);

  // Start the animation when playing
  useEffect(() => {
    if (isPlaying) {
      startAnimation();
    } else {
      Object.values(animations).forEach(anim => {
        Animated.timing(anim).stop();
      });
    }
    return () => {
      Object.values(animations).forEach(anim => {
        Animated.timing(anim).stop();
      });
    };
  }, [isPlaying]);

  // Clean up audio when component unmounts
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const startAnimation = () => {
    const animateBar = (bar: Animated.Value) => {
      const randomHeight = Math.floor(Math.random() * 20) + 5;
      Animated.sequence([
        Animated.timing(bar, {
          toValue: randomHeight,
          duration: 500 + Math.random() * 1000,
          useNativeDriver: false,
        }),
        Animated.timing(bar, {
          toValue: 3 + Math.random() * 15,
          duration: 500 + Math.random() * 1000,
          useNativeDriver: false,
        })
      ]).start(() => {
        if (isPlaying) {
          animateBar(bar);
        }
      });
    };

    Object.values(animations).forEach(animateBar);
  };

  const togglePlayback = async () => {
    if (!sound) {
      await loadAndPlaySound();
    } else {
      if (isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        setIsBuffering(true);
        await sound.playAsync();
        setIsPlaying(true);
        setIsBuffering(false);
      }
    }
  };

  const loadAndPlaySound = async () => {
    try {
      setIsBuffering(true);
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: streamUrl },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );
      
      setSound(newSound);
      setIsPlaying(true);
    } catch (error) {
      console.error('Error loading sound', error);
    } finally {
      setIsBuffering(false);
    }
  };

  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
      setIsBuffering(status.isBuffering);
    }
  };

  const handleVolumeChange = async (value) => {
    setVolume(value);
    if (sound) {
      await sound.setVolumeAsync(value);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.mainContent}>
        <View style={styles.infoContainer}>
          <ThemedText style={styles.title} numberOfLines={1}>{title}</ThemedText>
          {artist && <ThemedText style={styles.artist}>{artist}</ThemedText>}
        </View>
        
        <View style={styles.controlsContainer}>
          <TouchableOpacity 
            onPress={togglePlayback} 
            style={[
              styles.playButton, 
              { backgroundColor: isPlaying 
                ? '#5a1717' // darker maroon
                : '#8a2424' // maroon
              }
            ]}
            disabled={isBuffering}
          >
            {isBuffering ? (
              <Ionicons name="sync" size={24} color="white" style={styles.spinIcon} />
            ) : isPlaying ? (
              <Ionicons name="pause" size={24} color="white" />
            ) : (
              <Ionicons name="play" size={24} color="white" />
            )}
          </TouchableOpacity>
          
          {isPlaying && (
            <View style={styles.equalizerContainer}>
              {Object.values(animations).map((anim, index) => (
                <Animated.View 
                  key={index}
                  style={[
                    styles.equalizerBar, 
                    { 
                      height: anim, 
                      backgroundColor: colorScheme === 'dark' ? '#d1d1d1' : '#333333'
                    }
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      </View>
      
      {showControls && (
        <View style={styles.volumeContainer}>
          <Ionicons 
            name="volume-low" 
            size={18} 
            color={Colors[colorScheme].text} 
          />
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            value={volume}
            onValueChange={handleVolumeChange}
            minimumTrackTintColor="#8a2424"
            maximumTrackTintColor={colorScheme === 'dark' ? '#555555' : '#cccccc'}
            thumbTintColor="#8a2424"
          />
          <Ionicons 
            name="volume-high" 
            size={18} 
            color={Colors[colorScheme].text} 
          />
        </View>
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  artist: {
    fontSize: 14,
    opacity: 0.7,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  equalizerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 24,
    marginLeft: 8,
  },
  equalizerBar: {
    width: 4,
    marginHorizontal: 1,
    borderRadius: 2,
  },
  volumeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  slider: {
    flex: 1,
    marginHorizontal: 8,
    height: 40,
  },
  spinIcon: {
    transform: [{ rotate: '0deg' }],
  },
});

export default AudioPlayer;
