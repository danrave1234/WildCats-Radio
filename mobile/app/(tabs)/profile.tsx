import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Colors from '../../constants/Colors';
import { useColorScheme } from '../../hooks/useColorScheme';

export default function ProfileScreen() {
  const { currentUser, updateProfile, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const colorScheme = useColorScheme();
  const [userData, setUserData] = useState({
    name: '',
    email: '',
    bio: '',
    preferences: {
      notifications: true,
      theme: colorScheme,
    }
  });

  useEffect(() => {
    if (currentUser) {
      setUserData({
        name: currentUser.name || '',
        email: currentUser.email || '',
        bio: currentUser.bio || '',
        preferences: {
          notifications: true,
          theme: colorScheme,
        }
      });
    }
  }, [currentUser]);

  const handleLogout = () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Log Out', 
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/login');
          }
        }
      ]
    );
  };

  const handleSaveProfile = async () => {
    if (!userData.name.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    try {
      setIsSaving(true);
      await updateProfile(currentUser.id, userData);
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const avatarPlaceholder = 'https://via.placeholder.com/100?text=' + 
    (userData.name ? userData.name.charAt(0).toUpperCase() : 'U');

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <ThemedView style={styles.header}>
        <Image 
          source={{ uri: currentUser?.avatarUrl || avatarPlaceholder }} 
          style={styles.avatar} 
        />
        <ThemedView style={styles.userInfo}>
          <ThemedText style={styles.name}>
            {isEditing ? (
              <TextInput
                style={[styles.input, { color: Colors[colorScheme].text }]}
                value={userData.name}
                onChangeText={(text) => setUserData({ ...userData, name: text })}
                placeholder="Your Name"
                placeholderTextColor={Colors[colorScheme === 'dark' ? 'dark' : 'light'].tabIconDefault}
              />
            ) : (
              userData.name
            )}
          </ThemedText>
          <ThemedText style={styles.role}>
            {currentUser?.role || 'Listener'}
          </ThemedText>
          <ThemedText style={styles.email}>{userData.email}</ThemedText>
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.card}>
        <ThemedText style={styles.cardTitle}>Account Information</ThemedText>
        
        <ThemedView style={styles.infoRow}>
          <MaterialIcons name="email" size={24} color={Colors[colorScheme].text} style={styles.icon} />
          <ThemedView style={styles.infoContent}>
            <ThemedText style={styles.infoLabel}>Email</ThemedText>
            <ThemedText style={styles.infoValue}>{userData.email}</ThemedText>
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.infoRow}>
          <MaterialCommunityIcons name="badge-account" size={24} color={Colors[colorScheme].text} style={styles.icon} />
          <ThemedView style={styles.infoContent}>
            <ThemedText style={styles.infoLabel}>User ID</ThemedText>
            <ThemedText style={styles.infoValue}>{currentUser?.id}</ThemedText>
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.infoRow}>
          <MaterialIcons name="verified-user" size={24} color={Colors[colorScheme].text} style={styles.icon} />
          <ThemedView style={styles.infoContent}>
            <ThemedText style={styles.infoLabel}>Account Type</ThemedText>
            <ThemedText style={styles.infoValue}>{currentUser?.role || 'Listener'}</ThemedText>
          </ThemedView>
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.card}>
        <ThemedText style={styles.cardTitle}>Profile Bio</ThemedText>
        
        {isEditing ? (
          <TextInput
            style={[
              styles.bioInput,
              { 
                color: Colors[colorScheme].text,
                backgroundColor: colorScheme === 'dark' ? '#333333' : '#f9f9f9'
              }
            ]}
            value={userData.bio}
            onChangeText={(text) => setUserData({ ...userData, bio: text })}
            placeholder="Tell us about yourself..."
            placeholderTextColor={Colors[colorScheme === 'dark' ? 'dark' : 'light'].tabIconDefault}
            multiline={true}
            numberOfLines={4}
          />
        ) : (
          <ThemedText style={styles.bioText}>
            {userData.bio || 'No bio provided yet. Edit your profile to add a bio.'}
          </ThemedText>
        )}
      </ThemedView>

      {/* Edit/Save Buttons */}
      <ThemedView style={styles.actionsContainer}>
        {isEditing ? (
          <>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton]} 
              onPress={() => setIsEditing(false)}
              disabled={isSaving}
            >
              <ThemedText style={styles.buttonText}>Cancel</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.saveButton]} 
              onPress={handleSaveProfile}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <ThemedText style={styles.saveButtonText}>Save Profile</ThemedText>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity 
            style={[styles.button, styles.editButton]} 
            onPress={() => setIsEditing(true)}
          >
            <Ionicons name="pencil" size={18} color="white" style={styles.buttonIcon} />
            <ThemedText style={styles.editButtonText}>Edit Profile</ThemedText>
          </TouchableOpacity>
        )}
      </ThemedView>

      <TouchableOpacity 
        style={styles.logoutButton} 
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={20} color="#ff3b30" style={styles.logoutIcon} />
        <ThemedText style={styles.logoutText}>Log Out</ThemedText>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  userInfo: {
    marginLeft: 16,
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  role: {
    fontSize: 16,
    marginBottom: 4,
    opacity: 0.8,
  },
  email: {
    fontSize: 14,
    opacity: 0.7,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  bioText: {
    fontSize: 16,
    lineHeight: 22,
  },
  bioInput: {
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 16,
  },
  input: {
    fontSize: 20,
    fontWeight: 'bold',
    padding: 0,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    backgroundColor: '#8a2424', // maroon color
    minWidth: 150,
  },
  saveButton: {
    backgroundColor: '#8a2424', // maroon color
    flex: 1,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#6b7280', // gray color
    flex: 1,
    marginRight: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  editButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  buttonIcon: {
    marginRight: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginBottom: 32,
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutText: {
    color: '#ff3b30',
    fontSize: 16,
    fontWeight: '600',
  },
});
