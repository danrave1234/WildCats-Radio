import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create the context
export const AuthContext = createContext(null);

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// API base URL
const API_BASE_URL = 'https://wildcat-radio-f05d362144e6.herokuapp.com/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include authentication token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Auth service
const authService = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  verify: (email, code) => api.post(`/auth/verify?email=${email}&code=${code}`),
  sendCode: (email) => api.post(`/auth/send-code?email=${email}`),
  getProfile: (id) => api.get(`/auth/${id}`),
  getCurrentUser: () => api.get('/auth/me'),
  updateProfile: (id, data) => api.put(`/auth/${id}`, data),
  changePassword: (id, data) => api.post(`/auth/${id}/change-password`, data),
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuthStatus = async () => {
      const storedToken = await AsyncStorage.getItem('token');

      if (storedToken) {
        try {
          // Validate token by getting current user profile
          const response = await authService.getCurrentUser();
          setCurrentUser(response.data);
          setToken(storedToken);

          // Update stored user ID and role from the current user data
          await AsyncStorage.setItem('userId', response.data.id.toString());
          await AsyncStorage.setItem('userRole', response.data.role);
        } catch (err) {
          // Token is invalid or expired
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('userId');
          await AsyncStorage.removeItem('userRole');
          setToken(null);
          setCurrentUser(null);
          setError('Session expired. Please log in again.');
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

      const response = await authService.login(credentials);
      const { token, user } = response.data;

      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('userId', user.id.toString());
      await AsyncStorage.setItem('userRole', user.role);

      setToken(token);
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

  // Logout function
  const logout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('userId');
    await AsyncStorage.removeItem('userRole');
    setToken(null);
    setCurrentUser(null);
  };

  const value = {
    currentUser,
    token,
    loading,
    error,
    login,
    register,
    verifyEmail,
    sendVerificationCode,
    updateProfile,
    changePassword,
    logout,
    isAuthenticated: !!token
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};