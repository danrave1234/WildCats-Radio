import apiClient from '../apiClient';
import { Poll, VotePollRequest } from '../types';

export const pollService = {
  /**
   * Get all polls for a specific broadcast
   */
  getBroadcastPolls: async (broadcastId: number): Promise<Poll[]> => {
    const response = await apiClient.get<Poll[]>(`/polls/broadcast/${broadcastId}`);
    return response.data;
  },

  /**
   * Get all active polls for a specific broadcast
   */
  getActiveBroadcastPolls: async (broadcastId: number): Promise<Poll[]> => {
    const response = await apiClient.get<Poll[]>(`/polls/broadcast/${broadcastId}/active`);
    return response.data;
  },

  /**
   * Get poll by ID
   */
  getPollById: async (pollId: number): Promise<Poll> => {
    const response = await apiClient.get<Poll>(`/polls/${pollId}`);
    return response.data;
  },

  /**
   * Vote on a poll
   */
  votePoll: async (pollId: number, data: VotePollRequest): Promise<Poll> => {
    const response = await apiClient.post<Poll>(`/polls/${pollId}/vote`, data);
    return response.data;
  }
}; 