import { config } from '../config';
import { BaseService, ServiceConnection, ServiceResult } from './baseService';
import { createLogger } from './logger';

const logger = createLogger('SongRequestService');

const getApiUrl = (endpoint: string) => {
  const baseUrl = config.apiBaseUrl.replace(/\/$/, '');
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.replace('/api', '');
  }
  return `${baseUrl}${cleanEndpoint}`;
};

export interface SongRequest {
  id: number;
  songTitle: string;
  artist?: string;
  timestamp: string;
  requestedBy: { id?: number; name?: string };
  broadcastId: number;
}

export interface CreateSongRequestPayload {
  songTitle: string;
}

interface SongRequestConnection extends ServiceConnection {}

class SongRequestService extends BaseService<SongRequestConnection> {
  async getSongRequests(broadcastId: number, authToken: string): Promise<ServiceResult<SongRequest[]>> {
    try {
      const response = await fetch(getApiUrl(`/broadcasts/${broadcastId}/song-requests`), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch song requests');
      }

      const data = await response.json();
      return this.createResult(Array.isArray(data) ? data : []);
    } catch (error) {
      const errorMessage = this.handleError(error, 'SongRequestService: Exception fetching song requests');
      return this.createResult(undefined, errorMessage);
    }
  }

  async createSongRequest(
    broadcastId: number,
    requestData: CreateSongRequestPayload,
    authToken?: string
  ): Promise<ServiceResult<SongRequest>> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add Authorization header only if token is provided
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(getApiUrl(`/broadcasts/${broadcastId}/song-requests`), {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to create song request';
        try {
          const error = JSON.parse(errorText);
          errorMessage = error.message || error.error || errorMessage;
        } catch {
          errorMessage = errorText || `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return this.createResult(data);
    } catch (error) {
      const errorMessage = this.handleError(error, 'SongRequestService: Exception creating song request');
      return this.createResult(undefined, errorMessage);
    }
  }
}

export const songRequestService = new SongRequestService();
export default songRequestService;

