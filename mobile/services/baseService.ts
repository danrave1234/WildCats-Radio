// Base service class for consistent service architecture
export interface ServiceConnection {
  disconnect: () => void;
}

export interface ServiceResult<T> {
  data?: T;
  error?: string;
}

export interface ServiceSubscriptionOptions {
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: any) => void;
}

export abstract class BaseService<TConnection extends ServiceConnection> {
  protected subscriptions: Map<number, TConnection> = new Map();

  /**
   * Clean up existing subscription for a broadcast
   */
  protected cleanupSubscription(broadcastId: number): void {
    const existingConnection = this.subscriptions.get(broadcastId);
    if (existingConnection) {
      existingConnection.disconnect();
      this.subscriptions.delete(broadcastId);
    }
  }

  /**
   * Disconnect all subscriptions
   */
  disconnectAll(): void {
    this.subscriptions.forEach((connection, broadcastId) => {
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

  /**
   * Handle service errors consistently
   */
  protected handleError(error: any, context: string): string {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`❌ ${context}:`, errorMessage);
    return errorMessage;
  }

  /**
   * Create a standardized service result
   */
  protected createResult<T>(data?: T, error?: string): ServiceResult<T> {
    if (error) {
      return { error };
    }
    return { data: data as T };
  }
}
