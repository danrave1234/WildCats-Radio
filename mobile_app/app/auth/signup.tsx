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
  Modal,
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

const genderOptions = [
  { label: 'Prefer not to say', value: '' },
  { label: 'Male', value: 'MALE' },
  { label: 'Female', value: 'FEMALE' },
  { label: 'Other', value: 'OTHER' },
];

const SignupScreen: React.FC = () => {
  const router = useRouter();
  const { register, login, loading, error: authError } = useAuth();
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [gender, setGender] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showGenderDropdown, setShowGenderDropdown] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [firstnameFocused, setFirstnameFocused] = useState(false);
  const [lastnameFocused, setLastnameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [birthdateFocused, setBirthdateFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);
  const [error, setError] = useState('');
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const firstnameBorderColor = useRef(new Animated.Value(0)).current;
  const lastnameBorderColor = useRef(new Animated.Value(0)).current;
  const emailBorderColor = useRef(new Animated.Value(0)).current;
  const birthdateBorderColor = useRef(new Animated.Value(0)).current;
  const passwordBorderColor = useRef(new Animated.Value(0)).current;
  const confirmPasswordBorderColor = useRef(new Animated.Value(0)).current;
  const localParams = useLocalSearchParams<{ direction?: string; fromWelcome?: string }>();

  useFocusEffect(
    React.useCallback(() => {
      const entryDirection = localParams.direction;
      const fromWelcome = localParams.fromWelcome;

      if (entryDirection === 'fromBottom') {
        // Coming from login - vertical animation
        translateX.setValue(0);
        translateY.setValue(screenHeight);
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

  // Format date input as mm/dd/yyyy
  const formatDateInput = (text: string) => {
    // Remove all non-numeric characters
    const numbers = text.replace(/\D/g, '');
    
    // Format as mm/dd/yyyy
    let formatted = numbers;
    if (numbers.length > 2) {
      formatted = numbers.slice(0, 2) + '/' + numbers.slice(2);
    }
    if (numbers.length > 4) {
      formatted = numbers.slice(0, 2) + '/' + numbers.slice(2, 4) + '/' + numbers.slice(4, 8);
    }
    
    // Limit to 10 characters (mm/dd/yyyy)
    if (formatted.length > 10) {
      formatted = formatted.slice(0, 10);
    }
    
    return formatted;
  };

  const handleDateChange = (text: string) => {
    const formatted = formatDateInput(text);
    setBirthdate(formatted);
  };

  const handleSignUp = async () => {
    setError('');

    // Validate password match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    // Validate birthdate (must be at least 13 years old)
    if (birthdate) {
      // Convert mm/dd/yyyy to Date
      const [month, day, year] = birthdate.split('/');
      if (month && day && year) {
        const birthDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }

        if (age < 13) {
          setError('You must be at least 13 years old to register');
          return;
        }
      } else {
        setError('Please enter a valid date of birth');
        return;
      }
    } else {
      setError('Please enter your date of birth');
      return;
    }

    try {
      // Convert birthdate from mm/dd/yyyy to yyyy-mm-dd format
      const [month, day, year] = birthdate.split('/');
      const formattedBirthdate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

      await register({
        firstname,
        lastname,
        email,
        password,
        birthdate: formattedBirthdate,
        gender: gender || undefined,
      });

      // Automatically log in the user after successful registration
      try {
        await login({ email, password });
        // Navigate to home after successful login
        setShowSignupModal(false);
        router.replace('/(tabs)/home' as any);
      } catch (loginErr: any) {
        // If auto-login fails, show error but don't block navigation
        setError('Account created but login failed. Please log in manually.');
        setShowSignupModal(false);
        router.push({ pathname: '/auth/login', params: { direction: 'fromTop' } } as any);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Registration failed. Please try again.';
      setError(errorMessage);
    }
  };

  const navigateToLogin = () => {
    Animated.timing(translateY, {
      toValue: screenHeight,
      duration: 200,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      router.push({ pathname: '/auth/login', params: { direction: 'fromTop' } } as any);
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

  const openTermsOfService = () => {
    // Functionality will be added later
    console.log('Terms of Service pressed');
  };

  const openPrivacyPolicy = () => {
    // Functionality will be added later
    console.log('Privacy Policy pressed');
  };

  const handleGenderSelect = (value: string) => {
    setGender(value);
    setShowGenderDropdown(false);
  };

  const getGenderLabel = () => {
    const selected = genderOptions.find(opt => opt.value === gender);
    return selected ? selected.label : 'Prefer not to say';
  };

  // Animate border colors on focus
  useEffect(() => {
    Animated.timing(firstnameBorderColor, {
      toValue: firstnameFocused ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [firstnameFocused]);

  useEffect(() => {
    Animated.timing(lastnameBorderColor, {
      toValue: lastnameFocused ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [lastnameFocused]);

  useEffect(() => {
    Animated.timing(emailBorderColor, {
      toValue: emailFocused ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [emailFocused]);

  useEffect(() => {
    Animated.timing(birthdateBorderColor, {
      toValue: birthdateFocused ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [birthdateFocused]);

  useEffect(() => {
    Animated.timing(passwordBorderColor, {
      toValue: passwordFocused ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [passwordFocused]);

  useEffect(() => {
    Animated.timing(confirmPasswordBorderColor, {
      toValue: confirmPasswordFocused ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [confirmPasswordFocused]);

  const firstnameBorderColorInterpolate = firstnameBorderColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.2)', 'rgba(255, 195, 11, 0.6)'],
  });

  const lastnameBorderColorInterpolate = lastnameBorderColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.2)', 'rgba(255, 195, 11, 0.6)'],
  });

  const emailBorderColorInterpolate = emailBorderColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.2)', 'rgba(255, 195, 11, 0.6)'],
  });

  const birthdateBorderColorInterpolate = birthdateBorderColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.2)', 'rgba(255, 195, 11, 0.6)'],
  });

  const passwordBorderColorInterpolate = passwordBorderColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.2)', 'rgba(255, 195, 11, 0.6)'],
  });

  const confirmPasswordBorderColorInterpolate = confirmPasswordBorderColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.2)', 'rgba(255, 195, 11, 0.6)'],
  });

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
            onScrollBeginDrag={() => setShowGenderDropdown(false)}
            scrollEventThrottle={16}
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
              Create Account
            </Text>

            <Text style={styles.subtitle}>
              Join the Wildcat Radio community
            </Text>

            {/* Google Sign Up Button */}
            <TouchableOpacity
              style={styles.googleButton}
              activeOpacity={0.8}
              onPress={() => {
                // Functionality will be added later
                console.log('Sign up with Google pressed');
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

            {/* Create Account Button */}
            <TouchableOpacity
              onPress={() => setShowSignupModal(true)}
              style={styles.createAccountButton}
              activeOpacity={0.8}
            >
              <Text style={styles.createAccountButtonText}>
                Create Account
              </Text>
            </TouchableOpacity>

            <View style={styles.loginLinkContainer}>
              <Text style={styles.loginLinkText}>
                Already have an account?{' '}
              </Text>
              <TouchableOpacity onPress={navigateToLogin}>
                <Text style={styles.loginLinkButton}>
                  Sign in
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Signup Modal */}
      <Modal
        visible={showSignupModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowSignupModal(false);
          setShowGenderDropdown(false);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Background gradients - same as main screen */}
          <View style={styles.modalBackgroundBase} />
          <LinearGradient
            colors={['rgba(15,23,42,0.95)', 'rgba(2,6,23,0.95)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.modalGradientOverlay1}
          />
          <LinearGradient
            colors={['rgba(127,29,29,0.35)', 'transparent']}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={styles.modalGradientMaroon1}
          />
          <LinearGradient
            colors={['rgba(251,191,36,0.18)', 'transparent']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.modalGradientYellow1}
          />
          <LinearGradient
            colors={['rgba(251,191,36,0.50)', 'rgba(127,29,29,0.45)', 'transparent']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.modalGradientBlur1}
          />
          <LinearGradient
            colors={['rgba(127,29,29,0.60)', 'rgba(225,29,72,0.45)', 'transparent']}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={styles.modalGradientBlur2}
          />

          <TouchableOpacity 
            onPress={() => {
              setShowSignupModal(false);
              setShowGenderDropdown(false);
            }}
            style={styles.modalCloseButton}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color="#94a3b8" />
          </TouchableOpacity>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKeyboardView}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              onScrollBeginDrag={() => setShowGenderDropdown(false)}
              scrollEventThrottle={16}
            >
              <View style={styles.modalContent}>
              <Text style={styles.modalContentTitle}>Create your account</Text>
              <Text style={styles.modalContentSubtitle}>Enter your details below to create your account</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.modalLabel}>First Name</Text>
                    <Animated.View style={[styles.modalInputWrapper, { borderColor: firstnameBorderColorInterpolate }]}>
                      <Ionicons name="person-outline" size={20} color={firstnameFocused ? "#FFC30B" : "#94a3b8"} style={styles.modalInputIcon} />
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Enter your first name"
                        placeholderTextColor="#64748b"
                        value={firstname}
                        onChangeText={setFirstname}
                        autoCapitalize="words"
                        autoCorrect={false}
                        onFocus={() => setFirstnameFocused(true)}
                        onBlur={() => setFirstnameFocused(false)}
                      />
                    </Animated.View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.modalLabel}>Last Name</Text>
                    <Animated.View style={[styles.modalInputWrapper, { borderColor: lastnameBorderColorInterpolate }]}>
                      <Ionicons name="person-outline" size={20} color={lastnameFocused ? "#FFC30B" : "#94a3b8"} style={styles.modalInputIcon} />
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Enter your last name"
                        placeholderTextColor="#64748b"
                        value={lastname}
                        onChangeText={setLastname}
                        autoCapitalize="words"
                        autoCorrect={false}
                        onFocus={() => setLastnameFocused(true)}
                        onBlur={() => setLastnameFocused(false)}
                      />
                    </Animated.View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.modalLabel}>Email Address</Text>
                    <Animated.View style={[styles.modalInputWrapper, { borderColor: emailBorderColorInterpolate }]}>
                      <Ionicons name="mail-outline" size={20} color={emailFocused ? "#FFC30B" : "#94a3b8"} style={styles.modalInputIcon} />
                      <TextInput
                        style={styles.modalInput}
                        placeholder="your.email@example.com"
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
                <Text style={styles.modalLabel}>Date of Birth</Text>
                    <Animated.View style={[styles.modalInputWrapper, { borderColor: birthdateBorderColorInterpolate }]}>
                      <Ionicons name="calendar-outline" size={20} color={birthdateFocused ? "#FFC30B" : "#94a3b8"} style={styles.modalInputIcon} />
                      <TextInput
                        style={styles.modalInput}
                        placeholder="mm/dd/yyyy"
                        placeholderTextColor="#64748b"
                        value={birthdate}
                        onChangeText={handleDateChange}
                        keyboardType="numeric"
                        maxLength={10}
                        autoCorrect={false}
                        onFocus={() => setBirthdateFocused(true)}
                        onBlur={() => setBirthdateFocused(false)}
                      />
                    </Animated.View>
                <Text style={styles.modalHelperText}>
                  Used for analytics and age-appropriate content
                </Text>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.modalLabel}>
                  Gender <Text style={styles.optionalText}>(optional)</Text>
                </Text>
                    <View style={styles.modalDropdownContainer}>
                      <TouchableOpacity
                        style={styles.modalDropdownButton}
                        onPress={() => setShowGenderDropdown(!showGenderDropdown)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.modalDropdownButtonText, !gender && styles.modalPlaceholderText]}>
                          {getGenderLabel()}
                        </Text>
                        <Ionicons
                          name={showGenderDropdown ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color="#94a3b8"
                        />
                      </TouchableOpacity>
                      {showGenderDropdown && (
                        <View style={styles.modalDropdownMenu}>
                          {genderOptions.map((option) => (
                            <TouchableOpacity
                              key={option.value}
                              style={[
                                styles.modalDropdownOption,
                                gender === option.value && styles.modalDropdownOptionSelected
                              ]}
                              onPress={() => handleGenderSelect(option.value)}
                              activeOpacity={0.7}
                            >
                              <Text style={[
                                styles.modalDropdownOptionText,
                                gender === option.value && styles.modalDropdownOptionTextSelected
                              ]}>
                                {option.label}
                              </Text>
                              {gender === option.value && (
                                <Ionicons name="checkmark" size={20} color="#FFC30B" />
                              )}
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                <Text style={styles.modalHelperText}>
                  Helps us improve demographics analytics
                </Text>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.modalLabel}>Password</Text>
                    <Animated.View style={[styles.modalInputWrapper, { borderColor: passwordBorderColorInterpolate }]}>
                      <Ionicons name="lock-closed-outline" size={20} color={passwordFocused ? "#FFC30B" : "#94a3b8"} style={styles.modalInputIcon} />
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Create a secure password"
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
                        style={styles.modalPasswordToggle}
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

              <View style={styles.inputContainer}>
                <Text style={styles.modalLabel}>Confirm Password</Text>
                    <Animated.View style={[styles.modalInputWrapper, { borderColor: confirmPasswordBorderColorInterpolate }]}>
                      <Ionicons name="lock-closed-outline" size={20} color={confirmPasswordFocused ? "#FFC30B" : "#94a3b8"} style={styles.modalInputIcon} />
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Confirm your password"
                        placeholderTextColor="#64748b"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        onFocus={() => setConfirmPasswordFocused(true)}
                        onBlur={() => setConfirmPasswordFocused(false)}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={styles.modalPasswordToggle}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color={confirmPasswordFocused ? "#FFC30B" : "#94a3b8"}
                        />
                      </TouchableOpacity>
                    </Animated.View>
              </View>

              {(error || authError) && (
                <View style={styles.modalErrorContainer}>
                  <Ionicons name="alert-circle" size={16} color="#ef4444" />
                  <Text style={styles.modalErrorText}>{error || authError}</Text>
                </View>
              )}

              <View style={styles.modalTermsContainer}>
                    <TouchableOpacity
                      onPress={() => setAgreedToTerms(!agreedToTerms)}
                      style={styles.modalCheckbox}
                    >
                      {agreedToTerms && (
                        <View style={styles.modalCheckboxInner} />
                      )}
                    </TouchableOpacity>
                    <View style={styles.modalTermsTextContainer}>
                      <Text style={styles.modalTermsText}>
                        By creating an account, you agree to our{' '}
                        <Text onPress={openTermsOfService} style={styles.modalTermsLink}>
                          Terms of Service
                        </Text>
                        {' '}and{' '}
                        <Text onPress={openPrivacyPolicy} style={styles.modalTermsLink}>
                          Privacy Policy
                        </Text>
                        .
                      </Text>
                    </View>
              </View>

              <TouchableOpacity
                    onPress={handleSignUp}
                    style={[styles.modalSignupButton, (!agreedToTerms || loading) && styles.modalSignupButtonDisabled]}
                    activeOpacity={0.8}
                    disabled={!agreedToTerms || loading}
                  >
                      {loading ? (
                        <ActivityIndicator color="#000000" />
                      ) : (
                        <Text style={styles.modalSignupButtonText}>
                          Create Account
                        </Text>
                      )}
                  </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
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
  input: {
    width: '100%',
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 16,
    color: '#e2e8f0', // slate-200
    fontSize: 16,
  },
  dropdownContainer: {
    width: '100%',
    position: 'relative',
    zIndex: 1000,
  },
  dropdownButton: {
    width: '100%',
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownButtonText: {
    color: '#e2e8f0', // slate-200
    fontSize: 16,
    flex: 1,
  },
  placeholderText: {
    color: '#94a3b8', // slate-400
  },
  dropdownArrow: {
    color: '#94a3b8', // slate-400
    fontSize: 12,
    marginLeft: 8,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: '#1e293b', // slate-800
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  dropdownOptionSelected: {
    backgroundColor: 'rgba(145, 64, 62, 0.2)', // cordovan with opacity
  },
  dropdownOptionText: {
    color: '#e2e8f0', // slate-200
    fontSize: 16,
  },
  dropdownOptionTextSelected: {
    color: '#FFC30B', // mikado_yellow
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: '#94a3b8', // slate-400
    marginTop: 4,
    paddingLeft: 4,
  },
  termsContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  termsTextContainer: {
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#94a3b8',
    borderRadius: 4,
    marginRight: 10,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxInner: {
    width: 10,
    height: 10,
    backgroundColor: '#91403E', // cordovan
    borderRadius: 2,
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    color: '#94a3b8', // slate-400
    lineHeight: 18,
  },
  termsLink: {
    fontSize: 12,
    fontWeight: '600',
    color: '#91403E', // cordovan
  },
  signupButton: {
    width: '100%',
    backgroundColor: '#FFC30B', // mikado_yellow
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  signupButtonDisabled: {
    opacity: 0.7,
  },
  signupButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: 14,
    color: '#94a3b8', // slate-400
  },
  loginLinkButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#91403E', // cordovan
  },
  createAccountButton: {
    width: '100%',
    backgroundColor: '#FFC30B',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  createAccountButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#020617', // slate-950
  },
  modalBackgroundBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#020617',
  },
  modalGradientOverlay1: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.7,
  },
  modalGradientMaroon1: {
    position: 'absolute',
    bottom: -height * 0.3,
    left: -width * 0.2,
    width: width * 0.8,
    height: height * 0.8,
    opacity: 0.7,
  },
  modalGradientYellow1: {
    position: 'absolute',
    top: -height * 0.2,
    right: -width * 0.15,
    width: width * 0.7,
    height: height * 0.7,
    opacity: 0.7,
  },
  modalGradientBlur1: {
    position: 'absolute',
    top: -height * 0.3,
    right: -width * 0.15,
    width: width * 1.2,
    height: height * 0.8,
    opacity: 0.8,
  },
  modalGradientBlur2: {
    position: 'absolute',
    bottom: -height * 0.4,
    left: -width * 0.2,
    width: width * 1.2,
    height: height * 1.0,
    opacity: 0.7,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  modalKeyboardView: {
    flex: 1,
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    paddingBottom: 40,
    paddingTop: 16,
    flexGrow: 1,
  },
  modalContent: {
    padding: 24,
  },
  modalContentTitle: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#e2e8f0', // slate-200
    textAlign: 'left',
    marginBottom: 8,
  },
  modalContentSubtitle: {
    fontSize: 16,
    color: '#94a3b8', // slate-400
    textAlign: 'left',
    marginBottom: 32,
  },
  modalCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)', // slate-800 with opacity
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  modalCardInner: {
    padding: 24,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8', // slate-400
    marginBottom: 8,
  },
  optionalText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#64748b', // slate-500
  },
  modalInputWrapper: {
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
  modalInputIcon: {
    marginLeft: 12,
    marginRight: 8,
  },
  modalInput: {
    flex: 1,
    height: 48,
    color: '#e2e8f0', // slate-200
    fontSize: 16,
    paddingRight: 8,
  },
  modalPasswordToggle: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  modalHelperText: {
    fontSize: 12,
    color: '#94a3b8', // slate-400
    marginTop: 4,
    paddingLeft: 4,
  },
  modalDropdownContainer: {
    width: '100%',
    position: 'relative',
    zIndex: 1000,
  },
  modalDropdownButton: {
    width: '100%',
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modalDropdownButtonText: {
    color: '#e2e8f0', // slate-200
    fontSize: 16,
    flex: 1,
  },
  modalPlaceholderText: {
    color: '#94a3b8', // slate-400
  },
  modalDropdownMenu: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: '#1e293b', // slate-800
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalDropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalDropdownOptionSelected: {
    backgroundColor: 'rgba(145, 64, 62, 0.2)', // cordovan with opacity
  },
  modalDropdownOptionText: {
    color: '#e2e8f0', // slate-200
    fontSize: 16,
  },
  modalDropdownOptionTextSelected: {
    color: '#FFC30B', // mikado_yellow
    fontWeight: '600',
  },
  modalTermsContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  modalTermsTextContainer: {
    flex: 1,
  },
  modalCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#94a3b8', // slate-400
    borderRadius: 4,
    marginRight: 10,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCheckboxInner: {
    width: 10,
    height: 10,
    backgroundColor: '#91403E', // cordovan
    borderRadius: 2,
  },
  modalTermsText: {
    flex: 1,
    fontSize: 12,
    color: '#94a3b8', // slate-400
    lineHeight: 18,
  },
  modalTermsLink: {
    fontSize: 12,
    fontWeight: '600',
    color: '#91403E', // cordovan
  },
  modalSignupButton: {
    width: '100%',
    backgroundColor: '#FFC30B',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSignupButtonDisabled: {
    opacity: 0.6,
  },
  modalSignupButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  modalErrorContainer: {
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
  modalErrorText: {
    flex: 1,
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500',
  },
});

export default SignupScreen;

