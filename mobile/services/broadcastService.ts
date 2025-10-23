import { 
  Broadcast, 
  getLiveBroadcasts, 
  getBroadcastDetails 
} from './apiService';
import { BaseService, ServiceConnection, ServiceResult } from './baseService';

interface BroadcastConnection extends ServiceConnection {}

class BroadcastService extends BaseService<BroadcastConnection> {

  /**
   * Get all live broadcasts
   */
  async getLiveBroadcasts(authToken: string): Promise<ServiceResult<Broadcast[]>> {
    try {
      const result = await getLiveBroadcasts(authToken);

      if ('error' in result) {
        return this.createResult(undefined, result.error || 'Failed to fetch live broadcasts');
      }
      
      return this.createResult(result);
    } catch (error) {
      const errorMessage = this.handleError(error, 'BroadcastService: Exception fetching live broadcasts');
      return this.createResult(undefined, errorMessage);
    }
  }

  /**
   * Get details for a specific broadcast
   */
  async getBroadcastDetails(broadcastId: number, authToken: string): Promise<ServiceResult<Broadcast>> {
    try {
      const result = await getBroadcastDetails(broadcastId, authToken);

      if ('error' in result) {
        return this.createResult(undefined, result.error || 'Failed to fetch broadcast details');
      }
      
      return this.createResult(result);
    } catch (error) {
      const errorMessage = this.handleError(error, 'BroadcastService: Exception fetching broadcast details');
      return this.createResult(undefined, errorMessage);
    }
  }
}

// Export a singleton instance
export const broadcastService = new BroadcastService();
export default broadcastService;
