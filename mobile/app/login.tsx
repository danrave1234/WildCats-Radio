import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Text, Platform, Image, KeyboardAvoidingView, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function Login() {
  const { login, loading, error: authError, isAuthenticated } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");

  // This redirection is now handled by the AppNavigator in _layout.tsx
  // We keep this as a fallback in case the user navigates directly to the login screen
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

    try {
      // Call the login function from AuthContext
      await login(formData);
      // Navigate to the main app on successful login
      router.replace('/(tabs)');
    } catch (err) {
      // Error handling is done by AuthContext, but we can add additional handling here if needed
      setError(err.response?.data?.message || 'Login failed. Please try again.');
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
            <ThemedText type="title" style={styles.title}>WildCats Radio</ThemedText>
            <ThemedText style={styles.subtitle}>Sign in to access your account</ThemedText>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              placeholder="Email address"
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              value={formData.email}
              onChangeText={(text) => handleChange('email', text)}
              style={[
                styles.input, 
                styles.topInput,
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
              placeholder="Password"
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              value={formData.password}
              onChangeText={(text) => handleChange('password', text)}
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
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </TouchableOpacity>

          <View style={styles.registerContainer}>
            <ThemedText style={styles.registerText}>
              Don't have an account?{' '}
            </ThemedText>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text style={styles.registerLink}>Sign up</Text>
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
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    fontSize: 14,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7F1D1D', // maroon-600
  },
});
