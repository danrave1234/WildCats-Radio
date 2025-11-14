package com.wildcastradio.Broadcast;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import com.wildcastradio.ActivityLog.ActivityLogEntity;
import com.wildcastradio.ActivityLog.ActivityLogService;
import com.wildcastradio.icecast.IcecastService;

/**
 * Manages automatic reconnection attempts for DJ source disconnections.
 * Implements exponential backoff and coordinates with health monitoring system.
 */
@Component
public class ReconnectionManager {
    private static final Logger logger = LoggerFactory.getLogger(ReconnectionManager.class);
    
    @Autowired(required = false)
    private IcecastService icecastService;
    
    @Autowired(required = false)
    private SimpMessagingTemplate messagingTemplate;
    
    @Autowired(required = false)
    private ActivityLogService activityLogService;
    
    @Value("${broadcast.recovery.reconnection.enabled:true}")
    private boolean reconnectionEnabled;
    
    @Value("${broadcast.recovery.reconnection.maxAttempts:5}")
    private int maxAttempts;
    
    @Value("${broadcast.recovery.reconnection.baseDelayMs:1000}")
    private long baseDelayMs;
    
    @Value("${broadcast.recovery.reconnection.maxDelayMs:30000}")
    private long maxDelayMs;
    
    // Track active reconnection attempts per broadcast
    private final Map<Long, ReconnectionAttempt> activeAttempts = new ConcurrentHashMap<>();
    private final Map<Long, ScheduledFuture<?>> scheduledTasks = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2, r -> {
        Thread t = new Thread(r, "ReconnectionManager-Scheduler");
        t.setDaemon(true);
        return t;
    });
    
    /**
     * Start reconnection attempts for a broadcast with DJ source disconnection.
     * 
     * @param broadcastId The broadcast ID
     * @param disconnectionType The type of disconnection detected
     */
    public void attemptReconnection(Long broadcastId, SourceDisconnectionType disconnectionType) {
        if (!reconnectionEnabled) {
            logger.debug("Reconnection manager is disabled, skipping reconnection attempt for broadcast {}", broadcastId);
            return;
        }
        
        if (!disconnectionType.supportsAutomaticRecovery()) {
            logger.debug("Disconnection type {} does not support automatic recovery for broadcast {}", disconnectionType, broadcastId);
            return;
        }
        
        // Check if already attempting reconnection for this broadcast
        if (activeAttempts.containsKey(broadcastId)) {
            logger.debug("Reconnection already in progress for broadcast {}", broadcastId);
            return;
        }
        
        logger.info("Starting reconnection attempts for broadcast {} (disconnection type: {})", broadcastId, disconnectionType);
        
        // Create new reconnection attempt tracker
        ReconnectionAttempt attempt = new ReconnectionAttempt(broadcastId, disconnectionType);
        activeAttempts.put(broadcastId, attempt);
        
        // Send initial notification to DJ
        sendReconnectionNotification(broadcastId, attempt, "STARTED");
        
        // Schedule first attempt immediately
        scheduleNextAttempt(broadcastId, attempt);
    }
    
    /**
     * Schedule the next reconnection attempt with exponential backoff
     */
    private void scheduleNextAttempt(Long broadcastId, ReconnectionAttempt attempt) {
        if (!attempt.shouldContinue()) {
            logger.info("Reconnection attempts exhausted for broadcast {} ({} attempts)", broadcastId, attempt.getAttemptCount());
            handleReconnectionFailure(broadcastId, attempt);
            return;
        }
        
        long delayMs = attempt.getNextDelayMs();
        logger.debug("Scheduling reconnection attempt {} for broadcast {} in {}ms", 
            attempt.getAttemptCount() + 1, broadcastId, delayMs);
        
        ScheduledFuture<?> future = scheduler.schedule(() -> {
            try {
                performReconnectionAttempt(broadcastId, attempt);
            } catch (Exception e) {
                logger.error("Error during reconnection attempt for broadcast {}: {}", broadcastId, e.getMessage());
            }
        }, delayMs, TimeUnit.MILLISECONDS);
        
        scheduledTasks.put(broadcastId, future);
    }
    
    /**
     * Perform a single reconnection attempt
     */
    private void performReconnectionAttempt(Long broadcastId, ReconnectionAttempt attempt) {
        attempt.recordAttempt();
        int attemptNumber = attempt.getAttemptCount();
        
        logger.info("Reconnection attempt {}/{} for broadcast {}", attemptNumber, maxAttempts, broadcastId);
        
        // Send notification to DJ
        sendReconnectionNotification(broadcastId, attempt, "ATTEMPTING");
        
        // Check if source is now connected (health check)
        boolean sourceRestored = checkSourceRestored(broadcastId);
        
        if (sourceRestored) {
            logger.info("Source restored for broadcast {} after {} attempts", broadcastId, attemptNumber);
            handleReconnectionSuccess(broadcastId, attempt);
        } else {
            // Schedule next attempt
            scheduleNextAttempt(broadcastId, attempt);
        }
    }
    
    /**
     * Check if the source has been restored by checking health status
     */
    private boolean checkSourceRestored(Long broadcastId) {
        if (icecastService == null) {
            logger.debug("IcecastService not available, cannot check source restoration");
            return false;
        }
        
        try {
            Map<String, Object> status = icecastService.checkMountPointStatus(false);
            boolean hasActiveSource = Boolean.TRUE.equals(status.get("hasActiveSource"));
            int bitrate = 0;
            Object bitrateObj = status.get("bitrate");
            if (bitrateObj instanceof Number) {
                bitrate = ((Number) bitrateObj).intValue();
            }
            
            // Source is restored if it exists and has positive bitrate
            return hasActiveSource && bitrate > 0;
        } catch (Exception e) {
            logger.warn("Error checking source restoration for broadcast {}: {}", broadcastId, e.getMessage());
            return false;
        }
    }
    
    /**
     * Handle successful reconnection
     */
    private void handleReconnectionSuccess(Long broadcastId, ReconnectionAttempt attempt) {
        // Cancel any scheduled future attempts
        ScheduledFuture<?> future = scheduledTasks.remove(broadcastId);
        if (future != null && !future.isDone()) {
            future.cancel(false);
        }
        
        // Remove from active attempts
        activeAttempts.remove(broadcastId);
        
        // Send success notification
        sendReconnectionNotification(broadcastId, attempt, "SUCCESS");
        
        // Log success
        if (activityLogService != null) {
            Map<String, Object> metadata = new java.util.HashMap<>();
            metadata.put("attemptCount", attempt.getAttemptCount());
            metadata.put("disconnectionType", attempt.getDisconnectionType().toString());
            metadata.put("firstAttemptTime", attempt.getFirstAttemptTime().toString());
            metadata.put("lastAttemptTime", attempt.getLastAttemptTime().toString());
            
            activityLogService.logSystemAuditWithMetadata(
                ActivityLogEntity.ActivityType.BROADCAST_RECOVERY,
                String.format("Source reconnection successful for broadcast %d after %d attempts", 
                    broadcastId, attempt.getAttemptCount()),
                broadcastId,
                metadata
            );
        }
        
        logger.info("Reconnection successful for broadcast {} after {} attempts", broadcastId, attempt.getAttemptCount());
    }
    
    /**
     * Handle reconnection failure (max attempts reached)
     */
    private void handleReconnectionFailure(Long broadcastId, ReconnectionAttempt attempt) {
        // Cancel any scheduled future attempts
        ScheduledFuture<?> future = scheduledTasks.remove(broadcastId);
        if (future != null && !future.isDone()) {
            future.cancel(false);
        }
        
        // Remove from active attempts
        activeAttempts.remove(broadcastId);
        
        // Send failure notification
        sendReconnectionNotification(broadcastId, attempt, "FAILED");
        
        // Log failure
        if (activityLogService != null) {
            Map<String, Object> metadata = new java.util.HashMap<>();
            metadata.put("attemptCount", attempt.getAttemptCount());
            metadata.put("maxAttempts", maxAttempts);
            metadata.put("disconnectionType", attempt.getDisconnectionType().toString());
            metadata.put("firstAttemptTime", attempt.getFirstAttemptTime().toString());
            metadata.put("lastAttemptTime", attempt.getLastAttemptTime().toString());
            
            activityLogService.logSystemAuditWithMetadata(
                ActivityLogEntity.ActivityType.BROADCAST_HEALTH_CHECK_FAILED,
                String.format("Source reconnection failed for broadcast %d after %d attempts (max: %d)", 
                    broadcastId, attempt.getAttemptCount(), maxAttempts),
                broadcastId,
                metadata
            );
        }
        
        logger.warn("Reconnection failed for broadcast {} after {} attempts (max: {})", 
            broadcastId, attempt.getAttemptCount(), maxAttempts);
    }
    
    /**
     * Send WebSocket notification to DJ about reconnection status
     */
    private void sendReconnectionNotification(Long broadcastId, ReconnectionAttempt attempt, String status) {
        if (messagingTemplate == null) {
            logger.debug("SimpMessagingTemplate not available, skipping notification");
            return;
        }
        
        try {
            Map<String, Object> notification = new java.util.HashMap<>();
            notification.put("type", "RECONNECTION_STATUS");
            notification.put("broadcastId", broadcastId);
            notification.put("status", status); // STARTED, ATTEMPTING, SUCCESS, FAILED
            notification.put("attemptNumber", attempt.getAttemptCount());
            notification.put("maxAttempts", maxAttempts);
            notification.put("nextDelayMs", attempt.getNextDelayMs());
            notification.put("disconnectionType", attempt.getDisconnectionType().toString());
            notification.put("timestamp", LocalDateTime.now().toString());
            
            // Send to broadcast-specific topic
            messagingTemplate.convertAndSend("/topic/broadcast/" + broadcastId + "/reconnection", notification);
            
            // Also send to global broadcast status topic
            messagingTemplate.convertAndSend("/topic/broadcast/status", notification);
            
            logger.debug("Sent reconnection notification for broadcast {}: {}", broadcastId, status);
        } catch (Exception e) {
            logger.warn("Failed to send reconnection notification: {}", e.getMessage());
        }
    }
    
    /**
     * Cancel reconnection attempts for a broadcast (e.g., broadcast ended manually)
     */
    public void cancelReconnection(Long broadcastId) {
        ScheduledFuture<?> future = scheduledTasks.remove(broadcastId);
        if (future != null && !future.isDone()) {
            future.cancel(false);
            logger.info("Cancelled reconnection attempts for broadcast {}", broadcastId);
        }
        
        activeAttempts.remove(broadcastId);
    }
    
    /**
     * Check if reconnection is in progress for a broadcast
     */
    public boolean isReconnecting(Long broadcastId) {
        return activeAttempts.containsKey(broadcastId);
    }
    
    /**
     * Get the current reconnection attempt for a broadcast
     */
    public ReconnectionAttempt getReconnectionAttempt(Long broadcastId) {
        return activeAttempts.get(broadcastId);
    }
    
    /**
     * Shutdown scheduler on destroy
     */
    @jakarta.annotation.PreDestroy
    public void shutdown() {
        logger.info("Shutting down ReconnectionManager scheduler");
        scheduler.shutdown();
        try {
            if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
}

