import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  Modal,
  StyleSheet,
  Switch,
  Animated,
  TextInput,
  Linking,
  Dimensions,
  Easing,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getMe,
  UserData,
  updateUserProfile,
  UpdateUserProfilePayload,
  changeUserPassword,
  ChangePasswordPayload,
  updateNotificationPreferences,
  NotificationPreferences,
} from '../../services/userService';

const { width, height } = Dimensions.get('window');

// Function to generate initials from user data
const getInitials = (user: UserData | null) => {
  if (!user) return 'LS';
  const firstInitial = user.firstname ? user.firstname.charAt(0) : '';
  const lastInitial = user.lastname ? user.lastname.charAt(0) : '';
  return `${firstInitial}${lastInitial}`.toUpperCase() || 'LS';
};

const ProfileScreen: React.FC = () => {
  const router = useRouter();
  const { currentUser, logout, loading: authLoading, isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showEditPersonalInfoModal, setShowEditPersonalInfoModal] = useState(false);
  
  // Settings modal states
  const [settingsTab, setSettingsTab] = useState<'personal' | 'security' | 'preferences'>('personal');
  const [isEditingPersonalInfo, setIsEditingPersonalInfo] = useState(false);
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [showGenderDropdown, setShowGenderDropdown] = useState(false);
  
  // Security states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  
  // Preferences states
  const [isUpdatingPreferences, setIsUpdatingPreferences] = useState(false);
  const [preferenceUpdateError, setPreferenceUpdateError] = useState<string | null>(null);
  const [preferenceUpdateSuccess, setPreferenceUpdateSuccess] = useState<string | null>(null);
  const [localPreferences, setLocalPreferences] = useState<NotificationPreferences>({
    notifyBroadcastStart: true,
    notifyBroadcastReminders: true,
    notifyNewSchedule: false,
    notifySystemUpdates: true,
  });
  
  // Profile dropdown state
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownAnimation = useRef(new Animated.Value(0)).current;
  
  // Help & Support dropdown state
  const [isHelpDropdownOpen, setIsHelpDropdownOpen] = useState(false);
  const helpDropdownAnimation = useRef(new Animated.Value(0)).current;
  const savedHelpDropdownState = useRef(false);
  
  // Settings dropdown state
  const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = useState(false);
  const settingsDropdownAnimation = useRef(new Animated.Value(0)).current;
  const savedSettingsDropdownState = useRef(false);
  
  // Privacy Policy and Contact modal states
  const [showPrivacyPolicyModal, setShowPrivacyPolicyModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  
  // Contact form states
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactStatus, setContactStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Input focus states for modals
  const [contactNameFocused, setContactNameFocused] = useState(false);
  const [contactEmailFocused, setContactEmailFocused] = useState(false);
  const [contactMessageFocused, setContactMessageFocused] = useState(false);
  const [currentPasswordFocused, setCurrentPasswordFocused] = useState(false);
  const [newPasswordFocused, setNewPasswordFocused] = useState(false);
  const [confirmNewPasswordFocused, setConfirmNewPasswordFocused] = useState(false);
  const [editFirstnameFocused, setEditFirstnameFocused] = useState(false);
  const [editLastnameFocused, setEditLastnameFocused] = useState(false);
  
  // Animated border colors for modal inputs
  const contactNameBorderColor = useRef(new Animated.Value(0)).current;
  const contactEmailBorderColor = useRef(new Animated.Value(0)).current;
  const contactMessageBorderColor = useRef(new Animated.Value(0)).current;
  const currentPasswordBorderColor = useRef(new Animated.Value(0)).current;
  const newPasswordBorderColor = useRef(new Animated.Value(0)).current;
  const confirmNewPasswordBorderColor = useRef(new Animated.Value(0)).current;
  const editFirstnameBorderColor = useRef(new Animated.Value(0)).current;
  const editLastnameBorderColor = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.timing(profileDropdownAnimation, {
      toValue: isProfileDropdownOpen ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isProfileDropdownOpen]);
  
  useEffect(() => {
    Animated.timing(helpDropdownAnimation, {
      toValue: isHelpDropdownOpen ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isHelpDropdownOpen]);
  
  useEffect(() => {
    Animated.timing(settingsDropdownAnimation, {
      toValue: isSettingsDropdownOpen ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isSettingsDropdownOpen]);
  
  const profileDropdownHeight = profileDropdownAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 350],
  });
  
  const profileDropdownOpacity = profileDropdownAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  
  const helpDropdownHeight = helpDropdownAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 120],
  });
  
  const helpDropdownOpacity = helpDropdownAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  
  const settingsDropdownHeight = settingsDropdownAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 120],
  });
  
  const settingsDropdownOpacity = settingsDropdownAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  
  const isValidEmail = (value: string) => /[^@\s]+@[^@\s]+\.[^@\s]+/.test(value);
  
  // Animate border colors on focus for modal inputs
  useEffect(() => {
    Animated.timing(contactNameBorderColor, {
      toValue: contactNameFocused ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [contactNameFocused]);
  
  useEffect(() => {
    Animated.timing(contactEmailBorderColor, {
      toValue: contactEmailFocused ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [contactEmailFocused]);
  
  useEffect(() => {
    Animated.timing(contactMessageBorderColor, {
      toValue: contactMessageFocused ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [contactMessageFocused]);
  
  useEffect(() => {
    Animated.timing(currentPasswordBorderColor, {
      toValue: currentPasswordFocused ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [currentPasswordFocused]);
  
  useEffect(() => {
    Animated.timing(newPasswordBorderColor, {
      toValue: newPasswordFocused ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [newPasswordFocused]);
  
  useEffect(() => {
    Animated.timing(confirmNewPasswordBorderColor, {
      toValue: confirmNewPasswordFocused ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [confirmNewPasswordFocused]);
  
  useEffect(() => {
    Animated.timing(editFirstnameBorderColor, {
      toValue: editFirstnameFocused ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [editFirstnameFocused]);
  
  useEffect(() => {
    Animated.timing(editLastnameBorderColor, {
      toValue: editLastnameFocused ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [editLastnameFocused]);
  
  // Border color interpolations
  const contactNameBorderColorInterpolate = contactNameBorderColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.2)', 'rgba(255, 195, 11, 0.6)'],
  });
  
  const contactEmailBorderColorInterpolate = contactEmailBorderColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.2)', 'rgba(255, 195, 11, 0.6)'],
  });
  
  const contactMessageBorderColorInterpolate = contactMessageBorderColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.2)', 'rgba(255, 195, 11, 0.6)'],
  });
  
  const currentPasswordBorderColorInterpolate = currentPasswordBorderColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.2)', 'rgba(255, 195, 11, 0.6)'],
  });
  
  const newPasswordBorderColorInterpolate = newPasswordBorderColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.2)', 'rgba(255, 195, 11, 0.6)'],
  });
  
  const confirmNewPasswordBorderColorInterpolate = confirmNewPasswordBorderColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.2)', 'rgba(255, 195, 11, 0.6)'],
  });
  
  const editFirstnameBorderColorInterpolate = editFirstnameBorderColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.2)', 'rgba(255, 195, 11, 0.6)'],
  });
  
  const editLastnameBorderColorInterpolate = editLastnameBorderColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.2)', 'rgba(255, 195, 11, 0.6)'],
  });
  
  const handleContactSubmit = async () => {
    if (!contactName.trim() || !isValidEmail(contactEmail) || !contactMessage.trim()) {
      setContactStatus({ type: 'error', text: 'Please fill out all fields with a valid email.' });
      return;
    }
    
    const mailToAddress = 'wildcatsradio@example.edu';
    const subject = encodeURIComponent(`[WildCats Radio] Message from ${contactName}`);
    const body = encodeURIComponent(`Name: ${contactName}\nEmail: ${contactEmail}\n\n${contactMessage}`);
    
    const mailtoLink = `mailto:${mailToAddress}?subject=${subject}&body=${body}`;
    try {
      const canOpen = await Linking.canOpenURL(mailtoLink);
      if (canOpen) {
        await Linking.openURL(mailtoLink);
        setContactStatus({ type: 'success', text: 'Your email client should open. If not, email us directly.' });
      } else {
        setContactStatus({ type: 'error', text: 'Unable to open email client. Please email us directly.' });
      }
    } catch (error) {
      setContactStatus({ type: 'error', text: 'Unable to open email client. Please email us directly.' });
    }
    
    setTimeout(() => {
      setContactName('');
      setContactEmail('');
      setContactMessage('');
      setContactStatus(null);
    }, 5000);
  };
  
  const fetchUserData = async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      setError(null);
      const data = await getMe();
      if (data.error) {
        setError(data.error);
        setUserData(null);
      } else {
        setUserData(data);
        setFirstname(data.firstname || '');
        setLastname(data.lastname || '');
        setEmail(data.email || '');
        setGender(data.gender || '');
      }
    } catch (apiError: any) {
      setError(apiError.message || 'An unexpected error occurred.');
      setUserData(null);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (isAuthenticated) {
      fetchUserData();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated]);
  
  // Sync local preferences with userData preferences
  useEffect(() => {
    if (userData) {
      setLocalPreferences({
        notifyBroadcastStart: userData.notifyBroadcastStart ?? true,
        notifyBroadcastReminders: userData.notifyBroadcastReminders ?? true,
        notifyNewSchedule: userData.notifyNewSchedule ?? false,
        notifySystemUpdates: userData.notifySystemUpdates ?? true,
      });
    }
  }, [userData]);
  
  // Restore Help & Support dropdown state when modals close
  useEffect(() => {
    if (!showPrivacyPolicyModal && !showContactModal) {
      helpDropdownAnimation.setValue(savedHelpDropdownState.current ? 1 : 0);
      setIsHelpDropdownOpen(savedHelpDropdownState.current);
    }
  }, [showPrivacyPolicyModal, showContactModal, helpDropdownAnimation]);
  
  // Restore Settings dropdown state when modals close
  useEffect(() => {
    if (!showPrivacyModal && !showSettingsModal) {
      settingsDropdownAnimation.setValue(savedSettingsDropdownState.current ? 1 : 0);
      setIsSettingsDropdownOpen(savedSettingsDropdownState.current);
    }
  }, [showPrivacyModal, showSettingsModal, settingsDropdownAnimation]);
  
  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/welcome' as any);
            } catch {
              Alert.alert('Logout Failed', 'Could not log out. Please try again.');
            }
          },
        },
      ]
    );
  };
  
  const handleUpdateProfile = async () => {
    if (!userData?.id) return;
    setIsUpdatingProfile(true);
    setError(null);
    
    const payload: UpdateUserProfilePayload = { 
      firstname: firstname.trim(),
      lastname: lastname.trim(),
      gender: gender || null
    };
    
    const response = await updateUserProfile(userData.id, payload);
    setIsUpdatingProfile(false);
    if (response.error) {
      Alert.alert('Update Failed', response.error);
      setError(response.error); 
    } else {
      Alert.alert('Success', response.message || 'Profile updated successfully!');
      setShowEditPersonalInfoModal(false);
      fetchUserData(false); 
    }
  };
  
  const handleChangePassword = async () => {
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (!newPassword || !currentPassword) {
      setPasswordError('All password fields are required.');
      return;
    }
    if (!userData?.id) return;
    
    setPasswordError(null);
    setError(null);
    setIsChangingPassword(true);
    const payload: ChangePasswordPayload = { currentPassword, newPassword };
    const response = await changeUserPassword(userData.id, payload);
    setIsChangingPassword(false);
    if (response.error) {
      Alert.alert('Password Change Failed', response.error);
      setPasswordError(response.error); 
    } else {
      Alert.alert('Success', response.message || 'Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    }
  };
  
  const handlePreferenceToggle = (preferenceKey: keyof NotificationPreferences) => {
    setLocalPreferences(prev => ({
      ...prev,
      [preferenceKey]: !prev[preferenceKey],
    }));
    setPreferenceUpdateError(null);
    setPreferenceUpdateSuccess(null);
  };
  
  const handlePreferencesSubmit = async () => {
    if (!userData || isUpdatingPreferences) return;
    
    setIsUpdatingPreferences(true);
    setPreferenceUpdateError(null);
    setPreferenceUpdateSuccess(null);
    
    try {
      const result = await updateNotificationPreferences(localPreferences);
      
      if ('error' in result) {
        setPreferenceUpdateError(result.error || 'Failed to update preferences');
      } else {
        setUserData(result);
        setPreferenceUpdateSuccess('Notification preferences updated successfully!');
        setTimeout(() => {
          setPreferenceUpdateSuccess(null);
        }, 3000);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update notification preferences. Please try again.';
      setPreferenceUpdateError(errorMessage);
    } finally {
      setIsUpdatingPreferences(false);
    }
  };
  
  if (isLoading && !userData && isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.backgroundBase} />
        <LinearGradient colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.gradientOverlay1} />
        <LinearGradient colors={['rgba(127,29,29,0.3)', 'transparent']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.gradientMaroon1} />
        <LinearGradient colors={['rgba(251,191,36,0.18)', 'transparent']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={styles.gradientYellow1} />
        <LinearGradient colors={['rgba(251,191,36,0.4)', 'rgba(127,29,29,0.3)', 'transparent']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={styles.gradientBlur1} />
        <LinearGradient colors={['rgba(127,29,29,0.3)', 'rgba(225,29,72,0.2)', 'transparent']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.gradientBlur2} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFC30B" />
        </View>
      </SafeAreaView>
    );
  }
  
  if (error && !userData && isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.backgroundBase} />
        <LinearGradient colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.gradientOverlay1} />
        <LinearGradient colors={['rgba(127,29,29,0.3)', 'transparent']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.gradientMaroon1} />
        <LinearGradient colors={['rgba(251,191,36,0.18)', 'transparent']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={styles.gradientYellow1} />
        <LinearGradient colors={['rgba(251,191,36,0.4)', 'rgba(127,29,29,0.3)', 'transparent']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={styles.gradientBlur1} />
        <LinearGradient colors={['rgba(127,29,29,0.3)', 'rgba(225,29,72,0.2)', 'transparent']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.gradientBlur2} />
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={64} color="#91403E" />
          <Text style={styles.errorTitle}>Unable to Load Profile</Text>
          <Text style={styles.errorContainerText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchUserData()}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={handleLogout}>
            <Text style={styles.backButtonText}>Go Back to Welcome</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  const displayName = `${firstname} ${lastname}`.trim().toLowerCase() || 'listener student';
  const roleDisplay = (userData?.role || 'LISTENER').toUpperCase();
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Background gradients */}
      <View style={styles.backgroundBase} />
      <LinearGradient colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.gradientOverlay1} />
      <LinearGradient colors={['rgba(127,29,29,0.3)', 'transparent']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.gradientMaroon1} />
      <LinearGradient colors={['rgba(251,191,36,0.18)', 'transparent']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={styles.gradientYellow1} />
      <LinearGradient colors={['rgba(251,191,36,0.4)', 'rgba(127,29,29,0.3)', 'transparent']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={styles.gradientBlur1} />
      <LinearGradient colors={['rgba(127,29,29,0.3)', 'rgba(225,29,72,0.2)', 'transparent']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.gradientBlur2} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Menu Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Menu</Text>
        </View>

        {/* User Profile Section with Dropdown */}
        {isAuthenticated && userData ? (
          <View style={styles.profileCard}>
            <TouchableOpacity 
              style={styles.profileHeader}
              activeOpacity={0.7}
              onPress={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
            >
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>{getInitials(userData)}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{displayName}</Text>
                <Text style={styles.profileRole}>{roleDisplay}</Text>
              </View>
              <Animated.View
                style={{
                  transform: [{ rotate: profileDropdownAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '180deg'],
                  }) }],
                }}
              >
                <Ionicons name="chevron-down-outline" size={24} color="#91403E" />
              </Animated.View>
            </TouchableOpacity>
            
            {/* Dropdown Content - Personal Information */}
            <Animated.View
              style={{
                maxHeight: profileDropdownHeight,
                opacity: profileDropdownOpacity,
                overflow: 'hidden',
              }}
            >
              <View style={styles.dropdownContent}>
                <View style={styles.personalInfoHeader}>
                  <Text style={styles.personalInfoTitle}>Personal Information</Text>
                  <TouchableOpacity
                    onPress={() => setShowEditPersonalInfoModal(true)}
                    style={styles.editButton}
                  >
                    <Ionicons name="create-outline" size={28} color="#91403E" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.infoSection}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>FULL NAME</Text>
                    <Text style={styles.infoValue}>{`${firstname} ${lastname}`.trim() || 'N/A'}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>EMAIL</Text>
                    <Text style={styles.infoValue}>{email || 'N/A'}</Text>
                  </View>
                  {gender && (
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>GENDER</Text>
                      <Text style={styles.infoValue}>
                        {gender === 'MALE' ? 'Male' : gender === 'FEMALE' ? 'Female' : gender === 'OTHER' ? 'Other' : gender}
                      </Text>
                    </View>
                  )}
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>ROLE</Text>
                    <Text style={styles.infoValue}>{userData?.role || 'N/A'}</Text>
                  </View>
                </View>
                
                {/* Logo at bottom right */}
                <Image
                  source={require('../../assets/images/wildcat_radio_logo_transparent.png')}
                  style={styles.dropdownLogo}
                  resizeMode="contain"
                />
              </View>
            </Animated.View>
          </View>
        ) : (
          <View style={styles.authButtonsContainer}>
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => router.push('/auth/login' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.loginButtonText}>Log in</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.signupButton}
              onPress={() => router.push('/auth/signup' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.signupButtonText}>Sign up</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Menu Buttons */}
        <View style={styles.menuContainer}>
          {/* Help & Support Dropdown */}
          <View style={styles.menuCard}>
            <TouchableOpacity
              onPress={() => setIsHelpDropdownOpen(!isHelpDropdownOpen)}
              style={styles.menuHeader}
              activeOpacity={0.8}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="help-circle-outline" size={24} color="#91403E" />
              </View>
              <Text style={styles.menuTitle}>Help & Support</Text>
              <Animated.View
                style={{
                  transform: [{ rotate: helpDropdownAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '180deg'],
                  }) }],
                }}
              >
                <Ionicons name="chevron-down-outline" size={20} color="#91403E" />
              </Animated.View>
            </TouchableOpacity>
            
            {/* Dropdown Content - Sub-menus */}
            <Animated.View
              style={{
                maxHeight: helpDropdownHeight,
                opacity: helpDropdownOpacity,
                overflow: 'hidden',
              }}
            >
              <View style={styles.dropdownMenu}>
                <View style={styles.dropdownDivider} />
                <TouchableOpacity
                  onPress={() => {
                    savedHelpDropdownState.current = isHelpDropdownOpen;
                    setShowPrivacyPolicyModal(true);
                    setIsHelpDropdownOpen(false);
                  }}
                  style={styles.dropdownItem}
                  activeOpacity={0.7}
                >
                  <Ionicons name="document-text-outline" size={20} color="#91403E" />
                  <Text style={styles.dropdownItemText}>Privacy Policy</Text>
                </TouchableOpacity>
                <View style={styles.dropdownDivider} />
                <TouchableOpacity
                  onPress={() => {
                    savedHelpDropdownState.current = isHelpDropdownOpen;
                    setShowContactModal(true);
                    setIsHelpDropdownOpen(false);
                  }}
                  style={styles.dropdownItem}
                  activeOpacity={0.7}
                >
                  <Ionicons name="mail-outline" size={20} color="#91403E" />
                  <Text style={styles.dropdownItemText}>Contact</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>

          {/* Settings Dropdown */}
          <View style={styles.menuCard}>
            <TouchableOpacity
              onPress={() => setIsSettingsDropdownOpen(!isSettingsDropdownOpen)}
              style={styles.menuHeader}
              activeOpacity={0.8}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="settings-outline" size={24} color="#91403E" />
              </View>
              <Text style={styles.menuTitle}>Settings</Text>
              <Animated.View
                style={{
                  transform: [{ rotate: settingsDropdownAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '180deg'],
                  }) }],
                }}
              >
                <Ionicons name="chevron-down-outline" size={20} color="#91403E" />
              </Animated.View>
            </TouchableOpacity>
            
            {/* Dropdown Content - Sub-menus */}
            <Animated.View
              style={{
                maxHeight: settingsDropdownHeight,
                opacity: settingsDropdownOpacity,
                overflow: 'hidden',
              }}
            >
              <View style={styles.dropdownMenu}>
                <View style={styles.dropdownDivider} />
                <TouchableOpacity
                  onPress={() => {
                    savedSettingsDropdownState.current = isSettingsDropdownOpen;
                    setShowPrivacyModal(true);
                    setIsSettingsDropdownOpen(false);
                  }}
                  style={styles.dropdownItem}
                  activeOpacity={0.7}
                >
                  <Ionicons name="lock-closed-outline" size={20} color="#91403E" />
                  <Text style={styles.dropdownItemText}>Security</Text>
                </TouchableOpacity>
                <View style={styles.dropdownDivider} />
                <TouchableOpacity
                  onPress={() => {
                    savedSettingsDropdownState.current = isSettingsDropdownOpen;
                    setSettingsTab('preferences');
                    setShowSettingsModal(true);
                    setIsSettingsDropdownOpen(false);
                  }}
                  style={styles.dropdownItem}
                  activeOpacity={0.7}
                >
                  <Ionicons name="notifications-outline" size={20} color="#91403E" />
                  <Text style={styles.dropdownItemText}>Preferences</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </View>
        
        {/* Log out Button */}
        {isAuthenticated && (
          <View style={styles.logoutContainer}>
            <TouchableOpacity
              onPress={handleLogout}
              style={styles.logoutButton}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out-outline" size={22} color="#EF4444" />
              <Text style={styles.logoutButtonText}>Log out</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Settings Modal - Preferences */}
      <Modal
        visible={showSettingsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Background gradients - same as signup modal */}
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
            onPress={() => setShowSettingsModal(false)}
            style={styles.modalCloseButton}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color="#94a3b8" />
          </TouchableOpacity>

          <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalCard}>
              <Text style={styles.modalSectionTitle}>Notification Preferences</Text>
              <Text style={styles.modalContentSubtitle}>Manage your notification settings</Text>
              
              {preferenceUpdateSuccess && (
                <View style={styles.successMessage}>
                  <Text style={styles.successText}>{preferenceUpdateSuccess}</Text>
                </View>
              )}
              
              {preferenceUpdateError && (
                <View style={styles.errorMessage}>
                  <Text style={styles.errorText}>{preferenceUpdateError}</Text>
                </View>
              )}
              
              <View style={styles.preferenceList}>
                <View style={styles.preferenceItem}>
                  <View style={styles.preferenceInfo}>
                    <Text style={styles.preferenceTitle}>Broadcast Start</Text>
                    <Text style={styles.preferenceDescription}>Get notified when broadcasts begin</Text>
                  </View>
                  <Switch
                    value={localPreferences.notifyBroadcastStart}
                    onValueChange={() => handlePreferenceToggle('notifyBroadcastStart')}
                    disabled={isUpdatingPreferences}
                    trackColor={{ false: '#374151', true: '#91403E' }}
                    thumbColor={localPreferences.notifyBroadcastStart ? '#FFFFFF' : '#9CA3AF'}
                  />
                </View>
                
                <View style={styles.preferenceDivider} />
                
                <View style={styles.preferenceItem}>
                  <View style={styles.preferenceInfo}>
                    <Text style={styles.preferenceTitle}>Broadcast Reminders</Text>
                    <Text style={styles.preferenceDescription}>Get notified before broadcasts start</Text>
                  </View>
                  <Switch
                    value={localPreferences.notifyBroadcastReminders}
                    onValueChange={() => handlePreferenceToggle('notifyBroadcastReminders')}
                    disabled={isUpdatingPreferences}
                    trackColor={{ false: '#374151', true: '#91403E' }}
                    thumbColor={localPreferences.notifyBroadcastReminders ? '#FFFFFF' : '#9CA3AF'}
                  />
                </View>
                
                <View style={styles.preferenceDivider} />
                
                <View style={styles.preferenceItem}>
                  <View style={styles.preferenceInfo}>
                    <Text style={styles.preferenceTitle}>New Schedule</Text>
                    <Text style={styles.preferenceDescription}>Get notified about new broadcast schedules</Text>
                  </View>
                  <Switch
                    value={localPreferences.notifyNewSchedule}
                    onValueChange={() => handlePreferenceToggle('notifyNewSchedule')}
                    disabled={isUpdatingPreferences}
                    trackColor={{ false: '#374151', true: '#91403E' }}
                    thumbColor={localPreferences.notifyNewSchedule ? '#FFFFFF' : '#9CA3AF'}
                  />
                </View>
                
                <View style={styles.preferenceDivider} />
                
                <View style={styles.preferenceItem}>
                  <View style={styles.preferenceInfo}>
                    <Text style={styles.preferenceTitle}>System Updates</Text>
                    <Text style={styles.preferenceDescription}>Get notified about system announcements</Text>
                  </View>
                  <Switch
                    value={localPreferences.notifySystemUpdates}
                    onValueChange={() => handlePreferenceToggle('notifySystemUpdates')}
                    disabled={isUpdatingPreferences}
                    trackColor={{ false: '#374151', true: '#91403E' }}
                    thumbColor={localPreferences.notifySystemUpdates ? '#FFFFFF' : '#9CA3AF'}
                  />
                </View>
              </View>
              
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity
                  onPress={handlePreferencesSubmit}
                  disabled={isUpdatingPreferences}
                  style={[styles.modalButton, isUpdatingPreferences && styles.modalButtonDisabled]}
                  activeOpacity={0.8}
                >
                  {isUpdatingPreferences && <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />}
                  <Text style={styles.modalButtonText}>
                    {isUpdatingPreferences ? 'Saving...' : 'Save Preferences'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Privacy Policy Modal */}
      <Modal
        visible={showPrivacyPolicyModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPrivacyPolicyModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Background gradients - same as signup modal */}
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
            onPress={() => setShowPrivacyPolicyModal(false)}
            style={styles.modalCloseButton}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color="#94a3b8" />
          </TouchableOpacity>

          <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalCard}>
              <Text style={styles.modalSectionTitle}>Privacy Policy</Text>
              <Text style={styles.modalBodyText}>
                This policy explains what information WildCats Radio collects, how we use and share it,
                and the choices you have. We aim to collect only what we need to deliver a reliable,
                secure, and enjoyable listening and broadcasting experience.
              </Text>
              <Text style={styles.modalSubtitle}>Information We Collect</Text>
              <View style={styles.modalBodySection}>
                <Text style={styles.modalBodyText}>
                  <Text style={styles.modalBoldText}>Account Information</Text> (if you register): name, email address,
                  role (e.g., listener, DJ, moderator, admin), and profile preferences you provide.
                </Text>
                <Text style={styles.modalBodyText}>
                  <Text style={styles.modalBoldText}>Usage Data</Text>: interactions with the app (pages viewed, features used),
                  timestamps, approximate region/country derived from IP, and device/browser type.
                </Text>
                <Text style={styles.modalBodyText}>
                  <Text style={styles.modalBoldText}>Streaming & Broadcast Data</Text>: active broadcast metadata (title, DJ/host,
                  description), listener counts, and current track metadata submitted by DJs or fetched
                  from integrated services.
                </Text>
                <Text style={styles.modalBodyText}>
                  <Text style={styles.modalBoldText}>Technical Logs</Text>: diagnostic logs and error reports to keep services
                  reliable and secure.
                </Text>
                <Text style={styles.modalBodyText}>
                  <Text style={styles.modalBoldText}>Cookies & Local Storage</Text>: used for session management, theme
                  preferences, and performance.
                </Text>
              </View>
              <Text style={styles.modalSubtitle}>How We Use Information</Text>
              <View style={styles.modalBodySection}>
                <Text style={styles.modalBodyText}>• Operate core features like streaming, schedules, notifications, and moderation.</Text>
                <Text style={styles.modalBodyText}>• Maintain security, fraud prevention, and service integrity.</Text>
                <Text style={styles.modalBodyText}>• Understand service performance and improve reliability and usability.</Text>
                <Text style={styles.modalBodyText}>• Comply with legal obligations and institutional policies.</Text>
              </View>
              <Text style={styles.modalSubtitle}>Cookies and Similar Technologies</Text>
              <Text style={styles.modalBodyText}>
                We use strictly necessary cookies for authentication (when logged in), CSRF protection,
                and user preferences (e.g., dark mode). Analytics cookies may be used to measure traffic
                and usage. You can control cookies via your browser settings; disabling some may limit
                functionality.
              </Text>
              <Text style={styles.modalSubtitle}>Analytics</Text>
              <Text style={styles.modalBodyText}>
                We may collect aggregate metrics such as visitor counts, popular pages, and playback
                stability to improve the experience. Analytics are used in de-identified or aggregated
                form whenever feasible.
              </Text>
              <Text style={styles.modalSubtitle}>When We Share Information</Text>
              <View style={styles.modalBodySection}>
                <Text style={styles.modalBodyText}>• Service providers that help us operate the platform (hosting, storage, monitoring).</Text>
                <Text style={styles.modalBodyText}>• School or institutional administrators for compliance and safety purposes.</Text>
                <Text style={styles.modalBodyText}>• Legal or safety requirements (e.g., court orders, preventing harm or abuse).</Text>
                <Text style={styles.modalBodyText}>• With your consent or at your direction.</Text>
              </View>
              <Text style={styles.modalSubtitle}>Your Choices & Rights</Text>
              <View style={styles.modalBodySection}>
                <Text style={styles.modalBodyText}>• Access, update, or delete your account information from your profile when logged in.</Text>
                <Text style={styles.modalBodyText}>• Request a copy or deletion of your data (subject to legal and operational limits).</Text>
                <Text style={styles.modalBodyText}>• Opt out of non-essential communications where applicable.</Text>
              </View>
              <Text style={styles.modalSubtitle}>Data Retention</Text>
              <Text style={styles.modalBodyText}>
                We retain personal information only as long as necessary for the purposes described
                above, to comply with legal obligations, resolve disputes, and enforce agreements.
                Broadcast metadata and aggregate analytics may be retained for historical and
                reporting purposes.
              </Text>
              <Text style={styles.modalSubtitle}>Security</Text>
              <Text style={styles.modalBodyText}>
                We use reasonable administrative, technical, and organizational safeguards to protect
                information. No method of transmission or storage is 100% secure, but we continuously
                improve protections.
              </Text>
              <Text style={styles.modalSubtitle}>Children's Privacy</Text>
              <Text style={styles.modalBodyText}>
                Our services are intended for general audiences. If we learn we have collected
                personal information from a child without appropriate consent, we will take steps to
                delete it.
              </Text>
              <Text style={styles.modalSubtitle}>Changes to This Policy</Text>
              <Text style={styles.modalBodyText}>
                We may update this policy to reflect improvements or legal changes. We will post
                updates here and revise the "Last updated" date below.
              </Text>
              <Text style={styles.modalFooterText}>
                Last updated: {new Date().toLocaleDateString()}
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Contact Modal */}
      <Modal
        visible={showContactModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowContactModal(false);
          setContactStatus(null);
          setContactName('');
          setContactEmail('');
          setContactMessage('');
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Background gradients - same as signup modal */}
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
              setShowContactModal(false);
              setContactStatus(null);
              setContactName('');
              setContactEmail('');
              setContactMessage('');
            }}
            style={styles.modalCloseButton}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color="#94a3b8" />
          </TouchableOpacity>

          <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <Text style={styles.modalSectionTitle}>Contact</Text>
              <Text style={styles.modalContentSubtitle}>
                Have questions or feedback? Reach out below.
              </Text>
              
              <View style={styles.contactEmailBox}>
                <Text style={styles.contactEmailText}>
                  Email: <Text style={styles.contactEmailLink}>wildcatsradio@example.edu</Text>
                </Text>
              </View>
              
              {contactStatus && (
                <View style={contactStatus.type === 'success' ? styles.successMessage : styles.errorMessage}>
                  <Text style={contactStatus.type === 'success' ? styles.successText : styles.errorText}>
                    {contactStatus.text}
                  </Text>
                </View>
              )}
              
              <View style={styles.contactForm}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Name</Text>
                  <Animated.View style={[styles.modalInputWrapper, { borderColor: contactNameBorderColorInterpolate }]}>
                    <Ionicons name="person-outline" size={20} color={contactNameFocused ? "#FFC30B" : "#94a3b8"} style={styles.modalInputIcon} />
                    <TextInput
                      value={contactName}
                      onChangeText={setContactName}
                      placeholder="Your name"
                      placeholderTextColor="#64748b"
                      style={styles.modalInput}
                      onFocus={() => setContactNameFocused(true)}
                      onBlur={() => setContactNameFocused(false)}
                      autoCapitalize="words"
                    />
                  </Animated.View>
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <Animated.View style={[styles.modalInputWrapper, { borderColor: contactEmailBorderColorInterpolate }]}>
                    <Ionicons name="mail-outline" size={20} color={contactEmailFocused ? "#FFC30B" : "#94a3b8"} style={styles.modalInputIcon} />
                    <TextInput
                      value={contactEmail}
                      onChangeText={setContactEmail}
                      placeholder="you@example.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholderTextColor="#64748b"
                      style={styles.modalInput}
                      onFocus={() => setContactEmailFocused(true)}
                      onBlur={() => setContactEmailFocused(false)}
                    />
                  </Animated.View>
                  {contactEmail && !isValidEmail(contactEmail) && (
                    <Text style={styles.inputErrorText}>Enter a valid email.</Text>
                  )}
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Message</Text>
                  <Animated.View style={[styles.modalInputWrapper, styles.modalInputWrapperMultiline, { borderColor: contactMessageBorderColorInterpolate }]}>
                    <Ionicons name="chatbubble-outline" size={20} color={contactMessageFocused ? "#FFC30B" : "#94a3b8"} style={styles.modalInputIcon} />
                    <TextInput
                      value={contactMessage}
                      onChangeText={setContactMessage}
                      placeholder="How can we help?"
                      multiline
                      numberOfLines={5}
                      placeholderTextColor="#64748b"
                      style={[styles.modalInput, styles.modalInputMultiline]}
                      textAlignVertical="top"
                      onFocus={() => setContactMessageFocused(true)}
                      onBlur={() => setContactMessageFocused(false)}
                    />
                  </Animated.View>
                </View>
                
                <TouchableOpacity
                  onPress={handleContactSubmit}
                  style={styles.contactSubmitButton}
                  activeOpacity={0.8}
                >
                  <Ionicons name="send-outline" size={20} color="white" />
                  <Text style={styles.contactSubmitButtonText}>Send</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Security Modal - Change Password */}
      <Modal
        visible={showPrivacyModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPrivacyModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Background gradients - same as signup modal */}
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
            onPress={() => setShowPrivacyModal(false)}
            style={styles.modalCloseButton}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color="#94a3b8" />
          </TouchableOpacity>

          <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <Text style={styles.modalSectionTitle}>Change Password</Text>
              <Text style={styles.modalContentSubtitle}>Update your account password</Text>
              {passwordError && (
                <View style={styles.errorMessage}>
                  <Text style={styles.errorText}>{passwordError}</Text>
                </View>
              )}
              <View style={styles.contactForm}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Current Password</Text>
                  <Animated.View style={[styles.modalInputWrapper, { borderColor: currentPasswordBorderColorInterpolate }]}>
                    <Ionicons name="lock-closed-outline" size={20} color={currentPasswordFocused ? "#FFC30B" : "#94a3b8"} style={styles.modalInputIcon} />
                    <TextInput
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      secureTextEntry
                      editable={!isChangingPassword}
                      placeholder="Enter current password"
                      placeholderTextColor="#64748b"
                      style={styles.modalInput}
                      onFocus={() => setCurrentPasswordFocused(true)}
                      onBlur={() => setCurrentPasswordFocused(false)}
                    />
                  </Animated.View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>New Password</Text>
                  <Animated.View style={[styles.modalInputWrapper, { borderColor: newPasswordBorderColorInterpolate }]}>
                    <Ionicons name="lock-closed-outline" size={20} color={newPasswordFocused ? "#FFC30B" : "#94a3b8"} style={styles.modalInputIcon} />
                    <TextInput
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry
                      editable={!isChangingPassword}
                      placeholder="Enter new password"
                      placeholderTextColor="#64748b"
                      style={styles.modalInput}
                      onFocus={() => setNewPasswordFocused(true)}
                      onBlur={() => setNewPasswordFocused(false)}
                    />
                  </Animated.View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Confirm New Password</Text>
                  <Animated.View style={[styles.modalInputWrapper, { borderColor: confirmNewPasswordBorderColorInterpolate }]}>
                    <Ionicons name="lock-closed-outline" size={20} color={confirmNewPasswordFocused ? "#FFC30B" : "#94a3b8"} style={styles.modalInputIcon} />
                    <TextInput
                      value={confirmNewPassword}
                      onChangeText={setConfirmNewPassword}
                      secureTextEntry
                      editable={!isChangingPassword}
                      placeholder="Confirm new password"
                      placeholderTextColor="#64748b"
                      style={styles.modalInput}
                      onFocus={() => setConfirmNewPasswordFocused(true)}
                      onBlur={() => setConfirmNewPasswordFocused(false)}
                    />
                  </Animated.View>
                </View>
              </View>
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity
                  onPress={handleChangePassword}
                  disabled={isChangingPassword}
                  style={[styles.modalButton, isChangingPassword && styles.modalButtonDisabled]}
                  activeOpacity={0.8}
                >
                  {isChangingPassword && <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />}
                  <Text style={styles.modalButtonText}>Update Password</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Edit Personal Information Modal */}
      <Modal
        visible={showEditPersonalInfoModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowEditPersonalInfoModal(false);
          setShowGenderDropdown(false);
          setFirstname(userData?.firstname || '');
          setLastname(userData?.lastname || '');
          setGender(userData?.gender || '');
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Background gradients - same as signup modal */}
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
              setShowEditPersonalInfoModal(false);
              setShowGenderDropdown(false);
              setFirstname(userData?.firstname || '');
              setLastname(userData?.lastname || '');
              setGender(userData?.gender || '');
            }}
            style={styles.modalCloseButton}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color="#94a3b8" />
          </TouchableOpacity>

          <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <Text style={styles.modalSectionTitle}>Edit Personal Information</Text>
              <Text style={styles.modalContentSubtitle}>Update your personal details</Text>
              <View style={styles.contactForm}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>First Name</Text>
                  <Animated.View style={[styles.modalInputWrapper, { borderColor: editFirstnameBorderColorInterpolate }]}>
                    <Ionicons name="person-outline" size={20} color={editFirstnameFocused ? "#FFC30B" : "#94a3b8"} style={styles.modalInputIcon} />
                    <TextInput
                      value={firstname}
                      onChangeText={setFirstname}
                      editable={!isUpdatingProfile}
                      autoCapitalize="words"
                      placeholder="Enter your first name"
                      placeholderTextColor="#64748b"
                      style={styles.modalInput}
                      onFocus={() => setEditFirstnameFocused(true)}
                      onBlur={() => setEditFirstnameFocused(false)}
                    />
                  </Animated.View>
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Last Name</Text>
                  <Animated.View style={[styles.modalInputWrapper, { borderColor: editLastnameBorderColorInterpolate }]}>
                    <Ionicons name="person-outline" size={20} color={editLastnameFocused ? "#FFC30B" : "#94a3b8"} style={styles.modalInputIcon} />
                    <TextInput
                      value={lastname}
                      onChangeText={setLastname}
                      editable={!isUpdatingProfile}
                      autoCapitalize="words"
                      placeholder="Enter your last name"
                      placeholderTextColor="#64748b"
                      style={styles.modalInput}
                      onFocus={() => setEditLastnameFocused(true)}
                      onBlur={() => setEditLastnameFocused(false)}
                    />
                  </Animated.View>
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Gender <Text style={styles.inputLabelOptional}>(optional)</Text>
                  </Text>
                  <View style={{ position: 'relative' }}>
                    <TouchableOpacity
                      onPress={() => setShowGenderDropdown(!showGenderDropdown)}
                      disabled={isUpdatingProfile}
                      style={styles.dropdownButton}
                    >
                      <Text style={[styles.dropdownButtonText, !gender && styles.dropdownButtonTextPlaceholder]}>
                        {gender === 'MALE' ? 'Male' : 
                         gender === 'FEMALE' ? 'Female' : 
                         gender === 'OTHER' ? 'Other' : 
                         'Prefer not to say'}
                      </Text>
                      <Ionicons 
                        name={showGenderDropdown ? 'chevron-up' : 'chevron-down'} 
                        size={20} 
                        color="#6B7280" 
                      />
                    </TouchableOpacity>
                    
                    {showGenderDropdown && (
                      <View style={styles.genderDropdown}>
                        {['', 'MALE', 'FEMALE', 'OTHER'].map((value) => {
                          const labels: { [key: string]: string } = {
                            '': 'Prefer not to say',
                            'MALE': 'Male',
                            'FEMALE': 'Female',
                            'OTHER': 'Other',
                          };
                          const isSelected = gender === value;
                          return (
                            <TouchableOpacity
                              key={value}
                              onPress={() => {
                                setGender(value);
                                setShowGenderDropdown(false);
                              }}
                              disabled={isUpdatingProfile}
                              style={[styles.genderDropdownItem, isSelected && styles.genderDropdownItemSelected]}
                            >
                              <Text style={styles.genderDropdownItemText}>
                                {labels[value]}
                              </Text>
                              {isSelected && (
                                <Ionicons name="checkmark" size={20} color="#91403E" />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </View>
                
                <View style={styles.modalButtonContainer}>
                  <TouchableOpacity
                    onPress={() => {
                      setShowEditPersonalInfoModal(false);
                      setShowGenderDropdown(false);
                      setFirstname(userData?.firstname || '');
                      setLastname(userData?.lastname || '');
                      setGender(userData?.gender || '');
                    }}
                    disabled={isUpdatingProfile}
                    style={styles.modalCancelButton}
                  >
                    <Text style={styles.modalCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleUpdateProfile}
                    disabled={isUpdatingProfile}
                    style={[styles.modalButton, isUpdatingProfile && styles.modalButtonDisabled]}
                    activeOpacity={0.8}
                  >
                    {isUpdatingProfile && <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />}
                    <Text style={styles.modalButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backgroundBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  gradientOverlay1: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.4,
  },
  gradientMaroon1: {
    position: 'absolute',
    bottom: -height * 0.3,
    left: -width * 0.2,
    width: width * 0.8,
    height: height * 0.8,
    opacity: 0.3,
  },
  gradientYellow1: {
    position: 'absolute',
    top: -height * 0.2,
    right: -width * 0.15,
    width: width * 0.7,
    height: height * 0.7,
    opacity: 0.3,
  },
  gradientBlur1: {
    position: 'absolute',
    top: -height * 0.3,
    right: -width * 0.15,
    width: width * 1.2,
    height: height * 0.8,
    opacity: 0.4,
  },
  gradientBlur2: {
    position: 'absolute',
    bottom: -height * 0.4,
    left: -width * 0.2,
    width: width * 1.2,
    height: height * 1.0,
    opacity: 0.3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: Platform.OS === 'android' ? 12 : 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 10,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#e2e8f0',
    marginTop: 24,
    marginBottom: 8,
  },
  errorContainerText: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#91403E',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
    maxWidth: 300,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#FFC30B',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    maxWidth: 300,
  },
  backButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  titleContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    zIndex: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e2e8f0',
  },
  profileCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    zIndex: 10,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFC30B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#B5830F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    color: '#e2e8f0',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#91403E',
  },
  dropdownContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
    minHeight: 350, // Match the dropdown height
  },
  dropdownLogo: {
    position: 'absolute',
    bottom: 50,
    right: 20,
    width: 120,
    height: 70,
    opacity: 0.6,
  },
  personalInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginBottom: 16,
  },
  personalInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e2e8f0',
  },
  editButton: {
    padding: 8,
  },
  infoSection: {
    gap: 16,
  },
  infoItem: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    color: '#e2e8f0',
  },
  placeholderCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    zIndex: 10,
  },
  placeholderText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
  authButtonsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 12,
    zIndex: 10,
  },
  loginButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(145, 64, 62, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#91403E',
  },
  signupButton: {
    flex: 1,
    backgroundColor: '#91403E',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  signupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  menuContainer: {
    paddingHorizontal: 20,
    marginTop: 8,
    zIndex: 10,
  },
  menuCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 8,
    overflow: 'hidden',
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  menuIconContainer: {
    padding: 8,
    backgroundColor: 'rgba(145, 64, 62, 0.2)',
    borderRadius: 8,
    marginRight: 16,
  },
  menuTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  dropdownMenu: {
    paddingBottom: 16,
  },
  dropdownDivider: {
    marginHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 0,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 40,
    paddingRight: 24,
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#e2e8f0',
    marginLeft: 12,
  },
  logoutContainer: {
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 16,
    zIndex: 10,
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  logoutButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#EF4444',
    marginLeft: 8,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#020617', // slate-950 - same as signup modal
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
  modalIconContainer: {
    padding: 8,
    backgroundColor: 'rgba(145, 64, 62, 0.2)',
    borderRadius: 8,
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e2e8f0',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    paddingBottom: 40,
    paddingTop: 16,
  },
  modalContent: {
    padding: 24,
  },
  modalCard: {
    margin: 24,
    backgroundColor: 'rgba(30, 41, 59, 0.6)', // slate-800 with opacity - same as signup modal
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  modalSectionTitle: {
    fontSize: 30, // Match signup modal title size
    fontWeight: 'bold', // Match signup modal
    color: '#e2e8f0', // slate-200 - same as signup modal
    textAlign: 'left', // Match signup modal
    marginBottom: 8, // Match signup modal spacing
  },
  modalContentSubtitle: {
    fontSize: 16, // Match signup modal
    color: '#94a3b8', // slate-400 - same as signup modal
    textAlign: 'left', // Match signup modal
    marginBottom: 32, // Match signup modal spacing
  },
  modalSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e2e8f0',
    marginTop: 24,
    marginBottom: 8,
  },
  modalBodyText: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 24,
    marginBottom: 16,
  },
  modalBoldText: {
    fontWeight: '600',
    color: '#e2e8f0',
  },
  modalBodySection: {
    marginBottom: 16,
  },
  modalFooterText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 24,
  },
  successMessage: {
    backgroundColor: 'rgba(22, 163, 74, 0.2)',
    borderLeftWidth: 4,
    borderLeftColor: '#16A34A',
    padding: 12,
    marginBottom: 20,
    borderRadius: 4,
  },
  successText: {
    color: '#16A34A',
    fontSize: 14,
  },
  errorMessage: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    padding: 12,
    marginBottom: 20,
    borderRadius: 4,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  preferenceList: {
    marginTop: 8,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  preferenceDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  preferenceInfo: {
    flex: 1,
    marginRight: 16,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 14,
    color: '#94a3b8',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 32,
  },
  modalCancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 12,
  },
  modalCancelButtonText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButton: {
    backgroundColor: '#91403E',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  contactEmailBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)', // Match signup modal
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  contactEmailText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  contactEmailLink: {
    color: '#91403E',
    fontWeight: '600',
  },
  contactForm: {
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8', // slate-400 - same as signup modal
    marginBottom: 8,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8', // slate-400 - same as signup modal
    marginBottom: 8,
  },
  inputLabelOptional: {
    fontWeight: '400',
    color: '#6B7280',
  },
  // Modal input styles matching login/signup design
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
  modalInputWrapperMultiline: {
    alignItems: 'flex-start',
    paddingTop: 4,
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
    paddingRight: 16,
  },
  modalInputMultiline: {
    minHeight: 120,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },
  textInput: {
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)', // Match signup modal input wrapper
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    color: '#e2e8f0',
  },
  textInputError: {
    borderColor: '#DC2626',
  },
  textInputMultiline: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  inputErrorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
  },
  contactSubmitButton: {
    backgroundColor: '#91403E',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  contactSubmitButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#e2e8f0',
  },
  dropdownButtonTextPlaceholder: {
    color: '#6B7280',
  },
  genderDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
  },
  genderDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  genderDropdownItemSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  genderDropdownItemText: {
    fontSize: 16,
    color: '#e2e8f0',
  },
});

export default ProfileScreen;
