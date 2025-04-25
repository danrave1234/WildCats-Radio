import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Text, ActivityIndicator, RefreshControl, TextInput, Modal } from 'react-native';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { authService } from '../../services/api';
import { useColorScheme } from '../../hooks/useColorScheme';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

export default function UsersScreen() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  // State for editing user role
  const [editingUser, setEditingUser] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');

  // State for creating new user
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    role: 'LISTENER',
    password: ''
  });

  // Check if user is admin
  useEffect(() => {
    if (currentUser && currentUser.role !== 'ADMIN') {
      // Redirect non-admin users
      router.replace('/(tabs)');
    } else {
      fetchUsers();
    }
  }, [currentUser]);

  // Fetch users from the backend
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authService.getAllUsers();
      setUsers(response.data);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to fetch users. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  // Open role edit modal
  const handleEditRole = (user) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setShowRoleModal(true);
  };

  // Update user role
  const handleRoleUpdate = async () => {
    if (!editingUser || !selectedRole) return;

    setLoading(true);
    try {
      await authService.updateUserRole(editingUser.id, selectedRole);

      // Update local state
      setUsers(users.map(user => 
        user.id === editingUser.id ? { ...user, role: selectedRole } : user
      ));

      // Close modal
      setShowRoleModal(false);
      setEditingUser(null);
    } catch (err) {
      console.error('Error updating user role:', err);
      setError('Failed to update user role. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle new user form changes
  const handleNewUserChange = (name, value) => {
    setNewUser({
      ...newUser,
      [name]: value
    });
  };

  // Handle new user submission
  const handleNewUserSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      // Create user registration request
      const registerRequest = {
        name: newUser.username,
        email: newUser.email,
        password: newUser.password
      };

      // Register the user
      const response = await authService.register(registerRequest);
      const createdUser = response.data;

      // If the role is not LISTENER (default), update the role
      if (newUser.role !== 'LISTENER') {
        await authService.updateUserRole(createdUser.id, newUser.role);
        createdUser.role = newUser.role;
      }

      // Update local state
      setUsers([...users, createdUser]);

      // Reset form and close modal
      setNewUser({
        username: '',
        email: '',
        role: 'LISTENER',
        password: ''
      });
      setShowNewUserModal(false);

      // Show success message
      alert('User created successfully!');
    } catch (err) {
      console.error('Error creating user:', err);
      setError('Failed to create user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7F1D1D" />
        <ThemedText style={styles.loadingText}>Loading users...</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">User Management</ThemedText>
      </ThemedView>

      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => setShowNewUserModal(true)}
      >
        <Text style={styles.addButtonText}>+ Add New User</Text>
      </TouchableOpacity>

      {error && (
        <ThemedView style={[styles.errorContainer, { backgroundColor: isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEF2F2' }]}>
          <ThemedText style={{ color: isDark ? '#FECACA' : '#B91C1C' }}>{error}</ThemedText>
        </ThemedView>
      )}

      <ScrollView 
        style={styles.userList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {users.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText>No users found</ThemedText>
          </ThemedView>
        ) : (
          users.map((user) => (
            <ThemedView key={user.id} style={styles.userCard}>
              <View style={styles.userInfo}>
                <ThemedText style={styles.userName}>{user.name || user.username}</ThemedText>
                <ThemedText style={styles.userEmail}>{user.email}</ThemedText>
                <View style={[
                  styles.roleBadge, 
                  { 
                    backgroundColor: 
                      user.role === 'ADMIN' 
                        ? (isDark ? '#5B21B6' : '#F5F3FF') 
                        : user.role === 'DJ'
                          ? (isDark ? '#1E3A8A' : '#EFF6FF')
                          : (isDark ? '#065F46' : '#ECFDF5')
                  }
                ]}>
                  <Text style={{ 
                    color: 
                      user.role === 'ADMIN' 
                        ? (isDark ? '#F5F3FF' : '#5B21B6') 
                        : user.role === 'DJ'
                          ? (isDark ? '#EFF6FF' : '#1E3A8A')
                          : (isDark ? '#ECFDF5' : '#065F46'),
                    fontWeight: 'bold',
                    fontSize: 12
                  }}>
                    {user.role}
                  </Text>
                </View>
              </View>
              <View style={styles.userActions}>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => handleEditRole(user)}
                >
                  <Text style={[styles.actionButtonText, { color: isDark ? '#93C5FD' : '#2563EB' }]}>
                    Edit Role
                  </Text>
                </TouchableOpacity>
              </View>
            </ThemedView>
          ))
        )}
      </ScrollView>

      {/* Role Edit Modal */}
      <Modal
        visible={showRoleModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRoleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>Update User Role</ThemedText>

            {editingUser && (
              <ThemedText style={styles.modalSubtitle}>
                Change role for user: {editingUser.name || editingUser.email}
              </ThemedText>
            )}

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Role</ThemedText>
              <View style={styles.pickerContainer}>
                <TouchableOpacity 
                  style={[
                    styles.roleOption, 
                    selectedRole === 'LISTENER' && styles.selectedRoleOption
                  ]}
                  onPress={() => setSelectedRole('LISTENER')}
                >
                  <Text style={[
                    styles.roleOptionText,
                    selectedRole === 'LISTENER' && styles.selectedRoleOptionText
                  ]}>Listener</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[
                    styles.roleOption, 
                    selectedRole === 'DJ' && styles.selectedRoleOption
                  ]}
                  onPress={() => setSelectedRole('DJ')}
                >
                  <Text style={[
                    styles.roleOptionText,
                    selectedRole === 'DJ' && styles.selectedRoleOptionText
                  ]}>DJ</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[
                    styles.roleOption, 
                    selectedRole === 'ADMIN' && styles.selectedRoleOption
                  ]}
                  onPress={() => setSelectedRole('ADMIN')}
                >
                  <Text style={[
                    styles.roleOptionText,
                    selectedRole === 'ADMIN' && styles.selectedRoleOptionText
                  ]}>Admin</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.button, styles.secondaryButton]}
                onPress={() => {
                  setShowRoleModal(false);
                  setEditingUser(null);
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.button, styles.primaryButton]}
                onPress={handleRoleUpdate}
              >
                <Text style={styles.buttonText}>Update Role</Text>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* New User Modal */}
      <Modal
        visible={showNewUserModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNewUserModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>Create New User</ThemedText>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Username</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: isDark ? '#374151' : 'white',
                    borderColor: isDark ? '#4B5563' : '#D1D5DB',
                    color: isDark ? 'white' : 'black'
                  }
                ]}
                value={newUser.username}
                onChangeText={(text) => handleNewUserChange('username', text)}
                placeholder="Enter username"
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
                value={newUser.email}
                onChangeText={(text) => handleNewUserChange('email', text)}
                placeholder="Enter email"
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Password</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: isDark ? '#374151' : 'white',
                    borderColor: isDark ? '#4B5563' : '#D1D5DB',
                    color: isDark ? 'white' : 'black'
                  }
                ]}
                value={newUser.password}
                onChangeText={(text) => handleNewUserChange('password', text)}
                placeholder="Enter password"
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                secureTextEntry
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Role</ThemedText>
              <View style={styles.pickerContainer}>
                <TouchableOpacity 
                  style={[
                    styles.roleOption, 
                    newUser.role === 'LISTENER' && styles.selectedRoleOption
                  ]}
                  onPress={() => handleNewUserChange('role', 'LISTENER')}
                >
                  <Text style={[
                    styles.roleOptionText,
                    newUser.role === 'LISTENER' && styles.selectedRoleOptionText
                  ]}>Listener</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[
                    styles.roleOption, 
                    newUser.role === 'DJ' && styles.selectedRoleOption
                  ]}
                  onPress={() => handleNewUserChange('role', 'DJ')}
                >
                  <Text style={[
                    styles.roleOptionText,
                    newUser.role === 'DJ' && styles.selectedRoleOptionText
                  ]}>DJ</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[
                    styles.roleOption, 
                    newUser.role === 'ADMIN' && styles.selectedRoleOption
                  ]}
                  onPress={() => handleNewUserChange('role', 'ADMIN')}
                >
                  <Text style={[
                    styles.roleOptionText,
                    newUser.role === 'ADMIN' && styles.selectedRoleOptionText
                  ]}>Admin</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.button, styles.secondaryButton]}
                onPress={() => {
                  setShowNewUserModal(false);
                  setNewUser({
                    username: '',
                    email: '',
                    role: 'LISTENER',
                    password: ''
                  });
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.button, styles.primaryButton]}
                onPress={handleNewUserSubmit}
              >
                <Text style={styles.buttonText}>Create User</Text>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </View>
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
  addButton: {
    backgroundColor: '#7F1D1D',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  userList: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
  },
  userCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  userEmail: {
    fontSize: 14,
    marginTop: 4,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  userActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
  },
  actionButtonText: {
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
  modalSubtitle: {
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
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roleOption: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginHorizontal: 4,
    borderRadius: 8,
  },
  selectedRoleOption: {
    backgroundColor: '#7F1D1D',
    borderColor: '#7F1D1D',
  },
  roleOptionText: {
    fontWeight: 'bold',
  },
  selectedRoleOptionText: {
    color: 'white',
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
