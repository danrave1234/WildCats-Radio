import { config } from '../config';

const getApiUrl = (endpoint: string) => {
  const baseUrl = config.apiBaseUrl.replace(/\/$/, '');
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.replace('/api', '');
  }
  return `${baseUrl}${cleanEndpoint}`;
};

// Timeout wrapper for fetch requests
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = config.networkTimeout): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - server is not responding. Please check your connection or try again later.');
    }
    throw error;
  }
};

export interface UserData {
  id?: string | number;
  firstname?: string;
  lastname?: string;
  email?: string;
  role?: string;
  gender?: string;
  memberSince?: string;
  notifyBroadcastStart?: boolean;
  notifyBroadcastReminders?: boolean;
  notifyNewSchedule?: boolean;
  notifySystemUpdates?: boolean;
  error?: string;
}

export interface UpdateUserProfilePayload {
  firstname?: string;
  lastname?: string;
  gender?: string | null;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface ApiResponse {
  message?: string;
  error?: string;
}

export interface NotificationPreferences {
  notifyBroadcastStart?: boolean;
  notifyBroadcastReminders?: boolean;
  notifyNewSchedule?: boolean;
  notifySystemUpdates?: boolean;
}

export const getMe = async (): Promise<UserData> => {
  try {
    const response = await fetchWithTimeout(getApiUrl('/api/auth/me'), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const text = await response.text();
      if (text) {
        try {
          const data = JSON.parse(text);
          return { error: data.error || data.message || `Failed to fetch user data. Status: ${response.status}` };
        } catch (e) {
          return { error: `Failed to fetch user data. Status: ${response.status}, Response: ${text}` };
        }
      } else {
        return { error: `Failed to fetch user data. Status: ${response.status}, No response body.` };
      }
    }

    const data: UserData = await response.json();
    return data;
  } catch (error) {
    console.error('GetMe API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
    return { error: errorMessage };
  }
};

export const updateUserProfile = async (
  userId: string | number,
  payload: UpdateUserProfilePayload
): Promise<ApiResponse> => {
  try {
    const response = await fetchWithTimeout(getApiUrl(`/api/auth/${userId}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    
    const data: ApiResponse = await response.json();
    if (!response.ok) {
      return { error: data.message || data.error || `Failed to update profile. Status: ${response.status}` };
    }
    return data;
  } catch (error) {
    console.error('UpdateProfile API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

export const changeUserPassword = async (
  userId: string | number,
  payload: ChangePasswordPayload
): Promise<ApiResponse> => {
  try {
    const response = await fetchWithTimeout(getApiUrl(`/api/auth/${userId}/change-password`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    
    const data: ApiResponse = await response.json();
    if (!response.ok) {
      return { error: data.message || data.error || `Failed to change password. Status: ${response.status}` };
    }
    return data;
  } catch (error) {
    console.error('ChangePassword API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

export const updateNotificationPreferences = async (preferences: NotificationPreferences): Promise<UserData | { error: string }> => {
  try {
    const response = await fetchWithTimeout(getApiUrl('/api/auth/me/preferences'), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(preferences),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { error: data.message || data.error || `Failed to update notification preferences. Status: ${response.status}` };
    }
    
    return data as UserData;
  } catch (error) {
    console.error('UpdateNotificationPreferences API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

// Announcements interfaces and API
export interface AnnouncementDTO {
  id: number;
  title: string;
  content: string;
  imageUrl?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED' | 'REJECTED';
  pinned: boolean;
  createdAt: string;
  createdById?: number;
  createdByName?: string;
  publishedAt?: string;
  approvedByName?: string;
  scheduledFor?: string;
  expiresAt?: string;
  rejectedAt?: string;
  rejectedByName?: string;
  rejectionReason?: string;
  archivedAt?: string;
  archivedByName?: string;
  error?: string;
}

export interface AnnouncementPage {
  content: AnnouncementDTO[];
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
  error?: string;
}

// Broadcast interfaces and API
export interface BroadcastDJ {
  id?: number;
  name?: string;
}

export interface Broadcast {
  id: number;
  title: string;
  description?: string;
  scheduledStart: string; // ISO 8601 date-time string
  scheduledEnd: string;   // ISO 8601 date-time string
  actualStart?: string;    // ISO 8601 date-time string, present if started/live/ended
  actualEnd?: string;      // ISO 8601 date-time string, present if ended
  dj?: BroadcastDJ;
  status?: string; // e.g., "SCHEDULED", "LIVE", "ENDED"
  slowModeEnabled?: boolean; // Slow mode setting
  slowModeSeconds?: number; // Slow mode delay in seconds
  error?: string; // For error messages from the service
}

export const getAllAnnouncements = async (page = 0, size = 10): Promise<AnnouncementPage | { error: string }> => {
  try {
    const response = await fetchWithTimeout(getApiUrl(`/api/announcements?page=${page}&size=${size}`), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const text = await response.text();
      if (text) {
        try {
          const data = JSON.parse(text);
          return { error: data.message || data.error || `Failed to fetch announcements. Status: ${response.status}` };
        } catch (e) {
          return { error: `Failed to fetch announcements. Status: ${response.status}, Response: ${text}` };
        }
      } else {
        return { error: `Failed to fetch announcements. Status: ${response.status}, No response body.` };
      }
    }

    const data: AnnouncementPage = await response.json();
    return data;
  } catch (error) {
    console.error('GetAllAnnouncements API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred while fetching announcements.';
    return { error: errorMessage };
  }
};

export const getUpcomingBroadcasts = async (): Promise<Broadcast[] | { error: string }> => {
  try {
    const response = await fetchWithTimeout(getApiUrl('/broadcasts/upcoming'), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const text = await response.text();
      if (text) {
        try {
          const data = JSON.parse(text);
          return { error: data.message || data.error || `Failed to fetch upcoming broadcasts. Status: ${response.status}` };
        } catch (e) {
          return { error: `Failed to fetch upcoming broadcasts. Status: ${response.status}, Response: ${text}` };
        }
      } else {
        return { error: `Failed to fetch upcoming broadcasts. Status: ${response.status}, No response body.` };
      }
    }

    const data = await response.json();
    return data as Broadcast[];
  } catch (error) {
    console.error('GetUpcomingBroadcasts API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

// Notification interfaces and API
export interface NotificationDTO {
  id: number;
  message: string;
  type: string;
  timestamp: string;
  read: boolean;
  error?: string;
}

export interface NotificationPage {
  content: NotificationDTO[];
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
  last: boolean;
  error?: string;
}

export const getNotifications = async (page = 0, size = 20): Promise<NotificationPage | { error: string }> => {
  try {
    const response = await fetchWithTimeout(getApiUrl(`/notifications?page=${page}&size=${size}`), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const text = await response.text();
      if (text) {
        try {
          const data = JSON.parse(text);
          return { error: data.message || data.error || `Failed to fetch notifications. Status: ${response.status}` };
        } catch (e) {
          return { error: `Failed to fetch notifications. Status: ${response.status}, Response: ${text}` };
        }
      } else {
        return { error: `Failed to fetch notifications. Status: ${response.status}, No response body.` };
      }
    }

    const data: NotificationPage = await response.json();
    return data;
  } catch (error) {
    console.error('GetNotifications API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred while fetching notifications.';
    return { error: errorMessage };
  }
};

export const getUnreadCount = async (): Promise<number | { error: string }> => {
  try {
    const response = await fetchWithTimeout(getApiUrl('/notifications/count-unread'), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const text = await response.text();
      if (text) {
        try {
          const data = JSON.parse(text);
          return { error: data.message || data.error || `Failed to fetch unread count. Status: ${response.status}` };
        } catch (e) {
          return { error: `Failed to fetch unread count. Status: ${response.status}, Response: ${text}` };
        }
      } else {
        return { error: `Failed to fetch unread count. Status: ${response.status}, No response body.` };
      }
    }

    const data = await response.json();
    return typeof data === 'number' ? data : (data.count || 0);
  } catch (error) {
    console.error('GetUnreadCount API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

export const markNotificationAsRead = async (notificationId: number): Promise<{ message?: string } | { error: string }> => {
  try {
    const response = await fetchWithTimeout(getApiUrl(`/notifications/${notificationId}/read`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const text = await response.text();
      if (text) {
        try {
          const data = JSON.parse(text);
          return { error: data.message || data.error || `Failed to mark notification as read. Status: ${response.status}` };
        } catch (e) {
          return { error: `Failed to mark notification as read. Status: ${response.status}, Response: ${text}` };
        }
      } else {
        return { error: `Failed to mark notification as read. Status: ${response.status}, No response body.` };
      }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('MarkNotificationAsRead API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

export const markAllNotificationsAsRead = async (): Promise<{ message?: string } | { error: string }> => {
  try {
    const response = await fetchWithTimeout(getApiUrl('/notifications/read-all'), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const text = await response.text();
      if (text) {
        try {
          const data = JSON.parse(text);
          return { error: data.message || data.error || `Failed to mark all notifications as read. Status: ${response.status}` };
        } catch (e) {
          return { error: `Failed to mark all notifications as read. Status: ${response.status}, Response: ${text}` };
        }
      } else {
        return { error: `Failed to mark all notifications as read. Status: ${response.status}, No response body.` };
      }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('MarkAllNotificationsAsRead API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

