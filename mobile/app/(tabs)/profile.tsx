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
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import {
  getMe,
  UserData,
  updateUserProfile,
  UpdateUserProfilePayload,
  changeUserPassword,
  ChangePasswordPayload,
} from '../../services/apiService';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AnimatedTextInput from '../../components/ui/AnimatedTextInput';
import "../../global.css";

type ProfileTabKey = 'Personal Information' | 'Security' | 'Preferences';

interface ProfileTabInfo {
  key: ProfileTabKey;
  name: string; // Display name (can be shorter than key)
  icon: keyof typeof Ionicons.glyphMap;
}

// Function to generate initials from full name
const getInitials = (fullName: string = '') => {
  if (!fullName) return '';
  const names = fullName.split(' ');
  const initials = names.map(name => name.charAt(0)).join('');
  return initials.toUpperCase().slice(0, 2); // Max 2 initials
};

const ProfileScreen: React.FC = () => {
  const { authToken, signOut } = useAuth();
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
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // States for Change Password Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const fetchUserData = async (showLoading = true) => {
    if (!authToken) {
      if (showLoading) setIsLoading(false);
      setError('Authentication token not found.');
      return;
    }
    try {
      if (showLoading) setIsLoading(true);
      setError(null);
      const data = await getMe(authToken);
      if (data.error) {
        setError(data.error);
        setUserData(null);
      } else {
        setUserData(data);
        // Use the name field from the backend
        setFullName(data.name || '');
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
    fetchUserData();
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
    
    // Send the name directly to match backend's UserDTO structure
    const payload: UpdateUserProfilePayload = { 
      fullName: fullName.trim() 
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

  const renderTabContent = () => {
    const cardPadding = "p-6 md:p-8"; 
    const formVerticalSpacing = "space-y-6";
    const buttonGroupSpacing = "mt-10";

    // Content views no longer wrapped in PanGestureHandler or Animated.View for sliding
    if (isEditingPersonalInfo && activeTab === 'Personal Information') {
      return (
        <View className={`bg-white ${cardPadding} rounded-xl shadow-lg`}>
            <Text className="text-2xl font-semibold text-cordovan mb-8">Edit Personal Information</Text>
          <View className={formVerticalSpacing}>
            <AnimatedTextInput
              label="Full Name"
              value={fullName}
              onChangeText={setFullName}
              editable={!isUpdatingProfile}
              autoCapitalize="words"
            />
            <AnimatedTextInput
              label="Email (Cannot be changed)"
              value={email}
              editable={false}
              keyboardType="email-address"
              autoCapitalize="none"
              labelColor="#6B7280"
              activeLabelColor="#6B7280"
              borderColor="#D1D5DB"
              activeBorderColor="#D1D5DB"
              inputStyle={{
                color: '#6B7280',
                backgroundColor: '#F9FAFB',
              }}
              inputContainerStyle={{
                backgroundColor: '#F9FAFB',
                opacity: 0.7,
              }}
            />
          </View>
          <View className={`flex-row justify-end items-center ${buttonGroupSpacing}`}>
            <Pressable
              style={({ pressed }) => [
                {
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  opacity: pressed ? 0.9 : 1,
                },
                isUpdatingProfile && { opacity: 0.5 },
              ]}
              className={`py-3 px-6 rounded-lg border border-cordovan bg-white shadow-sm transition-all duration-150 ease-in-out ${isUpdatingProfile ? 'cursor-not-allowed' : ''}`}
              onPress={() => setIsEditingPersonalInfo(false)}
              disabled={isUpdatingProfile}
            >
              <Text className="text-cordovan font-semibold text-base">Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                {
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  opacity: pressed ? 0.8 : 1,
                },
                isUpdatingProfile && { opacity: 0.5 }, 
              ]}
              className={`ml-4 bg-mikado_yellow py-3.5 px-7 rounded-lg flex-row items-center justify-center shadow-md transition-all duration-150 ease-in-out ${isUpdatingProfile ? 'cursor-not-allowed' : ''}`}
              onPress={handleUpdateProfile}
              disabled={isUpdatingProfile}
            >
              {isUpdatingProfile && <ActivityIndicator size="small" color="#000000" className="mr-2" />}
              <Text className="text-black font-bold text-base">Save Changes</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    switch (activeTab) {
      case 'Personal Information':
        return (
          <View className={`bg-white ${cardPadding} rounded-xl shadow-lg`}>
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-semibold text-cordovan">Personal Information</Text>
              <Pressable 
                style={({ pressed }) => [
                  {
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                className="flex-row items-center bg-mikado_yellow py-2.5 px-4 rounded-lg shadow transition-all duration-150 ease-in-out"
                onPress={() => setIsEditingPersonalInfo(true)}
              >
                <MaterialIcons name="edit" size={18} color="#000000" />
                <Text className="text-sm text-black font-semibold ml-1.5">Edit</Text>
              </Pressable>
            </View>

            <View className="flex-row items-center py-4 border-b border-gray-200">
              <Ionicons name="person-outline" size={22} color="#8C1D18" className="mr-4" />
              <View>
                <Text className="text-sm text-cordovan font-medium">FULL NAME</Text>
                <Text className="text-lg text-gray-800 mt-0.5">{fullName || 'N/A'}</Text>
              </View>
            </View>

            <View className="flex-row items-center py-4">
              <Ionicons name="mail-outline" size={22} color="#8C1D18" className="mr-4" />
              <View>
                <Text className="text-sm text-cordovan font-medium">EMAIL</Text>
                <Text className="text-lg text-gray-800 mt-0.5">{userData?.email || email || 'N/A'}</Text>
              </View>
            </View>
          </View>
        );
      case 'Security':
        return (
          <View className={`bg-white ${cardPadding} rounded-xl shadow-lg`}>
            <Text className="text-2xl font-semibold text-cordovan mb-8">Change Password</Text>
            {passwordError && <Text className="text-sm text-red-600 mb-5 -mt-2 text-center font-medium">{passwordError}</Text>}
            <View className={formVerticalSpacing}>
                <AnimatedTextInput
                  label="Current Password"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry
                  editable={!isChangingPassword}
                  autoCapitalize="none"
                />
                <AnimatedTextInput
                  label="New Password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  editable={!isChangingPassword}
                  autoCapitalize="none"
                  error={passwordError?.includes('password') && !passwordError?.includes('match')}
                />
                <AnimatedTextInput
                  label="Confirm New Password"
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  secureTextEntry
                  editable={!isChangingPassword}
                  autoCapitalize="none"
                  error={passwordError?.includes('match')}
                />
            </View>
            <View className={`flex-row justify-end items-center ${buttonGroupSpacing}`}>
                <Pressable
                  style={({ pressed }) => [
                    {
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                      opacity: pressed ? 0.9 : 1,
                    },
                    isChangingPassword && { opacity: 0.5 },
                  ]}
                  className={`py-3 px-6 rounded-lg border border-cordovan bg-white shadow-sm transition-all duration-150 ease-in-out ${isChangingPassword ? 'cursor-not-allowed' : ''}`}
                  onPress={() => { setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword(''); setPasswordError(null); }}
                  disabled={isChangingPassword}
                >
                  <Text className="text-cordovan font-semibold text-base">Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    {
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                      opacity: pressed ? 0.8 : 1,
                    },
                    isChangingPassword && { opacity: 0.5 },
                  ]}
                  className={`ml-4 bg-mikado_yellow py-3.5 px-7 rounded-lg flex-row items-center justify-center shadow-md transition-all duration-150 ease-in-out ${isChangingPassword ? 'cursor-not-allowed' : ''}`}
                  onPress={handleChangePassword}
                  disabled={isChangingPassword}
                >
                  {isChangingPassword && <ActivityIndicator size="small" color="#000000" className="mr-2" />}                  
                  <Text className="text-black font-bold text-base">Update Password</Text>
                </Pressable>
            </View>
          </View>
        );
      case 'Preferences':
        return (
          <View className={`bg-white ${cardPadding} rounded-xl shadow-lg`}>
            <Text className="text-2xl font-semibold text-gray-900">Preferences</Text>
            <Text className="text-gray-600 mt-4 text-base">User preferences and app settings will be available here in a future update.</Text>
          </View>
        );
      default: return null;
    }
  };

  if (isLoading && !userData) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-gray-100">
        <ActivityIndicator size="large" color="#8C1D18" />
        <Text className="mt-4 text-gray-600 text-lg">Loading Profile...</Text>
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
          
          <TouchableOpacity 
              className="bg-mikado_yellow py-3 px-8 rounded-lg shadow-md hover:bg-opacity-90"
              onPress={handleLogout}
          >
               <Text className="text-black font-semibold text-base text-center">Go Back to Welcome</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  const currentDisplayName = userData?.name || 'User Name';
  const memberSinceText = userData?.memberSince || `Listener since ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      {/* Fixed Profile Header */}
      <View className="bg-gray-50 pt-5 pb-3 px-6 items-center border-b border-gray-200 shadow-sm relative">
        {/* Logout Icon Button */}
        <Pressable
          onPress={handleLogout}
          className="absolute top-2.5 right-2.5 p-2 z-10"
          android_ripple={{ color: 'rgba(0,0,0,0.1)', borderless: true }}
        >
          <Ionicons name="exit-outline" size={24} color="#8C1D18" />
        </Pressable>

        <View className="w-24 h-24 rounded-full bg-mikado_yellow justify-center items-center mb-2 border-4 border-white shadow-lg">
          <Text className="text-3xl font-bold text-black">{getInitials(currentDisplayName)}</Text>
        </View>
        <Text className="text-xl font-semibold text-gray-900 mb-1">{currentDisplayName}</Text>
        <Text className="text-sm text-gray-500">{memberSinceText}</Text>
      </View>

      {/* Tab Navigation - below fixed header, above scrollable content */}
      <View 
        className="bg-white border-b border-gray-200 relative shadow-sm"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        <View 
          className="flex-row py-4 px-2"
        >
          {tabDefinitions.map((tabDef, index) => (
            <View 
              key={tabDef.key}
              className="flex-1 px-1"
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                // Use actual measured position from the parent container
                setTabLayouts((prev) => ({
                  ...prev,
                  [tabDef.key]: { x: x + 4, width: width - 8 }, // Account for px-1 padding
                }));
              }}
            >
              <Pressable
                style={({ pressed }) => [
                  { 
                    opacity: pressed && Platform.OS === 'ios' ? 0.7 : 1,
                  },
                ]}
                className={`items-center justify-center py-3 px-2 flex-row rounded-2xl min-h-[44px] ${
                  activeTab === tabDef.key ? 'bg-cordovan/10' : 'bg-transparent'
                }`}
                onPress={() => handleTabPress(tabDef.key)}
                android_ripple={{ color: 'rgba(0,0,0,0.05)' }}
              >
                <Ionicons
                  name={tabDef.icon}
                  size={18}
                  color={activeTab === tabDef.key ? '#91403E' : '#6B7280'}
                />
                <Text
                  className={`ml-1.5 text-xs font-semibold ${
                    activeTab === tabDef.key ? 'text-cordovan' : 'text-gray-600'
                  }`}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {tabDef.name}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
        
        {/* Animated Underline */}
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 0,
            height: 4,
            backgroundColor: '#B5830F',
            borderTopLeftRadius: 2,
            borderTopRightRadius: 2,
            left: underlinePosition,
            width: underlineWidth,
          }}
        />
      </View>
      
      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 40 : 30, paddingTop: 24}}
        showsVerticalScrollIndicator={true}
      >
        <View className="px-4 md:px-6">
          {renderTabContent()}
        </View>

        <View className="px-6 mt-10 mb-8">
          {error && (isEditingPersonalInfo || activeTab === 'Security') && (
            <View className="bg-red-100 p-4 rounded-lg mb-6 flex-row items-center shadow">
                <Ionicons name="warning-outline" size={22} color="#B91C1C" />
                <Text className="text-red-800 ml-3 text-sm font-medium flex-1">{error}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen; 