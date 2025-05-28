import { SongRequestDTO, CreateSongRequestPayload, getSongRequestsForBroadcast, createSongRequest } from './apiService';

interface SongRequestConnection {
  disconnect: () => void;
}

class SongRequestService {
  private subscriptions: Map<number, SongRequestConnection> = new Map();

  /**
   * Get song requests for a broadcast (HTTP call)
   * @param broadcastId - The broadcast ID
   * @param authToken - Authentication token
   * @returns Promise with requests or error
   */
  async getRequests(broadcastId: number, authToken: string): Promise<{ data: SongRequestDTO[] } | { error: string }> {
    try {
      console.log('🎵 SongRequestService: Fetching requests for broadcast:', broadcastId);
      const result = await getSongRequestsForBroadcast(broadcastId, authToken);
      
      if ('error' in result) {
        console.error('❌ SongRequestService: Error fetching requests:', result.error);
        return { error: result.error };
      }
      
      console.log('✅ SongRequestService: Fetched', result.length, 'requests');
      return { data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ SongRequestService: Exception fetching requests:', errorMessage);
      return { error: errorMessage };
    }
  }

  /**
   * Create a new song request (HTTP call)
   * @param broadcastId - The broadcast ID
   * @param requestData - Request data
   * @param authToken - Authentication token
   * @returns Promise with created request or error
   */
  async createRequest(
    broadcastId: number, 
    requestData: CreateSongRequestPayload, 
    authToken: string
  ): Promise<{ data: SongRequestDTO } | { error: string }> {
    try {
      console.log('🎵 SongRequestService: Creating request for broadcast:', broadcastId, requestData);
      const result = await createSongRequest(broadcastId, requestData, authToken);
      
      if ('error' in result) {
        console.error('❌ SongRequestService: Error creating request:', result.error);
        return { error: result.error || 'Failed to create song request' };
      }
      
      console.log('✅ SongRequestService: Request created successfully:', result.id);
      return { data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ SongRequestService: Exception creating request:', errorMessage);
      return { error: errorMessage };
    }
  }

  /**
   * Subscribe to real-time song request updates (WebSocket)
   * Note: This would need WebSocket implementation for song requests if supported by backend
   */
  async subscribeToSongRequests(
    broadcastId: number,
    authToken: string,
    onNewRequest: (request: SongRequestDTO) => void
  ): Promise<SongRequestConnection> {
    console.log('🎵 SongRequestService: Song request WebSocket not implemented yet');
    
    // Return a dummy connection for now
    const connection: SongRequestConnection = {
      disconnect: () => {
        console.log('🔌 SongRequestService: Disconnecting song request subscription');
        this.subscriptions.delete(broadcastId);
      }
    };

    this.subscriptions.set(broadcastId, connection);
    return connection;
  }

  /**
   * Disconnect all song request subscriptions
   */
  disconnectAll(): void {
    console.log('🧹 SongRequestService: Disconnecting all subscriptions');
    this.subscriptions.forEach((connection, broadcastId) => {
      console.log('🔌 SongRequestService: Disconnecting subscription for broadcast:', broadcastId);
      connection.disconnect();
    });
    this.subscriptions.clear();
  }

  /**
   * Check if there's an active subscription for a broadcast
   */
  hasActiveSubscription(broadcastId: number): boolean {
    return this.subscriptions.has(broadcastId);
  }

  /**
   * Get the number of active subscriptions
   */
  getActiveSubscriptionCount(): number {
    return this.subscriptions.size;
  }
}

// Export a singleton instance
export const songRequestService = new SongRequestService();
export default songRequestService; 