import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Text, ActivityIndicator, TextInput, Modal, Alert } from 'react-native';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { authService } from '../../services/api';
import { useColorScheme } from '../../hooks/useColorScheme';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const { currentUser, logout, updateProfile, changePassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  // Profile edit state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: ''
  });

  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Set initial profile data
  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        name: currentUser.name || '',
        email: currentUser.email || ''
      });
    }
  }, [currentUser]);

  // Handle profile form changes
  const handleProfileChange = (name, value) => {
    setProfileForm({
      ...profileForm,
      [name]: value
    });
  };

  // Handle password form changes
  const handlePasswordChange = (name, value) => {
    setPasswordForm({
      ...passwordForm,
      [name]: value
    });
  };

  // Handle profile update
  const handleProfileUpdate = async () => {
    if (!profileForm.name || !profileForm.email) {
      setError('Name and email are required');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Update profile
      await updateProfile(currentUser.id, {
        name: profileForm.name,
        email: profileForm.email
      });

      // Close modal and show success message
      setShowProfileModal(false);
      setSuccess('Profile updated successfully');
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle password change
  const handlePasswordUpdate = async () => {
    // Validate password
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Change password
      await changePassword(currentUser.id, {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });

      // Close modal and show success message
      setShowPasswordModal(false);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setSuccess('Password changed successfully');
    } catch (err) {
      console.error('Error changing password:', err);
      setError('Failed to change password. Please check your current password and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Logout",
          onPress: async () => {
            await logout();
            router.replace('/login');
          }
        }
      ]
    );
  };

  if (!currentUser) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7F1D1D" />
        <ThemedText style={styles.loadingText}>Loading profile...</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Profile</ThemedText>
      </ThemedView>

      {error && (
        <ThemedView style={[styles.alertContainer, { backgroundColor: isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEF2F2' }]}>
          <ThemedText style={{ color: isDark ? '#FECACA' : '#B91C1C' }}>{error}</ThemedText>
        </ThemedView>
      )}

      {success && (
        <ThemedView style={[styles.alertContainer, { backgroundColor: isDark ? 'rgba(6, 95, 70, 0.2)' : '#ECFDF5' }]}>
          <ThemedText style={{ color: isDark ? '#A7F3D0' : '#065F46' }}>{success}</ThemedText>
        </ThemedView>
      )}

      <ThemedView style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={[styles.avatarCircle, { backgroundColor: isDark ? '#1D3D47' : '#A1CEDC' }]}>
            <Text style={styles.avatarText}>
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : currentUser.email.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <ThemedText style={styles.profileName}>{currentUser.name || 'User'}</ThemedText>
            <ThemedText style={styles.profileEmail}>{currentUser.email}</ThemedText>
            <View style={[
              styles.roleBadge, 
              { 
                backgroundColor: 
                  currentUser.role === 'ADMIN' 
                    ? (isDark ? '#5B21B6' : '#F5F3FF') 
                    : currentUser.role === 'DJ'
                      ? (isDark ? '#1E3A8A' : '#EFF6FF')
                      : (isDark ? '#065F46' : '#ECFDF5')
              }
            ]}>
              <Text style={{ 
                color: 
                  currentUser.role === 'ADMIN' 
                    ? (isDark ? '#F5F3FF' : '#5B21B6') 
                    : currentUser.role === 'DJ'
                      ? (isDark ? '#EFF6FF' : '#1E3A8A')
                      : (isDark ? '#ECFDF5' : '#065F46'),
                fontWeight: 'bold',
                fontSize: 12
              }}>
                {currentUser.role}
              </Text>
            </View>
          </View>
        </View>
      </ThemedView>

      <ThemedView style={styles.actionsCard}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => setShowProfileModal(true)}
        >
          <ThemedText style={styles.actionButtonText}>Edit Profile</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => setShowPasswordModal(true)}
        >
          <ThemedText style={styles.actionButtonText}>Change Password</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.logoutButton]}
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ThemedView>

      {/* Profile Edit Modal */}
      <Modal
        visible={showProfileModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>Edit Profile</ThemedText>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Name</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: isDark ? '#374151' : 'white',
                    borderColor: isDark ? '#4B5563' : '#D1D5DB',
                    color: isDark ? 'white' : 'black'
                  }
                ]}
                value={profileForm.name}
                onChangeText={(text) => handleProfileChange('name', text)}
                placeholder="Enter your name"
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Email</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: isDark ? '#374151' : 'white',
                    borderColor: isDark ? '#4B5563' : '#D1D5DB',
                    color: isDark ? 'white' : 'black'
                  }
                ]}
                value={profileForm.email}
                onChangeText={(text) => handleProfileChange('email', text)}
                placeholder="Enter your email"
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.button, styles.secondaryButton]}
                onPress={() => setShowProfileModal(false)}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.button, styles.primaryButton]}
                onPress={handleProfileUpdate}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.buttonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* Password Change Modal */}
      <Modal
        visible={showPasswordModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>Change Password</ThemedText>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Current Password</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: isDark ? '#374151' : 'white',
                    borderColor: isDark ? '#4B5563' : '#D1D5DB',
                    color: isDark ? 'white' : 'black'
                  }
                ]}
                value={passwordForm.currentPassword}
                onChangeText={(text) => handlePasswordChange('currentPassword', text)}
                placeholder="Enter current password"
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                secureTextEntry
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>New Password</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: isDark ? '#374151' : 'white',
                    borderColor: isDark ? '#4B5563' : '#D1D5DB',
                    color: isDark ? 'white' : 'black'
                  }
                ]}
                value={passwordForm.newPassword}
                onChangeText={(text) => handlePasswordChange('newPassword', text)}
                placeholder="Enter new password"
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                secureTextEntry
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Confirm New Password</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: isDark ? '#374151' : 'white',
                    borderColor: isDark ? '#4B5563' : '#D1D5DB',
                    color: isDark ? 'white' : 'black'
                  }
                ]}
                value={passwordForm.confirmPassword}
                onChangeText={(text) => handlePasswordChange('confirmPassword', text)}
                placeholder="Confirm new password"
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                secureTextEntry
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.button, styles.secondaryButton]}
                onPress={() => setShowPasswordModal(false)}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.button, styles.primaryButton]}
                onPress={handlePasswordUpdate}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.buttonText}>Change Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  alertContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  profileCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    marginBottom: 8,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  actionsCard: {
    padding: 16,
    borderRadius: 8,
  },
  actionButton: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  actionButtonText: {
    fontSize: 16,
  },
  logoutButton: {
    borderBottomWidth: 0,
  },
  logoutButtonText: {
    fontSize: 16,
    color: '#DC2626',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 8,
    padding: 16,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    marginLeft: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#7F1D1D',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  secondaryButtonText: {
    color: '#7F1D1D',
    fontWeight: 'bold',
  },
});
