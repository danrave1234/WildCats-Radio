import { 
  SongRequestDTO, 
  CreateSongRequestPayload, 
  getSongRequestsForBroadcast, 
  createSongRequest 
} from './apiService';
import { BaseService, ServiceConnection, ServiceResult } from './baseService';

interface SongRequestConnection extends ServiceConnection {}

class SongRequestService extends BaseService<SongRequestConnection> {

  /**
   * Get song requests for a specific broadcast
   */
  async getSongRequests(broadcastId: number, authToken: string): Promise<ServiceResult<SongRequestDTO[]>> {
    try {
      const result = await getSongRequestsForBroadcast(broadcastId, authToken);

      if ('error' in result) {
        return this.createResult(undefined, result.error || 'Failed to fetch song requests');
      }
      
      return this.createResult(result);
    } catch (error) {
      const errorMessage = this.handleError(error, 'SongRequestService: Exception fetching song requests');
      return this.createResult(undefined, errorMessage);
    }
  }

  /**
   * Create a new song request
   */
  async createSongRequest(
    broadcastId: number, 
    requestData: CreateSongRequestPayload, 
    authToken: string
  ): Promise<ServiceResult<SongRequestDTO>> {
    try {
      const result = await createSongRequest(broadcastId, requestData, authToken);

      if ('error' in result) {
        return this.createResult(undefined, result.error || 'Failed to create song request');
      }
      
      return this.createResult(result);
    } catch (error) {
      const errorMessage = this.handleError(error, 'SongRequestService: Exception creating song request');
      return this.createResult(undefined, errorMessage);
    }
  }
}

// Export a singleton instance
export const songRequestService = new SongRequestService();
export default songRequestService;