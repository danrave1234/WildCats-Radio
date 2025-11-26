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
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import {
  getMe,
  UserData,
  updateUserProfile,
  UpdateUserProfilePayload,
  changeUserPassword,
  ChangePasswordPayload,
  updateNotificationPreferences,
  NotificationPreferences,
} from '../../services/apiService';
import { Ionicons } from '@expo/vector-icons';
import AnimatedTextInput from '../../components/ui/AnimatedTextInput';
import ProfileSkeleton from '../../components/ProfileSkeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import "../../global.css";

// Function to generate initials from user data
const getInitials = (user: UserData | null) => {
  if (!user) return 'LS';
  const firstInitial = user.firstname ? user.firstname.charAt(0) : '';
  const lastInitial = user.lastname ? user.lastname.charAt(0) : '';
  return `${firstInitial}${lastInitial}`.toUpperCase() || 'LS';
};

const ProfileScreen: React.FC = () => {
  const { authToken, signOut } = useAuth();
  const router = useRouter();
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
  const savedHelpDropdownState = useRef(false); // Save state before closing
  
  // Settings dropdown state
  const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = useState(false);
  const settingsDropdownAnimation = useRef(new Animated.Value(0)).current;
  const savedSettingsDropdownState = useRef(false); // Save state before closing
  
  // Privacy Policy and Contact modal states
  const [showPrivacyPolicyModal, setShowPrivacyPolicyModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  
  // Contact form states
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactStatus, setContactStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
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
    outputRange: [0, 250], // Increased height to accommodate all fields properly
  });
  
  const profileDropdownOpacity = profileDropdownAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  
  const helpDropdownHeight = helpDropdownAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 120], // Height for two sub-menu items
  });
  
  const helpDropdownOpacity = helpDropdownAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  
  const settingsDropdownHeight = settingsDropdownAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 120], // Height for two sub-menu items
  });
  
  const settingsDropdownOpacity = settingsDropdownAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  
  const isValidEmail = (value: string) => /[^@\s]+@[^@\s]+\.[^@\s]+/.test(value);
  
  const handleContactSubmit = async () => {
    if (!contactName.trim() || !isValidEmail(contactEmail) || !contactMessage.trim()) {
      setContactStatus({ type: 'error', text: 'Please fill out all fields with a valid email.' });
      return;
    }
    
    const mailToAddress = 'wildcatsradio@example.edu'; // TODO: replace with official inbox
    const subject = encodeURIComponent(`[WildCats Radio] Message from ${contactName}`);
    const body = encodeURIComponent(`Name: ${contactName}\nEmail: ${contactEmail}\n\n${contactMessage}`);
    
    // Try to open email client
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
    
    // Reset form after a delay
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
      fetchUserData();
  }, [authToken]);

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
  
  // Restore Help & Support dropdown state when modals close (without animation)
  useEffect(() => {
    if (!showPrivacyPolicyModal && !showContactModal) {
      // Set animation value directly without triggering animation
      helpDropdownAnimation.setValue(savedHelpDropdownState.current ? 1 : 0);
      setIsHelpDropdownOpen(savedHelpDropdownState.current);
    }
  }, [showPrivacyPolicyModal, showContactModal, helpDropdownAnimation]);
  
  // Restore Settings dropdown state when modals close (without animation)
  useEffect(() => {
    if (!showPrivacyModal && !showSettingsModal) {
      // Set animation value directly without triggering animation
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
      await signOut();
              // Navigate to welcome screen after successful logout
              router.replace('/welcome');
            } catch (error) {
              console.error('Logout error:', error);
      Alert.alert('Logout Failed', 'Could not log out. Please try again.');
    }
          },
        },
      ]
    );
  };

  const handleUpdateProfile = async () => {
    if (!userData?.id || !authToken) return;
    setIsUpdatingProfile(true);
    setError(null);
    
    const payload: UpdateUserProfilePayload = { 
      firstname: firstname.trim(),
      lastname: lastname.trim(),
      gender: gender || null
    };
    
    const response = await updateUserProfile(userData.id, authToken, payload);
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
    if (!userData?.id || !authToken) return;
    
    setPasswordError(null);
    setError(null);
    setIsChangingPassword(true);
    const payload: ChangePasswordPayload = { currentPassword, newPassword };
    const response = await changeUserPassword(userData.id, authToken, payload);
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
    // Clear any previous messages when toggling
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

  const renderSettingsContent = () => {
    if (settingsTab === 'personal') {
      if (isEditingPersonalInfo) {
      return (
          <View className="p-6">
            <Text className="text-2xl font-bold text-gray-900 mb-6">Edit Personal Information</Text>
            <View className="space-y-4">
              <AnimatedTextInput
                label="First Name"
                value={firstname}
                onChangeText={setFirstname}
                editable={!isUpdatingProfile}
                autoCapitalize="words"
              />
              <AnimatedTextInput
                label="Last Name"
                value={lastname}
                onChangeText={setLastname}
                editable={!isUpdatingProfile}
                autoCapitalize="words"
              />
              <AnimatedTextInput
                label="Email Address"
                value={email}
                onChangeText={setEmail}
                editable={false} 
                keyboardType="email-address"
                containerStyle={{ opacity: 0.6 }}
              />
            </View>
            <View className="flex-row justify-end items-center mt-6 space-x-4">
                <TouchableOpacity onPress={() => setIsEditingPersonalInfo(false)} disabled={isUpdatingProfile}>
                    <Text className="text-gray-600 font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={handleUpdateProfile}
                    className="bg-cordovan py-2 px-6 rounded-lg shadow-lg flex-row items-center"
                    disabled={isUpdatingProfile}
                >
                    {isUpdatingProfile && <ActivityIndicator size="small" color="white" className="mr-2" />}
                    <Text className="text-white font-bold">Save</Text>
                </TouchableOpacity>
            </View>
        </View>
      );
    }
    
      return (
        <View className="p-6">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-gray-900">Personal Information</Text>
            <TouchableOpacity onPress={() => setIsEditingPersonalInfo(true)} className="p-2">
              <Ionicons name="create-outline" size={24} color="#91403E" />
            </TouchableOpacity>
          </View>
          <View className="space-y-4">
            <View>
              <Text className="text-sm text-gray-600 font-medium">FULL NAME</Text>
              <Text className="text-base text-gray-900 mt-1">{`${firstname} ${lastname}`.trim() || 'N/A'}</Text>
            </View>
            <View>
              <Text className="text-sm text-gray-600 font-medium">EMAIL</Text>
              <Text className="text-base text-gray-900 mt-1">{email || 'N/A'}</Text>
            </View>
            <View>
              <Text className="text-sm text-gray-600 font-medium">ROLE</Text>
              <Text className="text-base text-gray-900 mt-1">{userData?.role || 'N/A'}</Text>
            </View>
          </View>
        </View>
      );
    }
    
    if (settingsTab === 'security') {
      return (
        <View className="p-6">
          <Text className="text-2xl font-bold text-gray-900 mb-6">Change Password</Text>
          {passwordError && (
              <Text className="text-red-500 bg-red-100 p-3 rounded-lg mb-4">{passwordError}</Text>
          )}
          <View className="space-y-4">
              <AnimatedTextInput
                  label="Current Password"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry
                  editable={!isChangingPassword}
              />
              <AnimatedTextInput
                  label="New Password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  editable={!isChangingPassword}
              />
              <AnimatedTextInput
                  label="Confirm New Password"
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  secureTextEntry
                  editable={!isChangingPassword}
              />
          </View>
          <View className="flex-row justify-end mt-6">
              <TouchableOpacity
                  onPress={handleChangePassword}
                  className="bg-cordovan py-3 px-6 rounded-lg shadow-lg flex-row items-center"
                  disabled={isChangingPassword}
              >
                  {isChangingPassword && <ActivityIndicator size="small" color="white" className="mr-2" />}
                  <Text className="text-white font-bold">Update Password</Text>
              </TouchableOpacity>
          </View>
        </View>
      );
    }
    
    if (settingsTab === 'preferences') {
      return (
        <View className="p-6">
          <Text className="text-2xl font-bold text-gray-900 mb-6">Notification Preferences</Text>
          
          {preferenceUpdateSuccess && (
            <View className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <Text className="text-green-600 text-sm font-medium">{preferenceUpdateSuccess}</Text>
            </View>
          )}
          
          {preferenceUpdateError && (
            <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <Text className="text-red-600 text-sm font-medium">{preferenceUpdateError}</Text>
            </View>
          )}
          
          <View className="space-y-6">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-800">Broadcast Start</Text>
                <Text className="text-sm text-gray-600">Get notified when broadcasts begin</Text>
              </View>
              <Switch
                value={localPreferences.notifyBroadcastStart}
                onValueChange={() => handlePreferenceToggle('notifyBroadcastStart')}
                disabled={isUpdatingPreferences}
                trackColor={{ false: '#E5E7EB', true: '#91403E' }}
                thumbColor={localPreferences.notifyBroadcastStart ? '#FFFFFF' : '#F3F4F6'}
              />
            </View>

            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-800">Broadcast Reminders</Text>
                <Text className="text-sm text-gray-600">Get notified before broadcasts start</Text>
              </View>
              <Switch
                value={localPreferences.notifyBroadcastReminders}
                onValueChange={() => handlePreferenceToggle('notifyBroadcastReminders')}
                disabled={isUpdatingPreferences}
                trackColor={{ false: '#E5E7EB', true: '#91403E' }}
                thumbColor={localPreferences.notifyBroadcastReminders ? '#FFFFFF' : '#F3F4F6'}
              />
            </View>

            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-800">New Schedule</Text>
                <Text className="text-sm text-gray-600">Get notified about new broadcast schedules</Text>
              </View>
              <Switch
                value={localPreferences.notifyNewSchedule}
                onValueChange={() => handlePreferenceToggle('notifyNewSchedule')}
                disabled={isUpdatingPreferences}
                trackColor={{ false: '#E5E7EB', true: '#91403E' }}
                thumbColor={localPreferences.notifyNewSchedule ? '#FFFFFF' : '#F3F4F6'}
              />
            </View>

            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-800">System Updates</Text>
                <Text className="text-sm text-gray-600">Get notified about system announcements</Text>
              </View>
              <Switch
                value={localPreferences.notifySystemUpdates}
                onValueChange={() => handlePreferenceToggle('notifySystemUpdates')}
                disabled={isUpdatingPreferences}
                trackColor={{ false: '#E5E7EB', true: '#91403E' }}
                thumbColor={localPreferences.notifySystemUpdates ? '#FFFFFF' : '#F3F4F6'}
              />
            </View>
          </View>
          
          <View className="flex-row justify-end mt-6">
            <TouchableOpacity
              onPress={handlePreferencesSubmit}
              disabled={isUpdatingPreferences}
              className="bg-cordovan py-3 px-6 rounded-lg shadow-lg flex-row items-center"
            >
              {isUpdatingPreferences && <ActivityIndicator size="small" color="white" className="mr-2" />}
              <Text className="text-white font-bold">
                {isUpdatingPreferences ? 'Saving...' : 'Save Preferences'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    
    return null;
  };

  if (isLoading && !userData) {
    return (
      <SafeAreaView className="flex-1 bg-gray-100">
        <ScrollView
          style={{ backgroundColor: '#F9FAFB' }}
          contentContainerStyle={{ 
            paddingBottom: 120 + insets.bottom,
            paddingTop: Platform.OS === 'android' ? 12 : 6,
            backgroundColor: '#F9FAFB'
          }}
          showsVerticalScrollIndicator={false}
        >
          <ProfileSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error && !userData) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-gray-100 p-6">
        <Ionicons name="cloud-offline-outline" size={64} color="#7F1D1D" /> 
        <Text className="text-2xl font-semibold text-gray-800 mt-6 mb-2">Unable to Load Profile</Text>
        <Text className="text-gray-600 mb-8 text-base leading-relaxed text-center">{error}</Text>
        
        <View className="w-full max-w-sm space-y-4">
          <TouchableOpacity 
            className="bg-cordovan py-3 px-8 rounded-lg shadow-md"
            onPress={() => fetchUserData()}
          >
            <Text className="text-white font-semibold text-base text-center">Try Again</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="bg-mikado_yellow py-3 px-8 rounded-lg shadow-md"
            onPress={handleLogout}
          >
            <Text className="text-black font-semibold text-base text-center">Go Back to Welcome</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  const displayName = `${firstname} ${lastname}`.trim().toLowerCase() || 'listener student';
  const roleDisplay = (userData?.role || 'LISTENER').toUpperCase();

    return (
      <SafeAreaView className="flex-1 bg-gray-100">
        <ScrollView
        style={{ backgroundColor: '#F9FAFB' }}
          contentContainerStyle={{ 
            paddingBottom: 120 + insets.bottom,
            paddingTop: Platform.OS === 'android' ? 12 : 6,
          backgroundColor: '#F9FAFB'
          }}
          showsVerticalScrollIndicator={false}
        >
        {/* Menu Title */}
        <View className="px-5 pt-6 pb-4 bg-gray-100">
          <View className="flex-row items-center">
            <View className="flex-1">
              <Text className="text-3xl font-bold text-gray-900">Menu</Text>
            </View>
          </View>
        </View>

        {/* User Profile Section with Dropdown */}
        <View className="mx-5 mb-4 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <TouchableOpacity 
            className="px-5 py-4 flex-row items-center"
            activeOpacity={0.7}
            onPress={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
          >
            <View 
              className="w-16 h-16 rounded-full bg-mikado_yellow justify-center items-center mr-4"
              style={{
                shadowColor: '#B5830F',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: 4,
              }}
            >
              <Text className="text-2xl font-bold text-black">{getInitials(userData)}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base text-gray-700 mb-1">{displayName}</Text>
              <Text className="text-lg font-bold text-cordovan">{roleDisplay}</Text>
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
            <View className="px-5 pb-5 border-t border-gray-100">
              <View className="pt-4">
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-lg font-bold text-gray-900">Personal Information</Text>
                  <TouchableOpacity
                    onPress={() => setShowEditPersonalInfoModal(true)}
                    className="p-3"
                  >
                    <Ionicons name="create-outline" size={28} color="#91403E" />
                  </TouchableOpacity>
                </View>
                
                <View className="space-y-4">
                  <View>
                    <Text className="text-xs text-gray-500 font-medium mb-1.5">FULL NAME</Text>
                    <Text className="text-base text-gray-900">{`${firstname} ${lastname}`.trim() || 'N/A'}</Text>
                  </View>
                  <View>
                    <Text className="text-xs text-gray-500 font-medium mb-1.5">EMAIL</Text>
                    <Text className="text-base text-gray-900">{email || 'N/A'}</Text>
                  </View>
                  {gender && (
                    <View>
                      <Text className="text-xs text-gray-500 font-medium mb-1.5">GENDER</Text>
                      <Text className="text-base text-gray-900">
                        {gender === 'MALE' ? 'Male' : gender === 'FEMALE' ? 'Female' : gender === 'OTHER' ? 'Other' : gender}
                      </Text>
                    </View>
                  )}
                  <View>
                    <Text className="text-xs text-gray-500 font-medium mb-1.5">ROLE</Text>
                    <Text className="text-base text-gray-900">{userData?.role || 'N/A'}</Text>
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Menu Buttons */}
        <View className="px-5 mt-2">
          {/* Help & Support Dropdown */}
          <View className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-2">
            <TouchableOpacity
              onPress={() => setIsHelpDropdownOpen(!isHelpDropdownOpen)}
              className="px-6 py-4 flex-row items-center"
              activeOpacity={0.8}
            >
              <View className="p-2 bg-cordovan/10 rounded-lg mr-4">
                <Ionicons name="help-circle-outline" size={24} color="#91403E" />
              </View>
              <Text className="text-lg font-semibold text-gray-900 flex-1">Help & Support</Text>
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
              <View className="pb-4">
                <View className="border-t border-gray-100 mb-0" />
                <TouchableOpacity
                  onPress={() => {
                    savedHelpDropdownState.current = isHelpDropdownOpen;
                    setShowPrivacyPolicyModal(true);
                    setIsHelpDropdownOpen(false);
                  }}
                  className="py-3 flex-row items-center pl-10 pr-6"
                  activeOpacity={0.7}
                >
                  <Ionicons name="document-text-outline" size={20} color="#91403E" />
                  <Text className="text-base text-gray-900 ml-3">Privacy Policy</Text>
                </TouchableOpacity>
                <View className="mx-4 border-t border-gray-100" />
                <TouchableOpacity
                  onPress={() => {
                    savedHelpDropdownState.current = isHelpDropdownOpen;
                    setShowContactModal(true);
                    setIsHelpDropdownOpen(false);
                  }}
                  className="py-3 flex-row items-center pl-10 pr-6"
                  activeOpacity={0.7}
                >
                  <Ionicons name="mail-outline" size={20} color="#91403E" />
                  <Text className="text-base text-gray-900 ml-3">Contact</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>

          {/* Settings Dropdown */}
          <View className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <TouchableOpacity
              onPress={() => setIsSettingsDropdownOpen(!isSettingsDropdownOpen)}
              className="px-6 py-4 flex-row items-center"
              activeOpacity={0.8}
            >
              <View className="p-2 bg-cordovan/10 rounded-lg mr-4">
                <Ionicons name="settings-outline" size={24} color="#91403E" />
              </View>
              <Text className="text-lg font-semibold text-gray-900 flex-1">Settings</Text>
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
              <View className="pb-4">
                <View className="border-t border-gray-100 mb-0" />
                <TouchableOpacity
                  onPress={() => {
                    savedSettingsDropdownState.current = isSettingsDropdownOpen;
                    setShowPrivacyModal(true);
                    setIsSettingsDropdownOpen(false);
                  }}
                  className="py-3 flex-row items-center pl-10 pr-6"
                  activeOpacity={0.7}
                >
                  <Ionicons name="lock-closed-outline" size={20} color="#91403E" />
                  <Text className="text-base text-gray-900 ml-3">Security</Text>
                </TouchableOpacity>
                <View className="mx-4 border-t border-gray-100" />
                <TouchableOpacity
                  onPress={() => {
                    savedSettingsDropdownState.current = isSettingsDropdownOpen;
                    setSettingsTab('preferences');
                    setShowSettingsModal(true);
                    setIsSettingsDropdownOpen(false);
                  }}
                  className="py-3 flex-row items-center pl-10 pr-6"
                  activeOpacity={0.7}
                >
                  <Ionicons name="notifications-outline" size={20} color="#91403E" />
                  <Text className="text-base text-gray-900 ml-3">Preferences</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </View>
        
        {/* Log out Button */}
        <View className="px-5 mt-6 mb-4">
          <TouchableOpacity
            onPress={handleLogout}
            className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden"
            style={styles.logoutButton}
            activeOpacity={0.8}
          >
            <View className="px-6 py-4 flex-row items-center justify-center">
              <Ionicons name="log-out-outline" size={22} color="#EF4444" />
              <Text className="text-lg font-semibold text-red-600 ml-2">Log out</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Settings Modal - Shows Preferences Only */}
      <Modal
        visible={showSettingsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <SafeAreaView className="flex-1 bg-gray-50">
          <View className="bg-white flex-row items-center justify-between px-5 py-4 border-b border-gray-200">
            <View className="flex-row items-center">
              <View className="p-2 bg-cordovan/10 rounded-lg mr-3">
                <Ionicons name="notifications-outline" size={24} color="#91403E" />
              </View>
              <Text className="text-2xl font-bold text-gray-900">Preferences</Text>
            </View>
            <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
              <Ionicons name="close" size={28} color="#6B7280" />
            </TouchableOpacity>
          </View>
          
          <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 40 }}>
            <View className="p-6">
              <View className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <View className="p-6">
                  <Text className="text-xl font-semibold text-gray-900 mb-6">Notification Preferences</Text>
                  
                  {preferenceUpdateSuccess && (
            <View style={{
                      backgroundColor: '#F0FDF4',
                      borderLeftWidth: 4,
                      borderLeftColor: '#16A34A',
                      padding: 12,
                      marginBottom: 20,
                      borderRadius: 4,
                    }}>
                      <Text style={{ color: '#16A34A', fontSize: 14 }}>{preferenceUpdateSuccess}</Text>
                    </View>
                  )}
                  
                  {preferenceUpdateError && (
                    <View style={{
                      backgroundColor: '#FEF2F2',
                      borderLeftWidth: 4,
                      borderLeftColor: '#DC2626',
                      padding: 12,
                      marginBottom: 20,
                      borderRadius: 4,
                    }}>
                      <Text style={{ color: '#DC2626', fontSize: 14 }}>{preferenceUpdateError}</Text>
                    </View>
                  )}
                  
                  <View className="space-y-6">
                    <View style={{
                      flexDirection: 'row',
              alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: '#E5E7EB',
                    }}>
                      <View style={{ flex: 1, marginRight: 16 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 }}>
                          Broadcast Start
                        </Text>
                        <Text style={{ fontSize: 14, color: '#6B7280' }}>
                          Get notified when broadcasts begin
                        </Text>
            </View>
                      <Switch
                        value={localPreferences.notifyBroadcastStart}
                        onValueChange={() => handlePreferenceToggle('notifyBroadcastStart')}
                        disabled={isUpdatingPreferences}
                        trackColor={{ false: '#E5E7EB', true: '#91403E' }}
                        thumbColor={localPreferences.notifyBroadcastStart ? '#FFFFFF' : '#F3F4F6'}
                      />
                    </View>

                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: '#E5E7EB',
                    }}>
                      <View style={{ flex: 1, marginRight: 16 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 }}>
                          Broadcast Reminders
            </Text>
                        <Text style={{ fontSize: 14, color: '#6B7280' }}>
                          Get notified before broadcasts start
                        </Text>
                      </View>
                      <Switch
                        value={localPreferences.notifyBroadcastReminders}
                        onValueChange={() => handlePreferenceToggle('notifyBroadcastReminders')}
                        disabled={isUpdatingPreferences}
                        trackColor={{ false: '#E5E7EB', true: '#91403E' }}
                        thumbColor={localPreferences.notifyBroadcastReminders ? '#FFFFFF' : '#F3F4F6'}
                      />
                    </View>

                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: '#E5E7EB',
                    }}>
                      <View style={{ flex: 1, marginRight: 16 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 }}>
                          New Schedule
            </Text>
                        <Text style={{ fontSize: 14, color: '#6B7280' }}>
                          Get notified about new broadcast schedules
                        </Text>
                      </View>
                      <Switch
                        value={localPreferences.notifyNewSchedule}
                        onValueChange={() => handlePreferenceToggle('notifyNewSchedule')}
                        disabled={isUpdatingPreferences}
                        trackColor={{ false: '#E5E7EB', true: '#91403E' }}
                        thumbColor={localPreferences.notifyNewSchedule ? '#FFFFFF' : '#F3F4F6'}
                      />
                    </View>

                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 16,
                    }}>
                      <View style={{ flex: 1, marginRight: 16 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 }}>
                          System Updates
                        </Text>
                        <Text style={{ fontSize: 14, color: '#6B7280' }}>
                          Get notified about system announcements
                        </Text>
                      </View>
                      <Switch
                        value={localPreferences.notifySystemUpdates}
                        onValueChange={() => handlePreferenceToggle('notifySystemUpdates')}
                        disabled={isUpdatingPreferences}
                        trackColor={{ false: '#E5E7EB', true: '#91403E' }}
                        thumbColor={localPreferences.notifySystemUpdates ? '#FFFFFF' : '#F3F4F6'}
                      />
                    </View>
                  </View>
                  
                  {/* Save Preferences Button */}
                  <View className="flex-row justify-end mt-8">
            <TouchableOpacity
                      onPress={handlePreferencesSubmit}
                      disabled={isUpdatingPreferences}
              style={{
                backgroundColor: '#91403E',
                        paddingHorizontal: 24,
                        paddingVertical: 10,
                        borderRadius: 4,
                        flexDirection: 'row',
                alignItems: 'center',
                        opacity: isUpdatingPreferences ? 0.6 : 1,
                      }}
                    >
                      {isUpdatingPreferences && <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />}
                      <Text className="text-white font-semibold" style={{ fontSize: 16 }}>
                        {isUpdatingPreferences ? 'Saving...' : 'Save Preferences'}
              </Text>
            </TouchableOpacity>
                  </View>
                </View>
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
        <SafeAreaView className="flex-1 bg-gray-50">
          <View className="bg-white flex-row items-center justify-between px-5 py-4 border-b border-gray-200">
            <View className="flex-row items-center">
              <View className="p-2 bg-cordovan/10 rounded-lg mr-3">
                <Ionicons name="document-text-outline" size={24} color="#91403E" />
              </View>
              <Text className="text-2xl font-bold text-gray-900">Privacy Policy</Text>
            </View>
            <TouchableOpacity onPress={() => setShowPrivacyPolicyModal(false)}>
              <Ionicons name="close" size={28} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 40 }}>
            <View className="p-6">
              <View className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <View className="p-6">
                  <Text className="text-xl font-semibold text-gray-900 mb-4">Privacy Policy</Text>
              <Text className="text-gray-700 mb-4 leading-6">
                This policy explains what information WildCats Radio collects, how we use and share it,
                and the choices you have. We aim to collect only what we need to deliver a reliable,
                secure, and enjoyable listening and broadcasting experience.
              </Text>

              <Text className="text-xl font-semibold text-gray-900 mt-6 mb-2">Information We Collect</Text>
              <View className="mb-4">
                <Text className="text-gray-700 mb-2 leading-6">
                  <Text className="font-semibold">Account Information</Text> (if you register): name, email address,
                  role (e.g., listener, DJ, moderator, admin), and profile preferences you provide.
                </Text>
                <Text className="text-gray-700 mb-2 leading-6">
                  <Text className="font-semibold">Usage Data</Text>: interactions with the app (pages viewed, features used),
                  timestamps, approximate region/country derived from IP, and device/browser type.
                </Text>
                <Text className="text-gray-700 mb-2 leading-6">
                  <Text className="font-semibold">Streaming & Broadcast Data</Text>: active broadcast metadata (title, DJ/host,
                  description), listener counts, and current track metadata submitted by DJs or fetched
                  from integrated services.
                </Text>
                <Text className="text-gray-700 mb-2 leading-6">
                  <Text className="font-semibold">Technical Logs</Text>: diagnostic logs and error reports to keep services
                  reliable and secure.
                </Text>
                <Text className="text-gray-700 mb-2 leading-6">
                  <Text className="font-semibold">Cookies & Local Storage</Text>: used for session management, theme
                  preferences, and performance.
                </Text>
              </View>

              <Text className="text-xl font-semibold text-gray-900 mt-6 mb-2">How We Use Information</Text>
              <View className="mb-4">
                <Text className="text-gray-700 mb-2 leading-6">• Operate core features like streaming, schedules, notifications, and moderation.</Text>
                <Text className="text-gray-700 mb-2 leading-6">• Maintain security, fraud prevention, and service integrity.</Text>
                <Text className="text-gray-700 mb-2 leading-6">• Understand service performance and improve reliability and usability.</Text>
                <Text className="text-gray-700 mb-2 leading-6">• Comply with legal obligations and institutional policies.</Text>
              </View>

              <Text className="text-xl font-semibold text-gray-900 mt-6 mb-2">Cookies and Similar Technologies</Text>
              <Text className="text-gray-700 mb-4 leading-6">
                We use strictly necessary cookies for authentication (when logged in), CSRF protection,
                and user preferences (e.g., dark mode). Analytics cookies may be used to measure traffic
                and usage. You can control cookies via your browser settings; disabling some may limit
                functionality.
              </Text>

              <Text className="text-xl font-semibold text-gray-900 mt-6 mb-2">Analytics</Text>
              <Text className="text-gray-700 mb-4 leading-6">
                We may collect aggregate metrics such as visitor counts, popular pages, and playback
                stability to improve the experience. Analytics are used in de-identified or aggregated
                form whenever feasible.
              </Text>

              <Text className="text-xl font-semibold text-gray-900 mt-6 mb-2">When We Share Information</Text>
              <View className="mb-4">
                <Text className="text-gray-700 mb-2 leading-6">• Service providers that help us operate the platform (hosting, storage, monitoring).</Text>
                <Text className="text-gray-700 mb-2 leading-6">• School or institutional administrators for compliance and safety purposes.</Text>
                <Text className="text-gray-700 mb-2 leading-6">• Legal or safety requirements (e.g., court orders, preventing harm or abuse).</Text>
                <Text className="text-gray-700 mb-2 leading-6">• With your consent or at your direction.</Text>
              </View>

              <Text className="text-xl font-semibold text-gray-900 mt-6 mb-2">Your Choices & Rights</Text>
              <View className="mb-4">
                <Text className="text-gray-700 mb-2 leading-6">• Access, update, or delete your account information from your profile when logged in.</Text>
                <Text className="text-gray-700 mb-2 leading-6">• Request a copy or deletion of your data (subject to legal and operational limits).</Text>
                <Text className="text-gray-700 mb-2 leading-6">• Opt out of non-essential communications where applicable.</Text>
              </View>

              <Text className="text-xl font-semibold text-gray-900 mt-6 mb-2">Data Retention</Text>
              <Text className="text-gray-700 mb-4 leading-6">
                We retain personal information only as long as necessary for the purposes described
                above, to comply with legal obligations, resolve disputes, and enforce agreements.
                Broadcast metadata and aggregate analytics may be retained for historical and
                reporting purposes.
              </Text>

              <Text className="text-xl font-semibold text-gray-900 mt-6 mb-2">Security</Text>
              <Text className="text-gray-700 mb-4 leading-6">
                We use reasonable administrative, technical, and organizational safeguards to protect
                information. No method of transmission or storage is 100% secure, but we continuously
                improve protections.
              </Text>

              <Text className="text-xl font-semibold text-gray-900 mt-6 mb-2">Children's Privacy</Text>
              <Text className="text-gray-700 mb-4 leading-6">
                Our services are intended for general audiences. If we learn we have collected
                personal information from a child without appropriate consent, we will take steps to
                delete it.
              </Text>

              <Text className="text-xl font-semibold text-gray-900 mt-6 mb-2">Changes to This Policy</Text>
              <Text className="text-gray-700 mb-4 leading-6">
                We may update this policy to reflect improvements or legal changes. We will post
                updates here and revise the "Last updated" date below.
              </Text>

                  <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 24 }}>
                    Last updated: {new Date().toLocaleDateString()}
                  </Text>
                </View>
              </View>
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
        <SafeAreaView className="flex-1 bg-gray-50">
          <View className="bg-white flex-row items-center justify-between px-5 py-4 border-b border-gray-200">
            <View className="flex-row items-center">
              <View className="p-2 bg-cordovan/10 rounded-lg mr-3">
                <Ionicons name="mail-outline" size={24} color="#91403E" />
              </View>
              <Text className="text-2xl font-bold text-gray-900">Contact</Text>
            </View>
            <TouchableOpacity onPress={() => {
              setShowContactModal(false);
              setContactStatus(null);
              setContactName('');
              setContactEmail('');
              setContactMessage('');
            }}>
              <Ionicons name="close" size={28} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 40 }}>
            <View className="p-6">
              <View className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <View className="p-6">
                  <Text className="text-xl font-semibold text-gray-900 mb-2">Contact</Text>
                  <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 24 }}>
                    Have questions or feedback? Reach out below.
                  </Text>
                  
                  <View style={{
                    backgroundColor: '#F9FAFB',
                    padding: 12,
                    borderRadius: 4,
                    marginBottom: 24,
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                  }}>
              <Text style={{ fontSize: 14, color: '#6B7280' }}>
                      Email: <Text style={{ color: '#91403E', fontWeight: '600' }}>wildcatsradio@example.edu</Text>
              </Text>
                  </View>
                  
                  {contactStatus && (
                    <View style={{
                      backgroundColor: contactStatus.type === 'success' ? '#F0FDF4' : '#FEF2F2',
                      borderLeftWidth: 4,
                      borderLeftColor: contactStatus.type === 'success' ? '#16A34A' : '#DC2626',
                      padding: 12,
                      marginBottom: 20,
                      borderRadius: 4,
                    }}>
                      <Text style={{
                        color: contactStatus.type === 'success' ? '#16A34A' : '#DC2626',
                        fontSize: 14,
                      }}>
                        {contactStatus.text}
                      </Text>
                    </View>
                  )}
                  
                  <View className="space-y-6">
                    <View>
                      <Text className="text-sm font-semibold text-gray-700 mb-2">Name</Text>
                      <TextInput
                        value={contactName}
                        onChangeText={setContactName}
                        placeholder="Your name"
                        style={{
                          fontSize: 16,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          backgroundColor: '#FFFFFF',
                          borderWidth: 1,
                          borderColor: '#D1D5DB',
                          borderRadius: 4,
                          color: '#111827',
                        }}
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                    
                    <View>
                      <Text className="text-sm font-semibold text-gray-700 mb-2">Email</Text>
                      <TextInput
                        value={contactEmail}
                        onChangeText={setContactEmail}
                        placeholder="you@example.com"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        style={{
                          fontSize: 16,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          backgroundColor: '#FFFFFF',
                          borderWidth: 1,
                          borderColor: contactEmail && !isValidEmail(contactEmail) ? '#DC2626' : '#D1D5DB',
                          borderRadius: 4,
                          color: '#111827',
                        }}
                        placeholderTextColor="#9CA3AF"
                      />
                      {contactEmail && !isValidEmail(contactEmail) && (
                        <Text style={{ fontSize: 12, color: '#DC2626', marginTop: 4 }}>Enter a valid email.</Text>
                      )}
                    </View>
                    
                    <View>
                      <Text className="text-sm font-semibold text-gray-700 mb-2">Message</Text>
                      <TextInput
                        value={contactMessage}
                        onChangeText={setContactMessage}
                        placeholder="How can we help?"
                        multiline
                        numberOfLines={5}
                        style={{
                          fontSize: 16,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          backgroundColor: '#FFFFFF',
                          borderWidth: 1,
                          borderColor: '#D1D5DB',
                          borderRadius: 4,
                          color: '#111827',
                          minHeight: 120,
                          textAlignVertical: 'top',
                        }}
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                    
                    <TouchableOpacity
                      onPress={handleContactSubmit}
                      style={{
                        backgroundColor: '#91403E',
                        paddingVertical: 12,
                        paddingHorizontal: 24,
                        borderRadius: 4,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 8,
                      }}
                    >
                      <Ionicons name="send-outline" size={20} color="white" />
                      <Text style={{ color: 'white', fontWeight: '600', fontSize: 16, marginLeft: 8 }}>Send</Text>
            </TouchableOpacity>
                  </View>
                </View>
              </View>
          </View>
        </ScrollView>
      </SafeAreaView>
      </Modal>

      {/* Privacy Modal - Shows Security/Change Password */}
      <Modal
        visible={showPrivacyModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPrivacyModal(false)}
      >
        <SafeAreaView className="flex-1 bg-gray-50">
          <View className="bg-white flex-row items-center justify-between px-5 py-4 border-b border-gray-200">
            <View className="flex-row items-center">
              <View className="p-2 bg-cordovan/10 rounded-lg mr-3">
                <Ionicons name="lock-closed-outline" size={24} color="#91403E" />
              </View>
              <Text className="text-2xl font-bold text-gray-900">Security</Text>
            </View>
            <TouchableOpacity onPress={() => setShowPrivacyModal(false)}>
              <Ionicons name="close" size={28} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 40 }}>
            <View className="p-6">
              <View className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <View className="p-6">
                  <Text className="text-xl font-semibold text-gray-900 mb-6">Change Password</Text>
                  {passwordError && (
                    <View style={{
                      backgroundColor: '#FEF2F2',
                      borderLeftWidth: 4,
                      borderLeftColor: '#DC2626',
                      padding: 12,
                      marginBottom: 20,
                      borderRadius: 4,
                    }}>
                      <Text style={{ color: '#DC2626', fontSize: 14 }}>{passwordError}</Text>
                    </View>
                  )}
                  <View className="space-y-6">
                    <View>
                      <Text className="text-sm font-semibold text-gray-700 mb-2">Current Password</Text>
                      <TextInput
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        secureTextEntry
                        editable={!isChangingPassword}
                        style={{
                          fontSize: 16,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          backgroundColor: '#FFFFFF',
                          borderWidth: 1,
                          borderColor: '#D1D5DB',
                          borderRadius: 4,
                          color: '#111827',
                        }}
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                    <View>
                      <Text className="text-sm font-semibold text-gray-700 mb-2">New Password</Text>
                      <TextInput
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry
                        editable={!isChangingPassword}
                        style={{
                          fontSize: 16,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          backgroundColor: '#FFFFFF',
                          borderWidth: 1,
                          borderColor: '#D1D5DB',
                          borderRadius: 4,
                          color: '#111827',
                        }}
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                    <View>
                      <Text className="text-sm font-semibold text-gray-700 mb-2">Confirm New Password</Text>
                      <TextInput
                        value={confirmNewPassword}
                        onChangeText={setConfirmNewPassword}
                        secureTextEntry
                        editable={!isChangingPassword}
                        style={{
                          fontSize: 16,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          backgroundColor: '#FFFFFF',
                          borderWidth: 1,
                          borderColor: '#D1D5DB',
                          borderRadius: 4,
                          color: '#111827',
                        }}
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                  </View>
                  <View className="flex-row justify-end mt-8">
                    <TouchableOpacity
                      onPress={handleChangePassword}
                      disabled={isChangingPassword}
                      style={{
                        backgroundColor: '#91403E',
                        paddingHorizontal: 24,
                        paddingVertical: 10,
                        borderRadius: 4,
                        flexDirection: 'row',
                        alignItems: 'center',
                        opacity: isChangingPassword ? 0.6 : 1,
                      }}
                    >
                      {isChangingPassword && <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />}
                      <Text className="text-white font-semibold" style={{ fontSize: 16 }}>Update Password</Text>
                    </TouchableOpacity>
                  </View>
                </View>
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
          // Reset to original values
          setFirstname(userData?.firstname || '');
          setLastname(userData?.lastname || '');
          setGender(userData?.gender || '');
        }}
      >
        <SafeAreaView className="flex-1 bg-gray-50">
          <View className="bg-white flex-row items-center justify-between px-5 py-4 border-b border-gray-200">
            <View className="flex-row items-center">
              <View className="p-2 bg-cordovan/10 rounded-lg mr-3">
                <Ionicons name="person-outline" size={24} color="#91403E" />
              </View>
              <Text className="text-2xl font-bold text-gray-900">Edit Personal Information</Text>
            </View>
          <TouchableOpacity 
              onPress={() => {
                setShowEditPersonalInfoModal(false);
                setShowGenderDropdown(false);
                // Reset to original values
                setFirstname(userData?.firstname || '');
                setLastname(userData?.lastname || '');
                setGender(userData?.gender || '');
              }}
            >
              <Ionicons name="close" size={28} color="#6B7280" />
          </TouchableOpacity>
        </View>
          
          <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 40 }}>
            <View className="p-6">
              <View className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <View className="p-6">
                  <View className="space-y-6">
                    {/* First Name */}
                    <View>
                      <Text className="text-sm font-semibold text-gray-700 mb-2">First Name</Text>
                      <TextInput
                        value={firstname}
                        onChangeText={setFirstname}
                        editable={!isUpdatingProfile}
                        autoCapitalize="words"
                        style={{
                          fontSize: 16,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          backgroundColor: '#FFFFFF',
                          borderWidth: 1,
                          borderColor: '#D1D5DB',
                          borderRadius: 4,
                          color: '#111827',
                        }}
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                    
                    {/* Last Name */}
                    <View>
                      <Text className="text-sm font-semibold text-gray-700 mb-2">Last Name</Text>
                      <TextInput
                        value={lastname}
                        onChangeText={setLastname}
                        editable={!isUpdatingProfile}
                        autoCapitalize="words"
                        style={{
                          fontSize: 16,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          backgroundColor: '#FFFFFF',
                          borderWidth: 1,
                          borderColor: '#D1D5DB',
                          borderRadius: 4,
                          color: '#111827',
                        }}
                        placeholderTextColor="#9CA3AF"
                      />
        </View>

                    {/* Gender Dropdown */}
                    <View>
                      <Text className="text-sm font-semibold text-gray-700 mb-2">
                        Gender <Text className="text-gray-400 font-normal">(optional)</Text>
                      </Text>
                      <View style={{ position: 'relative' }}>
                        <TouchableOpacity
                          onPress={() => setShowGenderDropdown(!showGenderDropdown)}
                          disabled={isUpdatingProfile}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            backgroundColor: '#FFFFFF',
                            borderWidth: 1,
                            borderColor: '#D1D5DB',
                            borderRadius: 4,
                          }}
                        >
                          <Text style={{
                            fontSize: 16,
                            color: gender ? '#111827' : '#9CA3AF',
                          }}>
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
                          <View style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            marginTop: 4,
                            backgroundColor: '#FFFFFF',
                            borderWidth: 1,
                            borderColor: '#D1D5DB',
                            borderRadius: 4,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 8,
                            elevation: 5,
                            zIndex: 1000,
                          }}>
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
                                  style={{
                                    paddingHorizontal: 12,
                                    paddingVertical: 12,
                                    backgroundColor: isSelected ? '#F3F4F6' : '#FFFFFF',
                                    borderBottomWidth: value !== 'OTHER' ? 1 : 0,
                                    borderBottomColor: '#E5E7EB',
                                  }}
                                >
                                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Text style={{
                                      fontSize: 16,
                                      color: '#111827',
                                    }}>
                                      {labels[value]}
                </Text>
                                    {isSelected && (
                                      <Ionicons name="checkmark" size={20} color="#91403E" />
                                    )}
          </View>
                                </TouchableOpacity>
                              );
                            })}
        </View>
                        )}
                      </View>
        </View>
        
                    {/* Action Buttons */}
                    <View className="flex-row justify-end items-center mt-8 space-x-3">
            <TouchableOpacity
                        onPress={() => {
                          setShowEditPersonalInfoModal(false);
                          setShowGenderDropdown(false);
                          setFirstname(userData?.firstname || '');
                          setLastname(userData?.lastname || '');
                          setGender(userData?.gender || '');
                        }}
                        disabled={isUpdatingProfile}
                        style={{
                          paddingHorizontal: 20,
                          paddingVertical: 10,
                        }}
                      >
                        <Text className="text-gray-700 font-semibold" style={{ fontSize: 16 }}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleUpdateProfile}
                        disabled={isUpdatingProfile}
                        style={{
                          backgroundColor: '#91403E',
                          paddingHorizontal: 24,
                          paddingVertical: 10,
                          borderRadius: 4,
                          flexDirection: 'row',
                          alignItems: 'center',
                          opacity: isUpdatingProfile ? 0.6 : 1,
                        }}
                      >
                        {isUpdatingProfile && <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />}
                        <Text className="text-white font-semibold" style={{ fontSize: 16 }}>Save</Text>
            </TouchableOpacity>
                    </View>
                  </View>
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
  menuButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  logoutButton: {
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
});

export default ProfileScreen; 
