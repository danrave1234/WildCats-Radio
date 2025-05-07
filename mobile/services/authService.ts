import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Auth service methods
export const login = (credentials) => api.post('/auth/login', credentials);
export const register = (userData) => api.post('/auth/register', userData);
export const verify = (email, code) => api.post(`/auth/verify?email=${email}&code=${code}`);
export const sendCode = (email) => api.post(`/auth/send-code?email=${email}`);
export const getProfile = (id) => api.get(`/auth/${id}`);
export const getCurrentUser = () => api.get('/auth/me');
export const updateProfile = (id, data) => api.put(`/auth/${id}`, data);
export const changePassword = (id, data) => api.post(`/auth/${id}/change-password`, data);
