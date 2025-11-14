package com.wildcastradio.Broadcast;

import java.time.LocalDateTime;

/**
 * Tracks a single reconnection attempt for a broadcast.
 * Used by ReconnectionManager to manage exponential backoff and attempt limits.
 */
public class ReconnectionAttempt {
    private int attemptCount = 0;
    private LocalDateTime lastAttemptTime;
    private LocalDateTime firstAttemptTime;
    private Long broadcastId;
    private SourceDisconnectionType disconnectionType;
    
    // Configuration constants
    public static final int MAX_ATTEMPTS = 5;
    public static final long BASE_DELAY_MS = 1000; // 1 second
    public static final long MAX_DELAY_MS = 30000;  // 30 seconds
    
    public ReconnectionAttempt(Long broadcastId, SourceDisconnectionType disconnectionType) {
        this.broadcastId = broadcastId;
        this.disconnectionType = disconnectionType;
        this.firstAttemptTime = LocalDateTime.now();
    }
    
    /**
     * Record a new reconnection attempt
     */
    public void recordAttempt() {
        attemptCount++;
        lastAttemptTime = LocalDateTime.now();
    }
    
    /**
     * Calculate the delay for the next attempt using exponential backoff
     * @return Delay in milliseconds
     */
    public long getNextDelayMs() {
        if (attemptCount == 0) {
            return BASE_DELAY_MS; // First attempt: 1 second
        }
        
        // Exponential backoff: baseDelay * 2^(attemptCount-1)
        long exponentialDelay = BASE_DELAY_MS * (long) Math.pow(2, attemptCount - 1);
        
        // Cap at maximum delay
        return Math.min(exponentialDelay, MAX_DELAY_MS);
    }
    
    /**
     * Check if maximum attempts have been reached
     * @return true if max attempts reached
     */
    public boolean hasReachedMaxAttempts() {
        return attemptCount >= MAX_ATTEMPTS;
    }
    
    /**
     * Check if reconnection attempts should continue
     * @return true if should continue attempting
     */
    public boolean shouldContinue() {
        return !hasReachedMaxAttempts() && disconnectionType.supportsAutomaticRecovery();
    }
    
    /**
     * Get the number of attempts made so far
     * @return attempt count
     */
    public int getAttemptCount() {
        return attemptCount;
    }
    
    /**
     * Get the last attempt time
     * @return last attempt timestamp
     */
    public LocalDateTime getLastAttemptTime() {
        return lastAttemptTime;
    }
    
    /**
     * Get the first attempt time
     * @return first attempt timestamp
     */
    public LocalDateTime getFirstAttemptTime() {
        return firstAttemptTime;
    }
    
    /**
     * Get the broadcast ID
     * @return broadcast ID
     */
    public Long getBroadcastId() {
        return broadcastId;
    }
    
    /**
     * Get the disconnection type
     * @return disconnection type
     */
    public SourceDisconnectionType getDisconnectionType() {
        return disconnectionType;
    }
    
    /**
     * Reset the attempt counter (for successful reconnection)
     */
    public void reset() {
        attemptCount = 0;
        lastAttemptTime = null;
        firstAttemptTime = LocalDateTime.now();
    }
}

