import React, { useState, useRef, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  Image,
  TouchableOpacity,
  Alert,
  Animated,
  ActivityIndicator,
  Dimensions,
  Easing,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import "../../global.css"; // Adjust path based on actual global.css location
import { useFadeInUpAnimation } from '../../hooks/useFadeInUpAnimation'; // Added back
import AnimatedTextInput from '../../components/ui/AnimatedTextInput'; // Import the new component
import { loginUser, getMe } from '../../services/apiService'; // Import login and session check
import { useAuth } from '../../context/AuthContext'; // Import useAuth

// IMPORTANT: Update this path to your actual logo file if different
const logo = require('../../assets/images/wildcat_radio_logo_transparent.png');

const LoginScreen: React.FC = () => {
  const router = useRouter();
  const { signIn } = useAuth(); // Get signIn from AuthContext
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Loading state

  const screenHeight = Dimensions.get('window').height;
  const translateY = useRef(new Animated.Value(0)).current; // Changed from translateX
  const isInitialRender = useRef(true); // To prevent animation on initial load
  const localParams = useLocalSearchParams<{ direction?: string }>();

  // Individual element animations (adjusted delays for staging)
  const logoAnim = useFadeInUpAnimation({ delay: 300 });         // Was 200
  const titleAnim = useFadeInUpAnimation({ delay: 400 });        // Was 300
  const subtitleAnim = useFadeInUpAnimation({ delay: 500 });     // Was 400
  const emailInputAnim = useFadeInUpAnimation({ delay: 600 });   // Was 500
  const passwordInputAnim = useFadeInUpAnimation({ delay: 700 });// Was 600
  const forgotButtonAnim = useFadeInUpAnimation({ delay: 800 }); // Was 700
  const loginButtonAnim = useFadeInUpAnimation({ delay: 900 });  // Was 800
  const signupLinkAnim = useFadeInUpAnimation({ delay: 1000 }); // Was 900

  useFocusEffect(
    React.useCallback(() => {
      const entryDirection = localParams.direction;

      if (isInitialRender.current) {
        translateY.setValue(0); // Appear at 0 on initial load
        isInitialRender.current = false;
      } else if (entryDirection === 'fromTop') {
        translateY.setValue(-screenHeight); // Start off-screen at the top
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      } else {
        // Default to appear at 0 if no specific direction or other known entry
        translateY.setValue(0);
      }
    }, [translateY, screenHeight, localParams.direction])
  );

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }
    setIsLoading(true);
    try {
      console.log('🔐 Starting login process...');
      const response = await loginUser(email, password);
      
      if (response.error) {
        console.error('❌ Login failed:', response.error);
        
        // Enhanced error handling with specific messages
        let errorMessage = response.error;
        let errorTitle = 'Login Failed';
        
        if (response.error.toLowerCase().includes('invalid credentials') || 
            response.error.toLowerCase().includes('wrong password') ||
            response.error.toLowerCase().includes('user not found')) {
          errorTitle = 'Invalid Credentials';
          errorMessage = 'The email or password you entered is incorrect. Please try again.';
        } else if (response.error.toLowerCase().includes('timeout')) {
          errorTitle = 'Connection Timeout';
          errorMessage = 'The server is taking too long to respond. Please check your internet connection and try again.';
        } else if (response.error.toLowerCase().includes('network')) {
          errorTitle = 'Network Error';
          errorMessage = 'Unable to connect to the server. Please check your internet connection.';
        } else if (response.error.toLowerCase().includes('server')) {
          errorTitle = 'Server Error';
          errorMessage = 'The server is currently unavailable. Please try again later.';
        }
        
        Alert.alert(errorTitle, errorMessage);
      } else {
        console.log('✅ Login successful, verifying session...');
        // Website-style login: server sets HttpOnly cookies. Verify session via /auth/me
        const me = await getMe();
        if ('error' in me) {
          console.error('❌ Session verification failed:', me.error);
          Alert.alert('Login Failed', me.error || 'Could not verify session after login.');
        } else {
          console.log('✅ Session verified, signing in...');
          // Mark as signed-in; we don't need a JWT in React Native when using cookies
          await signIn('COOKIE'); // sentinel value for routing; not used for API auth
          // Root layout will handle navigation based on auth state
        }
      }
    } catch (error: any) {
      console.error('❌ Login exception:', error);
      
      // Enhanced error handling for different error types
      let errorMessage = 'An unexpected error occurred during login.';
      let errorTitle = 'Login Error';
      
      if (error.message && error.message.includes('timeout')) {
        errorTitle = 'Connection Timeout';
        errorMessage = 'The server is taking too long to respond. Please check your internet connection and try again.';
      } else if (error.message && error.message.includes('Network request failed')) {
        errorTitle = 'Network Error';
        errorMessage = 'Unable to connect to the server. Please check your internet connection.';
      } else if (error.message && error.message.includes('server is not responding')) {
        errorTitle = 'Server Unavailable';
        errorMessage = 'The server is currently not responding. Please try again later.';
      }
      
      Alert.alert(errorTitle, errorMessage);
    }
    setIsLoading(false);
  };

  const handleForgotPassword = () => {
    router.push('/auth/forgot-password'); // This navigation won't have the custom slide
  };

  const navigateToSignUp = () => {
    Animated.timing(translateY, {
      toValue: -screenHeight, 
      duration: 300,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      router.push({ pathname: '/auth/signup', params: { direction: 'fromBottom' } } as any);
      // No immediate reset of translateY here, useFocusEffect will handle it on next focus.
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-anti-flash_white overflow-hidden">
      <Animated.View style={[{ flex: 1, width: '100%' }, { transform: [{ translateY: translateY }] }]}>
        <View className="flex-1 justify-center items-center px-8">
          <Animated.View style={logoAnim}>
            <Image source={logo} className="w-48 h-28 mb-6" resizeMode="contain" />
          </Animated.View>

          <Animated.View style={titleAnim}>
            <Text className="text-3xl font-bold text-black mb-2 text-center">
              Welcome Back
            </Text>
          </Animated.View>

          <Animated.View style={subtitleAnim}>
            <Text className="text-base text-gray-600 mb-10 text-center">
              Sign in to your account
            </Text>
          </Animated.View>

          <AnimatedTextInput
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading}
            containerStyle={emailInputAnim} // Apply animation style
          />

          <AnimatedTextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isLoading}
            containerStyle={passwordInputAnim} // Apply animation style
          />
          
          <Animated.View style={forgotButtonAnim} className="w-full items-end mb-6">
            <TouchableOpacity onPress={handleForgotPassword} disabled={isLoading}>
              <Text className="text-sm text-cordovan font-semibold">
                Forgot Password?
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={loginButtonAnim} className="w-full">
            <TouchableOpacity
              onPress={handleLogin}
              className="bg-cordovan py-4 rounded-lg items-center justify-center shadow-md mb-6 flex-row"
              activeOpacity={0.8}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" className="mr-2" />
              ) : null}
              <Text className="text-white text-lg font-semibold">Log In</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={signupLinkAnim}>
            <View className="flex-row justify-center">
              <Text className="text-sm text-gray-600">
                Don't have an account?{" "}
              </Text>
              <TouchableOpacity onPress={navigateToSignUp} disabled={isLoading}>
                <Text className="text-sm text-cordovan font-semibold">
                  Sign up
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

export default LoginScreen; 