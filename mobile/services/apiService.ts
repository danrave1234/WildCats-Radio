const API_BASE_URL = 'http://192.168.5.60:8080/api'; // Adjusted base URL

interface AuthResponse {
  token?: string; // Assuming your API returns a token
  userId?: string;
  message?: string;
  error?: string;
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