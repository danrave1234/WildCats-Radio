import React, { useRef, useEffect } from 'react';
import { SafeAreaView, View, Text, Image, TouchableOpacity, StyleSheet, Dimensions, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');
const screenWidth = Dimensions.get('window').width;

const WelcomeScreen: React.FC = () => {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const translateX = useRef(new Animated.Value(0)).current;

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace('/(tabs)/home' as any);
    }
  }, [isAuthenticated, loading, router]);

  useFocusEffect(
    React.useCallback(() => {
      // Reset translateX when screen comes into focus
      translateX.setValue(0);
    }, [translateX])
  );

  // Don't render welcome screen if authenticated or still loading
  if (loading || isAuthenticated) {
    return null;
  }

  const handleLogin = () => {
    Animated.timing(translateX, {
      toValue: -screenWidth,
      duration: 200,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      router.push({ pathname: '/auth/login', params: { fromWelcome: 'true' } } as any);
    });
  };

  const handleSignUp = () => {
    Animated.timing(translateX, {
      toValue: -screenWidth,
      duration: 200,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      router.push({ pathname: '/auth/signup', params: { fromWelcome: 'true' } } as any);
    });
  };

  const handleNotNow = () => {
    router.push('/(tabs)/home' as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Base dark background */}
      <View style={styles.backgroundBase} />
      
      {/* Radial gradient overlay - top center */}
      <LinearGradient
        colors={['rgba(15,23,42,0.95)', 'rgba(2,6,23,0.95)']}
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
      
      <Animated.View style={[{ flex: 1, width: '100%' }, { transform: [{ translateX: translateX }] }]}>
        <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/images/wildcat_radio_logo_transparent.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>
          Welcome to Wildcat Radio
        </Text>

        <Text style={styles.subtitle}>
          Your ultimate destination for entertainment
        </Text>

        <TouchableOpacity
          onPress={handleLogin}
          style={styles.loginButton}
          activeOpacity={0.8}
        >
          <Text style={styles.loginButtonText}>
            Log In
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSignUp}
          style={styles.signupButton}
          activeOpacity={0.8}
        >
          <Text style={styles.signupButtonText}>
            Sign Up
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleNotNow}
          style={styles.notNowButton}
          activeOpacity={0.8}
        >
          <Text style={styles.notNowButtonText}>
            Not Now
          </Text>
        </TouchableOpacity>
      </View>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617', // slate-950 - dark background matching Login page
  },
  backgroundBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#020617', // slate-950
  },
  gradientOverlay1: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.7,
  },
  gradientMaroon1: {
    position: 'absolute',
    bottom: -height * 0.3,
    left: -width * 0.2,
    width: width * 0.8,
    height: height * 0.8,
    opacity: 0.7,
  },
  gradientYellow1: {
    position: 'absolute',
    top: -height * 0.2,
    right: -width * 0.15,
    width: width * 0.7,
    height: height * 0.7,
    opacity: 0.7,
  },
  gradientBlur1: {
    position: 'absolute',
    top: -height * 0.3,
    right: -width * 0.15,
    width: width * 1.2,
    height: height * 0.8,
    opacity: 0.8,
  },
  gradientBlur2: {
    position: 'absolute',
    bottom: -height * 0.4,
    left: -width * 0.2,
    width: width * 1.2,
    height: height * 1.0,
    opacity: 0.7,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logo: {
    width: 256,
    height: 168,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#e2e8f0', // slate-200 - light text matching Login page
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8', // slate-400 - muted light text for dark background
    textAlign: 'center',
    marginBottom: 48,
  },
  loginButton: {
    width: '100%',
    backgroundColor: '#91403E',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  signupButton: {
    width: '100%',
    backgroundColor: '#FFC30B',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  signupButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '600',
  },
  notNowButton: {
    width: '100%',
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notNowButtonText: {
    color: '#cbd5e1', // slate-300 - lighter text for better visibility on dark background
    fontSize: 16,
    fontWeight: '500',
  },
});

export default WelcomeScreen;

