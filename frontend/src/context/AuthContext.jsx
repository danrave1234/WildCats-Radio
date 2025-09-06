import { createContext, useState, useEffect, useContext } from 'react';
import { authService } from '../services/api/index.js';

// Create the context
export const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Note: Tokens are now stored in secure HttpOnly cookies set by the backend
// We can no longer access them via JavaScript for security reasons
// The browser will automatically send these cookies with requests

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if user is already logged in by validating with the server
    const checkAuthStatus = async () => {
      try {
        // The secure HttpOnly cookies will be automatically sent with this request
        const response = await authService.getCurrentUser();
        setCurrentUser(response.data);
      } catch (err) {
        // If the request fails, the user is not authenticated or token is invalid
        setCurrentUser(null);
        // Don't show error message on initial load - user might just not be logged in
        if (err.response?.status !== 401 && err.response?.status !== 403) {
          setError('Failed to verify authentication status.');
        }
      }

      setLoading(false);
    };

    checkAuthStatus();
  }, []);

  // Login function
  const login = async (credentials) => {
    try {
      setLoading(true);
      setError(null);

      const normalized = {
        ...credentials,
        email: credentials?.email ? credentials.email.trim().toLowerCase() : ''
      };

      const response = await authService.login(normalized);
      const { user } = response.data;
      
      // The secure HttpOnly cookies are now set by the backend
      // We only need to update the user state
      setCurrentUser(user);

      return user;
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Register function
  const register = async (userData) => {
    try {
      setLoading(true);
      setError(null);

      const response = await authService.register(userData);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Verify email function
  const verifyEmail = async (email, code) => {
    try {
      setLoading(true);
      setError(null);

      const response = await authService.verify(email, code);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Send verification code function
  const sendVerificationCode = async (email) => {
    try {
      setLoading(true);
      setError(null);

      const response = await authService.sendCode(email);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send verification code. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update profile function
  const updateProfile = async (id, data) => {
    try {
      setLoading(true);
      setError(null);

      const response = await authService.updateProfile(id, data);
      setCurrentUser(response.data);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Change password function
  const changePassword = async (id, passwordData) => {
    try {
      setLoading(true);
      setError(null);

      const response = await authService.changePassword(id, passwordData);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Logout function - now relies on backend to clear cookies
  const logout = async () => {
    try {
      // Call backend logout endpoint to clear secure cookies
      await authService.logout();
    } catch (err) {
      // Even if logout request fails, clear local state
      console.error('Logout request failed:', err);
    } finally {
      // Clear local state regardless of backend response
      setCurrentUser(null);
      setError(null);
    }
  };

  const value = {
    currentUser,
    loading,
    error,
    login,
    register,
    verifyEmail,
    sendVerificationCode,
    updateProfile,
    changePassword,
    logout,
    isAuthenticated: !!currentUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 
