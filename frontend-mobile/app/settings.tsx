import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TextInput, TouchableOpacity, Switch, ActivityIndicator, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ColorPalette } from '@/constants/ColorPalette';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth as useAuthApi, useUser } from '@/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Define preference types
type NotificationPreferences = {
  broadcastStartAlerts: boolean;
  broadcastReminders: boolean;
  scheduleUpdates: boolean;
  systemUpdates: boolean;
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isLoading } = useUser();
  const { changePassword } = useAuthApi();
  // Note: updatePreferences API needs to be implemented
  
  // Calculate bottom padding based on insets plus extra space for the bottom tab bar and listen button
  const bottomPadding = insets.bottom + 80;
  
  // Password state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // Notification preferences state
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    broadcastStartAlerts: true,
    broadcastReminders: true,
    scheduleUpdates: false,
    systemUpdates: true
  });
  
  // Loading states
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);

  // Handle password update
  const handleUpdatePassword = async () => {
    if (!user) return;
    
    // Validate form
    if (!passwordForm.currentPassword) {
      Alert.alert('Error', 'Please enter your current password');
      return;
    }
    
    if (!passwordForm.newPassword) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }
    
    if (passwordForm.newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    
    setIsUpdatingPassword(true);
    
    try {
      await changePassword.mutateAsync({
        userId: user.id,
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      
      // Clear form on success
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      Alert.alert('Success', 'Password updated successfully');
    } catch (error) {
      console.error('Failed to update password', error);
      Alert.alert('Error', 'Failed to update password. Please check your current password and try again.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };
  
  // Handle preferences update
  const handleSavePreferences = async () => {
    if (!user) return;
    
    setIsSavingPreferences(true);
    
    try {
      // TODO: Implement updatePreferences API
      // await updatePreferences.mutateAsync({
      //   userId: user.id,
      //   preferences
      // });
      
      // Mock API call with a timeout
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      Alert.alert('Success', 'Notification preferences updated successfully');
    } catch (error) {
      console.error('Failed to update preferences', error);
      Alert.alert('Error', 'Failed to update notification preferences');
    } finally {
      setIsSavingPreferences(false);
    }
  };
  
  // Toggle switch handler
  const toggleSwitch = (setting: keyof NotificationPreferences) => {
    setPreferences(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomPadding }
        ]}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={ColorPalette.cordovan.DEFAULT} />
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
          <View style={styles.backButtonSpacer} />
        </View>

        {/* Change Password Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.iconContainer}>
              <Ionicons name="key-outline" size={22} color={ColorPalette.white.DEFAULT} />
            </View>
            <Text style={styles.sectionTitle}>Change Password</Text>
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Current Password</Text>
            <TextInput
              style={styles.textInput}
              secureTextEntry
              value={passwordForm.currentPassword}
              onChangeText={(text) => setPasswordForm(prev => ({ ...prev, currentPassword: text }))}
              placeholder="Enter current password"
              placeholderTextColor={ColorPalette.black[400]}
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>New Password</Text>
            <TextInput
              style={styles.textInput}
              secureTextEntry
              value={passwordForm.newPassword}
              onChangeText={(text) => setPasswordForm(prev => ({ ...prev, newPassword: text }))}
              placeholder="Enter new password"
              placeholderTextColor={ColorPalette.black[400]}
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Confirm New Password</Text>
            <TextInput
              style={styles.textInput}
              secureTextEntry
              value={passwordForm.confirmPassword}
              onChangeText={(text) => setPasswordForm(prev => ({ ...prev, confirmPassword: text }))}
              placeholder="Confirm new password"
              placeholderTextColor={ColorPalette.black[400]}
            />
          </View>
          
          <TouchableOpacity 
            style={[styles.updateButton, isUpdatingPassword && styles.disabledButton]} 
            onPress={handleUpdatePassword}
            disabled={isUpdatingPassword}
          >
            {isUpdatingPassword ? (
              <ActivityIndicator size="small" color={ColorPalette.white.DEFAULT} />
            ) : (
              <Text style={styles.updateButtonText}>Update Password</Text>
            )}
          </TouchableOpacity>
        </View>
        
        {/* Notification Preferences Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.iconContainer}>
              <Ionicons name="notifications-outline" size={22} color={ColorPalette.white.DEFAULT} />
            </View>
            <Text style={styles.sectionTitle}>Notification Preferences</Text>
          </View>
          
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Text style={styles.preferenceName}>Broadcast Start Alerts</Text>
              <Text style={styles.preferenceDescription}>Get notified when a broadcast goes live</Text>
            </View>
            <Switch
              trackColor={{ false: ColorPalette.antiFlashWhite[700], true: ColorPalette.cordovan[600] }}
              thumbColor={preferences.broadcastStartAlerts ? ColorPalette.mikadoYellow.DEFAULT : ColorPalette.white.DEFAULT}
              ios_backgroundColor={ColorPalette.antiFlashWhite[700]}
              onValueChange={() => toggleSwitch('broadcastStartAlerts')}
              value={preferences.broadcastStartAlerts}
              style={styles.switchControl}
            />
          </View>
          
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Text style={styles.preferenceName}>Broadcast Reminders</Text>
              <Text style={styles.preferenceDescription}>Get reminders before scheduled broadcasts</Text>
            </View>
            <Switch
              trackColor={{ false: ColorPalette.antiFlashWhite[700], true: ColorPalette.cordovan[600] }}
              thumbColor={preferences.broadcastReminders ? ColorPalette.mikadoYellow.DEFAULT : ColorPalette.white.DEFAULT}
              ios_backgroundColor={ColorPalette.antiFlashWhite[700]}
              onValueChange={() => toggleSwitch('broadcastReminders')}
              value={preferences.broadcastReminders}
              style={styles.switchControl}
            />
          </View>
          
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Text style={styles.preferenceName}>New Schedule Updates</Text>
              <Text style={styles.preferenceDescription}>Get notified when new broadcasts are scheduled</Text>
            </View>
            <Switch
              trackColor={{ false: ColorPalette.antiFlashWhite[700], true: ColorPalette.cordovan[600] }}
              thumbColor={preferences.scheduleUpdates ? ColorPalette.mikadoYellow.DEFAULT : ColorPalette.white.DEFAULT}
              ios_backgroundColor={ColorPalette.antiFlashWhite[700]}
              onValueChange={() => toggleSwitch('scheduleUpdates')}
              value={preferences.scheduleUpdates}
              style={styles.switchControl}
            />
          </View>
          
          <View style={[styles.preferenceItem, styles.lastPreferenceItem]}>
            <View style={styles.preferenceInfo}>
              <Text style={styles.preferenceName}>System Updates</Text>
              <Text style={styles.preferenceDescription}>Receive notifications about system updates and maintenance</Text>
            </View>
            <Switch
              trackColor={{ false: ColorPalette.antiFlashWhite[700], true: ColorPalette.cordovan[600] }}
              thumbColor={preferences.systemUpdates ? ColorPalette.mikadoYellow.DEFAULT : ColorPalette.white.DEFAULT}
              ios_backgroundColor={ColorPalette.antiFlashWhite[700]}
              onValueChange={() => toggleSwitch('systemUpdates')}
              value={preferences.systemUpdates}
              style={styles.switchControl}
            />
          </View>
          
          <TouchableOpacity 
            style={[styles.saveButton, isSavingPreferences && styles.disabledButton]} 
            onPress={handleSavePreferences}
            disabled={isSavingPreferences}
          >
            {isSavingPreferences ? (
              <ActivityIndicator size="small" color={ColorPalette.white.DEFAULT} />
            ) : (
              <Text style={styles.saveButtonText}>Save Preferences</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
    paddingTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: ColorPalette.black.DEFAULT,
    textAlign: 'center',
  },
  backButton: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: ColorPalette.white.DEFAULT,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: ColorPalette.antiFlashWhite[700],
  },
  backButtonSpacer: {
    width: 40, // Same width as backButton to center the title
  },
  section: {
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: ColorPalette.black.DEFAULT,
    marginLeft: 12,
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
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  updateButton: {
    backgroundColor: ColorPalette.cordovan.DEFAULT,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    alignSelf: 'flex-end',
    paddingHorizontal: 26,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  updateButtonText: {
    color: ColorPalette.white.DEFAULT,
    fontSize: 16,
    fontWeight: '600',
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: ColorPalette.antiFlashWhite[500],
  },
  preferenceInfo: {
    flex: 1,
    paddingRight: 16,
  },
  preferenceName: {
    fontSize: 16,
    fontWeight: '600',
    color: ColorPalette.black.DEFAULT,
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 13,
    color: ColorPalette.black[600],
    lineHeight: 18,
  },
  saveButton: {
    backgroundColor: ColorPalette.cordovan.DEFAULT,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingHorizontal: 28,
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
    alignSelf: 'center',
  },
  saveButtonText: {
    color: ColorPalette.white.DEFAULT,
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.7,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: ColorPalette.cordovan.DEFAULT,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: ColorPalette.black.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  switchControl: {
    transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }],
  },
  lastPreferenceItem: {
    borderBottomWidth: 0,
  },
}); 