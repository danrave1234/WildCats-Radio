import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authService } from '../endpoints/authService';
import { LoginRequest, RegisterRequest, User } from '../types';

/**
 * Hook for authentication operations
 */
export const useAuth = () => {
  const queryClient = useQueryClient();

  // Login mutation
  const login = useMutation({
    mutationFn: (data: LoginRequest) => authService.login(data),
    onSuccess: () => {
      // Invalidate and refetch user data upon successful login
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  // Register mutation
  const register = useMutation({
    mutationFn: (data: RegisterRequest) => authService.register(data),
  });

  // Verify email mutation
  const verifyEmail = useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) =>
      authService.verifyEmail(email, code),
  });

  // Logout mutation
  const logout = useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      // Clear user data upon logout
      queryClient.removeQueries({ queryKey: ['user'] });
    },
  });

  // Update profile mutation
  const updateProfile = useMutation({
    mutationFn: ({ userId, userData }: { userId: number; userData: Partial<User> }) =>
      authService.updateProfile(userId, userData),
    onSuccess: () => {
      // Invalidate and refetch user data upon successful update
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  // Change password mutation
  const changePassword = useMutation({
    mutationFn: ({ 
      userId, 
      currentPassword, 
      newPassword 
    }: { 
      userId: number; 
      currentPassword: string; 
      newPassword: string 
    }) => authService.changePassword(userId, currentPassword, newPassword),
  });

  return {
    login,
    register,
    verifyEmail,
    logout,
    updateProfile,
    changePassword,
  };
}; 