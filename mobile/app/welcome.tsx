import React, { useEffect, useRef } from 'react';
import { SafeAreaView, View, Text, Image, TouchableOpacity, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import "../global.css"; // Ensure NativeWind styles are imported
import { useFadeInUpAnimation } from '../hooks/useFadeInUpAnimation'; // Import the hook
import { websocketService } from '../services/websocketService';

const WelcomeScreen: React.FC = () => {
  const router = useRouter();
  const userNavigatedRef = useRef(false);

  // Animation hooks with delays
  const logoAnim = useFadeInUpAnimation({ delay: 100 });
  const titleAnim = useFadeInUpAnimation({ delay: 300 });
  const subtitleAnim = useFadeInUpAnimation({ delay: 500 });
  const loginButtonAnim = useFadeInUpAnimation({ delay: 700 });
  const signupButtonAnim = useFadeInUpAnimation({ delay: 900 });

  const handleLogin = () => {
    userNavigatedRef.current = true;
    router.push('/auth/login'); // Navigate to your login screen
  };

  const handleSignUp = () => {
    userNavigatedRef.current = true;
    router.push('/auth/signup'); // Navigate to your sign-up screen
  };

  // Auto-forward to Listen after WS connect (with fallback timeout)
  useEffect(() => {
    let isActive = true;

    const goToListen = () => {
      if (!isActive || userNavigatedRef.current) return;
      router.replace('/(tabs)/broadcast');
    };

    const onWsConnect = () => {
      goToListen();
    };

    websocketService.onConnect(onWsConnect);
    // Fallback in case connect callback doesn't fire promptly
    const fallbackTimer = setTimeout(goToListen, 1500);

    return () => {
      isActive = false;
      clearTimeout(fallbackTimer);
      websocketService.offConnect(onWsConnect);
    };
  }, [router]);

  return (
    <SafeAreaView className="flex-1 bg-anti-flash_white">
      <View className="flex-1 justify-center items-center px-6">
        <Animated.View style={logoAnim}>
          <Image
            // IMPORTANT: Update this path to your actual logo file
            source={require('../assets/images/wildcat_radio_logo_transparent.png')}
            className="w-64 h-42 mb-2" // Adjust width, height, and margin as needed
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View style={titleAnim}>
          <Text className="text-3xl font-bold text-black text-center">
            Welcome to Wildcat Radio
          </Text>
        </Animated.View>

        <Animated.View style={subtitleAnim}>
          <Text className="text-base text-gray-600 mt-2 mb-12 text-center">
            Your ultimate destination for entertainment
          </Text>
        </Animated.View>

        <Animated.View style={loginButtonAnim} className="w-full">
          <TouchableOpacity
            onPress={handleLogin}
            className="w-full bg-cordovan py-4 rounded-lg items-center justify-center mb-4 shadow-md"
            activeOpacity={0.8}
          >
            <Text className="text-white text-lg font-semibold">
              Log In
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={signupButtonAnim} className="w-full">
          <TouchableOpacity
            onPress={handleSignUp}
            className="w-full bg-mikado_yellow py-4 rounded-lg items-center justify-center shadow-md"
            activeOpacity={0.8}
          >
            <Text className="text-black text-lg font-semibold">
              Sign Up
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

export default WelcomeScreen; 