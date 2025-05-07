import apiClient from '../apiClient';
import { SongRequest, CreateSongRequestRequest } from '../types';

export const songRequestService = {
  /**
   * Get all song requests for a specific broadcast
   */
  getBroadcastSongRequests: async (broadcastId: number): Promise<SongRequest[]> => {
    const response = await apiClient.get<SongRequest[]>(`/broadcasts/${broadcastId}/song-requests`);
    return response.data;
  },

  /**
   * Create a new song request for a broadcast
   */
  createSongRequest: async (broadcastId: number, data: CreateSongRequestRequest): Promise<SongRequest> => {
    const response = await apiClient.post<SongRequest>(`/broadcasts/${broadcastId}/song-requests`, data);
    return response.data;
  }
}; 