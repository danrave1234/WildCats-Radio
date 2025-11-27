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

