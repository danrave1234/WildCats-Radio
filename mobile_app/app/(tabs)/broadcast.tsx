import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const BroadcastScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      {/* Base black background */}
      <View style={styles.backgroundBase} />
      
      {/* Radial gradient overlay - top center */}
      <LinearGradient
        colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.gradientOverlay1}
      />
      
      {/* Maroon gradient - bottom left */}
      <LinearGradient
        colors={['rgba(127,29,29,0.35)', 'transparent']}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientMaroon1}
      />
      
      {/* Yellow gradient - top right */}
      <LinearGradient
        colors={['rgba(251,191,36,0.18)', 'transparent']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradientYellow1}
      />
      
      {/* Large maroon/yellow gradient blur - top right */}
      <LinearGradient
        colors={['rgba(251,191,36,0.50)', 'rgba(127,29,29,0.45)', 'transparent']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradientBlur1}
      />
      
      {/* Large maroon/rose gradient blur - bottom left */}
      <LinearGradient
        colors={['rgba(127,29,29,0.60)', 'rgba(225,29,72,0.45)', 'transparent']}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientBlur2}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Broadcast</Text>
            <Text style={styles.subtitle}>
              Listen to live broadcasts
            </Text>
          </View>

          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderText}>
              Broadcast content coming soon...
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backgroundBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  gradientOverlay1: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.4,
  },
  gradientMaroon1: {
    position: 'absolute',
    bottom: -height * 0.3,
    left: -width * 0.2,
    width: width * 0.8,
    height: height * 0.8,
    opacity: 0.3,
  },
  gradientYellow1: {
    position: 'absolute',
    top: -height * 0.2,
    right: -width * 0.15,
    width: width * 0.7,
    height: height * 0.7,
    opacity: 0.3,
  },
  gradientBlur1: {
    position: 'absolute',
    top: -height * 0.3,
    right: -width * 0.15,
    width: width * 1.2,
    height: height * 0.8,
    opacity: 0.4,
  },
  gradientBlur2: {
    position: 'absolute',
    bottom: -height * 0.4,
    left: -width * 0.2,
    width: width * 1.2,
    height: height * 1.0,
    opacity: 0.3,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingVertical: 40,
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e2e8f0',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#94a3b8',
    textAlign: 'center',
  },
  placeholderCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  placeholderText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
});

export default BroadcastScreen;

