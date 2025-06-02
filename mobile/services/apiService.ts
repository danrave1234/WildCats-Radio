//const API_BASE_URL = 'https://wildcat-radio-f05d362144e6.autoidleapp.com/api'; // Adjusted base URL
//const API_BASE_URL = 'http://192.168.5.60:8080/api';
//const API_BASE_URL = 'http://10.0.2.2:8080/api'; // For Android emulator, use this if running on localhost
const API_BASE_URL = 'https://wildcat-radio-f05d362144e6.autoidleapp.com/api'; // Use deployed server
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
  fullName?: string;
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
  artist: string;
  requestedAt: string; // ISO 8601 date-time string
  status: string; // e.g., "pending", "played", "rejected" - assuming from backend
  requestedBy: SongRequestUser;
  broadcastId: number;
  dedication?: string; // Added optional dedication field
  error?: string;
}

export interface CreateSongRequestPayload {
  songTitle: string;
  artist: string;
  dedication?: string; // Added optional dedication field
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
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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

export const getMe = async (token: string): Promise<UserData> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
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

export const getLiveBroadcasts = async (token: string): Promise<Broadcast[] | { error: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/broadcasts/live`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
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

export const getAllBroadcasts = async (token: string): Promise<Broadcast[] | { error: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/broadcasts`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
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

export const getUpcomingBroadcasts = async (token: string): Promise<Broadcast[] | { error: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/broadcasts/upcoming`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
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
export const getChatMessages = async (broadcastId: number, token: string): Promise<ChatMessageDTO[] | { error: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/chats/${broadcastId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    const data = await response.json();
    if (!response.ok) {
      return { error: data.message || data.error || `Failed to fetch chat messages. Status: ${response.status}` };
    }
    return data as ChatMessageDTO[];
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
    return data as ChatMessageDTO;
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
    return data as PollDTO[];
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
    return data as PollDTO[];
  } catch (error) {
    console.error('GetActivePolls API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

export const voteOnPoll = async (pollId: number, payload: VoteOnPollPayload, token: string): Promise<PollResultDTO | { error: string }> => {
  // Note: PollController has /{pollId}/vote and VoteRequest DTO has pollId.
  // Assuming the pollId in the path is the primary one.
  try {
    const response = await fetch(`${API_BASE_URL}/polls/${pollId}/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload), // VoteRequest DTO just needs optionId if pollId is in path
    });
    const data = await response.json();
    if (!response.ok) {
      return { error: data.message || data.error || `Failed to vote on poll. Status: ${response.status}` };
    }
    return data as PollResultDTO; 
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
    const data = await response.json();
    if (!response.ok) {
      return { error: data.message || data.error || `Failed to fetch poll results. Status: ${response.status}` };
    }
    return data as PollResultDTO;
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
    
    if (response.status === 404) { // Specific handling for "not found" which means user hasn't voted
        return { error: 'User has not voted on this poll.', status: 404 };
    }
    
    const data = await response.json();
    if (!response.ok) {
      return { error: data.message || data.error || `Failed to get user vote. Status: ${response.status}`, status: response.status };
    }
    // Backend returns optionId directly as Long. Wrap it in an object for consistency if desired or return number.
    return { optionId: data as number }; 
  } catch (error) {
    console.error('GetUserVoteForPoll API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

// Also, a function to get a single broadcast's details might be useful
export const getBroadcastDetails = async (broadcastId: number, token: string): Promise<Broadcast | { error: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/broadcasts/${broadcastId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
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

// +++ Notification Types +++
export interface NotificationDTO {
  id: number;
  message: string;
  type: string;
  timestamp: string;
  read: boolean;
  userId?: number;
  error?: string;
}

// +++ Notification API Functions +++
export const getAllNotifications = async (token: string): Promise<NotificationDTO[] | { error: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/notifications`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    const data = await response.json();
    if (!response.ok) {
      return { error: data.message || data.error || `Failed to fetch notifications. Status: ${response.status}` };
    }
    return data as NotificationDTO[];
  } catch (error) {
    console.error('GetAllNotifications API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

export const getUnreadNotifications = async (token: string): Promise<NotificationDTO[] | { error: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/notifications/unread`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    const data = await response.json();
    if (!response.ok) {
      return { error: data.message || data.error || `Failed to fetch unread notifications. Status: ${response.status}` };
    }
    return data as NotificationDTO[];
  } catch (error) {
    console.error('GetUnreadNotifications API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

export const getUnreadNotificationCount = async (token: string): Promise<number | { error: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/notifications/count-unread`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    const data = await response.json();
    if (!response.ok) {
      return { error: data.message || data.error || `Failed to fetch unread count. Status: ${response.status}` };
    }
    return data as number;
  } catch (error) {
    console.error('GetUnreadNotificationCount API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
};

export const markNotificationAsRead = async (notificationId: number, token: string): Promise<ApiResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    const data = await response.json();
    if (!response.ok) {
      return { error: data.message || data.error || `Failed to mark notification as read. Status: ${response.status}` };
    }
    return data as ApiResponse;
  } catch (error) {
    console.error('MarkNotificationAsRead API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { error: errorMessage };
  }
}; 