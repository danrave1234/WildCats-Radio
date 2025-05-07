import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError } from './types';

// Constants
const API_URL = 'https://wildcat-radio-f05d362144e6.herokuapp.com/api'; // Android emulator uses 10.0.2.2 to access localhost
// For iOS simulator, use 'http://localhost:8080/api'
// For real devices, you'll need to use your machine's IP or a deployed backend URL

const TOKEN_KEY = 'wildCatsRadio_authToken';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds
});

// Request interceptor for API calls
apiClient.interceptors.request.use(
  async (config) => {
    // Get the token from storage
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    
    // If token exists, add it to the headers
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log the request for debugging
    console.log(`🚀 API Request: [${config.method?.toUpperCase()}] ${config.baseURL}${config.url}`, {
      headers: config.headers,
      params: config.params,
      data: config.data,
    });
    
    return config;
  },
  (error) => {
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for API calls
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log the successful response
    console.log(`✅ API Response: [${response.status}] ${response.config.url}`, {
      data: response.data,
    });
    
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
    
    // Log the error response
    console.error('❌ API Response Error:', {
      status: error.response?.status,
      url: originalRequest?.url,
      data: error.response?.data,
    });
    
    // Handle token expiration (401 Unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Here you can implement token refresh logic if your API supports it
        // For now, we'll just clear the token and let the user re-login
        await AsyncStorage.removeItem(TOKEN_KEY);
        // You could navigate to login screen here or trigger a global auth state change
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
      }
    }
    
    // Transform the error to a more usable format
    const apiError: ApiError = {
      status: error.response?.status || 500,
      message: (error.response?.data as any)?.message || error.message || 'Unknown error occurred',
      error: (error.response?.data as any)?.error,
      timestamp: (error.response?.data as any)?.timestamp,
      path: originalRequest?.url,
    };
    
    return Promise.reject(apiError);
  }
);

// Token management functions
export const setAuthToken = async (token: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error('Error storing auth token:', error);
  }
};

export const getAuthToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch (error) {
    console.error('Error retrieving auth token:', error);
    return null;
  }
};

export const clearAuthToken = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error('Error clearing auth token:', error);
  }
};

export default apiClient; 