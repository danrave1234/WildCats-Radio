import ENV from '../config/environment';
import { generatePrefixedIdempotencyKey } from './idempotencyUtils';

const API_BASE_URL = ENV.API_BASE_URL; // Automatically switches between dev/prod

// Timeout wrapper for fetch requests
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = ENV.NETWORK_TIMEOUT): Promise<Response> => {
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

interface AuthResponse {
  token?: string; // Assuming your API returns a token
  userId?: string;
  message?: string;
  error?: string;
}

// Define the expected structure for user data from /api/auth/me
export interface UserData {
  id?: string; // Assuming id might be part of user data
  firstname?: string;
  lastname?: string;
  email?: string;
  role?: string;
  memberSince?: string; // Example for "Listener since May 2025"
  message?: string; // Added to handle potential error messages from API
  // Notification preferences (matching backend UserDTO)
  notifyBroadcastStart?: boolean;
  notifyBroadcastReminders?: boolean;
  notifyNewSchedule?: boolean;
  notifySystemUpdates?: boolean;
  // Add other fields as expected from your API
  error?: string; // For error messages from the service
}

// Interface for updating user profile (firstName, lastName, email)
export interface UpdateUserProfilePayload {
  firstname?: string;
  lastname?: string;
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

// Define the Broadcast type based on BroadcastDTO and usage
export interface BroadcastDJ {
  id?: number;
  name?: string;
  // Add other DJ related fields if available
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
  // Add other fields as returned by your backend
  error?: string; // For error messages from the service
}

// +++ ChatMessage Types +++
export interface ChatMessageSender { // Based on UserEntity simplified for DTO
  id?: number; // Or string depending on your UserEntity's ID type
  name?: string;
}

export interface ChatMessageDTO {
  id: number;
  content: string;
  createdAt: string; // ISO 8601 date-time string
  sender: ChatMessageSender;
  broadcastId: number;
  error?: string;
}

export interface SendChatMessagePayload {
  content: string;
}

// +++ SongRequest Types +++
export interface SongRequestUser { // Based on UserEntity simplified for DTO
  id?: number; // Or string
  name?: string;
}
export interface SongRequestDTO {
  id: number;
  songTitle: string;
  artist?: string;
  timestamp: string; // ISO 8601 date-time string
  requestedBy: SongRequestUser;
  broadcastId: number;
}

export interface CreateSongRequestPayload {
  songTitle: string;
}

// +++ Poll Types +++
export interface PollOptionDTO {
  id: number;
  text: string;
  voteCount: number;
}

export interface PollDTO {
  id: number;
  question: string;
  options: PollOptionDTO[];
  isActive: boolean; // Assuming backend provides this
  isEnded: boolean; // Assuming backend provides this
  broadcastId: number;
  // createdBy: UserData; // Might be too complex for listener, simplify if needed
  createdAt: string; // ISO 8601
  error?: string;
}

export interface VoteOnPollPayload {
  optionId: number;
  // pollId is usually part of the URL path
}

// PollResultDTO might be the same as PollDTO or a simplified version
// For now, let's assume getPollResults returns PollDTO
export interface PollResultDTO extends PollDTO {}

export const loginUser = async (email: string, password: string): Promise<AuthResponse> => {
  try {
    console.log(`🔐 Attempting login to: ${API_BASE_URL}/auth/login`);
    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const text = await response.text();
      if (text) {
        try {
          const data = JSON.parse(text);
          return { error: data.message || data.error || `Login failed. Status: ${response.status}` };
        } catch (e) {
          return { error: `Login failed. Status: ${response.status}, Response: ${text}` };
        }
      } else {
        return { error: `Login failed. Status: ${response.status}, No response body.` };
      }
    }

    const data: AuthResponse = await response.json();
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

export const getMe = async (): Promise<UserData> => {
  try {
    console.log(`👤 Fetching user data from: ${API_BASE_URL}/auth/me`);
    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
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

export const getLiveBroadcasts = async (token?: string | null): Promise<Broadcast[] | { error: string }> => {
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Only add Authorization header if token is provided
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/broadcasts/live`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      if (text) {
        try {
          const data = JSON.parse(text);
          return { error: data.message || data.error || `Failed to fetch live broadcasts. Status: ${response.status}` };
        } catch (e) {
          return { error: `Failed to fetch live broadcasts. Status: ${response.status}, Response: ${text}` };
        }
      } else {
        return { error: `Failed to fetch live broadcasts. Status: ${response.status}, No response body.` };
      }
    }

    const data = await response.json();
    return data as Broadcast[];
  } catch (error) {
    console.error('GetLiveBroadcasts API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

export const getAllBroadcasts = async (token?: string | null): Promise<Broadcast[] | { error: string }> => {
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Only add Authorization header if token is provided
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/broadcasts`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      if (text) {
        try {
          const data = JSON.parse(text);
          return { error: data.message || data.error || `Failed to fetch all broadcasts. Status: ${response.status}` };
        } catch (e) {
          return { error: `Failed to fetch all broadcasts. Status: ${response.status}, Response: ${text}` };
        }
      } else {
        return { error: `Failed to fetch all broadcasts. Status: ${response.status}, No response body.` };
      }
    }

    const data = await response.json();
    return data as Broadcast[];
  } catch (error) {
    console.error('GetAllBroadcasts API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

export const getUpcomingBroadcasts = async (token?: string | null): Promise<Broadcast[] | { error: string }> => {
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Only add Authorization header if token is provided
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/broadcasts/upcoming`, {
      method: 'GET',
      headers,
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

// +++ Chat API Functions +++
export const getChatMessages = async (broadcastId: number, token?: string): Promise<ChatMessageDTO[] | { error: string }> => {
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      (headers as any)['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE_URL}/chats/${broadcastId}`, {
      method: 'GET',
      headers,
    });
    const data = await response.json();
    if (!response.ok) {
      return { error: data.message || data.error || `Failed to fetch chat messages. Status: ${response.status}` };
    }
    // Normalize backend DTO (timestamp -> createdAt)
    const normalized = Array.isArray(data)
      ? (data as any[]).map((m) => ({
          ...m,
          createdAt: m.createdAt ?? m.timestamp ?? m.created_at ?? m.time,
        }))
      : [];
    return normalized as ChatMessageDTO[];
  } catch (error) {
    console.error('GetChatMessages API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

export const sendChatMessage = async (broadcastId: number, payload: SendChatMessagePayload, token: string): Promise<ChatMessageDTO | { error: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/chats/${broadcastId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      return { error: data.message || data.error || `Failed to send chat message. Status: ${response.status}` };
    }
    const normalized = data && typeof data === 'object'
      ? ({ ...data, createdAt: (data as any).createdAt ?? (data as any).timestamp } as ChatMessageDTO)
      : (data as ChatMessageDTO);
    return normalized;
  } catch (error) {
    console.error('SendChatMessage API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

// +++ Song Request API Functions +++
export const getSongRequestsForBroadcast = async (broadcastId: number, token: string): Promise<SongRequestDTO[] | { error: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/broadcasts/${broadcastId}/song-requests`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    const data = await response.json();
    if (!response.ok) {
      return { error: data.message || data.error || `Failed to fetch song requests. Status: ${response.status}` };
    }
    return data as SongRequestDTO[];
  } catch (error) {
    console.error('GetSongRequests API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

export const createSongRequest = async (broadcastId: number, payload: CreateSongRequestPayload, token: string): Promise<SongRequestDTO | { error: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/broadcasts/${broadcastId}/song-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      return { error: data.message || data.error || `Failed to create song request. Status: ${response.status}` };
    }
    return data as SongRequestDTO;
  } catch (error) {
    console.error('CreateSongRequest API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

// +++ Poll API Functions +++
// Helper to map backend poll response to mobile PollDTO format
const mapPollFromBackend = (poll: any): PollDTO => {
  // Backend uses 'active' (boolean), mobile expects 'isActive'
  const isActive = poll.isActive !== undefined ? poll.isActive : (poll.active !== undefined ? poll.active : false);
  // Backend uses 'endedAt' (date or null), mobile expects 'isEnded' (boolean)
  // A poll is ended if endedAt is set AND active is false
  const isEnded = poll.isEnded !== undefined 
    ? poll.isEnded 
    : (poll.endedAt !== null && poll.endedAt !== undefined && !isActive);
  
  return {
    id: poll.id,
    question: poll.question,
    options: poll.options || [],
    isActive: isActive,
    isEnded: isEnded,
    broadcastId: poll.broadcastId,
    createdAt: poll.createdAt,
    ...(poll.error && { error: poll.error }),
  };
};

export const getAllPollsForBroadcast = async (broadcastId: number, token: string): Promise<PollDTO[] | { error: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/polls/broadcast/${broadcastId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    const data = await response.json();
    if (!response.ok) {
      return { error: data.message || data.error || `Failed to fetch polls. Status: ${response.status}` };
    }
    // Map backend response to mobile format
    return Array.isArray(data) ? data.map(mapPollFromBackend) : [];
  } catch (error) {
    console.error('GetAllPolls API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

export const getActivePollsForBroadcast = async (broadcastId: number, token: string): Promise<PollDTO[] | { error: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/polls/broadcast/${broadcastId}/active`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    const data = await response.json();
    if (!response.ok) {
      return { error: data.message || data.error || `Failed to fetch active polls. Status: ${response.status}` };
    }
    // Map backend response to mobile format and ensure isActive is true
    return Array.isArray(data) ? data.map(poll => ({
      ...mapPollFromBackend(poll),
      isActive: true, // Active polls endpoint should always return active polls
    })) : [];
  } catch (error) {
    console.error('GetActivePolls API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

export const voteOnPoll = async (pollId: number, payload: VoteOnPollPayload, token: string): Promise<PollResultDTO | { error: string }> => {
  // Backend expects VoteRequest with both pollId and optionId
  try {
    const response = await fetch(`${API_BASE_URL}/polls/${pollId}/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        pollId: pollId, // Backend expects pollId in the request body too
        optionId: payload.optionId,
      }),
    });
    
    // Check if response has content before parsing
    const responseText = await response.text();
    
    if (!response.ok) {
      // Try to parse error message
      let errorMessage = `Failed to vote on poll. Status: ${response.status}`;
      if (responseText) {
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = responseText || errorMessage;
        }
      }
      return { error: errorMessage };
    }
    
    // Parse response if it has content
    if (!responseText || responseText.trim() === '') {
      console.warn('VoteOnPoll: Empty response from server, vote may have succeeded');
      // Return a success indicator even if response is empty
      return { error: 'Vote submitted but no response received' };
    }
    
    try {
      const data = JSON.parse(responseText);
      // Map PollResultDTO format if needed
      return {
        id: data.id,
        question: data.question,
        isActive: data.isActive !== undefined ? data.isActive : (data.active !== undefined ? data.active : true),
        totalVotes: data.totalVotes || 0,
        options: (data.options || []).map((opt: any) => ({
          id: opt.id,
          text: opt.text || opt.optionText,
          voteCount: opt.voteCount || opt.votes || 0,
          percentage: opt.percentage || 0,
        })),
      } as PollResultDTO;
    } catch (parseError) {
      console.error('VoteOnPoll: Failed to parse response:', parseError, 'Response:', responseText);
      return { error: 'Invalid response from server' };
    }
  } catch (error) {
    console.error('VoteOnPoll API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

export const getPollResults = async (pollId: number, token: string): Promise<PollResultDTO | { error: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/polls/${pollId}/results`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    // Check if response has content before parsing
    const responseText = await response.text();
    
    // Handle 404 (poll deleted) or empty response
    if (response.status === 404 || !responseText || responseText.trim() === '') {
      return { error: 'Poll not found or has been deleted' };
    }
    
    if (!response.ok) {
      // Try to parse error message
      let errorMessage = `Failed to fetch poll results. Status: ${response.status}`;
      if (responseText) {
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = responseText || errorMessage;
        }
      }
      return { error: errorMessage };
    }
    
    try {
      const data = JSON.parse(responseText);
      // Map PollResultDTO format
      return {
        id: data.id,
        question: data.question,
        isActive: data.isActive !== undefined ? data.isActive : (data.active !== undefined ? data.active : false),
        totalVotes: data.totalVotes || 0,
        options: (data.options || []).map((opt: any) => ({
          id: opt.id,
          text: opt.text || opt.optionText,
          voteCount: opt.voteCount || opt.votes || 0,
          percentage: opt.percentage || 0,
        })),
      } as PollResultDTO;
    } catch (parseError) {
      console.error('GetPollResults: Failed to parse response:', parseError, 'Response:', responseText);
      return { error: 'Invalid response from server' };
    }
  } catch (error) {
    console.error('GetPollResults API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

export const hasUserVotedOnPoll = async (pollId: number, token: string): Promise<boolean | { error: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/polls/${pollId}/has-voted`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})); // Try to parse error, default to empty obj
      return { error: data.message || data.error || `Failed to check if user voted. Status: ${response.status}` };
    }
    const hasVoted: boolean = await response.json();
    return hasVoted;
  } catch (error) {
    console.error('HasUserVotedOnPoll API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

export const getUserVoteForPoll = async (pollId: number, token: string): Promise<{ optionId: number } | { error: string; status?: number }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/polls/${pollId}/user-vote`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    // Check if response has content before parsing
    const responseText = await response.text();
    
    // Handle 404 (poll deleted or user hasn't voted) or empty response
    if (response.status === 404 || !responseText || responseText.trim() === '') {
      return { error: 'User has not voted on this poll or poll not found.', status: 404 };
    }
    
    if (!response.ok) {
      // Try to parse error message
      let errorMessage = `Failed to get user vote. Status: ${response.status}`;
      if (responseText) {
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = responseText || errorMessage;
        }
      }
      return { error: errorMessage, status: response.status };
    }
    
    try {
      const data = JSON.parse(responseText);
      // Backend returns optionId directly as Long. Wrap it in an object for consistency
      return { optionId: typeof data === 'number' ? data : (data.optionId || data) };
    } catch (parseError) {
      console.error('GetUserVoteForPoll: Failed to parse response:', parseError, 'Response:', responseText);
      return { error: 'Invalid response from server' };
    } 
  } catch (error) {
    console.error('GetUserVoteForPoll API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

// Also, a function to get a single broadcast's details might be useful
export const getCurrentActiveDJ = async (broadcastId: number, token: string): Promise<any | { error: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/broadcasts/${broadcastId}/current-dj`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { error: data.message || data.error || `Failed to fetch active DJ. Status: ${response.status}` };
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('GetCurrentActiveDJ API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

export const getBroadcastDetails = async (broadcastId: number, token?: string | null): Promise<Broadcast | { error: string }> => {
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Only add Authorization header if token is provided
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/broadcasts/${broadcastId}`, {
      method: 'GET',
      headers,
    });
    const data = await response.json();
    if (!response.ok) {
      return { error: data.message || data.error || `Failed to fetch broadcast details. Status: ${response.status}` };
    }
    return data as Broadcast;
  } catch (error) {
    console.error('GetBroadcastDetails API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

// Notification Preferences API
export interface NotificationPreferences {
  notifyBroadcastStart?: boolean;
  notifyBroadcastReminders?: boolean;
  notifyNewSchedule?: boolean;
  notifySystemUpdates?: boolean;
}

// Update user notification preferences
export const updateNotificationPreferences = async (preferences: NotificationPreferences): Promise<UserData | { error: string }> => {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/me/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
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

// +++ Broadcast Control API Functions +++

export const startBroadcast = async (broadcastId: number, token: string): Promise<Broadcast | { error: string }> => {
  try {
    const idempotencyKey = generatePrefixedIdempotencyKey('broadcast-start');

    const response = await fetch(`${API_BASE_URL}/broadcasts/${broadcastId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      return { error: data.message || data.error || `Failed to start broadcast. Status: ${response.status}` };
    }
    return data as Broadcast;
  } catch (error) {
    console.error('StartBroadcast API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

export const endBroadcast = async (broadcastId: number, token: string): Promise<Broadcast | { error: string }> => {
  try {
    const idempotencyKey = generatePrefixedIdempotencyKey('broadcast-end');

    const response = await fetch(`${API_BASE_URL}/broadcasts/${broadcastId}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      return { error: data.message || data.error || `Failed to end broadcast. Status: ${response.status}` };
    }
    return data as Broadcast;
  } catch (error) {
    console.error('EndBroadcast API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

// +++ Announcement Types and API Functions +++

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

// Get all published announcements (public - no auth needed, but we'll send token for consistency)
export const getAllAnnouncements = async (page = 0, size = 10): Promise<AnnouncementPage | { error: string }> => {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/announcements?page=${page}&size=${size}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
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
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
}; 