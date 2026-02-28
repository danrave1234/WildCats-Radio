import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../services/authService';

interface User {
  id: number;
  email: string;
  firstname: string;
  lastname: string;
  role?: string;
}

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  error: string | null;
  login: (credentials: { email: string; password: string }) => Promise<User>;
  register: (userData: {
    firstname: string;
    lastname: string;
    email: string;
    password: string;
    birthdate: string;
    gender?: string;
  }) => Promise<any>;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = '@wildcats_radio_user';
const SESSION_TIMESTAMP_KEY = '@wildcats_radio_session_timestamp';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user from storage on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      setLoading(true);
      
      // Try to load user from storage first
      const storedUserJson = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (storedUserJson) {
        const storedUser = JSON.parse(storedUserJson);
        setCurrentUser(storedUser);
      }

      // Verify with server
      try {
        const response = await authService.getCurrentUser();
        const user = response.data || response;
        setCurrentUser(user);
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
        await AsyncStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
      } catch (err: any) {
        // If server check fails, clear storage
        if (err.message === 'Not authenticated') {
          setCurrentUser(null);
          await AsyncStorage.removeItem(USER_STORAGE_KEY);
          await AsyncStorage.removeItem(SESSION_TIMESTAMP_KEY);
        }
      }
    } catch (err) {
      console.error('Auth check error:', err);
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials: { email: string; password: string }) => {
    try {
      setLoading(true);
      setError(null);

      const normalized = {
        ...credentials,
        email: credentials.email.trim().toLowerCase(),
      };

      const response = await authService.login(normalized);
      const user = response.data?.user || response.user || response;

      setCurrentUser(user);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      await AsyncStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());

      return user;
    } catch (err: any) {
      const errorMessage = err.message || 'Login failed. Please try again.';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: {
    firstname: string;
    lastname: string;
    email: string;
    password: string;
    birthdate: string;
    gender?: string;
  }) => {
    try {
      setLoading(true);
      setError(null);

      const response = await authService.register(userData);
      return response;
    } catch (err: any) {
      const errorMessage = err.message || 'Registration failed. Please try again.';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      setError(null);

      try {
        await authService.logout();
      } catch (err) {
        // Continue with local logout even if server logout fails
        console.error('Logout error:', err);
      }

      setCurrentUser(null);
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      await AsyncStorage.removeItem(SESSION_TIMESTAMP_KEY);
    } catch (err: any) {
      setError(err.message || 'Logout failed');
      // Force local logout
      setCurrentUser(null);
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      await AsyncStorage.removeItem(SESSION_TIMESTAMP_KEY);
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    currentUser,
    loading,
    error,
    login,
    register,
    logout,
    checkAuthStatus,
    isAuthenticated: !!currentUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

