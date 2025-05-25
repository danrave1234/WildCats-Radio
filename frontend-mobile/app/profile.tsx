import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Image, ActivityIndicator, TextInput, Alert, Modal, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ColorPalette } from '@/constants/ColorPalette';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './_layout';
import { useRouter } from 'expo-router';
import { useAuth as useAuthApi, useUser } from '@/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { setIsLoggedIn } = useAuth();
  const { logout, updateProfile, changePassword } = useAuthApi();
  const { user, isLoading, isError, refetch } = useUser();
  const router = useRouter();
  
  // State for profile editing
  const [isEditing, setIsEditing] = useState(false);
  const [isNameEditing, setIsNameEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const nameInputRef = useRef<TextInput>(null);
  const [formData, setFormData] = useState({
    name: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameUpdated, setNameUpdated] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  
  // Logout confirmation dialog state
  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Calculate bottom padding based on insets plus extra space for the bottom tab bar and listen button
  const bottomPadding = insets.bottom + 80;

  useEffect(() => {
    if (isNameEditing && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isNameEditing]);

  useEffect(() => {
    if (user) {
      setNewName(user.name || 'Wildcat User');
    }
  }, [user]);

  const showLogoutDialog = () => {
    setLogoutDialogVisible(true);
  };

  const hideLogoutDialog = () => {
    setLogoutDialogVisible(false);
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout.mutateAsync();
      setIsLoggedIn(false);
      // @ts-ignore - Temporarily ignore TypeScript errors for paths
      router.replace('/login');
    } catch (error) {
      console.error('Logout failed', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    } finally {
      setIsLoggingOut(false);
      hideLogoutDialog();
    }
  };
  
  // Toggle edit mode and initialize form with current values
  const toggleEditMode = () => {
    if (!isEditing && user) {
      setFormData({
        name: user.name || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
    setIsEditing(!isEditing);
    // Reset update flags when toggling
    setNameUpdated(false);
    setPasswordUpdated(false);
  };

  // Toggle name editing mode
  const toggleNameEditing = () => {
    if (!isNameEditing && user) {
      setNewName(user.name || 'Wildcat User');
    }
    setIsNameEditing(!isNameEditing);
  };

  // Handle saving the edited name
  const saveNameChange = async () => {
    if (!user) return;
    
    // Validate name
    if (!newName.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    if (newName.trim() === user.name) {
      setIsNameEditing(false);
      return; // No changes made
    }
    
    setIsSubmitting(true);
    
    try {
      await updateProfile.mutateAsync({
        userId: user.id,
        userData: {
          name: newName.trim(),
        },
      });
      
      // Refresh user data
      await refetch();
      
      // Exit edit mode
      setIsNameEditing(false);
      Alert.alert('Success', 'Name updated successfully');
    } catch (error) {
      console.error('Update name failed', error);
      Alert.alert('Error', 'Failed to update name');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle form submission - updates both name and password if provided
  const handleSubmitForm = async () => {
    setNameUpdated(false);
    setPasswordUpdated(false);
    
    if (!user) return;
    
    // Validate name
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Update name if it changed
      if (formData.name.trim() !== user.name) {
        await updateProfile.mutateAsync({
          userId: user.id,
          userData: {
            name: formData.name.trim(),
          },
        });
        setNameUpdated(true);
      }
      
      // Update password if all password fields are filled
      const passwordFieldsFilled = formData.currentPassword && formData.newPassword && formData.confirmPassword;
      
      if (passwordFieldsFilled) {
        // Password validation
        if (formData.newPassword !== formData.confirmPassword) {
          Alert.alert('Error', 'New passwords do not match');
          setIsSubmitting(false);
          return;
        }
        
        if (formData.newPassword.length < 6) {
          Alert.alert('Error', 'New password must be at least 6 characters');
          setIsSubmitting(false);
          return;
        }
        
        try {
          await changePassword.mutateAsync({
            userId: user.id,
            currentPassword: formData.currentPassword,
            newPassword: formData.newPassword,
          });
          setPasswordUpdated(true);
        } catch (passwordError) {
          console.error('Change password failed', passwordError);
          Alert.alert('Error', 'Failed to change password. Make sure your current password is correct.');
          setIsSubmitting(false);
          return;
        }
      }
      
      // Refresh user data
      await refetch(); 
      
      // Show success message based on what was updated
      if (nameUpdated && passwordUpdated) {
        Alert.alert('Success', 'Profile and password updated successfully');
      } else if (nameUpdated) {
        Alert.alert('Success', 'Profile updated successfully');
      } else if (passwordUpdated) {
        Alert.alert('Success', 'Password updated successfully');
      } else {
        Alert.alert('Info', 'No changes were made');
      }
      
      // Exit edit mode
      setIsEditing(false);
    } catch (error) {
      console.error('Update profile failed', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render edit profile form
  const renderEditProfileForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.formTitle}>Edit Profile</Text>
      
      {/* Name Field */}
      <View style={styles.formSection}>
        <Text style={styles.sectionLabel}>Personal Information</Text>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Name</Text>
          <TextInput
            style={styles.textInput}
            value={formData.name}
            onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
            placeholder="Your name"
            placeholderTextColor={ColorPalette.black[400]}
          />
        </View>
      </View>
      
      {/* Password Fields */}
      <View style={styles.formSection}>
        <Text style={styles.sectionLabel}>Change Password (optional)</Text>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Current Password</Text>
          <TextInput
            style={styles.textInput}
            value={formData.currentPassword}
            onChangeText={(text) => setFormData(prev => ({ ...prev, currentPassword: text }))}
            secureTextEntry
            placeholder="Enter current password"
            placeholderTextColor={ColorPalette.black[400]}
          />
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>New Password</Text>
          <TextInput
            style={styles.textInput}
            value={formData.newPassword}
            onChangeText={(text) => setFormData(prev => ({ ...prev, newPassword: text }))}
            secureTextEntry
            placeholder="Enter new password"
            placeholderTextColor={ColorPalette.black[400]}
          />
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Confirm New Password</Text>
          <TextInput
            style={styles.textInput}
            value={formData.confirmPassword}
            onChangeText={(text) => setFormData(prev => ({ ...prev, confirmPassword: text }))}
            secureTextEntry
            placeholder="Confirm new password"
            placeholderTextColor={ColorPalette.black[400]}
          />
        </View>
        <Text style={styles.helperText}>
          Leave password fields empty if you don't want to change your password
        </Text>
      </View>
      
      {/* Action Buttons */}
      <View style={styles.formActions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.cancelButton]} 
          onPress={toggleEditMode}
          disabled={isSubmitting}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.saveButton, isSubmitting && styles.disabledButton]} 
          onPress={handleSubmitForm}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={ColorPalette.white.DEFAULT} />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Your Profile</Text>
        
        <View style={styles.headerRight}>
          {/* Empty space to match the schedule.tsx layout */}
        </View>
      </View>
      
      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomPadding }
        ]}
      >
        <View style={styles.contentSpacerTop} />
        {isEditing ? (
          renderEditProfileForm()
        ) : (
          <>
            <View style={styles.profileSection}>
              <TouchableOpacity 
                style={styles.editIconTopRight} 
                onPress={toggleNameEditing}
                activeOpacity={0.7}
              >
                <Ionicons name="pencil-sharp" size={20} color={ColorPalette.mikadoYellow.DEFAULT} />
              </TouchableOpacity>
              
              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={50} color={ColorPalette.white.DEFAULT} />
                </View>
                <View style={styles.statusIndicator} />
              </View>
              
              {isLoading ? (
                <ActivityIndicator size="small" color={ColorPalette.cordovan.DEFAULT} />
              ) : isError ? (
                <Text style={styles.errorText}>Could not load profile data</Text>
              ) : (
                <>
                  {isNameEditing ? (
                    <View style={styles.nameEditContainer}>
                      <TextInput
                        ref={nameInputRef}
                        style={styles.nameInput}
                        value={newName}
                        onChangeText={setNewName}
                        placeholder="Your name"
                        placeholderTextColor={ColorPalette.black[400]}
                        autoCapitalize="words"
                        selectTextOnFocus
                      />
                      <View style={styles.nameEditActions}>
                        <TouchableOpacity 
                          style={styles.nameEditButton} 
                          onPress={() => setIsNameEditing(false)}
                          disabled={isSubmitting}
                        >
                          <Ionicons name="close" size={22} color={ColorPalette.cordovan.DEFAULT} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.nameEditButton, styles.saveNameButton]} 
                          onPress={saveNameChange}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <ActivityIndicator size="small" color={ColorPalette.white.DEFAULT} />
                          ) : (
                            <Ionicons name="checkmark" size={22} color={ColorPalette.white.DEFAULT} />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.username}>{user?.name || 'Wildcat User'}</Text>
                  )}
                  <Text style={styles.email}>{user?.email || 'user@wildcatsradio.com'}</Text>
                  <View style={styles.activeBadge}>
                    <View style={styles.activeIndicator} />
                    <Text style={styles.activeText}>{user?.role || 'N/A'}</Text>
                  </View>
                </>
              )}
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.sectionTitle}>Account Management</Text>
              
              <Text style={styles.settingsDescription}>
                Need to change your password or update notification preferences?
              </Text>
              
              <TouchableOpacity 
                style={styles.settingsButton} 
                onPress={() => {
                  // @ts-ignore - Temporarily ignore TypeScript errors for paths
                  router.push('/settings');
                }}
              >
                <Text style={styles.settingsButtonText}>Go to Settings</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={showLogoutDialog}>
              <Ionicons name="log-out-outline" size={24} color={ColorPalette.cordovan.DEFAULT} />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Logout confirmation dialog */}
      <Modal
        visible={logoutDialogVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={hideLogoutDialog}
      >
        <Pressable style={styles.modalBackground} onPress={hideLogoutDialog}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Image 
              source={require('@/assets/images/wildcat_radio_logo_transparent.png')} 
              style={styles.modalLogo}
              resizeMode="contain"
            />
            <Text style={styles.modalTitle}>Logout</Text>
            <Text style={styles.modalMessage}>Are you sure you want to logout from your account?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalCancelButton]} 
                onPress={hideLogoutDialog}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalLogoutButton]}
                onPress={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <ActivityIndicator size="small" color={ColorPalette.white.DEFAULT} />
                ) : (
                  <Text style={styles.modalLogoutText}>Logout</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ColorPalette.antiFlashWhite.DEFAULT,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 0,
  },
  contentSpacerTop: {
    height: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: ColorPalette.white.DEFAULT,
    borderBottomWidth: 1,
    borderBottomColor: ColorPalette.antiFlashWhite[400],
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: ColorPalette.cordovan.DEFAULT,
  },
  profileSection: {
    backgroundColor: ColorPalette.white.DEFAULT,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 6,
    position: 'relative',
  },
  avatarContainer: {
    marginBottom: 20,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: ColorPalette.cordovan.DEFAULT,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 3,
    borderColor: ColorPalette.white.DEFAULT,
  },
  statusIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ColorPalette.mikadoYellow.DEFAULT,
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 3,
    borderColor: ColorPalette.white.DEFAULT,
  },
  username: {
    fontSize: 26,
    fontWeight: 'bold',
    color: ColorPalette.black.DEFAULT,
    marginBottom: 6,
  },
  email: {
    fontSize: 16,
    color: ColorPalette.black[600],
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: ColorPalette.cordovan[700],
    marginTop: 8,
  },
  settingsSection: {
    backgroundColor: ColorPalette.white.DEFAULT,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 6,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: ColorPalette.black.DEFAULT,
    marginBottom: 16,
  },
  settingsDescription: {
    fontSize: 15,
    color: ColorPalette.black[600],
    marginBottom: 24,
    textAlign: 'left',
    paddingHorizontal: 0,
    lineHeight: 20,
  },
  settingsButton: {
    backgroundColor: ColorPalette.cordovan.DEFAULT,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignSelf: 'center',
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  settingsButtonText: {
    color: ColorPalette.white.DEFAULT,
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: ColorPalette.white.DEFAULT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: ColorPalette.cordovan.DEFAULT,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutText: {
    color: ColorPalette.cordovan.DEFAULT,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  // Form Styles
  formContainer: {
    backgroundColor: ColorPalette.white.DEFAULT,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: ColorPalette.cordovan.DEFAULT,
    marginBottom: 24,
    textAlign: 'center',
  },
  formSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: ColorPalette.black[700],
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: ColorPalette.antiFlashWhite[700],
  },
  inputContainer: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: ColorPalette.black[700],
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: ColorPalette.antiFlashWhite.DEFAULT,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: ColorPalette.black.DEFAULT,
    borderWidth: 1,
    borderColor: ColorPalette.antiFlashWhite[700],
  },
  helperText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: ColorPalette.black[600],
    marginTop: 6,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cancelButton: {
    backgroundColor: ColorPalette.white.DEFAULT,
    borderWidth: 1.5,
    borderColor: ColorPalette.black[300],
    marginRight: 10,
  },
  cancelButtonText: {
    color: ColorPalette.black[700],
    fontWeight: '600',
    fontSize: 15,
  },
  saveButton: {
    backgroundColor: ColorPalette.cordovan.DEFAULT,
    marginLeft: 10,
  },
  saveButtonText: {
    color: ColorPalette.white.DEFAULT,
    fontWeight: '600',
    fontSize: 15,
  },
  disabledButton: {
    opacity: 0.7,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ColorPalette.antiFlashWhite.DEFAULT,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ColorPalette.mikadoYellow.DEFAULT,
  },
  activeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ColorPalette.mikadoYellow.DEFAULT,
    marginRight: 6,
  },
  activeText: {
    fontSize: 13,
    color: ColorPalette.black[700],
    fontWeight: '600',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: ColorPalette.white.DEFAULT,
    padding: 24,
    borderRadius: 20,
    width: '85%',
    alignItems: 'center',
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 5,
  },
  modalLogo: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: ColorPalette.black.DEFAULT,
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    color: ColorPalette.black[600],
    marginBottom: 28,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  modalCancelButton: {
    backgroundColor: ColorPalette.antiFlashWhite.DEFAULT,
    borderWidth: 1,
    borderColor: ColorPalette.antiFlashWhite[700],
  },
  modalCancelText: {
    color: ColorPalette.black[700],
    fontWeight: '600',
    fontSize: 15,
  },
  modalLogoutButton: {
    backgroundColor: ColorPalette.cordovan.DEFAULT,
    shadowColor: ColorPalette.cordovan[800],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  modalLogoutText: {
    color: ColorPalette.white.DEFAULT,
    fontWeight: '600',
    fontSize: 15,
  },
  editIconTopRight: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: ColorPalette.white.DEFAULT,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: ColorPalette.mikadoYellow.DEFAULT,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  nameEditContainer: {
    width: '100%',
    marginBottom: 6,
  },
  nameInput: {
    fontSize: 26,
    fontWeight: 'bold',
    color: ColorPalette.black.DEFAULT,
    borderWidth: 1,
    borderColor: ColorPalette.mikadoYellow.DEFAULT,
    backgroundColor: ColorPalette.antiFlashWhite[100],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    textAlign: 'center',
  },
  nameEditActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  nameEditButton: {
    backgroundColor: ColorPalette.white.DEFAULT,
    borderWidth: 1.5,
    borderColor: ColorPalette.cordovan.DEFAULT,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  saveNameButton: {
    backgroundColor: ColorPalette.cordovan.DEFAULT,
    borderColor: ColorPalette.cordovan.DEFAULT,
  },
}); 