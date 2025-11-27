import React, { useState, useRef, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';

const { width, height } = Dimensions.get('window');
const screenHeight = Dimensions.get('window').height;
const screenWidth = Dimensions.get('window').width;

const LoginScreen: React.FC = () => {
  const router = useRouter();
  const { login, loading, error: authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [error, setError] = useState('');
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const emailBorderColor = useRef(new Animated.Value(0)).current;
  const passwordBorderColor = useRef(new Animated.Value(0)).current;
  const localParams = useLocalSearchParams<{ direction?: string; fromWelcome?: string }>();

  useFocusEffect(
    React.useCallback(() => {
      const entryDirection = localParams.direction;
      const fromWelcome = localParams.fromWelcome;

      if (entryDirection === 'fromTop') {
        // Coming from signup - vertical animation
        translateX.setValue(0);
        translateY.setValue(-screenHeight);
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      } else if (fromWelcome === 'true') {
        // Coming from welcome - slide in from right
        translateY.setValue(0);
        translateX.setValue(screenWidth);
        Animated.timing(translateX, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      } else {
        translateY.setValue(0);
        translateX.setValue(0);
      }
    }, [translateY, translateX, localParams.direction, localParams.fromWelcome])
  );

  const handleLogin = async () => {
    setError('');
    
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    
    if (!password) {
      setError('Please enter your password');
      return;
    }

    try {
      await login({ email, password });
      // Navigate to home screen on successful login
      router.replace('/(tabs)/home' as any);
    } catch (err: any) {
      const errorMessage = err.message || 'Login failed. Please try again.';
      setError(errorMessage);
    }
  };

  const handleForgotPassword = () => {
    // Functionality will be added later
    Alert.alert('Forgot Password', 'This feature will be available soon.');
  };

  // Animate border color on focus
  useEffect(() => {
    Animated.timing(emailBorderColor, {
      toValue: emailFocused ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [emailFocused]);

  useEffect(() => {
    Animated.timing(passwordBorderColor, {
      toValue: passwordFocused ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [passwordFocused]);

  const emailBorderColorInterpolate = emailBorderColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.2)', 'rgba(255, 195, 11, 0.6)'], // slate to yellow
  });

  const passwordBorderColorInterpolate = passwordBorderColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.2)', 'rgba(255, 195, 11, 0.6)'], // slate to yellow
  });

  const navigateToSignUp = () => {
    Animated.timing(translateY, {
      toValue: -screenHeight,
      duration: 200,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      router.push({ pathname: '/auth/signup', params: { direction: 'fromBottom' } } as any);
    });
  };

  const navigateToWelcome = () => {
    Animated.timing(translateX, {
      toValue: screenWidth,
      duration: 200,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      router.push('/welcome' as any);
    });
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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <Animated.View style={[{ flex: 1, width: '100%' }, { transform: [{ translateY: translateY }, { translateX: translateX }] }]}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              {/* Back Button - Top left corner, scrolls with content */}
              <TouchableOpacity
                onPress={navigateToWelcome}
                style={styles.backButton}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-back" size={24} color="#FFC30B" />
              </TouchableOpacity>

              <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/images/wildcat_radio_logo_transparent.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.title}>
              Welcome Back
            </Text>

            <Text style={styles.subtitle}>
              Sign in to your account
            </Text>

            {/* Google Log In Button */}
            <TouchableOpacity
              style={styles.googleButton}
              activeOpacity={0.8}
              onPress={() => {
                // Functionality will be added later
                console.log('Log in with Google pressed');
              }}
            >
              <View style={styles.googleLogoContainer}>
                <Svg width={20} height={20} viewBox="0 0 24 24">
                  <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </Svg>
              </View>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            {/* Separator */}
            <View style={styles.separatorContainer}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>Or continue with email</Text>
              <View style={styles.separatorLine} />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address</Text>
              <Animated.View style={[styles.inputWrapper, { borderColor: emailBorderColorInterpolate }]}>
                <Ionicons name="mail-outline" size={20} color={emailFocused ? "#FFC30B" : "#94a3b8"} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email address"
                  placeholderTextColor="#64748b"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </Animated.View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <Animated.View style={[styles.passwordInputWrapper, { borderColor: passwordBorderColorInterpolate }]}>
                <Ionicons name="lock-closed-outline" size={20} color={passwordFocused ? "#FFC30B" : "#94a3b8"} style={styles.inputIcon} />
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter your password"
                  placeholderTextColor="#64748b"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.passwordToggle}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={passwordFocused ? "#FFC30B" : "#94a3b8"}
                  />
                </TouchableOpacity>
              </Animated.View>
            </View>

            {(error || authError) && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color="#ef4444" />
                <Text style={styles.errorText}>{error || authError}</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleForgotPassword}
              style={styles.forgotButton}
            >
              <Text style={styles.forgotButtonText}>
                Forgot Password?
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleLogin}
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              activeOpacity={0.8}
              disabled={loading}
            >
              <LinearGradient
                colors={['#91403E', '#7F1D1D', '#91403E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.loginButtonText}>
                    Log In
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.signupLinkContainer}>
              <Text style={styles.signupLinkText}>
                Don't have an account?{' '}
              </Text>
              <TouchableOpacity onPress={navigateToSignUp}>
                <Text style={styles.signupLinkButton}>
                  Sign up
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617', // slate-950
  },
  backgroundBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#020617',
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
    zIndex: 10,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    padding: 8,
    zIndex: 20,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logo: {
    width: 192,
    height: 112,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#e2e8f0', // slate-200
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8', // slate-400
    textAlign: 'center',
    marginBottom: 24,
  },
  googleButton: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  googleLogoContainer: {
    marginRight: 12,
  },
  googleButtonText: {
    color: '#1f2937', // gray-800
    fontSize: 16,
    fontWeight: '600',
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  separatorText: {
    fontSize: 12,
    color: '#94a3b8', // slate-400
    paddingHorizontal: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8', // slate-400
    marginBottom: 8,
  },
  inputWrapper: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputIcon: {
    marginLeft: 12,
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    color: '#e2e8f0', // slate-200
    fontSize: 16,
    paddingRight: 16,
  },
  passwordInputWrapper: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  passwordInput: {
    flex: 1,
    height: 48,
    color: '#e2e8f0', // slate-200
    fontSize: 16,
    paddingRight: 8,
  },
  passwordToggle: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  forgotButton: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#91403E', // cordovan
  },
  loginButton: {
    width: '100%',
    borderRadius: 8,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  loginButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  signupLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupLinkText: {
    fontSize: 14,
    color: '#94a3b8', // slate-400
  },
  signupLinkButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#91403E', // cordovan
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500',
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
});

export default LoginScreen;

