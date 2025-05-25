import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  Image,
  TouchableOpacity,
  Alert,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import "../../global.css"; // Adjust path based on actual global.css location
import { useFadeInUpAnimation } from '../../hooks/useFadeInUpAnimation'; // Import the hook
import AnimatedTextInput from '../../components/ui/AnimatedTextInput'; // Import the new component
import { loginUser } from '../../services/apiService'; // Import the loginUser function

// IMPORTANT: Update this path to your actual logo file if different
const logo = require('../../assets/images/wildcat_radio_logo_transparent.png');

const LoginScreen: React.FC = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Loading state

  // Entrance animations (keeping these for non-input elements)
  const logoAnim = useFadeInUpAnimation({ delay: 100 });
  const titleAnim = useFadeInUpAnimation({ delay: 300 });
  const subtitleAnim = useFadeInUpAnimation({ delay: 500 });
  const emailInputAnim = useFadeInUpAnimation({ delay: 600 }); // Renamed for clarity
  const passwordInputAnim = useFadeInUpAnimation({ delay: 700 }); // Renamed for clarity
  const forgotButtonAnim = useFadeInUpAnimation({ delay: 800 });
  const loginButtonAnim = useFadeInUpAnimation({ delay: 900 });
  const signupLinkAnim = useFadeInUpAnimation({ delay: 1000 });

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await loginUser(email, password);
      if (response.error) {
        Alert.alert('Login Failed', response.error);
      } else if (response.token) {
        // TODO: Store the token securely (e.g., Expo SecureStore)
        console.log('Login successful, token:', response.token);
        Alert.alert('Success', 'Logged in successfully!');
        router.replace('/(tabs)/home'); // Navigate to dashboard/home after login
      } else {
        Alert.alert('Login Failed', 'An unknown error occurred.');
      }
    } catch (error) {
      // This catch block might be redundant if apiService handles all errors
      Alert.alert('Error', 'An unexpected error occurred during login.');
    }
    setIsLoading(false);
  };

  const handleForgotPassword = () => {
    router.push('/auth/forgot-password');
  };

  const navigateToSignUp = () => {
    router.push('/auth/signup');
  };

  return (
    <SafeAreaView className="flex-1 bg-anti-flash_white">
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
          containerStyle={emailInputAnim}
        />

        <AnimatedTextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!isLoading}
          containerStyle={passwordInputAnim}
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
    </SafeAreaView>
  );
};

export default LoginScreen; 