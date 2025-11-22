package com.wildcastradio.Broadcast;

/**
 * Enumeration of source disconnection types for stream recovery classification.
 * Used by SourceStateClassifier to determine the appropriate recovery strategy.
 */
public enum SourceDisconnectionType {
    /**
     * DJ's audio source has disconnected (browser crash, network issue, etc.)
     * Recovery Strategy: Attempt automatic reconnection with exponential backoff
     */
    DJ_SOURCE_DISCONNECTED,
    
    /**
     * Server-side issue detected (Liquidsoap stopped, Icecast down, etc.)
     * Recovery Strategy: Log for admin intervention, no automatic recovery
     */
    SERVER_ISSUE,
    
    /**
     * Temporary network issue detected
     * Recovery Strategy: Wait and retry, may resolve automatically
     */
    NETWORK_ISSUE,
    
    /**
     * Cannot determine the disconnection type
     * Recovery Strategy: Conservative approach - wait and monitor
     */
    UNKNOWN;
    
    /**
     * Check if this disconnection type supports automatic recovery
     * @return true if automatic recovery should be attempted
     */
    public boolean supportsAutomaticRecovery() {
        return this == DJ_SOURCE_DISCONNECTED || this == NETWORK_ISSUE;
    }
    
    /**
     * Check if this disconnection type requires admin intervention
     * @return true if admin intervention is required
     */
    public boolean requiresAdminIntervention() {
        return this == SERVER_ISSUE;
    }
}

