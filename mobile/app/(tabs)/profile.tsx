import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
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
import "../../global.css";

type ProfileTab = 'Personal Information' | 'Security' | 'Preferences';

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
  const [activeTab, setActiveTab] = useState<ProfileTab>('Personal Information');

  // States for animated underline
  const [tabLayouts, setTabLayouts] = useState<Record<ProfileTab, { x: number; width: number } | undefined>>(
    {} as Record<ProfileTab, { x: number; width: number } | undefined>
  );
  const underlinePosition = useRef(new Animated.Value(0)).current;
  const underlineWidth = useRef(new Animated.Value(0)).current;
  const [isInitialLayoutDone, setIsInitialLayoutDone] = useState(false);

  // Define tab names array for easier mapping and indexing
  const tabNames: ProfileTab[] = ['Personal Information', 'Security', 'Preferences'];

  // States for Personal Information Edit Form
  const [isEditingPersonalInfo, setIsEditingPersonalInfo] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // States for Change Password Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Effect to animate underline when activeTab or layouts change
  useEffect(() => {
    const currentTabLayout = tabLayouts[activeTab];

    if (currentTabLayout && currentTabLayout.width > 0) {
      if (!isInitialLayoutDone && activeTab === tabNames[0]) {
        // Set initial position and width without animation for the first tab
        underlinePosition.setValue(currentTabLayout.x);
        underlineWidth.setValue(currentTabLayout.width);
        setIsInitialLayoutDone(true);
      } else if (isInitialLayoutDone) {
        // Animate for subsequent tab changes
        Animated.parallel([
          Animated.timing(underlinePosition, {
            toValue: currentTabLayout.x,
            duration: 250,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false, // width/x animations might need this
          }),
          Animated.timing(underlineWidth, {
            toValue: currentTabLayout.width,
            duration: 250,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false,
          }),
        ]).start();
      }
    } else if (!isInitialLayoutDone && activeTab === tabNames[0] && tabLayouts[tabNames[0]] === undefined) {
      // Special handling if the very first tab layout isn't ready but it's the active one
      // This helps to set a default for the first render if needed, though onLayout should catch it.
      const firstPotentialLayout = Object.values(tabLayouts)[0];
      if(firstPotentialLayout) { // Attempt to set if any layout is available (likely the first one)
        underlinePosition.setValue(firstPotentialLayout.x);
        underlineWidth.setValue(firstPotentialLayout.width);
        // setIsInitialLayoutDone(true); // Don't set true until the *active* first tab is confirmed
      }
    }
  }, [activeTab, tabLayouts, underlinePosition, underlineWidth, isInitialLayoutDone, tabNames]);

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
        // Populate form fields when data is fetched
        setFirstName(data.firstName || (data.fullName || data.name || '').split(' ')[0] || '');
        setLastName(data.lastName || (data.fullName || data.name || '').split(' ').slice(1).join(' ') || '');
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
    } catch (e) {
      Alert.alert('Logout Failed', 'Could not log out. Please try again.');
    }
  };

  const handleUpdateProfile = async () => {
    if (!userData?.id || !authToken) return;
    setIsUpdatingProfile(true);
    setError(null);
    const payload: UpdateUserProfilePayload = { firstName, lastName };
    const response = await updateUserProfile(userData.id, authToken, payload);
    setIsUpdatingProfile(false);
    if (response.error) {
      Alert.alert('Update Failed', response.error);
      setError(response.error); 
    } else {
      Alert.alert('Success', response.message || 'Profile updated successfully!');
      setIsEditingPersonalInfo(false);
      fetchUserData(false); // Refresh user data without full loading indicator
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
    const inputBaseClass = "border border-gray-300 p-4 rounded-lg text-gray-800 bg-white text-base shadow-sm transition-all duration-300 ease-in-out focus:border-cordovan focus:ring-2 focus:ring-cordovan focus:ring-opacity-50 focus:shadow-md";
    const labelBaseClass = "text-sm font-medium text-gray-600 mb-2";
    const nonEditableInputClass = "border border-gray-200 p-4 rounded-lg text-gray-500 bg-gray-100 text-base shadow-sm";
    const cardPadding = "p-6 md:p-8"; // Consistent padding for cards
    const formVerticalSpacing = "space-y-6";
    const buttonGroupSpacing = "mt-10";

    if (isEditingPersonalInfo && activeTab === 'Personal Information') {
      return (
        <View className={`bg-white ${cardPadding} rounded-xl shadow-lg`}>
          <Text className="text-2xl font-semibold text-cordovan mb-8">Edit Personal Information</Text>
          <View className={formVerticalSpacing}>
            <View>
              <Text className="text-sm font-medium text-cordovan mb-1">First Name</Text>
              <TextInput className={inputBaseClass} value={firstName} onChangeText={setFirstName} placeholder="John" editable={!isUpdatingProfile}/>
            </View>
            <View>
              <Text className="text-sm font-medium text-cordovan mb-1">Last Name</Text>
              <TextInput className={inputBaseClass} value={lastName} onChangeText={setLastName} placeholder="Doe" editable={!isUpdatingProfile}/>
            </View>
            <View>
              <Text className="text-sm font-medium text-cordovan mb-1">Email (Cannot be changed)</Text>
              <TextInput className={nonEditableInputClass} value={email} editable={false}/>
            </View>
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
                <Text className="text-sm text-cordovan font-medium">FIRST NAME</Text>
                <Text className="text-lg text-gray-800 mt-0.5">{userData?.firstName || firstName || 'N/A'}</Text>
              </View>
            </View>

            <View className="flex-row items-center py-4 border-b border-gray-200">
              <Ionicons name="person-outline" size={22} color="#8C1D18" className="mr-4" />
              <View>
                <Text className="text-sm text-cordovan font-medium">LAST NAME</Text>
                <Text className="text-lg text-gray-800 mt-0.5">{userData?.lastName || lastName || 'N/A'}</Text>
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
                <View>
                  <Text className="text-sm font-medium text-cordovan mb-1">Current Password</Text>
                  <TextInput className={inputBaseClass} value={currentPassword} onChangeText={setCurrentPassword} placeholder="Enter current password" secureTextEntry editable={!isChangingPassword}/>
                </View>
                <View>
                  <Text className="text-sm font-medium text-cordovan mb-1">New Password</Text>
                  <TextInput className={inputBaseClass} value={newPassword} onChangeText={setNewPassword} placeholder="Enter new password" secureTextEntry editable={!isChangingPassword}/>
                </View>
                <View>
                  <Text className="text-sm font-medium text-cordovan mb-1">Confirm New Password</Text>
                  <TextInput className={inputBaseClass} value={confirmNewPassword} onChangeText={setConfirmNewPassword} placeholder="Confirm new password" secureTextEntry editable={!isChangingPassword}/>
                </View>
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
        <Ionicons name="cloud-offline-outline" size={64} color="#7F1D1D" /> {/* Darker red for icon */}
        <Text className="text-2xl font-semibold text-gray-800 mt-6 mb-2">Unable to Load Profile</Text>
        <Text className="text-gray-600 mb-8 text-base leading-relaxed">{error}</Text>
        <TouchableOpacity 
            className="bg-cordovan py-3 px-8 rounded-lg shadow-md hover:bg-opacity-90"
            onPress={() => fetchUserData()}
        >
             <Text className="text-white font-semibold text-base">Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  
  const currentDisplayName = userData?.fullName || userData?.name || 'User Name';
  const memberSinceText = userData?.memberSince || `Listener since ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      {/* Fixed Profile Header */}
      <View className="bg-gray-50 pt-12 pb-8 px-6 items-center border-b border-gray-200 shadow-sm relative">
        {/* Logout Icon Button */}
        <Pressable
          onPress={handleLogout}
          className="absolute top-4 right-4 p-3 z-10"
          android_ripple={{ color: 'rgba(0,0,0,0.1)', borderless: true }}
        >
          <Ionicons name="exit-outline" size={28} color="#8C1D18" />
        </Pressable>

        <View className="w-32 h-32 rounded-full bg-mikado_yellow justify-center items-center mb-5 border-4 border-white shadow-xl">
          <Text className="text-5xl font-bold text-black">{getInitials(currentDisplayName)}</Text>
        </View>
        <Text className="text-3xl font-semibold text-gray-900 mb-1.5">{currentDisplayName}</Text>
        <Text className="text-base text-gray-500">{memberSinceText}</Text>
      </View>

      {/* Tab Navigation - below fixed header, above scrollable content */}
      <View className="flex-row bg-white border-b border-gray-200 shadow-sm relative">
        {tabNames.map((tabName, index) => (
          <Pressable
            key={tabName}
            onLayout={(event) => {
              const { x, width } = event.nativeEvent.layout;
              setTabLayouts((prev) => ({
                ...prev,
                [tabName]: { x, width },
              }));
            }}
            className={`flex-1 items-center justify-center py-4 px-4`}
            onPress={() => setActiveTab(tabName as ProfileTab)}
            android_ripple={{ color: 'transparent' }}
          >
            <Text
              className={`text-base font-medium text-center ${ 
                activeTab === tabName ? 'text-cordovan' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tabName}
            </Text>
          </Pressable>
        ))}
        {/* Animated Underline */}
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 0,
            height: 2, // Underline thickness
            backgroundColor: '#8C1D18', // Cordovan color for the underline
            transform: [{ translateX: underlinePosition }],
            width: underlineWidth,
          }}
        />
      </View>
      
      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 40 : 30, paddingTop: 24}} 
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