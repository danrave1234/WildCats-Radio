import apiClient from '../apiClient';
import { 
  Broadcast, 
  CreateBroadcastRequest 
} from '../types';

export const broadcastService = {
  /**
   * Get all broadcasts
   */
  getAllBroadcasts: async (): Promise<Broadcast[]> => {
    const response = await apiClient.get<Broadcast[]>('/broadcasts');
    return response.data;
  },

  /**
   * Get broadcast by ID
   */
  getBroadcastById: async (id: number): Promise<Broadcast> => {
    const response = await apiClient.get<Broadcast>(`/broadcasts/${id}`);
    return response.data;
  },

  /**
   * Create a new broadcast
   */
  createBroadcast: async (data: CreateBroadcastRequest): Promise<Broadcast> => {
    const response = await apiClient.post<Broadcast>('/broadcasts', data);
    return response.data;
  },

  /**
   * Update a broadcast
   */
  updateBroadcast: async (id: number, data: Partial<CreateBroadcastRequest>): Promise<Broadcast> => {
    const response = await apiClient.put<Broadcast>(`/broadcasts/${id}`, data);
    return response.data;
  },

  /**
   * Start a broadcast (status -> LIVE)
   */
  startBroadcast: async (id: number): Promise<Broadcast> => {
    const response = await apiClient.post<Broadcast>(`/broadcasts/${id}/start`);
    return response.data;
  },

  /**
   * End a broadcast (status -> COMPLETED)
   */
  endBroadcast: async (id: number): Promise<Broadcast> => {
    const response = await apiClient.post<Broadcast>(`/broadcasts/${id}/end`);
    return response.data;
  },

  /**
   * Get active/ongoing broadcast
   */
  getActiveBroadcast: async (): Promise<Broadcast | null> => {
    try {
      const response = await apiClient.get<Broadcast>('/broadcasts/active');
      return response.data;
    } catch (error) {
      // If no active broadcast, return null
      if ((error as any).status === 400 || (error as any).status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Get all live broadcasts
   */
  getLiveBroadcasts: async (): Promise<Broadcast[]> => {
    const response = await apiClient.get<Broadcast[]>('/broadcasts/live');
    return response.data;
  },

  /**
   * Get all upcoming broadcasts
   */
  getUpcomingBroadcasts: async (): Promise<Broadcast[]> => {
    const response = await apiClient.get<Broadcast[]>('/broadcasts/upcoming');
    return response.data;
  }
}; 