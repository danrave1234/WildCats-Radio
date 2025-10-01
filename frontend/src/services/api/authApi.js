import { api } from './apiBase';

/**
 * Authentication and User Management API
 * Handles user authentication, registration, profile management, and admin operations
 */
export const authApi = {
  // Authentication operations
  login: (credentials) => api.post('/api/auth/login', credentials),
  logout: () => api.post('/api/auth/logout'),
  register: (userData) => api.post('/api/auth/register', userData),
  verify: (email, code) => api.post(`/api/auth/verify?email=${email}&code=${code}`),
  sendCode: (email) => api.post(`/api/auth/send-code?email=${email}`),
  
  // User profile operations
  getProfile: (id) => api.get(`/api/auth/${id}`),
  getCurrentUser: () => api.get('/api/auth/me'),
  updateProfile: (id, data) => api.put(`/api/auth/${id}`, data),
  changePassword: (id, data) => api.post(`/api/auth/${id}/change-password`, data),
  
  // Admin-specific operations
  getAllUsers: () => api.get('/api/auth/getAll'),
  getUsersByRole: (role) => api.get(`/api/auth/by-role/${role}`),
  updateUserRole: (id, newRole) => api.put(`/api/auth/${id}/role?newRole=${newRole}`),
  updateUserRoleByActor: (id, newRole) => api.put(`/api/auth/${id}/role/by-actor?newRole=${newRole}`),

  // Moderation operations
  banUser: (id, banData) => api.post(`/api/auth/${id}/ban`, banData),
  unbanUser: (id) => api.post(`/api/auth/${id}/unban`),
};

export default authApi;