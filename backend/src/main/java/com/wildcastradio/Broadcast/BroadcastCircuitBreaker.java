package com.wildcastradio.Broadcast;

import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.wildcastradio.ActivityLog.ActivityLogEntity;
import com.wildcastradio.ActivityLog.ActivityLogService;

/**
 * Circuit breaker pattern implementation for broadcast operations.
 * Prevents cascading failures by stopping requests when failure threshold is reached.
 */
@Component
public class BroadcastCircuitBreaker {
    private static final Logger logger = LoggerFactory.getLogger(BroadcastCircuitBreaker.class);
    
    @Autowired(required = false)
    private ActivityLogService activityLogService;
    
    private enum CircuitState {
        CLOSED,    // Normal operation - requests allowed
        OPEN,      // Circuit open - requests blocked
        HALF_OPEN  // Testing state - allow limited requests
    }
    
    private CircuitState state = CircuitState.CLOSED;
    private int failureCount = 0;
    private long lastFailureTime = 0;
    private static final int FAILURE_THRESHOLD = 5;
    private static final long TIMEOUT_MS = 60000; // 1 minute
    private static final int HALF_OPEN_SUCCESS_THRESHOLD = 2;
    private int halfOpenSuccessCount = 0;

    /**
     * Check if request is allowed based on circuit breaker state
     * @return true if request should be allowed, false otherwise
     */
    public boolean allowRequest() {
        if (state == CircuitState.OPEN) {
            // Check if timeout period has passed
            if (System.currentTimeMillis() - lastFailureTime > TIMEOUT_MS) {
                logger.info("Circuit breaker transitioning to HALF_OPEN state");
                CircuitState oldState = state;
                state = CircuitState.HALF_OPEN;
                halfOpenSuccessCount = 0;
                
                // Audit log: Circuit breaker state change
                if (activityLogService != null) {
                    Map<String, Object> metadata = new HashMap<>();
                    metadata.put("oldState", oldState.name());
                    metadata.put("newState", state.name());
                    metadata.put("failureCount", failureCount);
                    activityLogService.logSystemAuditWithMetadata(
                        ActivityLogEntity.ActivityType.CIRCUIT_BREAKER_HALF_OPEN,
                        String.format("Circuit breaker transitioned to HALF_OPEN (failureCount: %d)", failureCount),
                        null,
                        metadata
                    );
                }
                
                return true;
            }
            logger.debug("Circuit breaker is OPEN - request blocked");
            return false;
        }
        return true;
    }

    /**
     * Record a successful operation
     */
    public void recordSuccess() {
        if (state == CircuitState.HALF_OPEN) {
            halfOpenSuccessCount++;
            if (halfOpenSuccessCount >= HALF_OPEN_SUCCESS_THRESHOLD) {
                logger.info("Circuit breaker transitioning to CLOSED state after successful operations");
                CircuitState oldState = state;
                state = CircuitState.CLOSED;
                failureCount = 0;
                halfOpenSuccessCount = 0;
                
                // Audit log: Circuit breaker closed after recovery
                if (activityLogService != null) {
                    Map<String, Object> metadata = new HashMap<>();
                    metadata.put("oldState", oldState.name());
                    metadata.put("newState", state.name());
                    metadata.put("halfOpenSuccessCount", halfOpenSuccessCount);
                    activityLogService.logSystemAuditWithMetadata(
                        ActivityLogEntity.ActivityType.CIRCUIT_BREAKER_CLOSED,
                        "Circuit breaker closed after successful recovery operations",
                        null,
                        metadata
                    );
                }
            }
        } else if (state == CircuitState.CLOSED) {
            // Reset failure count on success in CLOSED state
            failureCount = 0;
        }
    }

    /**
     * Record a failed operation
     */
    public void recordFailure() {
        failureCount++;
        lastFailureTime = System.currentTimeMillis();
        
        CircuitState oldState = state;
        
        if (state == CircuitState.HALF_OPEN) {
            // Any failure in HALF_OPEN state immediately opens circuit
            logger.warn("Circuit breaker transitioning to OPEN state after failure in HALF_OPEN");
            state = CircuitState.OPEN;
            halfOpenSuccessCount = 0;
            
            // Audit log: Circuit breaker opened from HALF_OPEN
            if (activityLogService != null) {
                Map<String, Object> metadata = new HashMap<>();
                metadata.put("oldState", oldState.name());
                metadata.put("newState", state.name());
                metadata.put("failureCount", failureCount);
                metadata.put("reason", "Failure in HALF_OPEN state");
                activityLogService.logSystemAuditWithMetadata(
                    ActivityLogEntity.ActivityType.CIRCUIT_BREAKER_OPEN,
                    String.format("Circuit breaker opened after failure in HALF_OPEN (failureCount: %d)", failureCount),
                    null,
                    metadata
                );
            }
        } else if (state == CircuitState.CLOSED && failureCount >= FAILURE_THRESHOLD) {
            logger.warn("Circuit breaker transitioning to OPEN state after {} failures", failureCount);
            state = CircuitState.OPEN;
            
            // Audit log: Circuit breaker opened after threshold
            if (activityLogService != null) {
                Map<String, Object> metadata = new HashMap<>();
                metadata.put("oldState", oldState.name());
                metadata.put("newState", state.name());
                metadata.put("failureCount", failureCount);
                metadata.put("threshold", FAILURE_THRESHOLD);
                metadata.put("reason", "Failure threshold exceeded");
                activityLogService.logSystemAuditWithMetadata(
                    ActivityLogEntity.ActivityType.CIRCUIT_BREAKER_OPEN,
                    String.format("Circuit breaker opened after %d failures (threshold: %d)", failureCount, FAILURE_THRESHOLD),
                    null,
                    metadata
                );
            }
        }
    }

    /**
     * Get current circuit breaker state
     * @return Current state name
     */
    public String getState() {
        return state.name();
    }

    /**
     * Get current failure count
     * @return Number of consecutive failures
     */
    public int getFailureCount() {
        return failureCount;
    }

    /**
     * Reset circuit breaker to CLOSED state (for testing/admin purposes)
     */
    public void reset() {
        logger.info("Circuit breaker manually reset to CLOSED state");
        state = CircuitState.CLOSED;
        failureCount = 0;
        lastFailureTime = 0;
        halfOpenSuccessCount = 0;
    }
}

