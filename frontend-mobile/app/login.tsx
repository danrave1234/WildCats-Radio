import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert
} from 'react-native';
import { Link, useNavigation, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth as useAuthApi } from '@/services/api';
import { useAuth as useAppAuth } from './_layout';
import { ColorPalette } from '@/constants/ColorPalette';

// Color palette
const COLORS = {
  white: ColorPalette.white.DEFAULT,
  cordovan: ColorPalette.cordovan.DEFAULT,
  antiFlashWhite: ColorPalette.antiFlashWhite.DEFAULT,
  mikadoYellow: ColorPalette.mikadoYellow.DEFAULT,
  black: ColorPalette.black.DEFAULT,
};

export default function AuthScreen() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigation = useNavigation();
  const router = useRouter();
  const { login, register } = useAuthApi();
  const { setIsLoggedIn } = useAppAuth();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    try {
      const response = await login.mutateAsync({
        email,
        password
      });
      
      // Update auth state
      setIsLoggedIn(true);
      
      // For development/testing purposes, just use a simple navigation
      // We'll use Link's href prop which works better with TypeScript
      // @ts-ignore - Ignoring TypeScript here as we know this is valid
      navigation.navigate('(tabs)');
    } catch (error: any) {
      // Display error message
      Alert.alert(
        'Login Failed',
        error.message || 'Please check your credentials and try again'
      );
    }
  };

  const handleRegister = async () => {
    // Form validation
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      // Call register API
      await register.mutateAsync({
        name,
        email,
        password
      });
      
      // Show success message
      Alert.alert(
        'Registration Successful',
        'Your account has been created. Please log in.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Switch back to login mode
              setIsLoginMode(true);
            }
          }
        ]
      );
    } catch (error: any) {
      // Display error message
      Alert.alert(
        'Registration Failed',
        error.message || 'There was a problem creating your account'
      );
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    // Clear the form when toggling
    if (isLoginMode) {
      // Switching to register mode, keep the entered email/password
      setName('');
      setConfirmPassword('');
    } else {
      // Switching to login mode, clear all fields
      setName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
    >
      <StatusBar style="dark" />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Image 
            source={require('@/assets/images/wildcat_radio_logo_transparent.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.title}>{isLoginMode ? 'Login' : 'Create Account'}</Text>
          
          {/* Name field (only shown in register mode) */}
          {!isLoginMode && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor={COLORS.black + '80'}
                autoCapitalize="words"
                value={name}
                onChangeText={setName}
              />
            </View>
          )}

          {/* Email field */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={COLORS.black + '80'}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Password field */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder={isLoginMode ? "Enter your password" : "Create a password"}
              placeholderTextColor={COLORS.black + '80'}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {/* Confirm Password field (only shown in register mode) */}
          {!isLoginMode && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Confirm your password"
                placeholderTextColor={COLORS.black + '80'}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity 
            style={styles.submitButton}
            onPress={isLoginMode ? handleLogin : handleRegister}
            disabled={isLoginMode ? login.isPending : register.isPending}
          >
            {(isLoginMode && login.isPending) || (!isLoginMode && register.isPending) ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.submitButtonText}>
                {isLoginMode ? 'Login' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Forgot Password Button (only shown in login mode) */}
          {isLoginMode && (
            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={() => Alert.alert('Coming Soon', 'This feature will be available soon!')}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          {/* Toggle Button */}
          <View style={styles.toggleContainer}>
            <Text style={styles.toggleText}>
              {isLoginMode ? 'Don\'t have an account?' : 'Already have an account?'}
            </Text>
            <TouchableOpacity onPress={toggleMode}>
              <Text style={styles.toggleLink}>
                {isLoginMode ? 'Sign Up' : 'Sign In'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.antiFlashWhite,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 30,
  },
  logo: {
    width: 360,
    height: 260,
    marginBottom: 8,
  },
  formContainer: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.cordovan,
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.antiFlashWhite,
    color: COLORS.black,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.cordovan + '40',
  },
  submitButton: {
    backgroundColor: COLORS.cordovan,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  forgotPasswordButton: {
    alignSelf: 'center',
    marginTop: 16,
    padding: 8,
  },
  forgotPasswordText: {
    color: COLORS.cordovan,
    fontSize: 14,
    fontWeight: '500',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  toggleText: {
    color: COLORS.black + '80',
    fontSize: 14,
  },
  toggleLink: {
    color: COLORS.mikadoYellow,
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 5,
  },
}); 