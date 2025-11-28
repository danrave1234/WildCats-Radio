import { config } from '../config';

/**
 * Broadcast API Service
 * Handles all broadcast-related API calls
 */

const getApiUrl = (endpoint: string) => {
  const baseUrl = config.apiBaseUrl.replace(/\/$/, '');
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.replace('/api', '');
  }
  return `${baseUrl}${cleanEndpoint}`;
};

export interface Broadcast {
  id: number;
  title: string;
  description?: string;
  status?: 'SCHEDULED' | 'LIVE' | 'ENDED';
  dj?: { id?: number; name?: string };
  scheduledStart?: string;
  actualStart?: string;
  slowModeEnabled?: boolean;
  slowModeSeconds?: number;
}

export interface ChatMessage {
  id: number;
  content: string;
  createdAt: string;
  sender: { id?: number; name?: string; firstname?: string; lastname?: string };
  broadcastId: number;
}

export interface StreamConfig {
  streamUrl: string;
  listenerCount: number;
  isLive: boolean;
}

export const broadcastService = {
  /**
   * Get currently live broadcasts
   */
  getLiveBroadcasts: async (): Promise<Broadcast[]> => {
    try {
      const response = await fetch(getApiUrl('/broadcasts/live'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch live broadcasts');
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching live broadcasts:', error);
      return [];
    }
  },

  /**
   * Get broadcast details by ID
   */
  getBroadcastDetails: async (broadcastId: number): Promise<Broadcast | null> => {
    try {
      const response = await fetch(getApiUrl(`/broadcasts/${broadcastId}`), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch broadcast details');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching broadcast details:', error);
      return null;
    }
  },

  /**
   * Get chat messages for a broadcast
   */
  getChatMessages: async (broadcastId: number): Promise<ChatMessage[]> => {
    try {
      const response = await fetch(getApiUrl(`/chats/${broadcastId}`), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to fetch chat messages';
        try {
          const error = JSON.parse(errorText);
          errorMessage = error.message || error.error || errorMessage;
        } catch {
          errorMessage = errorText || `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      // Handle both direct array response and { data: [...] } response
      if (Array.isArray(data)) {
        return data;
      } else if (data && Array.isArray(data.data)) {
        return data.data;
      }
      return [];
    } catch (error: any) {
      console.error('Error fetching chat messages:', error);
      throw error; // Re-throw to let caller handle it
    }
  },

  /**
   * Send a chat message
   */
  sendChatMessage: async (
    broadcastId: number,
    content: string
  ): Promise<ChatMessage | null> => {
    try {
      const response = await fetch(getApiUrl(`/chats/${broadcastId}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to send message';
        try {
          const error = JSON.parse(errorText);
          errorMessage = error.message || error.error || errorMessage;
        } catch {
          errorMessage = errorText || `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      // Handle both direct object response and { data: {...} } response
      return data?.data || data;
    } catch (error: any) {
      console.error('Error sending chat message:', error);
      throw error;
    }
  },

  /**
   * Get stream configuration
   */
  getStreamConfig: async (): Promise<StreamConfig> => {
    try {
      // Default stream URL - update with your actual endpoint
      const response = await fetch(getApiUrl('/stream/config'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.ok) {
        return await response.json();
      }

      // Fallback to default config
      return {
        streamUrl: 'https://icecast.software/live.mp3',
        listenerCount: 0,
        isLive: false,
      };
    } catch (error) {
      console.error('Error fetching stream config:', error);
      return {
        streamUrl: 'https://icecast.software/live.mp3',
        listenerCount: 0,
        isLive: false,
      };
    }
  },
};

