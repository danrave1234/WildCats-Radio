import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  Pressable,
  Animated,
  Easing,
  Switch,
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
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AnimatedTextInput from '../../components/ui/AnimatedTextInput';
import ProfileSkeleton from '../../components/ProfileSkeleton';
import LoginPrompt from '../../components/LoginPrompt';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import "../../global.css";

type ProfileTabKey = 'Personal Information' | 'Security' | 'Preferences';

interface ProfileTabInfo {
  key: ProfileTabKey;
  name: string; // Display name (can be shorter than key)
  icon: keyof typeof Ionicons.glyphMap;
}

// Function to generate initials from user data
const getInitials = (user: UserData | null) => {
  if (!user) return '';
  const firstInitial = user.firstname ? user.firstname.charAt(0) : '';
  const lastInitial = user.lastname ? user.lastname.charAt(0) : '';
  return `${firstInitial}${lastInitial}`.toUpperCase();
};

const ProfileScreen: React.FC = () => {
  const { authToken, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTabKey>('Personal Information');

  // States for animated underline
  const [tabLayouts, setTabLayouts] = useState<Record<ProfileTabKey, { x: number; width: number } | undefined>>(
    {} as Record<ProfileTabKey, { x: number; width: number } | undefined>
  );
  const underlinePosition = useRef(new Animated.Value(0)).current;
  const underlineWidth = useRef(new Animated.Value(0)).current;
  const [isInitialLayoutDone, setIsInitialLayoutDone] = useState(false);

  // Define tab information
  const tabDefinitions: ProfileTabInfo[] = useMemo(() => [
    { key: 'Personal Information', name: 'Personal Info', icon: 'person-outline' },
    { key: 'Security', name: 'Security', icon: 'lock-closed-outline' },
    { key: 'Preferences', name: 'Preferences', icon: 'settings-outline' },
  ], []);

  const tabKeys: ProfileTabKey[] = useMemo(() => tabDefinitions.map(t => t.key), [tabDefinitions]);

  // Get current tab index for animation
  const getCurrentTabIndex = (tabKey: ProfileTabKey): number => {
    return tabKeys.findIndex(key => key === tabKey);
  };

  // Animate line to new position
  const animateLineToTab = (newTabKey: ProfileTabKey) => {
    const newIndex = getCurrentTabIndex(newTabKey);
    const currentTabLayout = tabLayouts[newTabKey];
    
    if (currentTabLayout && currentTabLayout.width > 0) {
      console.log(`🎬 Profile: Animating line to ${newTabKey} (index: ${newIndex})`);
      
      Animated.parallel([
        Animated.spring(underlinePosition, {
          toValue: currentTabLayout.x,
          useNativeDriver: false,
          tension: 120,
          friction: 8,
          velocity: 0,
        }),
        Animated.spring(underlineWidth, {
          toValue: currentTabLayout.width,
          useNativeDriver: false,
          tension: 120,
          friction: 8,
          velocity: 0,
        }),
      ]).start((finished) => {
        if (finished) {
          console.log(`✅ Profile: Animation completed for ${newTabKey}`);
        }
      });
    }
  };

  // Simplified tab change with immediate animation
  const handleTabPress = (newTab: ProfileTabKey) => {
    if (newTab === activeTab) return;
    
    console.log(`🔄 Profile: Tab change requested: ${activeTab} → ${newTab}`);
    
    // Clear preference messages when switching tabs
    setPreferenceUpdateError(null);
    setPreferenceUpdateSuccess(null);
    
    // Change tab immediately
    setActiveTab(newTab);
    
    // Animate line to new position
    if (isInitialLayoutDone) {
      animateLineToTab(newTab);
    }
  };

  // Effect to handle initial setup and tab changes
  useEffect(() => {
    const currentTabLayout = tabLayouts[activeTab];
    
    console.log(`📍 Profile: Tab changed to ${activeTab}, layout:`, currentTabLayout);

    if (currentTabLayout && currentTabLayout.width > 0) {
      if (!isInitialLayoutDone) {
        // Set initial position without animation
        underlinePosition.setValue(currentTabLayout.x);
        underlineWidth.setValue(currentTabLayout.width);
        setIsInitialLayoutDone(true);
        console.log(`🎯 Profile: Initial position set for ${activeTab}`);
      } else {
        // Animate to new position
        animateLineToTab(activeTab);
      }
    }
  }, [activeTab, tabLayouts, isInitialLayoutDone]);

  // States for Personal Information Edit Form
  const [isEditingPersonalInfo, setIsEditingPersonalInfo] = useState(false);
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // States for Change Password Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  
  // States for notification preferences
  const [isUpdatingPreferences, setIsUpdatingPreferences] = useState(false);
  const [preferenceUpdateError, setPreferenceUpdateError] = useState<string | null>(null);
  const [preferenceUpdateSuccess, setPreferenceUpdateSuccess] = useState<string | null>(null);

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
        // Use the name field from the backend
        setFirstname(data.firstname || '');
        setLastname(data.lastname || '');
        setEmail(data.email || '');
      }
    } catch (apiError: any) {
      setError(apiError.message || 'An unexpected error occurred.');
      setUserData(null);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authToken) {
      fetchUserData();
    } else {
      setIsLoading(false);
      setUserData(null);
    }
  }, [authToken]);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch {
      Alert.alert('Logout Failed', 'Could not log out. Please try again.');
    }
  };

  const handleUpdateProfile = async () => {
    if (!userData?.id || !authToken) return;
    setIsUpdatingProfile(true);
    setError(null);
    
    const payload: UpdateUserProfilePayload = { 
      firstname: firstname.trim(),
      lastname: lastname.trim()
    };
    
    const response = await updateUserProfile(userData.id, authToken, payload);
    setIsUpdatingProfile(false);
    if (response.error) {
      Alert.alert('Update Failed', response.error);
      setError(response.error); 
    } else {
      Alert.alert('Success', response.message || 'Profile updated successfully!');
      setIsEditingPersonalInfo(false);
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

  const handlePreferenceChange = async (preferenceKey: keyof NotificationPreferences, value: boolean) => {
    if (!userData || isUpdatingPreferences) return;
    
    setIsUpdatingPreferences(true);
    setPreferenceUpdateError(null);
    setPreferenceUpdateSuccess(null);
    
    try {
      // Update local state immediately for responsive UI
      setUserData(prev => prev ? { ...prev, [preferenceKey]: value } : null);
      
      // Update preferences on server
      const preferences: NotificationPreferences = {
        [preferenceKey]: value,
      };
      
      const result = await updateNotificationPreferences(preferences);
      
      if ('error' in result) {
        // Revert local state on error
        setUserData(prev => prev ? { ...prev, [preferenceKey]: !value } : null);
        setPreferenceUpdateError(result.error || 'Failed to update preference');
        Alert.alert('Error', result.error || 'Failed to update preference');
      } else {
        // Update with server response
        setUserData(result);
        // Show success feedback
        const preferenceName = preferenceKey.replace('notify', '').replace(/([A-Z])/g, ' $1').trim();
        setPreferenceUpdateSuccess(`${preferenceName} preference updated successfully!`);
        console.log(`✅ Notification preference updated: ${preferenceKey} = ${value}`);
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setPreferenceUpdateSuccess(null);
        }, 3000);
      }
    } catch (error) {
      // Revert local state on error
      setUserData(prev => prev ? { ...prev, [preferenceKey]: !value } : null);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update notification preference. Please try again.';
      setPreferenceUpdateError(errorMessage);
      console.error('Preference update error:', error);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsUpdatingPreferences(false);
    }
  };

  const renderTabContent = () => {
    const formVerticalSpacing = "space-y-6";

    // Edit mode for Personal Information
    if (isEditingPersonalInfo && activeTab === 'Personal Information') {
      return (
        <View>
          <View className="flex-row items-center mb-6">
            <Ionicons name="pencil-outline" size={20} color="#91403E" />
            <Text className="text-lg font-medium text-gray-900 ml-2">Personal Information</Text>
          </View>
          <View style={{ height: 1, backgroundColor: '#E5E7EB', marginBottom: 24 }} />
          <View className={formVerticalSpacing}>
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
              label="Email"
              value={email}
              onChangeText={setEmail}
              editable={false} 
              keyboardType="email-address"
              containerStyle={{ opacity: 0.6 }}
            />
          </View>
          <View className="flex-row justify-end items-center mt-8">
            <TouchableOpacity 
              onPress={() => setIsEditingPersonalInfo(false)} 
              disabled={isUpdatingProfile}
              className="mr-4"
            >
              <Text className="text-gray-600 font-semibold">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleUpdateProfile}
              className="py-2.5 px-6 rounded-lg flex-row items-center"
              style={{ backgroundColor: '#91403E' }}
              disabled={isUpdatingProfile}
            >
              {isUpdatingProfile && <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />}
              <Text className="text-white font-semibold">Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    
    if (activeTab === 'Personal Information') {
      return (
        <View>
          <View className="flex-row items-center justify-between mb-6">
            <View className="flex-row items-center">
              <Ionicons name="pencil-outline" size={20} color="#91403E" />
              <Text className="text-lg font-medium text-gray-900 ml-2">Personal Information</Text>
            </View>
            <TouchableOpacity onPress={() => setIsEditingPersonalInfo(true)} className="p-2">
              <MaterialIcons name="edit" size={22} color="#91403E" />
            </TouchableOpacity>
          </View>
          <View style={{ height: 1, backgroundColor: '#E5E7EB', marginBottom: 24 }} />
          <View className={formVerticalSpacing}>
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">First Name</Text>
              <Text className="text-base text-gray-900">{firstname || 'N/A'}</Text>
            </View>
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Last Name</Text>
              <Text className="text-base text-gray-900">{lastname || 'N/A'}</Text>
            </View>
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Email</Text>
              <Text className="text-base text-gray-900">{email || 'N/A'}</Text>
              <Text className="text-xs text-gray-500 mt-1">Email cannot be changed</Text>
            </View>
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Role</Text>
              <Text className="text-base text-gray-900">{userData?.role || 'N/A'}</Text>
            </View>
          </View>
        </View>
      );
    }
    
    if (activeTab === 'Security') {
      return (
        <View>
          <View className="flex-row items-center mb-6">
            <Ionicons name="lock-closed-outline" size={20} color="#91403E" />
            <Text className="text-lg font-medium text-gray-900 ml-2">Change Password</Text>
          </View>
          <View style={{ height: 1, backgroundColor: '#E5E7EB', marginBottom: 24 }} />
          {passwordError && (
            <View className="bg-red-50 border-l-4 p-4 rounded-lg mb-6" style={{ borderLeftColor: '#EF4444' }}>
              <Text className="text-red-800 text-sm">{passwordError}</Text>
            </View>
          )}
          <View className={formVerticalSpacing}>
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
          <View className="flex-row justify-end mt-8">
            <TouchableOpacity
              onPress={handleChangePassword}
              className="py-2.5 px-6 rounded-lg flex-row items-center"
              style={{ backgroundColor: '#91403E' }}
              disabled={isChangingPassword}
            >
              {isChangingPassword && <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />}
              <Text className="text-white font-semibold">Update Password</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    
    if (activeTab === 'Preferences') {
      return (
        <View>
          <View className="flex-row items-center mb-6">
            <Ionicons name="settings-outline" size={20} color="#91403E" />
            <Text className="text-lg font-medium text-gray-900 ml-2">Notification Preferences</Text>
          </View>
          <View style={{ height: 1, backgroundColor: '#E5E7EB', marginBottom: 24 }} />
          
          {/* Success Display */}
          {preferenceUpdateSuccess && (
            <View className="bg-green-50 border-l-4 p-4 rounded-lg mb-6" style={{ borderLeftColor: '#10B981' }}>
              <Text className="text-green-800 text-sm">{preferenceUpdateSuccess}</Text>
            </View>
          )}
          
          {/* Error Display */}
          {preferenceUpdateError && (
            <View className="bg-red-50 border-l-4 p-4 rounded-lg mb-6" style={{ borderLeftColor: '#EF4444' }}>
              <Text className="text-red-800 text-sm">{preferenceUpdateError}</Text>
            </View>
          )}
          
          {/* Loading Indicator */}
          {isUpdatingPreferences && (
            <View className="bg-blue-50 border-l-4 p-4 rounded-lg mb-6" style={{ borderLeftColor: '#3B82F6' }}>
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="#3B82F6" style={{ marginRight: 8 }} />
                <Text className="text-blue-800 text-sm font-medium">Updating preferences...</Text>
              </View>
            </View>
          )}
          
          <View style={{ gap: 24 }}>
            {/* Broadcast Start Notifications */}
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-4">
                <Text className="text-base font-semibold text-gray-900">Broadcast Start</Text>
                <Text className="text-sm text-gray-600 mt-0.5">Get notified when broadcasts begin</Text>
              </View>
              <Switch
                value={userData?.notifyBroadcastStart ?? true}
                onValueChange={(value) => handlePreferenceChange('notifyBroadcastStart', value)}
                disabled={isUpdatingPreferences}
                trackColor={{ false: '#E5E7EB', true: '#91403E' }}
                thumbColor={userData?.notifyBroadcastStart ? '#FFFFFF' : '#F3F4F6'}
              />
            </View>

            {/* Broadcast Reminders */}
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-4">
                <Text className="text-base font-semibold text-gray-900">Broadcast Reminders</Text>
                <Text className="text-sm text-gray-600 mt-0.5">Get notified before broadcasts start</Text>
              </View>
              <Switch
                value={userData?.notifyBroadcastReminders ?? true}
                onValueChange={(value) => handlePreferenceChange('notifyBroadcastReminders', value)}
                disabled={isUpdatingPreferences}
                trackColor={{ false: '#E5E7EB', true: '#91403E' }}
                thumbColor={userData?.notifyBroadcastReminders ? '#FFFFFF' : '#F3F4F6'}
              />
            </View>

            {/* New Schedule Notifications */}
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-4">
                <Text className="text-base font-semibold text-gray-900">New Schedule</Text>
                <Text className="text-sm text-gray-600 mt-0.5">Get notified about new broadcast schedules</Text>
              </View>
              <Switch
                value={userData?.notifyNewSchedule ?? false}
                onValueChange={(value) => handlePreferenceChange('notifyNewSchedule', value)}
                disabled={isUpdatingPreferences}
                trackColor={{ false: '#E5E7EB', true: '#91403E' }}
                thumbColor={userData?.notifyNewSchedule ? '#FFFFFF' : '#F3F4F6'}
              />
            </View>

            {/* System Updates */}
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-4">
                <Text className="text-base font-semibold text-gray-900">System Updates</Text>
                <Text className="text-sm text-gray-600 mt-0.5">Get notified about system announcements</Text>
              </View>
              <Switch
                value={userData?.notifySystemUpdates ?? true}
                onValueChange={(value) => handlePreferenceChange('notifySystemUpdates', value)}
                disabled={isUpdatingPreferences}
                trackColor={{ false: '#E5E7EB', true: '#91403E' }}
                thumbColor={userData?.notifySystemUpdates ? '#FFFFFF' : '#F3F4F6'}
              />
            </View>
          </View>
        </View>
      );
    }
    
    return null;
  };

  // Show login screen if not authenticated
  if (!authToken) {
    return (
      <SafeAreaView className="flex-1 bg-gray-100">
        <ScrollView
          contentContainerStyle={{ 
            flexGrow: 1, 
            justifyContent: 'center', 
            paddingVertical: 40,
            paddingHorizontal: 20,
          }}
          showsVerticalScrollIndicator={false}
        >
          <LoginPrompt
            title="Login to Manage Profile"
            message="Sign in to view and manage your personal information, security settings, and notification preferences."
            icon="person-circle-outline"
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isLoading && !userData) {
    return (
      <SafeAreaView className="flex-1 bg-gray-100">
        <ScrollView
          style={{ backgroundColor: '#F3F4F6' }}
          contentContainerStyle={{ 
            paddingBottom: 120 + insets.bottom, // Increased bottom padding to account for app navigation bar
            paddingTop: Platform.OS === 'android' ? 12 : 6, // Tight spacing like schedule page
            backgroundColor: '#F3F4F6'
          }}
          showsVerticalScrollIndicator={false}
        >
          <ProfileSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error && !userData && !isEditingPersonalInfo) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-gray-100 p-6 text-center">
        <Ionicons name="cloud-offline-outline" size={64} color="#7F1D1D" /> 
        <Text className="text-2xl font-semibold text-gray-800 mt-6 mb-2">Unable to Load Profile</Text>
        <Text className="text-gray-600 mb-8 text-base leading-relaxed">{error}</Text>
        
        <View className="w-full max-w-sm space-y-4">
          <TouchableOpacity 
              className="bg-cordovan py-3 px-8 rounded-lg shadow-md hover:bg-opacity-90"
              onPress={() => fetchUserData()}
          >
               <Text className="text-white font-semibold text-base text-center">Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  const currentDisplayName = `${firstname} ${lastname}`.trim() || 'User Name';
  const memberSinceText = userData?.memberSince || `Listener since ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#F9FAFB' }}>
      <ScrollView
        style={{ backgroundColor: '#F9FAFB' }}
        contentContainerStyle={{ 
          paddingBottom: 120 + insets.bottom,
          paddingTop: Platform.OS === 'android' ? 8 : 4,
          backgroundColor: '#F9FAFB'
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Header */}
        <View className="px-4 pt-4 pb-6">
          <Text className="text-3xl font-bold text-gray-900">Your Profile</Text>
          <Text className="text-gray-600 mt-1">Manage your personal information and account settings</Text>
        </View>

        {/* User Info Section */}
        <View className="px-4 pb-6">
          <View className="flex-row items-center mb-6">
            <View className="h-20 w-20 rounded-full" style={{ backgroundColor: '#F3E8FF', justifyContent: 'center', alignItems: 'center' }}>
              <Text className="text-2xl font-bold" style={{ color: '#91403E' }}>{getInitials(userData)}</Text>
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-xl font-bold text-gray-900">
                {`${firstname} ${lastname}`.trim() || 'User Name'}
              </Text>
              <Text className="text-gray-600 mt-1">{email || 'No email'}</Text>
              {userData?.role && (
                <View className="mt-1 self-start px-2.5 py-0.5 rounded-full" style={{ backgroundColor: '#FEF3C7' }}>
                  <Text className="text-xs font-medium" style={{ color: '#92400E' }}>{userData.role}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Tab Navigation */}
        <View className="px-4 pb-2">
          <View className="flex-row" style={{ borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
            {tabDefinitions.map((tab) => (
              <Pressable
                key={tab.key}
                onLayout={(event) => {
                  const { x, width } = event.nativeEvent.layout;
                  setTabLayouts(prev => ({ ...prev, [tab.key]: { x, width } }));
                }}
                onPress={() => handleTabPress(tab.key)}
                className="flex-1 items-center pb-3"
              >
                <Ionicons
                  name={tab.icon}
                  size={22}
                  color={activeTab === tab.key ? "#91403E" : "#6B7280"}
                />
                <Text
                  className={`mt-1 text-xs font-medium ${
                    activeTab === tab.key ? 'text-cordovan' : 'text-gray-500'
                  }`}
                >
                  {tab.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Tab Content - Full Width */}
        <View className="px-4 pt-6">
          {renderTabContent()}
        </View>
        
        {/* Logout Button */}
        <View className="px-4 mt-8 mb-6">
          <TouchableOpacity
            onPress={handleLogout}
            className="bg-red-50 py-3 rounded-lg flex-row items-center justify-center border"
            style={{ borderColor: '#FEE2E2' }}
          >
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
            <Text className="text-red-600 font-semibold ml-2">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen; 