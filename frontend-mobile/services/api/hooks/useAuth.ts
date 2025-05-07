import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authService } from '../endpoints/authService';
import { LoginRequest, RegisterRequest } from '../types';

export const useAuth = () => {
  const queryClient = useQueryClient();

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: (credentials: LoginRequest) => authService.login(credentials),
    onSuccess: () => {
      // Invalidate relevant queries when login is successful
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: (userData: RegisterRequest) => authService.register(userData),
  });

  // Verify email mutation
  const verifyEmailMutation = useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) => 
      authService.verifyEmail(email, code),
  });

  // Send verification code mutation
  const sendVerificationMutation = useMutation({
    mutationFn: (email: string) => authService.sendVerificationCode(email),
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      // Clear user data from React Query cache
      queryClient.clear();
    },
  });

  return {
    login: loginMutation,
    register: registerMutation,
    verifyEmail: verifyEmailMutation,
    sendVerification: sendVerificationMutation,
    logout: logoutMutation,
  };
}; 