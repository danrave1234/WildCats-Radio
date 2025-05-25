import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  Image,
  TouchableOpacity,
  Alert,
  ScrollView,
  Linking,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import "../../global.css";
import { useFadeInUpAnimation } from '../../hooks/useFadeInUpAnimation';
import AnimatedTextInput from '../../components/ui/AnimatedTextInput';
import { registerUser } from '../../services/apiService';
import { useAuth } from '../../context/AuthContext';

// IMPORTANT: Update this path to your actual logo file if different
const logo = require('../../assets/images/wildcat_radio_logo_transparent.png');

const SignupScreen: React.FC = () => {
  const router = useRouter();
  const { signIn } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Entrance Animations
  const logoAnim = useFadeInUpAnimation({ delay: 100 });
  const titleAnim = useFadeInUpAnimation({ delay: 300 });
  const subtitleAnim = useFadeInUpAnimation({ delay: 500 });
  // Input fields will use their own animation, but we can animate their container
  const fullNameAnim = useFadeInUpAnimation({ delay: 600 });
  const emailAnim = useFadeInUpAnimation({ delay: 700 });
  const passwordAnim = useFadeInUpAnimation({ delay: 800 });
  const confirmPasswordAnim = useFadeInUpAnimation({ delay: 900 });
  const termsAnim = useFadeInUpAnimation({ delay: 1000 });
  const signupButtonAnim = useFadeInUpAnimation({ delay: 1100 });
  const loginLinkAnim = useFadeInUpAnimation({ delay: 1200 });

  const handleSignUp = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    if (!agreedToTerms) {
      Alert.alert('Error', 'Please agree to the Terms of Service and Privacy Policy.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await registerUser({ name: fullName, email, password });
      if (response.error) {
        Alert.alert('Sign Up Failed', response.error);
      } else if (response.token) {
        await signIn(response.token);
      } else {
        Alert.alert('Success', 'Account created successfully! Please log in.');
        router.push('/auth/login');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred during sign up.');
    }
    setIsLoading(false);
  };

  const navigateToLogin = () => {
    router.push('/auth/login');
  };

  const openTermsOfService = () => {
    Linking.openURL('https://example.com/terms').catch(err => console.error("Couldn't load page", err));
  };

  const openPrivacyPolicy = () => {
    Linking.openURL('https://example.com/privacy').catch(err => console.error("Couldn't load page", err));
  };

  return (
    <SafeAreaView className="flex-1 bg-anti-flash_white">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View className="items-center px-8 py-10">
          <Animated.View style={logoAnim}>
            <Image source={logo} className="w-48 h-28 mb-6" resizeMode="contain" />
          </Animated.View>

          <Animated.View style={titleAnim}>
            <Text className="text-3xl font-bold text-black mb-1 text-center">
              Create Account
            </Text>
          </Animated.View>
          <Animated.View style={subtitleAnim}>
            <Text className="text-base text-gray-600 mb-6 text-center">
              Join the Wildcat Radio community
            </Text>
          </Animated.View>

          <AnimatedTextInput
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            editable={!isLoading}
            containerStyle={fullNameAnim}
          />

          <AnimatedTextInput
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading}
            containerStyle={emailAnim}
          />

          <AnimatedTextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isLoading}
            containerStyle={passwordAnim}
          />

          <AnimatedTextInput
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            editable={!isLoading}
            containerStyle={confirmPasswordAnim}
          />

          <Animated.View style={termsAnim} className="w-full flex-row items-center mb-5 px-1">
            <TouchableOpacity
              onPress={() => setAgreedToTerms(!agreedToTerms)}
              className="w-5 h-5 border-2 border-gray-400 rounded-sm justify-center items-center mr-2.5"
              disabled={isLoading}
            >
              {agreedToTerms && <View className="w-2.5 h-2.5 bg-cordovan rounded-xs" />}
            </TouchableOpacity>
            <Text className="flex-1 text-xs text-gray-600 leading-tight">
              I agree to the{" "}
              <Text onPress={openTermsOfService} className="text-cordovan font-semibold">
                Terms of Service
              </Text>
              {" "}and{" "}
              <Text onPress={openPrivacyPolicy} className="text-cordovan font-semibold">
                Privacy Policy
              </Text>
            </Text>
          </Animated.View>

          <Animated.View style={signupButtonAnim} className="w-full">
            <TouchableOpacity
              onPress={handleSignUp}
              className="bg-mikado_yellow py-3.5 rounded-lg items-center justify-center shadow-md mb-6 flex-row"
              activeOpacity={0.8}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#000000" className="mr-2" />
              ) : null}
              <Text className="text-black text-lg font-bold">Create Account</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={loginLinkAnim}>
            <View className="flex-row justify-center">
              <Text className="text-sm text-gray-600">
                Already have an account?{" "}
              </Text>
              <TouchableOpacity onPress={navigateToLogin} disabled={isLoading}>
                <Text className="text-sm text-cordovan font-semibold">
                  Log In
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SignupScreen; 