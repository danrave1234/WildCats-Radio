import axios from 'axios';
import { configUtils } from '../config';

const API_URL = configUtils.getApiUrl('/api/announcements');

// Helper to get auth headers (optional token for backward compatibility)
const getAuthHeaders = (token) => {
  const headers = { 'Content-Type': 'application/json' };
  // Only add Authorization header if token is explicitly provided
  // Otherwise, rely on HttpOnly cookies sent automatically
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

/**
 * Get published announcements (public - no auth needed)
 */
export const getAllAnnouncements = async (page = 0, size = 10) => {
  const response = await axios.get(API_URL, {
    params: { page, size },
    withCredentials: true
  });
  return response.data;
};

/**
 * Get announcements by status (Moderators/Admins only)
 */
export const getAnnouncementsByStatus = async (status, page = 0, size = 10, token = null) => {
  const response = await axios.get(`${API_URL}/by-status/${status}`, {
    params: { page, size },
    headers: getAuthHeaders(token),
    withCredentials: true
  });
  return response.data;
};

/**
 * Get current user's own announcements (DJs see their drafts)
 */
export const getMyAnnouncements = async (page = 0, size = 10, token = null) => {
  const response = await axios.get(`${API_URL}/my-announcements`, {
    params: { page, size },
    headers: getAuthHeaders(token),
    withCredentials: true
  });
  return response.data;
};

/**
 * Get a single announcement by ID
 */
export const getAnnouncementById = async (id) => {
  const response = await axios.get(`${API_URL}/${id}`, {
    withCredentials: true
  });
  return response.data;
};

/**
 * Create a new announcement
 */
export const createAnnouncement = async (announcementData, token = null) => {
  const response = await axios.post(API_URL, announcementData, {
    headers: getAuthHeaders(token),
    withCredentials: true
  });
  return response.data;
};

/**
 * Update an announcement
 */
export const updateAnnouncement = async (id, announcementData, token = null) => {
  const response = await axios.put(`${API_URL}/${id}`, announcementData, {
    headers: getAuthHeaders(token),
    withCredentials: true
  });
  return response.data;
};

/**
 * Publish a draft announcement (Moderators/Admins only)
 */
export const publishAnnouncement = async (id, token = null) => {
  const response = await axios.post(`${API_URL}/${id}/publish`, {}, {
    headers: getAuthHeaders(token),
    withCredentials: true
  });
  return response.data;
};

/**
 * Schedule an announcement for future publication (Moderators/Admins only)
 */
export const scheduleAnnouncement = async (id, scheduledFor, expiresAt, token = null) => {
  const response = await axios.post(`${API_URL}/${id}/schedule`, {
    scheduledFor,
    expiresAt
  }, {
    headers: getAuthHeaders(token),
    withCredentials: true
  });
  return response.data;
};

/**
 * Pin an announcement (Moderators/Admins only, max 2 pinned)
 */
export const pinAnnouncement = async (id, token = null) => {
  const response = await axios.post(`${API_URL}/${id}/pin`, {}, {
    headers: getAuthHeaders(token),
    withCredentials: true
  });
  return response.data;
};

/**
 * Unpin an announcement (Moderators/Admins only)
 */
export const unpinAnnouncement = async (id, token = null) => {
  const response = await axios.post(`${API_URL}/${id}/unpin`, {}, {
    headers: getAuthHeaders(token),
    withCredentials: true
  });
  return response.data;
};

/**
 * Archive an announcement (Moderators/Admins only)
 */
export const archiveAnnouncement = async (id, token = null) => {
  const response = await axios.post(`${API_URL}/${id}/archive`, {}, {
    headers: getAuthHeaders(token),
    withCredentials: true
  });
  return response.data;
};

/**
 * Unarchive an announcement (Moderators/Admins only)
 */
export const unarchiveAnnouncement = async (id, token = null) => {
  const response = await axios.post(`${API_URL}/${id}/unarchive`, {}, {
    headers: getAuthHeaders(token),
    withCredentials: true
  });
  return response.data;
};

/**
 * Reject an announcement (Moderators/Admins only)
 */
export const rejectAnnouncement = async (id, rejectionReason, token = null) => {
  const response = await axios.post(`${API_URL}/${id}/reject`, {
    rejectionReason
  }, {
    headers: getAuthHeaders(token),
    withCredentials: true
  });
  return response.data;
};

/**
 * Resubmit a rejected announcement (DJ only)
 */
export const resubmitAnnouncement = async (id, token = null) => {
  const response = await axios.post(`${API_URL}/${id}/resubmit`, {}, {
    headers: getAuthHeaders(token),
    withCredentials: true
  });
  return response.data;
};

/**
 * Delete an announcement
 */
export const deleteAnnouncement = async (id, token = null) => {
  const response = await axios.delete(`${API_URL}/${id}`, {
    headers: getAuthHeaders(token),
    withCredentials: true
  });
  return response.data;
};