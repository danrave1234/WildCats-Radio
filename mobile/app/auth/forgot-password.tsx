import React from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, Alert, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import AnimatedTextInput from '../../components/ui/AnimatedTextInput'; // Assuming similar input style
import { useFadeInUpAnimation } from '../../hooks/useFadeInUpAnimation';

const ForgotPasswordScreen: React.FC = () => {
  const router = useRouter();
  const [email, setEmail] = React.useState('');

  const titleAnim = useFadeInUpAnimation({ delay: 100 });
  const subtitleAnim = useFadeInUpAnimation({ delay: 300 });
  const inputAnim = useFadeInUpAnimation({ delay: 500 });
  const buttonAnim = useFadeInUpAnimation({ delay: 700 });
  const backButtonAnim = useFadeInUpAnimation({ delay: 900 });

  const handleResetPassword = () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    // TODO: Implement password reset logic (e.g., API call)
    console.log('Password reset requested for:', email);
    Alert.alert('Success', 'If an account exists for this email, a reset link will be sent.');
    router.back(); // or router.push('/auth/login');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#E9ECEC' }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
        <Animated.View style={titleAnim}>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#000000', marginBottom: 8, textAlign: 'center' }}>
            Forgot Password?
          </Text>
        </Animated.View>
        <Animated.View style={subtitleAnim}>
          <Text style={{ fontSize: 16, color: '#6b7280', marginBottom: 30, textAlign: 'center' }}>
            Enter your email to receive a reset link.
          </Text>
        </Animated.View>

        <AnimatedTextInput
          label="Email Address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          containerStyle={inputAnim}
        />

        <Animated.View style={buttonAnim}>
          <TouchableOpacity
            onPress={handleResetPassword}
            style={{
              backgroundColor: '#91403E', // cordovan
              paddingVertical: 16,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 2,
              elevation: 3,
              width: '100%', // Ensure button takes full width of its animated container
              marginBottom: 20,
            }}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '600' }}>Send Reset Link</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={backButtonAnim}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
            <Text style={{ fontSize: 16, color: '#91403E', fontWeight: '600' }}>
              Back to Login
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

export default ForgotPasswordScreen; 