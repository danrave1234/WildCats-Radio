import { config } from '../config';

/**
 * Authentication API Service
 * Handles all authentication-related API calls
 */

const getApiUrl = (endpoint: string) => {
  // config.apiBaseUrl already includes /api suffix
  const baseUrl = config.apiBaseUrl.replace(/\/$/, '');
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  // Remove /api from endpoint if it's already in baseUrl to avoid duplication
  if (cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.replace('/api', '');
  }
  return `${baseUrl}${cleanEndpoint}`;
};

export const authService = {
  login: async (credentials: { email: string; password: string }) => {
    try {
      const url = getApiUrl('/api/auth/login');
      console.log('Logging in to:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        let errorMessage = 'Login failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || `Server error: ${response.status}`;
        } catch (parseError) {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error: any) {
      if (error.message === 'Network request failed' || error.message.includes('Network')) {
        throw new Error('Network error: Please check your internet connection and ensure the server is running.');
      }
      throw error;
    }
  },

  register: async (userData: {
    firstname: string;
    lastname: string;
    email: string;
    password: string;
    birthdate: string;
    gender?: string;
  }) => {
    try {
      const url = getApiUrl('/api/auth/register');
      console.log('Registering to:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        // Note: credentials: 'include' may not work in React Native
        // Cookies are handled differently in mobile apps
        credentials: 'include',
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        let errorMessage = 'Registration failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || `Server error: ${response.status}`;
        } catch (parseError) {
          // If response is not JSON, use status text
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error: any) {
      // Handle network errors
      if (error.message === 'Network request failed' || error.message.includes('Network')) {
        throw new Error('Network error: Please check your internet connection and ensure the server is running.');
      }
      // Re-throw other errors
      throw error;
    }
  },

  logout: async () => {
    const response = await fetch(getApiUrl('/api/auth/logout'), {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Logout failed');
    }

    return response.json();
  },

  getCurrentUser: async () => {
    const response = await fetch(getApiUrl('/api/auth/me'), {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Not authenticated');
      }
      throw new Error('Failed to get current user');
    }

    return response.json();
  },
};

