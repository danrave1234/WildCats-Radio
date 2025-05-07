import apiClient, { setAuthToken, clearAuthToken } from '../apiClient';
import { 
  LoginRequest, 
  LoginResponse, 
  RegisterRequest, 
  User 
} from '../types';

export const authService = {
  /**
   * Login with email and password
   */
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/auth/login', data);
    
    // Store the token for future requests
    if (response.data.token) {
      await setAuthToken(response.data.token);
    }
    
    return response.data;
  },

  /**
   * Register a new user
   */
  register: async (data: RegisterRequest): Promise<User> => {
    const response = await apiClient.post<User>('/auth/register', data);
    return response.data;
  },

  /**
   * Verify email with code
   */
  verifyEmail: async (email: string, code: string): Promise<string> => {
    const response = await apiClient.post<string>('/auth/verify', null, {
      params: { email, code }
    });
    return response.data;
  },

  /**
   * Send verification code to email
   */
  sendVerificationCode: async (email: string): Promise<string> => {
    const response = await apiClient.post<string>('/auth/send-code', null, {
      params: { email }
    });
    return response.data;
  },

  /**
   * Get current user profile
   */
  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
  },

  /**
   * Update user profile
   */
  updateProfile: async (userId: number, userData: Partial<User>): Promise<User> => {
    const response = await apiClient.put<User>(`/auth/${userId}`, userData);
    return response.data;
  },

  /**
   * Change user password
   */
  changePassword: async (userId: number, currentPassword: string, newPassword: string): Promise<string> => {
    const response = await apiClient.post<string>(`/auth/${userId}/change-password`, {
      currentPassword,
      newPassword
    });
    return response.data;
  },

  /**
   * Logout user
   */
  logout: async (): Promise<void> => {
    // Clear token from storage
    await clearAuthToken();
    // Any additional logout logic...
  }
}; 