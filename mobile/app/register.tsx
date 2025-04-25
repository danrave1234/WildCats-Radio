import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Text, Platform, KeyboardAvoidingView, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function Register() {
  const { register, loading, error: authError, isAuthenticated } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");

  // This redirection is now handled by the AppNavigator in _layout.tsx
  // We keep this as a fallback in case the user navigates directly to the register screen
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated]);

  const handleChange = (name, value) => {
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  // Handle form submission with backend integration
  const handleSubmit = async () => {
    setError("");

    // Validate email is from cit.edu domain
    if (!formData.email.endsWith('@cit.edu')) {
      setError('Only cit.edu email addresses are allowed to register');
      return;
    }

    // Validate password match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password length
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    try {
      // Remove confirmPassword before sending to backend
      const { confirmPassword, ...registerData } = formData;

      // Call the register function from AuthContext
      await register(registerData);

      // Navigate to login page after successful registration
      router.replace('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedView style={styles.formContainer}>
          <View style={styles.logoContainer}>
            {/* Replace with your actual logo */}
            <View style={[styles.iconCircle, { backgroundColor: isDark ? '#1D3D47' : '#A1CEDC' }]}>
              <Text style={styles.iconText}>📻</Text>
            </View>
            <ThemedText type="title" style={styles.title}>Create Your Account</ThemedText>
            <ThemedText style={styles.subtitle}>Join WildCats Radio as a listener</ThemedText>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              placeholder="Full Name"
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              value={formData.name}
              onChangeText={(text) => handleChange('name', text)}
              style={[
                styles.input, 
                styles.topInput,
                { 
                  backgroundColor: isDark ? '#374151' : 'white',
                  borderColor: isDark ? '#4B5563' : '#D1D5DB',
                  color: isDark ? 'white' : 'black'
                }
              ]}
              autoCapitalize="words"
            />
            <TextInput
              placeholder="Email address (cit.edu domain only)"
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              value={formData.email}
              onChangeText={(text) => handleChange('email', text)}
              style={[
                styles.input, 
                styles.middleInput,
                { 
                  backgroundColor: isDark ? '#374151' : 'white',
                  borderColor: isDark ? '#4B5563' : '#D1D5DB',
                  color: isDark ? 'white' : 'black'
                }
              ]}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              placeholder="Password (min. 6 characters)"
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              value={formData.password}
              onChangeText={(text) => handleChange('password', text)}
              style={[
                styles.input, 
                styles.middleInput,
                { 
                  backgroundColor: isDark ? '#374151' : 'white',
                  borderColor: isDark ? '#4B5563' : '#D1D5DB',
                  color: isDark ? 'white' : 'black'
                }
              ]}
              secureTextEntry
            />
            <TextInput
              placeholder="Confirm Password"
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              value={formData.confirmPassword}
              onChangeText={(text) => handleChange('confirmPassword', text)}
              style={[
                styles.input, 
                styles.bottomInput,
                { 
                  backgroundColor: isDark ? '#374151' : 'white',
                  borderColor: isDark ? '#4B5563' : '#D1D5DB',
                  color: isDark ? 'white' : 'black'
                }
              ]}
              secureTextEntry
            />
          </View>

          {(error || authError) && (
            <View style={[styles.errorContainer, { backgroundColor: isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEF2F2' }]}>
              <Text style={[styles.errorText, { color: isDark ? '#FECACA' : '#B91C1C' }]}>
                {error || authError}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.button,
              loading ? styles.buttonDisabled : styles.buttonEnabled
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>Sign up</Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginContainer}>
            <ThemedText style={styles.loginText}>
              Already have an account?{' '}
            </ThemedText>
            <TouchableOpacity onPress={() => router.push('/login')}>
              <Text style={styles.loginLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    padding: 16,
    borderRadius: 8,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    height: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  topInput: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomWidth: 0,
  },
  middleInput: {
    borderBottomWidth: 0,
  },
  bottomInput: {
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
  },
  button: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonEnabled: {
    backgroundColor: '#7F1D1D', // maroon-700
  },
  buttonDisabled: {
    backgroundColor: '#9F2F2F', // maroon-400
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7F1D1D', // maroon-600
  },
});
