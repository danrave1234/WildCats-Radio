const API_BASE_URL = 'http://192.168.34.212:8080/api'; // Adjusted base URL

interface AuthResponse {
  token?: string; // Assuming your API returns a token
  userId?: string;
  message?: string;
  error?: string;
}

// Define the expected structure for user data from /api/auth/me
export interface UserData {
  id?: string; // Assuming id might be part of user data
  fullName?: string; // Changed from name for consistency with request
  name?: string; // Keeping this if API actually returns 'name'
  firstName?: string; // For editing and potentially if API returns it
  lastName?: string;  // For editing and potentially if API returns it
  email?: string;
  role?: string;
  memberSince?: string; // Example for "Listener since May 2025"
  message?: string; // Added to handle potential error messages from API
  // Add other fields as expected from your API
  error?: string; // For error messages from the service
}

// Interface for updating user profile (firstName, lastName, email)
export interface UpdateUserProfilePayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  // Add any other updatable fields here
}

// Interface for changing password
export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

// Generic API response for PUT/POST operations
export interface ApiResponse {
  message?: string;
  error?: string;
  // Include other common response fields if any
}

export const loginUser = async (email: string, password: string): Promise<AuthResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data: AuthResponse = await response.json();

    if (!response.ok) {
      return { error: data.message || 'Login failed' };
    }
    return data;
  } catch (error) {
    console.error('Login API error:', error);
    return { error: 'An unexpected error occurred. Please try again.' };
  }
};

export const registerUser = async (userData: object): Promise<AuthResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    const responseText = await response.text(); // Get response as text first
    console.log('Raw registration response text:', responseText); // Log the raw text

    if (!response.ok) {
      // Try to parse error message if server sends JSON error, otherwise use a generic message
      try {
        const errorData: AuthResponse = JSON.parse(responseText);
        return { error: errorData.message || 'Registration failed' };
      } catch (e) {
        return { error: `Registration failed. Server responded with status ${response.status}` };
      }
    }

    // If response.ok, try to parse the success response as JSON
    try {
      const data: AuthResponse = JSON.parse(responseText);
      return data;
    } catch (e) {
      console.error('Error parsing successful registration JSON:', e);
      return { error: 'Registration successful, but response was not valid JSON.' };
    }

  } catch (error) {
    console.error('Registration API error (network or other issue):', error);
    return { error: 'An unexpected error occurred. Please try again.' };
  }
};

export const getMe = async (token: string): Promise<UserData> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data: UserData = await response.json();

    if (!response.ok) {
      // If the server provides an error message in the JSON, use it
      return { error: data.error || data.message || `Failed to fetch user data. Status: ${response.status}` };
    }
    return data;
  } catch (error) {
    console.error('GetMe API error:', error);
    // Check if error is an instance of Error to access message property
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
    return { error: errorMessage };
  }
};

export const updateUserProfile = async (
  userId: string,
  token: string,
  payload: UpdateUserProfilePayload
): Promise<ApiResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
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
  userId: string,
  token: string,
  payload: ChangePasswordPayload
): Promise<ApiResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/${userId}/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
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