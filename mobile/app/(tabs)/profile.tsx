import React, { useEffect, useState } from 'react';
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
    const inputBaseClass = "border border-gray-300 p-4 rounded-lg text-gray-800 bg-white text-base focus:border-cordovan focus:ring-1 focus:ring-cordovan shadow-sm";
    const labelBaseClass = "text-sm font-medium text-gray-600 mb-2";
    const nonEditableInputClass = "border border-gray-200 p-4 rounded-lg text-gray-500 bg-gray-100 text-base shadow-sm";
    const cardPadding = "p-6 md:p-8"; // Consistent padding for cards
    const formVerticalSpacing = "space-y-6";
    const buttonGroupSpacing = "mt-10";

    if (isEditingPersonalInfo && activeTab === 'Personal Information') {
      return (
        <View className={`bg-white ${cardPadding} rounded-xl shadow-lg`}>
          <Text className="text-2xl font-semibold text-gray-900 mb-8">Edit Personal Information</Text>
          <View className={formVerticalSpacing}>
            <View>
              <Text className={labelBaseClass}>First Name</Text>
              <TextInput className={inputBaseClass} value={firstName} onChangeText={setFirstName} placeholder="John" editable={!isUpdatingProfile}/>
            </View>
            <View>
              <Text className={labelBaseClass}>Last Name</Text>
              <TextInput className={inputBaseClass} value={lastName} onChangeText={setLastName} placeholder="Doe" editable={!isUpdatingProfile}/>
            </View>
            <View>
              <Text className={labelBaseClass}>Email (Cannot be changed)</Text>
              <TextInput className={nonEditableInputClass} value={email} editable={false}/>
            </View>
          </View>
          <View className={`flex-row justify-end items-center space-x-4 ${buttonGroupSpacing}`}>
            <TouchableOpacity
              className="py-3 px-6 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 shadow-sm"
              onPress={() => setIsEditingPersonalInfo(false)}
              disabled={isUpdatingProfile}
            >
              <Text className="text-gray-700 font-semibold text-base">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-mikado_yellow py-3.5 px-7 rounded-lg flex-row items-center shadow-md hover:bg-opacity-90"
              onPress={handleUpdateProfile}
              disabled={isUpdatingProfile}
            >
              {isUpdatingProfile && <ActivityIndicator size="small" color="#000000" className="mr-2" />}
              <Text className="text-black font-bold text-base">Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    switch (activeTab) {
      case 'Personal Information':
        return (
          <View className={`bg-white ${cardPadding} rounded-xl shadow-lg space-y-5`}>
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-2xl font-semibold text-gray-900">Personal Information</Text>
              <TouchableOpacity 
                className="flex-row items-center bg-gray-100 hover:bg-gray-200 py-2 px-3.5 rounded-md shadow-sm"
                onPress={() => setIsEditingPersonalInfo(true)}
              >
                <MaterialIcons name="edit" size={18} color="#4B5563" />
                <Text className="text-sm text-gray-700 font-semibold ml-1.5">Edit</Text>
              </TouchableOpacity>
            </View>
            <View className="py-2">
              <Text className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">First Name</Text>
              <Text className="text-lg text-gray-800">{userData?.firstName || firstName || 'N/A'}</Text>
            </View>
            <View className="py-2">
              <Text className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Last Name</Text>
              <Text className="text-lg text-gray-800">{userData?.lastName || lastName || 'N/A'}</Text>
            </View>
            <View className="py-2">
              <Text className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Email</Text>
              <Text className="text-lg text-gray-800">{userData?.email || email || 'N/A'}</Text>
            </View>
          </View>
        );
      case 'Security':
        return (
          <View className={`bg-white ${cardPadding} rounded-xl shadow-lg`}>
            <Text className="text-2xl font-semibold text-gray-900 mb-8">Change Password</Text>
            {passwordError && <Text className="text-sm text-red-600 mb-5 -mt-2 text-center font-medium">{passwordError}</Text>}
            <View className={formVerticalSpacing}>
                <View>
                  <Text className={labelBaseClass}>Current Password</Text>
                  <TextInput className={inputBaseClass} value={currentPassword} onChangeText={setCurrentPassword} placeholder="Enter current password" secureTextEntry editable={!isChangingPassword}/>
                </View>
                <View>
                  <Text className={labelBaseClass}>New Password</Text>
                  <TextInput className={inputBaseClass} value={newPassword} onChangeText={setNewPassword} placeholder="Enter new password" secureTextEntry editable={!isChangingPassword}/>
                </View>
                <View>
                  <Text className={labelBaseClass}>Confirm New Password</Text>
                  <TextInput className={inputBaseClass} value={confirmNewPassword} onChangeText={setConfirmNewPassword} placeholder="Confirm new password" secureTextEntry editable={!isChangingPassword}/>
                </View>
            </View>
            <View className={`flex-row justify-end items-center space-x-4 ${buttonGroupSpacing}`}>
                <TouchableOpacity
                  className="py-3 px-6 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 shadow-sm"
                  onPress={() => { setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword(''); setPasswordError(null); }}
                  disabled={isChangingPassword}
                >
                  <Text className="text-gray-700 font-semibold text-base">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="bg-mikado_yellow py-3.5 px-7 rounded-lg flex-row items-center shadow-md hover:bg-opacity-90"
                  onPress={handleChangePassword}
                  disabled={isChangingPassword}
                >
                  {isChangingPassword && <ActivityIndicator size="small" color="#000000" className="mr-2" />}
                  <Text className="text-black font-bold text-base">Update Password</Text>
                </TouchableOpacity>
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
      <View className="bg-gray-50 pt-12 pb-8 px-6 items-center border-b border-gray-200 shadow-sm">
        <View className="w-32 h-32 rounded-full bg-mikado_yellow justify-center items-center mb-5 border-4 border-white shadow-xl">
          <Text className="text-5xl font-bold text-black">{getInitials(currentDisplayName)}</Text>
        </View>
        <Text className="text-3xl font-semibold text-gray-900 mb-1.5">{currentDisplayName}</Text>
        <Text className="text-base text-gray-500">{memberSinceText}</Text>
      </View>

      {/* Tab Navigation - below fixed header, above scrollable content */}
      <View className="flex-row justify-center bg-white border-b border-gray-200 shadow-sm">
        {['Personal Information', 'Security', 'Preferences'].map((tab) => (
          <TouchableOpacity
            key={tab}
            className={`py-4 px-6 border-b-2 ${
              activeTab === tab ? 'border-cordovan' : 'border-transparent'
            }`}
            onPress={() => setActiveTab(tab as ProfileTab)}
          >
            <Text
              className={`text-base font-medium ${
                activeTab === tab ? 'text-cordovan' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
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
          <TouchableOpacity
            className="bg-cordovan py-4 rounded-xl items-center justify-center flex-row shadow-lg hover:bg-opacity-90"
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={22} color="#FFFFFF" className="mr-2.5"/>
            <Text className="text-white text-lg font-semibold">Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen; 