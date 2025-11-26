package com.wildcastradio.Broadcast;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.wildcastradio.ActivityLog.ActivityLogEntity;
import com.wildcastradio.ActivityLog.ActivityLogService;
import com.wildcastradio.Analytics.ListenerTrackingService;
import com.wildcastradio.Broadcast.DTO.BroadcastDTO;
import com.wildcastradio.Broadcast.DTO.CreateBroadcastRequest;
import com.wildcastradio.ChatMessage.ChatMessageRepository;
import com.wildcastradio.Notification.NotificationService;
import com.wildcastradio.Notification.NotificationType;
import com.wildcastradio.SongRequest.SongRequestRepository;
import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserRepository;
import com.wildcastradio.icecast.IcecastService;

@Service
public class BroadcastService {
    private static final Logger logger = LoggerFactory.getLogger(BroadcastService.class);

    @Autowired
    private BroadcastRepository broadcastRepository;


    @Autowired
    private IcecastService icecastService;

    @Autowired
    private ActivityLogService activityLogService;

    @Autowired
    private ListenerTrackingService listenerTrackingService;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Autowired
    private SongRequestRepository songRequestRepository;

    @Autowired(required = false)
    private com.wildcastradio.radio.RadioAgentClient radioAgentClient;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired(required = false)
    private BroadcastCircuitBreaker circuitBreaker;

    @Autowired(required = false)
    private SourceStateClassifier sourceStateClassifier;

    @Autowired(required = false)
    private ReconnectionManager reconnectionManager;

    // Live stream health check configuration
    @Value("${broadcast.healthCheck.enabled:true}")
    private boolean healthCheckEnabled;

    @Value("${broadcast.healthCheck.intervalMs:15000}")
    private long healthCheckIntervalMs; // Base interval (used as fallback)

    @Value("${broadcast.healthCheck.unhealthyConsecutiveThreshold:3}")
    private int unhealthyConsecutiveThreshold;

    @Value("${broadcast.healthCheck.startupGraceMs:60000}")
    private long healthCheckStartupGraceMs;

    @Value("${broadcast.healthCheck.adaptive.enabled:true}")
    private boolean adaptiveIntervalsEnabled;

    @Value("${broadcast.healthCheck.adaptive.minIntervalMs:5000}")
    private long adaptiveMinIntervalMs; // 5 seconds for new/unhealthy broadcasts

    @Value("${broadcast.healthCheck.adaptive.maxIntervalMs:60000}")
    private long adaptiveMaxIntervalMs; // 60 seconds for stable long-running broadcasts

    @Value("${broadcast.healthCheck.adaptive.stableThresholdMinutes:60}")
    private long adaptiveStableThresholdMinutes; // After 60 minutes, use max interval

    // Broadcast cleanup configuration (stale LIVE broadcasts)
    @Value("${broadcast.cleanup.enabled:true}")
    private boolean cleanupEnabled;

    @Value("${broadcast.cleanup.maxLiveDurationHours:24}")
    private long cleanupMaxLiveDurationHours; // Auto-end broadcasts older than this

    @Value("${broadcast.cleanup.staleThresholdMinutes:30}")
    private long cleanupStaleThresholdMinutes; // Auto-end broadcasts with no recent checkpoint

    @Value("${broadcast.cleanup.intervalMinutes:30}")
    private long cleanupIntervalMinutes; // How often to run cleanup check

    // In-memory tracking for consecutive unhealthy checks
    private int consecutiveUnhealthyChecks = 0;
    private Long lastCheckedBroadcastId = null;

    @Value("${broadcast.healthCheck.autoEnd:false}")
    private boolean autoEndOnUnhealthy;

    // Recovery state and last health snapshot for UI/clients
    private volatile boolean recovering = false;
    private volatile java.util.Map<String, Object> lastHealthSnapshot = new java.util.HashMap<>();
    private volatile LocalDateTime lastHealthCheckTime = null;

    // Adaptive scheduling
    private ScheduledExecutorService healthCheckScheduler;
    private ScheduledFuture<?> healthCheckFuture;


    // Unified method that handles both scheduled and immediate broadcasts
    public BroadcastDTO createBroadcast(CreateBroadcastRequest request, UserEntity user) {
        logger.info("Creating broadcast: {} for user: {}", request.getTitle(), user.getEmail());

        LocalDateTime now = LocalDateTime.now();

        // Validate that if scheduledStart is provided, scheduledEnd must also be provided
        if (request.getScheduledStart() != null && request.getScheduledEnd() == null) {
            throw new IllegalArgumentException("Scheduled end time is required when scheduled start time is provided.");
        }
        if (request.getScheduledStart() == null && request.getScheduledEnd() != null) {
            throw new IllegalArgumentException("Scheduled start time is required when scheduled end time is provided.");
        }

        // Validate that scheduled broadcasts cannot be in the past
        if (request.getScheduledStart() != null && request.getScheduledStart().isBefore(now.plusSeconds(30))) {
            throw new IllegalArgumentException("Cannot schedule broadcasts in the past. Scheduled start time must be at least 30 seconds from now.");
        }

        // Create broadcast with embedded schedule fields
        BroadcastEntity broadcast = new BroadcastEntity();
        broadcast.setTitle(request.getTitle());
        broadcast.setDescription(request.getDescription());
        broadcast.setCreatedBy(user);

        // Determine if this is a scheduled broadcast or immediate broadcast
        boolean isScheduledForFuture = request.getScheduledStart() != null &&
                                      request.getScheduledStart().isAfter(now.plusMinutes(1));

        if (isScheduledForFuture) {
            // This is a scheduled broadcast - use provided times
            broadcast.setScheduledStart(request.getScheduledStart());
            broadcast.setScheduledEnd(request.getScheduledEnd());
            broadcast.setStatus(BroadcastEntity.BroadcastStatus.SCHEDULED);
        } else {
            // This is an immediate broadcast - set past times to avoid "starting soon" notifications
            broadcast.setScheduledStart(now.minusMinutes(1)); // Set to past so no notifications
            broadcast.setScheduledEnd(now.plusHours(2)); // Default 2 hours
            broadcast.setStatus(BroadcastEntity.BroadcastStatus.SCHEDULED);
        }

        BroadcastEntity savedBroadcast = broadcastRepository.save(broadcast);

        // Log the activity
        activityLogService.logActivity(
            user,
            ActivityLogEntity.ActivityType.BROADCAST_START,
            "Broadcast created: " + savedBroadcast.getTitle()
        );

        // Only send a schedule notification if this broadcast is scheduled for the future
        if (isScheduledForFuture) {
            String notificationMessage = "New broadcast scheduled: " + savedBroadcast.getTitle() +
                                        " at " + savedBroadcast.getScheduledStart();
            sendNotificationToAllUsers(notificationMessage, NotificationType.BROADCAST_SCHEDULED);
        }

        return BroadcastDTO.fromEntity(savedBroadcast);
    }

    public BroadcastDTO updateBroadcast(Long id, CreateBroadcastRequest request) {
        logger.info("Updating broadcast: {}", id);

        LocalDateTime now = LocalDateTime.now();

        // Validate that if scheduledStart is provided, scheduledEnd must also be provided
        if (request.getScheduledStart() != null && request.getScheduledEnd() == null) {
            throw new IllegalArgumentException("Scheduled end time is required when scheduled start time is provided.");
        }
        if (request.getScheduledStart() == null && request.getScheduledEnd() != null) {
            throw new IllegalArgumentException("Scheduled start time is required when scheduled end time is provided.");
        }

        // Validate that scheduled broadcasts cannot be updated to past times
        if (request.getScheduledStart() != null && request.getScheduledStart().isBefore(now.plusSeconds(30))) {
            throw new IllegalArgumentException("Cannot schedule broadcasts in the past. Scheduled start time must be at least 30 seconds from now.");
        }

        BroadcastEntity broadcast = broadcastRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Broadcast not found"));

        // Update broadcast details
        broadcast.setTitle(request.getTitle());
        broadcast.setDescription(request.getDescription());

        // Update embedded schedule fields directly
        broadcast.setScheduledStart(request.getScheduledStart());
        broadcast.setScheduledEnd(request.getScheduledEnd());

        BroadcastEntity updatedBroadcast = broadcastRepository.save(broadcast);
        return BroadcastDTO.fromEntity(updatedBroadcast);
    }

    public BroadcastDTO updateSlowMode(Long id, Boolean enabled, Integer seconds) {
        logger.info("Updating slow mode for broadcast {}: enabled={}, seconds={}", id, enabled, seconds);
        BroadcastEntity broadcast = broadcastRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Broadcast not found"));
        boolean isEnabled = enabled != null && enabled;
        int secs = seconds != null ? Math.max(0, Math.min(seconds, 3600)) : 0; // clamp to [0, 3600]
        broadcast.setSlowModeEnabled(isEnabled);
        broadcast.setSlowModeSeconds(secs);
        BroadcastEntity saved = broadcastRepository.save(broadcast);
        return BroadcastDTO.fromEntity(saved);
    }


    // Helper method to send notifications to all users
    private void sendNotificationToAllUsers(String message, NotificationType type) {
        List<UserEntity> allUsers = userRepository.findAll();
        for (UserEntity user : allUsers) {
            notificationService.sendNotification(user, message, type);
        }
    }

    public BroadcastEntity startBroadcast(Long broadcastId, UserEntity dj) {
        return startBroadcast(broadcastId, dj, false, null);
    }

    public BroadcastEntity startBroadcast(Long broadcastId, UserEntity dj, String idempotencyKey) {
        return startBroadcast(broadcastId, dj, false, idempotencyKey);
    }

    public BroadcastEntity startBroadcastTestMode(Long broadcastId, UserEntity dj) {
        return startBroadcast(broadcastId, dj, true, null);
    }

    @Transactional
    private BroadcastEntity startBroadcast(Long broadcastId, UserEntity dj, boolean testMode, String idempotencyKey) {
        // Check circuit breaker
        if (circuitBreaker != null && !circuitBreaker.allowRequest()) {
            logger.warn("Circuit breaker is OPEN - blocking broadcast start request");
            throw new IllegalStateException("Service temporarily unavailable. Please try again later.");
        }

        try {
            // Check idempotency if key provided
            if (idempotencyKey != null && !idempotencyKey.trim().isEmpty()) {
                Optional<BroadcastEntity> existing = broadcastRepository.findByStartIdempotencyKey(idempotencyKey);
                if (existing.isPresent()) {
                    logger.info("Duplicate start request detected with idempotency key: {}. Returning existing broadcast.", idempotencyKey);
                    circuitBreaker.recordSuccess();
                    return existing.get();
                }
            }
            BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
                    .orElseThrow(() -> new IllegalArgumentException("Broadcast not found"));

            // State machine validation
            BroadcastEntity.BroadcastStatus currentStatus = broadcast.getStatus();
            if (!currentStatus.canTransitionTo(BroadcastEntity.BroadcastStatus.LIVE)) {
                String errorMsg = String.format("Cannot start broadcast in state: %s. Valid transitions: SCHEDULED->LIVE, TESTING->LIVE", currentStatus);
                logger.warn(errorMsg);
                circuitBreaker.recordFailure();
                throw new IllegalStateException(errorMsg);
            }

            // Schedule is now embedded in broadcast entity, no separate activation needed
            // Allow any DJ to start a broadcast, not just the creator
            // This enables site-wide broadcast control

            if (testMode) {
                // Test mode - bypass server checks
                logger.info("Starting broadcast in TEST MODE (Google Cloud Icecast integration bypassed)");
                // Generate a test stream URL
                broadcast.setStreamUrl(icecastService.getStreamUrl() + "?test=true");
            } else {
                // Check if the Google Cloud Icecast server is accessible
                boolean icecastServerAccessible = icecastService.checkIcecastServer();

                // If the Google Cloud Icecast server is accessible, we can proceed
                if (icecastServerAccessible) {
                    logger.info("Google Cloud Icecast server is available, proceeding with broadcast");

                    // Set the stream URL from Google Cloud Icecast service
                    broadcast.setStreamUrl(icecastService.getStreamUrl());
                } else {
                    // If the Google Cloud Icecast server is not accessible, decide based on configuration
                    if (icecastService.isDegradedStartAllowed()) {
                        logger.warn("Icecast server not accessible. Proceeding with broadcast in DEGRADED MODE using fallback stream URL");
                        String fallbackUrl = icecastService.getFallbackStreamUrl();
                        // Tag URL so clients can be aware (optional)
                        if (fallbackUrl != null && !fallbackUrl.isEmpty()) {
                            if (!fallbackUrl.contains("?")) {
                                fallbackUrl = fallbackUrl + "?degraded=true";
                            } else {
                                fallbackUrl = fallbackUrl + "&degraded=true";
                            }
                        }
                        broadcast.setStreamUrl(fallbackUrl != null ? fallbackUrl : icecastService.getStreamUrl());
                    } else {
                        // Force degraded start to avoid hard failure in dev/local environments
                        logger.error("Failed to reach Icecast. Proceeding with broadcast in FORCED DEGRADED MODE");
                        String fallbackUrl = icecastService.getFallbackStreamUrl();
                        if (fallbackUrl == null || fallbackUrl.isEmpty()) {
                            fallbackUrl = icecastService.getStreamUrl();
                        }
                        // Tag URL so clients can handle UI accordingly
                        if (!fallbackUrl.contains("?")) {
                            fallbackUrl = fallbackUrl + "?degraded=true";
                        } else {
                            fallbackUrl = fallbackUrl + "&degraded=true";
                        }
                        broadcast.setStreamUrl(fallbackUrl);
                    }
                }
            }

            // Capture old status for audit logging
            BroadcastEntity.BroadcastStatus oldStatus = broadcast.getStatus();

            // Atomic update
            broadcast.setActualStart(LocalDateTime.now());
            broadcast.setStatus(BroadcastEntity.BroadcastStatus.LIVE);
            broadcast.setStartedBy(dj);
            broadcast.setCurrentActiveDJ(dj); // Set current active DJ when broadcast starts
            broadcast.setActiveSessionId(UUID.randomUUID().toString()); // Generate active session ID
            if (idempotencyKey != null && !idempotencyKey.trim().isEmpty()) {
                broadcast.setStartIdempotencyKey(idempotencyKey);
                logger.info("Setting start idempotency key: {} for broadcast {}", idempotencyKey, broadcastId);
            }

            BroadcastEntity savedBroadcast = broadcastRepository.save(broadcast);
            broadcastRepository.flush(); // Force immediate write to database
            
            logger.info("Broadcast started: ID={}, Status={}, StartedBy={}, CurrentActiveDJ={}, StartIdempotencyKey={}, ActiveSessionId={}", 
                savedBroadcast.getId(),
                savedBroadcast.getStatus(),
                savedBroadcast.getStartedBy() != null ? savedBroadcast.getStartedBy().getId() : "null",
                savedBroadcast.getCurrentActiveDJ() != null ? savedBroadcast.getCurrentActiveDJ().getId() : "null",
                savedBroadcast.getStartIdempotencyKey() != null ? savedBroadcast.getStartIdempotencyKey() : "null",
                savedBroadcast.getActiveSessionId());

            // Log state transition for audit trail
            Map<String, Object> metadata = new java.util.HashMap<>();
            metadata.put("testMode", testMode);
            if (idempotencyKey != null && !idempotencyKey.trim().isEmpty()) {
                metadata.put("idempotencyKey", idempotencyKey);
            }
            
            activityLogService.logBroadcastStateTransition(
                dj,
                savedBroadcast.getId(),
                savedBroadcast.getTitle(),
                oldStatus.toString(),
                BroadcastEntity.BroadcastStatus.LIVE.toString(),
                testMode ? "TEST MODE" : "Normal start"
            );

            // Log the activity (legacy support)
            activityLogService.logActivity(
                dj,
                ActivityLogEntity.ActivityType.BROADCAST_START,
                (testMode ? "TEST MODE: " : "") + "Broadcast started: " + savedBroadcast.getTitle()
            );

            // Record success in circuit breaker
            if (circuitBreaker != null) {
                circuitBreaker.recordSuccess();
            }

            // Send notifications asynchronously (non-blocking)
            if (!testMode) {
                CompletableFuture.runAsync(() -> {
                    try {
                        // Send notification to all users that the broadcast has started
                        String notificationMessage = "Broadcast started: " + savedBroadcast.getTitle();
                        sendNotificationToAllUsers(notificationMessage, NotificationType.BROADCAST_STARTED);

                        // Send WebSocket message for immediate UI updates
                        Map<String, Object> broadcastStartedMessage = new java.util.HashMap<>();
                        broadcastStartedMessage.put("type", "BROADCAST_STARTED");
                        broadcastStartedMessage.put("broadcast", BroadcastDTO.fromEntity(savedBroadcast));
                        messagingTemplate.convertAndSend("/topic/broadcast/status", broadcastStartedMessage);

                        // Clear transient key used for "starting soon" notifications for this broadcast
                        if (savedBroadcast.getId() != null) {
                            notificationService.clearTransientKey("starting-soon:" + savedBroadcast.getId());
                        }
                    } catch (Exception e) {
                        logger.error("Error sending broadcast start notifications", e);
                    }
                });
            }

            return savedBroadcast;
        } catch (IllegalStateException e) {
            // Re-throw state machine validation errors
            throw e;
        } catch (Exception e) {
            // Record failure in circuit breaker
            if (circuitBreaker != null) {
                circuitBreaker.recordFailure();
            }
            logger.error("Error starting broadcast", e);
            throw e;
        }
    }

    public BroadcastEntity endBroadcast(Long broadcastId, UserEntity dj) {
        return endBroadcast(broadcastId, dj, null);
    }

    @Transactional
    public BroadcastEntity endBroadcast(Long broadcastId, UserEntity dj, String idempotencyKey) {
        // Check circuit breaker
        if (circuitBreaker != null && !circuitBreaker.allowRequest()) {
            logger.warn("Circuit breaker is OPEN - blocking broadcast end request");
            throw new IllegalStateException("Service temporarily unavailable. Please try again later.");
        }

        try {
            // Check idempotency if key provided
            if (idempotencyKey != null && !idempotencyKey.trim().isEmpty()) {
                Optional<BroadcastEntity> existing = broadcastRepository.findByEndIdempotencyKey(idempotencyKey);
                if (existing.isPresent()) {
                    logger.info("Duplicate end request detected with idempotency key: {}. Returning existing broadcast.", idempotencyKey);
                    
                    // Audit log: Idempotent operation detected
                    Map<String, Object> metadata = new java.util.HashMap<>();
                    metadata.put("idempotencyKey", idempotencyKey);
                    metadata.put("existingBroadcastId", existing.get().getId());
                    activityLogService.logAuditWithMetadata(
                        dj,
                        ActivityLogEntity.ActivityType.IDEMPOTENT_OPERATION_DETECTED,
                        String.format("Duplicate broadcast end prevented (idempotency key: %s)", idempotencyKey),
                        existing.get().getId(),
                        metadata
                    );
                    
                    circuitBreaker.recordSuccess();
                    BroadcastEntity existingBroadcast = existing.get();
                    existingBroadcast.setEndResultType(BroadcastEntity.BroadcastEndResultType.IDEMPOTENT_DUPLICATE);
                    existingBroadcast.setVerificationRetried(false);
                    return existingBroadcast;
                }
            }

            BroadcastEntity broadcast = broadcastRepository.findByIdForUpdate(broadcastId)
                    .orElseThrow(() -> new IllegalArgumentException("Broadcast not found"));

            // State machine validation
            BroadcastEntity.BroadcastStatus currentStatus = broadcast.getStatus();
            if (BroadcastEntity.BroadcastStatus.ENDED.equals(currentStatus)) {
                logger.info("Broadcast {} already ended. Idempotent no-op.", broadcastId);
                if (circuitBreaker != null) {
                    circuitBreaker.recordSuccess();
                }
                broadcast.setEndResultType(BroadcastEntity.BroadcastEndResultType.NO_OP_ALREADY_ENDED);
                broadcast.setVerificationRetried(false);
                return broadcast;
            }
            if (!currentStatus.canTransitionTo(BroadcastEntity.BroadcastStatus.ENDED)) {
                String errorMsg = String.format("Cannot end broadcast in state: %s. Valid transitions: LIVE->ENDED, TESTING->ENDED", currentStatus);
                logger.warn(errorMsg);
                circuitBreaker.recordFailure();
                throw new IllegalStateException(errorMsg);
            }

            // Allow any DJ to end a broadcast, not just the creator
            // This enables site-wide broadcast control

            // Capture old status for audit logging
            BroadcastEntity.BroadcastStatus oldStatus = broadcast.getStatus();

            // Atomic update
            LocalDateTime endTimestamp = LocalDateTime.now();
            broadcast.setActualEnd(endTimestamp);
            broadcast.setStatus(BroadcastEntity.BroadcastStatus.ENDED);
            if (idempotencyKey != null && !idempotencyKey.trim().isEmpty()) {
                broadcast.setEndIdempotencyKey(idempotencyKey);
                logger.info("Setting end idempotency key: {} for broadcast {}", idempotencyKey, broadcastId);
            }

            BroadcastEntity savedBroadcast = broadcastRepository.saveAndFlush(broadcast);
            BroadcastEntity finalBroadcast = verifyEndStateWithRetry(savedBroadcast.getId(), endTimestamp);
            finalBroadcast.setEndResultType(BroadcastEntity.BroadcastEndResultType.SUCCESS);
            
            logger.info("Broadcast ended: ID={}, Status={}, EndIdempotencyKey={}", 
                finalBroadcast.getId(),
                finalBroadcast.getStatus(),
                finalBroadcast.getEndIdempotencyKey() != null ? finalBroadcast.getEndIdempotencyKey() : "null");

            // CRITICAL FIX: Clear all active broadcasts from IcecastService to ensure stream status is updated
            // This fixes the issue where the stream still shows as live after ending
            icecastService.clearAllActiveBroadcasts();

            // Log state transition for audit trail
            Map<String, Object> metadata = new java.util.HashMap<>();
            if (idempotencyKey != null && !idempotencyKey.trim().isEmpty()) {
                metadata.put("idempotencyKey", idempotencyKey);
            }
            
            activityLogService.logBroadcastStateTransition(
                dj,
                finalBroadcast.getId(),
                finalBroadcast.getTitle(),
                oldStatus.toString(),
                BroadcastEntity.BroadcastStatus.ENDED.toString(),
                "Manual end by DJ"
            );

            // Log the activity (legacy support)
            activityLogService.logActivity(
                dj,
                ActivityLogEntity.ActivityType.BROADCAST_END,
                "Broadcast ended: " + finalBroadcast.getTitle()
            );

            // Record success in circuit breaker
            if (circuitBreaker != null) {
                circuitBreaker.recordSuccess();
            }

            // Cancel any ongoing reconnection attempts when broadcast ends
            if (reconnectionManager != null) {
                reconnectionManager.cancelReconnection(broadcastId);
            }

            // Send notifications asynchronously (non-blocking)
            CompletableFuture.runAsync(() -> {
                try {
                    // Send notification to all users that the broadcast has ended
                    String notificationMessage = "Broadcast ended: " + finalBroadcast.getTitle();
                    sendNotificationToAllUsers(notificationMessage, NotificationType.BROADCAST_ENDED);

                    // Send WebSocket message for immediate UI updates
                    Map<String, Object> broadcastEndedMessage = new java.util.HashMap<>();
                    broadcastEndedMessage.put("type", "BROADCAST_ENDED");
                    broadcastEndedMessage.put("broadcast", BroadcastDTO.fromEntity(finalBroadcast));
                    messagingTemplate.convertAndSend("/topic/broadcast/status", broadcastEndedMessage);
                } catch (Exception e) {
                    logger.error("Error sending broadcast end notifications", e);
                }
            });

            return finalBroadcast;
        } catch (IllegalStateException e) {
            // Re-throw state machine validation errors
            throw e;
        } catch (Exception e) {
            // Record failure in circuit breaker
            if (circuitBreaker != null) {
                circuitBreaker.recordFailure();
            }
            logger.error("Error ending broadcast", e);
            throw e;
        }
    }

    /**
     * Simplified version of endBroadcast that doesn't require a user parameter
     * This is used for API calls that don't have user authentication (e.g., auto-end on health check failure)
     */
    @Transactional
    public BroadcastEntity endBroadcast(Long broadcastId) {
        // Check circuit breaker
        if (circuitBreaker != null && !circuitBreaker.allowRequest()) {
            logger.warn("Circuit breaker is OPEN - blocking broadcast end request");
            throw new IllegalStateException("Service temporarily unavailable. Please try again later.");
        }

        try {
            BroadcastEntity broadcast = broadcastRepository.findByIdForUpdate(broadcastId)
                    .orElseThrow(() -> new IllegalArgumentException("Broadcast not found"));

            // State machine validation
            BroadcastEntity.BroadcastStatus currentStatus = broadcast.getStatus();
            if (BroadcastEntity.BroadcastStatus.ENDED.equals(currentStatus)) {
                logger.info("Broadcast {} already ended (auto path). Idempotent no-op.", broadcastId);
                if (circuitBreaker != null) {
                    circuitBreaker.recordSuccess();
                }
                broadcast.setEndResultType(BroadcastEntity.BroadcastEndResultType.NO_OP_ALREADY_ENDED);
                broadcast.setVerificationRetried(false);
                return broadcast;
            }
            if (!currentStatus.canTransitionTo(BroadcastEntity.BroadcastStatus.ENDED)) {
                String errorMsg = String.format("Cannot end broadcast in state: %s. Valid transitions: LIVE->ENDED, TESTING->ENDED", currentStatus);
                logger.warn(errorMsg);
                circuitBreaker.recordFailure();
                throw new IllegalStateException(errorMsg);
            }

            // Capture old status for audit logging
            BroadcastEntity.BroadcastStatus oldStatus = broadcast.getStatus();

            // Atomic update
            LocalDateTime endTimestamp = LocalDateTime.now();
            broadcast.setActualEnd(endTimestamp);
            broadcast.setStatus(BroadcastEntity.BroadcastStatus.ENDED);

            BroadcastEntity savedBroadcast = broadcastRepository.saveAndFlush(broadcast);
            BroadcastEntity finalBroadcast = verifyEndStateWithRetry(savedBroadcast.getId(), endTimestamp);
            finalBroadcast.setEndResultType(BroadcastEntity.BroadcastEndResultType.SUCCESS);

            // CRITICAL FIX: Clear all active broadcasts from IcecastService to ensure stream status is updated
            icecastService.clearAllActiveBroadcasts();

            // Log state transition for audit trail (system-level, no user)
            activityLogService.logBroadcastStateTransition(
                null, // System event
                finalBroadcast.getId(),
                finalBroadcast.getTitle(),
                oldStatus.toString(),
                BroadcastEntity.BroadcastStatus.ENDED.toString(),
                "Auto-end (no user context)"
            );

            // Record success in circuit breaker
            if (circuitBreaker != null) {
                circuitBreaker.recordSuccess();
            }

            logger.info("Broadcast ended without user info: {}", finalBroadcast.getTitle());

            // Cancel any ongoing reconnection attempts when broadcast ends
            if (reconnectionManager != null) {
                reconnectionManager.cancelReconnection(broadcastId);
            }

            // Send WebSocket notification asynchronously
            CompletableFuture.runAsync(() -> {
                try {
                    Map<String, Object> broadcastEndedMessage = new java.util.HashMap<>();
                    broadcastEndedMessage.put("type", "BROADCAST_ENDED");
                    broadcastEndedMessage.put("broadcast", BroadcastDTO.fromEntity(finalBroadcast));
                    messagingTemplate.convertAndSend("/topic/broadcast/status", broadcastEndedMessage);
                } catch (Exception e) {
                    logger.error("Error sending broadcast end notification", e);
                }
            });

            return finalBroadcast;
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            if (circuitBreaker != null) {
                circuitBreaker.recordFailure();
            }
            logger.error("Error ending broadcast", e);
            throw e;
        }
    }

    private BroadcastEntity verifyEndStateWithRetry(Long broadcastId, LocalDateTime fallbackEndTime) {
        BroadcastEntity verified = broadcastRepository.findByIdForUpdate(broadcastId)
                .orElseThrow(() -> new IllegalArgumentException("Broadcast not found during verification"));

        if (BroadcastEntity.BroadcastStatus.ENDED.equals(verified.getStatus()) && verified.getActualEnd() != null) {
            verified.setVerificationRetried(false);
            return verified;
        }

        logger.warn("Broadcast {} end state not persisted after initial save. Retrying force-write.", broadcastId);

        verified.setStatus(BroadcastEntity.BroadcastStatus.ENDED);
        if (verified.getActualEnd() == null) {
            verified.setActualEnd(fallbackEndTime != null ? fallbackEndTime : LocalDateTime.now());
        }

        broadcastRepository.saveAndFlush(verified);

        BroadcastEntity forcedVerification = broadcastRepository.findByIdForUpdate(broadcastId)
                .orElseThrow(() -> new IllegalArgumentException("Broadcast not found after force-write"));

        if (!BroadcastEntity.BroadcastStatus.ENDED.equals(forcedVerification.getStatus()) ||
                forcedVerification.getActualEnd() == null) {
            logger.error("Broadcast {} failed to persist ENDED state even after retry.", broadcastId);
            throw new IllegalStateException("Unable to persist broadcast end state");
        }

        logger.info("Broadcast {} end state confirmed after retry.", broadcastId);
        forcedVerification.setVerificationRetried(true);
        return forcedVerification;
    }

    public BroadcastEntity testBroadcast(Long broadcastId, UserEntity dj) {
        // Use startBroadcastTestMode to bypass server checks and start a test broadcast
        return startBroadcastTestMode(broadcastId, dj);
    }

    public Optional<BroadcastEntity> getBroadcastById(Long id) {
        return broadcastRepository.findById(id);
    }

    public List<BroadcastEntity> getAllBroadcasts() {
        return broadcastRepository.findAll();
    }

    public List<BroadcastEntity> getBroadcastsByDJ(UserEntity dj) {
        // Include broadcasts where DJ was active (creator, startedBy, currentActiveDJ, or via handovers)
        return broadcastRepository.findByActiveDJ(dj);
    }

    public List<BroadcastEntity> getLiveBroadcasts() {
        return broadcastRepository.findByStatusOrderByActualStartDesc(BroadcastEntity.BroadcastStatus.LIVE);
    }
    
    /**
     * Get the most recent live broadcast (the one that should be active)
     * This ensures we always get the current live broadcast, not an old one
     */
    public Optional<BroadcastEntity> getCurrentLiveBroadcast() {
        List<BroadcastEntity> liveBroadcasts = getLiveBroadcasts();
        return liveBroadcasts.isEmpty() ? Optional.empty() : Optional.of(liveBroadcasts.get(0));
    }

    public List<BroadcastEntity> getUpcomingBroadcasts() {
        return broadcastRepository.findByStatusAndScheduledStartAfter(
            BroadcastEntity.BroadcastStatus.SCHEDULED, 
            LocalDateTime.now()
        );
    }

    /**
     * Optimized method to get upcoming broadcasts using DTO projection.
     * Eliminates N+1 queries by fetching only needed columns in a single query.
     * Returns only SCHEDULED broadcasts (excludes COMPLETED, CANCELLED).
     * 
     * @return List of UpcomingBroadcastDTO sorted by scheduled start time
     */
    public List<com.wildcastradio.Broadcast.DTO.UpcomingBroadcastDTO> getUpcomingBroadcastsDTO() {
        // Limit to a reasonable number to keep payload small
        Pageable pageable = PageRequest.of(0, 100);
        return broadcastRepository.findUpcomingFromScheduleDTO(
            BroadcastEntity.BroadcastStatus.SCHEDULED,
            LocalDateTime.now(),
            pageable
        );
    }

    public List<BroadcastEntity> getEndedBroadcastsSince(LocalDateTime since) {
        return broadcastRepository.findEndedSince(since);
    }

    public Page<BroadcastEntity> getEndedBroadcastsSince(LocalDateTime since, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        Pageable pageable = PageRequest.of(safePage, safeSize);
        return broadcastRepository.findEndedSince(since, pageable);
    }

    public Page<BroadcastEntity> searchBroadcasts(String query, String status, Pageable pageable) {
        if (status != null && !status.isEmpty()) {
            try {
                BroadcastEntity.BroadcastStatus broadcastStatus = BroadcastEntity.BroadcastStatus.valueOf(status.toUpperCase());
                return broadcastRepository.findByTitleContainingIgnoreCaseAndStatus(query, broadcastStatus, pageable);
            } catch (IllegalArgumentException e) {
                logger.warn("Invalid broadcast status: {}, falling back to title search", status);
            }
        }
        return broadcastRepository.findByTitleContainingIgnoreCase(query, pageable);
    }

    // Method to get engagement data for analytics
    public String getAnalytics(Long broadcastId) {
        Optional<BroadcastEntity> broadcast = getBroadcastById(broadcastId);
        if (broadcast.isPresent()) {
            BroadcastEntity b = broadcast.get();
            return String.format("Analytics for broadcast '%s': Chat messages: %d, Song requests: %d", 
                                b.getTitle(), 
                                b.getChatMessages().size(), 
                                b.getSongRequests().size());
        }
        return "Broadcast not found";
    }

    public void deleteBroadcast(Long id) {
        logger.info("Deleting broadcast with ID: {}", id);

        // Check if the broadcast exists
        broadcastRepository.findById(id)
                .orElseThrow(() -> {
                    logger.error("Failed to delete broadcast: Broadcast not found with ID: {}", id);
                    return new RuntimeException("Broadcast not found with id: " + id);
                });

        try {
            // Delete the broadcast (schedule is now embedded, no separate entity to cancel)
            broadcastRepository.deleteById(id);
            logger.info("Broadcast with ID: {} deleted successfully", id);
        } catch (Exception e) {
            logger.error("Error deleting broadcast with ID {}: {}", id, e.getMessage());
            throw new RuntimeException("Failed to delete broadcast: " + e.getMessage());
        }
    }

    /**
     * Scheduled task that runs every 5 minutes to check for broadcasts that are about to start
     * and send notifications to users.
     */
    @Scheduled(fixedRate = 300000) // 5 minutes in milliseconds
    public void checkUpcomingBroadcasts() {
        logger.info("Checking for upcoming broadcasts...");

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime fifteenMinutesFromNow = now.plusMinutes(15);

        // Find broadcasts that are scheduled to start in the next 15 minutes
        List<BroadcastEntity> upcomingBroadcasts = broadcastRepository.findByScheduledStartBetween(
            now.plusMinutes(1), // Start from 1 minute in the future to avoid immediate broadcasts
            fifteenMinutesFromNow
        );

        // Filter to only include broadcasts with SCHEDULED status
        upcomingBroadcasts = upcomingBroadcasts.stream()
            .filter(broadcast -> broadcast.getStatus() == BroadcastEntity.BroadcastStatus.SCHEDULED)
            .collect(java.util.stream.Collectors.toList());

        for (BroadcastEntity broadcast : upcomingBroadcasts) {
            // Send notification to all users that the broadcast is about to start, once per user per broadcast
            String notificationMessage = "Broadcast starting soon: " + broadcast.getTitle() +
                                        " at " + broadcast.getScheduledStart();
            String baseKey = "starting-soon:" + broadcast.getId();
            List<UserEntity> allUsers = userRepository.findAll();
            for (UserEntity user : allUsers) {
                notificationService.sendTransientNotificationOnce(baseKey + ":" + user.getId(), user,
                        notificationMessage, NotificationType.BROADCAST_STARTING_SOON);
            }

            logger.info("Ensured 'starting soon' notification for broadcast: {} (deduped)", broadcast.getTitle());
        }
    }


    /**
     * Record a listener joining a broadcast
     * 
     * @param broadcastId The ID of the broadcast
     * @param user The user who joined (can be null for anonymous listeners)
     */
    public void recordListenerJoin(Long broadcastId, UserEntity user) {
        logger.info("Listener joined broadcast {}: {}", 
                    broadcastId, 
                    user != null ? user.getEmail() : "Anonymous");

        // Get the broadcast
        Optional<BroadcastEntity> broadcastOpt = getBroadcastById(broadcastId);
        if (broadcastOpt.isPresent()) {
            BroadcastEntity broadcast = broadcastOpt.get();

            // Log the activity if the user is authenticated
            if (user != null) {
                activityLogService.logActivity(
                    user,
                    ActivityLogEntity.ActivityType.BROADCAST_START,
                    "Joined broadcast: " + broadcast.getTitle()
                );
            }

            // Record listener join in tracking service for real-time analytics
            listenerTrackingService.recordListenerJoin(broadcastId, user != null ? user.getId() : null);
        }
    }

    /**
     * Record a listener leaving a broadcast
     * 
     * @param broadcastId The ID of the broadcast
     * @param user The user who left (can be null for anonymous listeners)
     */
    public void recordListenerLeave(Long broadcastId, UserEntity user) {
        logger.info("Listener left broadcast {}: {}", 
                    broadcastId, 
                    user != null ? user.getEmail() : "Anonymous");

        // Get the broadcast
        Optional<BroadcastEntity> broadcastOpt = getBroadcastById(broadcastId);
        if (broadcastOpt.isPresent()) {
            // Record listener leave in tracking service for real-time analytics
            listenerTrackingService.recordListenerLeave(broadcastId, user != null ? user.getId() : null);
        }
    }

    // Analytics methods for data retrieval
    public long getTotalBroadcastCount() {
        return broadcastRepository.count();
    }

    public long getLiveBroadcastCount() {
        return broadcastRepository.countByStatus(BroadcastEntity.BroadcastStatus.LIVE);
    }

    public long getUpcomingBroadcastCount() {
        return broadcastRepository.countByStatusAndScheduledStartAfter(
            BroadcastEntity.BroadcastStatus.SCHEDULED, 
            LocalDateTime.now()
        );
    }

    public long getCompletedBroadcastCount() {
        return broadcastRepository.countByStatus(BroadcastEntity.BroadcastStatus.ENDED);
    }

    public double getAverageBroadcastDuration() {
        List<BroadcastEntity> completedBroadcasts = broadcastRepository.findByStatusOrderByActualStartDesc(BroadcastEntity.BroadcastStatus.ENDED);

        if (completedBroadcasts.isEmpty()) {
            return 0.0;
        }

        long totalMinutes = completedBroadcasts.stream()
            .filter(broadcast -> broadcast.getActualStart() != null && broadcast.getActualEnd() != null)
            .mapToLong(broadcast -> java.time.Duration.between(broadcast.getActualStart(), broadcast.getActualEnd()).toMinutes())
            .sum();

        return (double) totalMinutes / completedBroadcasts.size();
    }

    public List<BroadcastEntity> getPopularBroadcasts(int limit) {
        // Prefer ended broadcasts with most interactions, then live, then scheduled
        // Fetch all broadcasts (without collections to avoid MultipleBagFetchException)
        List<BroadcastEntity> all = broadcastRepository.findAll();
        
        if (all.isEmpty()) {
            return java.util.Collections.emptyList();
        }
        
        // Get all broadcast IDs
        List<Long> broadcastIds = all.stream()
            .map(BroadcastEntity::getId)
            .collect(java.util.stream.Collectors.toList());
        
        // Use batch aggregation queries to get all counts in just 2 queries
        java.util.Map<Long, Integer> interactionCounts = new java.util.HashMap<>();
        
        // Initialize all broadcasts with 0 counts
        for (Long id : broadcastIds) {
            interactionCounts.put(id, 0);
        }
        
        // Batch query for chat messages - single query for all broadcasts
        List<Object[]> chatCounts = chatMessageRepository.countMessagesByBroadcastIds(broadcastIds);
        for (Object[] result : chatCounts) {
            Long broadcastId = ((Number) result[0]).longValue();
            Long count = ((Number) result[1]).longValue();
            interactionCounts.put(broadcastId, count.intValue());
        }
        
        // Batch query for song requests - single query for all broadcasts
        List<Object[]> requestCounts = songRequestRepository.countSongRequestsByBroadcastIds(broadcastIds);
        java.util.Map<Long, Integer> requestCountsMap = new java.util.HashMap<>();
        for (Object[] result : requestCounts) {
            Long broadcastId = ((Number) result[0]).longValue();
            Long count = ((Number) result[1]).longValue();
            requestCountsMap.put(broadcastId, count.intValue());
        }
        
        // Combine chat and request counts
        for (Long id : broadcastIds) {
            int chatCount = interactionCounts.getOrDefault(id, 0);
            int requestCount = requestCountsMap.getOrDefault(id, 0);
            interactionCounts.put(id, chatCount + requestCount);
        }
        
        return all.stream()
            .sorted((a, b) -> {
                // Use pre-computed counts instead of querying during sort
                int aInteractions = interactionCounts.getOrDefault(a.getId(), 0);
                int bInteractions = interactionCounts.getOrDefault(b.getId(), 0);
                
                // Desc by interactions, tie-breaker by latest actualStart/end
                int cmp = Integer.compare(bInteractions, aInteractions);
                if (cmp != 0) return cmp;
                java.time.LocalDateTime aTime = a.getActualEnd() != null ? a.getActualEnd() : a.getActualStart();
                java.time.LocalDateTime bTime = b.getActualEnd() != null ? b.getActualEnd() : b.getActualStart();
                if (aTime == null && bTime == null) return 0;
                if (aTime == null) return 1;
                if (bTime == null) return -1;
                return bTime.compareTo(aTime);
            })
            .limit(limit)
            .collect(java.util.stream.Collectors.toList());
    }

    /**
     * Initialize adaptive health check scheduler on startup
     */
    @jakarta.annotation.PostConstruct
    public void initAdaptiveHealthCheck() {
        if (adaptiveIntervalsEnabled && healthCheckEnabled) {
            healthCheckScheduler = Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "BroadcastHealthCheck-Adaptive");
                t.setDaemon(true);
                return t;
            });
            // Start the adaptive health check loop
            scheduleNextHealthCheck();
            logger.info("Adaptive health check scheduler initialized (min: {}ms, max: {}ms, stable threshold: {}min)",
                adaptiveMinIntervalMs, adaptiveMaxIntervalMs, adaptiveStableThresholdMinutes);
        }
    }

    /**
     * Shutdown scheduler on destroy
     */
    @jakarta.annotation.PreDestroy
    public void shutdownAdaptiveHealthCheck() {
        if (healthCheckScheduler != null) {
            if (healthCheckFuture != null) {
                healthCheckFuture.cancel(false);
            }
            healthCheckScheduler.shutdown();
            try {
                if (!healthCheckScheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                    healthCheckScheduler.shutdownNow();
                }
            } catch (InterruptedException e) {
                healthCheckScheduler.shutdownNow();
                Thread.currentThread().interrupt();
            }
            logger.info("Adaptive health check scheduler shut down");
        }
    }

    /**
     * Calculate adaptive health check interval based on broadcast age and health status
     */
    private long calculateAdaptiveInterval(BroadcastEntity broadcast, boolean isHealthy) {
        if (!adaptiveIntervalsEnabled) {
            return healthCheckIntervalMs; // Fallback to fixed interval
        }

        // If unhealthy or recovering, use minimum interval for faster detection
        if (!isHealthy || recovering || consecutiveUnhealthyChecks > 0) {
            return adaptiveMinIntervalMs;
        }

        // Calculate broadcast age
        if (broadcast.getActualStart() == null) {
            return adaptiveMinIntervalMs; // New broadcast, use min interval
        }

        long broadcastAgeMinutes = java.time.Duration.between(
            broadcast.getActualStart(),
            LocalDateTime.now()
        ).toMinutes();

        // For new broadcasts (< 5 minutes), use minimum interval
        if (broadcastAgeMinutes < 5) {
            return adaptiveMinIntervalMs;
        }
        // For stable broadcasts (> threshold), use maximum interval
        else if (broadcastAgeMinutes >= adaptiveStableThresholdMinutes) {
            return adaptiveMaxIntervalMs;
        }
        // For medium-age broadcasts, interpolate between min and max
        else {
            // Linear interpolation: min + (max - min) * (age / threshold)
            double progress = (double) broadcastAgeMinutes / adaptiveStableThresholdMinutes;
            long interval = (long) (adaptiveMinIntervalMs + 
                (adaptiveMaxIntervalMs - adaptiveMinIntervalMs) * progress);
            return Math.max(adaptiveMinIntervalMs, Math.min(adaptiveMaxIntervalMs, interval));
        }
    }

    /**
     * Schedule the next health check with adaptive interval
     */
    private void scheduleNextHealthCheck() {
        if (healthCheckScheduler == null || !healthCheckEnabled) {
            return;
        }

        try {
            Optional<BroadcastEntity> liveOpt = getCurrentLiveBroadcast();
            boolean isHealthy = lastHealthSnapshot.getOrDefault("healthy", false).equals(true);
            
            long nextInterval;
            if (liveOpt.isPresent()) {
                nextInterval = calculateAdaptiveInterval(liveOpt.get(), isHealthy);
            } else {
                // No live broadcast: use max interval to reduce load
                nextInterval = adaptiveMaxIntervalMs;
            }

            healthCheckFuture = healthCheckScheduler.schedule(() -> {
                monitorLiveStreamHealthInternal();
                scheduleNextHealthCheck(); // Reschedule for next check
            }, nextInterval, TimeUnit.MILLISECONDS);

            logger.debug("Next health check scheduled in {}ms (adaptive: {})", 
                nextInterval, adaptiveIntervalsEnabled);
        } catch (Exception e) {
            logger.error("Error scheduling adaptive health check: {}", e.getMessage());
            // Fallback: reschedule with base interval
            healthCheckFuture = healthCheckScheduler.schedule(() -> {
                monitorLiveStreamHealthInternal();
                scheduleNextHealthCheck();
            }, healthCheckIntervalMs, TimeUnit.MILLISECONDS);
        }
    }

    /**
     * Periodically verify live stream health and auto-end broadcast if stalled.
     * Healthy criteria: Icecast server reachable, mount exists, active source present, bitrate > 0.
     * Uses consecutive unhealthy checks to avoid false positives during brief network hiccups.
     * 
     * Note: When adaptive intervals are enabled, this method is called by the adaptive scheduler.
     * Otherwise, it uses the fixed @Scheduled annotation.
     */
    @Scheduled(fixedDelayString = "${broadcast.healthCheck.intervalMs:15000}")
    public void monitorLiveStreamHealth() {
        // Skip if adaptive scheduling is enabled (it will call this method directly)
        if (adaptiveIntervalsEnabled && healthCheckScheduler != null) {
            return;
        }
        
        monitorLiveStreamHealthInternal();
    }

    /**
     * Internal health check implementation (called by both fixed and adaptive schedulers)
     */
    private void monitorLiveStreamHealthInternal() {
        if (!healthCheckEnabled) {
            return;
        }
        try {
            Optional<BroadcastEntity> liveOpt = getCurrentLiveBroadcast();
            if (liveOpt.isEmpty()) {
                // Nothing live; reset state
                consecutiveUnhealthyChecks = 0;
                lastCheckedBroadcastId = null;
                recovering = false;
                // Update snapshot to reflect no live broadcast
                lastHealthSnapshot = new java.util.HashMap<>();
                lastHealthSnapshot.put("healthy", false);
                lastHealthSnapshot.put("recovering", false);
                lastHealthSnapshot.put("broadcastLive", false);
                lastHealthSnapshot.put("consecutiveUnhealthyChecks", consecutiveUnhealthyChecks);
                lastHealthCheckTime = LocalDateTime.now();
                return;
            }

            BroadcastEntity live = liveOpt.get();
            Long id = live.getId();
            if (id == null) {
                return;
            }

            if (lastCheckedBroadcastId == null || !id.equals(lastCheckedBroadcastId)) {
                // New live broadcast; reset counters
                lastCheckedBroadcastId = id;
                consecutiveUnhealthyChecks = 0;
            }

            // Apply startup grace period after a broadcast starts to avoid early false negatives
            Long startMs = icecastService.getEarliestActiveBroadcastStartTimeMillis();
            if (startMs != null) {
                long elapsed = System.currentTimeMillis() - startMs;
                if (elapsed < healthCheckStartupGraceMs) {
                    // Within grace window: report recovering but do not count as unhealthy or spam logs
                    Map<String, Object> graceStatus = new java.util.HashMap<>();
                    graceStatus.put("serverReachable", true); // optimistic until first real check completes
                    graceStatus.put("mountPointExists", false);
                    graceStatus.put("hasActiveSource", false);
                    graceStatus.put("listenerCount", 0);
                    graceStatus.put("bitrate", 0);
                    graceStatus.put("errorMessage", "Within startup grace period: " + (healthCheckStartupGraceMs - elapsed) + "ms remaining");

                    lastHealthSnapshot = graceStatus;
                    lastHealthSnapshot.put("healthy", false);
                    lastHealthSnapshot.put("recovering", true);
                    lastHealthSnapshot.put("consecutiveUnhealthyChecks", consecutiveUnhealthyChecks);
                    lastHealthSnapshot.put("broadcastId", id);
                    lastHealthSnapshot.put("broadcastLive", true);
                    lastHealthCheckTime = LocalDateTime.now();
                    return;
                }
            }

            Map<String, Object> status = icecastService.checkMountPointStatus(false);
            boolean serverReachable = Boolean.TRUE.equals(status.get("serverReachable"));
            boolean mountExists = Boolean.TRUE.equals(status.get("mountPointExists"));
            boolean hasSource = Boolean.TRUE.equals(status.get("hasActiveSource"));
            int bitrate = 0;
            Object bitrateObj = status.get("bitrate");
            if (bitrateObj instanceof Number) {
                bitrate = ((Number) bitrateObj).intValue();
            } else if (bitrateObj != null) {
                try { bitrate = Integer.parseInt(String.valueOf(bitrateObj)); } catch (Exception ignore) {}
            }

            boolean healthy = serverReachable && mountExists && hasSource && bitrate > 0;

            if (healthy) {
                boolean wasRecovering = recovering || consecutiveUnhealthyChecks > 0;
                if (wasRecovering) {
                    logger.info("Live stream recovered health for broadcast id={}; resetting recovering state", id);
                    
                    // Cancel any ongoing reconnection attempts (source restored)
                    if (reconnectionManager != null && reconnectionManager.isReconnecting(id)) {
                        ReconnectionAttempt attempt = reconnectionManager.getReconnectionAttempt(id);
                        if (attempt != null) {
                            logger.info("Source restored for broadcast {}, cancelling reconnection attempts", id);
                            reconnectionManager.cancelReconnection(id);
                        }
                    }
                    
                    // Audit log: Health check recovered
                    Map<String, Object> metadata = new java.util.HashMap<>();
                    metadata.put("previousConsecutiveUnhealthyChecks", consecutiveUnhealthyChecks);
                    metadata.put("serverReachable", serverReachable);
                    metadata.put("mountExists", mountExists);
                    metadata.put("hasSource", hasSource);
                    metadata.put("bitrate", bitrate);
                    activityLogService.logSystemAuditWithMetadata(
                        ActivityLogEntity.ActivityType.BROADCAST_HEALTH_CHECK_RECOVERED,
                        String.format("Broadcast health recovered: %s", live.getTitle()),
                        id,
                        metadata
                    );
                }
                consecutiveUnhealthyChecks = 0;
                recovering = false;
                // Update snapshot
                lastHealthSnapshot = new java.util.HashMap<>(status);
                lastHealthSnapshot.put("healthy", true);
                lastHealthSnapshot.put("recovering", false);
                lastHealthSnapshot.put("consecutiveUnhealthyChecks", consecutiveUnhealthyChecks);
                lastHealthSnapshot.put("broadcastId", id);
                lastHealthSnapshot.put("broadcastLive", true);
                lastHealthCheckTime = LocalDateTime.now();
                return;
            }

            consecutiveUnhealthyChecks++;
            
            // Classify source disconnection type if classifier is available
            SourceDisconnectionType disconnectionType = SourceDisconnectionType.UNKNOWN;
            if (sourceStateClassifier != null) {
                try {
                    disconnectionType = sourceStateClassifier.classify(status);
                    logger.debug("Classified disconnection type for broadcast {}: {}", id, disconnectionType);
                } catch (Exception e) {
                    logger.warn("Failed to classify source disconnection type: {}", e.getMessage());
                }
            }
            
            // Audit log: Health check failed (only log when threshold is reached to avoid spam)
            if (consecutiveUnhealthyChecks == unhealthyConsecutiveThreshold) {
                Map<String, Object> metadata = new java.util.HashMap<>();
                metadata.put("consecutiveUnhealthyChecks", consecutiveUnhealthyChecks);
                metadata.put("threshold", unhealthyConsecutiveThreshold);
                metadata.put("serverReachable", serverReachable);
                metadata.put("mountExists", mountExists);
                metadata.put("hasSource", hasSource);
                metadata.put("bitrate", bitrate);
                metadata.put("autoEndEnabled", autoEndOnUnhealthy);
                metadata.put("disconnectionType", disconnectionType.toString());
                metadata.put("supportsAutomaticRecovery", disconnectionType.supportsAutomaticRecovery());
                metadata.put("requiresAdminIntervention", disconnectionType.requiresAdminIntervention());
                activityLogService.logSystemAuditWithMetadata(
                    ActivityLogEntity.ActivityType.BROADCAST_HEALTH_CHECK_FAILED,
                    String.format("Broadcast health check failed (consecutive: %d/%d, type: %s): %s", 
                        consecutiveUnhealthyChecks, unhealthyConsecutiveThreshold, disconnectionType, live.getTitle()),
                    id,
                    metadata
                );
            }
            
            // Update snapshot for unhealthy state
            lastHealthSnapshot = new java.util.HashMap<>(status);
            lastHealthSnapshot.put("healthy", false);
            lastHealthSnapshot.put("recovering", true);
            lastHealthSnapshot.put("consecutiveUnhealthyChecks", consecutiveUnhealthyChecks);
            lastHealthSnapshot.put("broadcastId", id);
            lastHealthSnapshot.put("broadcastLive", true);
            lastHealthSnapshot.put("disconnectionType", disconnectionType.toString());
            lastHealthSnapshot.put("supportsAutomaticRecovery", disconnectionType.supportsAutomaticRecovery());
            lastHealthSnapshot.put("requiresAdminIntervention", disconnectionType.requiresAdminIntervention());
            lastHealthCheckTime = LocalDateTime.now();

            if (consecutiveUnhealthyChecks >= unhealthyConsecutiveThreshold) {
                if (autoEndOnUnhealthy) {
                    logger.warn("Auto-ending broadcast id={} due to sustained unhealthy stream (serverReachable={}, mountExists={}, hasSource={}, bitrate={})", id, serverReachable, mountExists, hasSource, bitrate);
                    
                    // Cancel any ongoing reconnection attempts
                    if (reconnectionManager != null) {
                        reconnectionManager.cancelReconnection(id);
                    }
                    
                    // Audit log: Auto-end due to health check failure
                    Map<String, Object> metadata = new java.util.HashMap<>();
                    metadata.put("reason", "Health check failure threshold exceeded");
                    metadata.put("consecutiveUnhealthyChecks", consecutiveUnhealthyChecks);
                    metadata.put("threshold", unhealthyConsecutiveThreshold);
                    metadata.put("serverReachable", serverReachable);
                    metadata.put("mountExists", mountExists);
                    metadata.put("hasSource", hasSource);
                    metadata.put("bitrate", bitrate);
                    metadata.put("disconnectionType", disconnectionType.toString());
                    activityLogService.logSystemAuditWithMetadata(
                        ActivityLogEntity.ActivityType.BROADCAST_AUTO_END,
                        String.format("Auto-ended broadcast due to health check failure: %s", live.getTitle()),
                        id,
                        metadata
                    );
                    
                    try {
                        // Use simplified end that doesn't require a user context
                        endBroadcast(id);
                    } catch (Exception e) {
                        logger.error("Failed to auto-end broadcast {}: {}", id, e.getMessage());
                    } finally {
                        // Reset after action
                        consecutiveUnhealthyChecks = 0;
                        lastCheckedBroadcastId = null;
                        recovering = false;
                    }
                } else {
                    // Keep broadcast LIVE and mark recovering
                    recovering = true;
                    logger.warn("Stream unhealthy for broadcast id={}, keeping LIVE (autoEndOnUnhealthy=false). Disconnection type: {}. Waiting for source reconnection. (serverReachable={}, mountExists={}, hasSource={}, bitrate={})", id, disconnectionType, serverReachable, mountExists, hasSource, bitrate);
                    
                    // Trigger automatic reconnection if supported and not already attempting
                    if (reconnectionManager != null && disconnectionType.supportsAutomaticRecovery()) {
                        if (!reconnectionManager.isReconnecting(id)) {
                            logger.info("Triggering automatic reconnection for broadcast {} (disconnection type: {})", id, disconnectionType);
                            reconnectionManager.attemptReconnection(id, disconnectionType);
                        }
                    }
                    
                    // Cap the counter to avoid overflow/log spam
                    if (consecutiveUnhealthyChecks > unhealthyConsecutiveThreshold) {
                        consecutiveUnhealthyChecks = unhealthyConsecutiveThreshold;
                    }
                }
            } else {
                logger.info("Stream unhealthy check {}/{} for broadcast id={} (serverReachable={}, mountExists={}, hasSource={}, bitrate={})", consecutiveUnhealthyChecks, unhealthyConsecutiveThreshold, id, serverReachable, mountExists, hasSource, bitrate);
            }
        } catch (Exception ex) {
            logger.error("Error during live stream health monitoring: {}", ex.getMessage());
        }
    }

    /**
     * Expose the latest live stream health status for UI/clients.
     * Returns a snapshot with keys: healthy, recovering, broadcastLive, consecutiveUnhealthyChecks,
     * broadcastId (when live), serverReachable, mountPointExists, hasActiveSource, bitrate, listenerCount,
     * errorMessage, lastCheckedAt (ISO string).
     */
    public java.util.Map<String, Object> getLiveStreamHealthStatus() {
        java.util.Map<String, Object> snapshot = lastHealthSnapshot != null ? new java.util.HashMap<>(lastHealthSnapshot) : new java.util.HashMap<>();
        snapshot.putIfAbsent("healthy", false);
        snapshot.putIfAbsent("recovering", false);
        boolean live = getCurrentLiveBroadcast().isPresent();
        snapshot.putIfAbsent("broadcastLive", live);

        // Enrich snapshot with degraded mode signal and stream URL if a broadcast is live
        if (live) {
            try {
                java.util.Optional<BroadcastEntity> current = getCurrentLiveBroadcast();
                if (current.isPresent()) {
                    String url = current.get().getStreamUrl();
                    boolean degraded = url != null && url.contains("degraded=true");
                    snapshot.put("degradedMode", degraded);
                    if (url != null) {
                        snapshot.put("streamUrl", url);
                    }
                }
            } catch (Exception ignored) { /* keep health endpoint resilient */ }
        } else {
            snapshot.put("degradedMode", false);
        }

        snapshot.put("lastCheckedAt", lastHealthCheckTime != null ? lastHealthCheckTime.toString() : null);
        snapshot.put("autoEndOnUnhealthy", autoEndOnUnhealthy);
        snapshot.put("healthCheckEnabled", healthCheckEnabled);
        
        // Include disconnection type if available (for recovery system)
        if (snapshot.containsKey("disconnectionType")) {
            snapshot.put("disconnectionType", snapshot.get("disconnectionType"));
            snapshot.put("supportsAutomaticRecovery", snapshot.get("supportsAutomaticRecovery"));
            snapshot.put("requiresAdminIntervention", snapshot.get("requiresAdminIntervention"));
        }
        
        return snapshot;
    }
    
    /**
     * Get the classified disconnection type for the current live broadcast.
     * Returns UNKNOWN if no live broadcast or classification unavailable.
     * 
     * @return SourceDisconnectionType for current live broadcast
     */
    public SourceDisconnectionType getCurrentDisconnectionType() {
        if (sourceStateClassifier == null || lastHealthSnapshot == null || lastHealthSnapshot.isEmpty()) {
            return SourceDisconnectionType.UNKNOWN;
        }
        
        try {
            String typeStr = (String) lastHealthSnapshot.get("disconnectionType");
            if (typeStr != null) {
                return SourceDisconnectionType.valueOf(typeStr);
            }
        } catch (Exception e) {
            logger.debug("Failed to parse disconnection type from snapshot: {}", e.getMessage());
        }
        
        return SourceDisconnectionType.UNKNOWN;
    }

    /**
     * Check if the Liquidsoap radio server is currently running.
     * This is used to validate if broadcasts marked as LIVE are actually streaming.
     * 
     * @return true if radio server is running, false otherwise
     */
    public boolean isRadioServerRunning() {
        if (radioAgentClient == null) {
            logger.warn("RadioAgentClient not available, assuming server is running (graceful degradation)");
            return true; // Graceful degradation - assume running if agent not available
        }

        try {
            java.util.Map<String, Object> status = radioAgentClient.status();
            String state = (String) status.get("state");
            boolean running = "running".equals(state);
            
            logger.debug("Radio server status check: state={}, running={}", state, running);
            return running;
        } catch (Exception e) {
            logger.error("Failed to check radio server status: {}", e.getMessage());
            // Graceful degradation - on error, assume running to avoid breaking existing functionality
            return true;
        }
    }

    /**
     * Periodic checkpointing for live broadcasts to enable recovery from server crashes.
     * Runs every 60 seconds and updates checkpoint time and current duration.
     */
    @Scheduled(fixedRate = 60000) // Every minute
    public void checkpointLiveBroadcasts() {
        try {
            List<BroadcastEntity> liveBroadcasts = getLiveBroadcasts();
            
            if (liveBroadcasts.isEmpty()) {
                return; // No live broadcasts to checkpoint
            }
            
            logger.debug("Checkpointing {} live broadcast(s)", liveBroadcasts.size());
            
            for (BroadcastEntity broadcast : liveBroadcasts) {
                try {
                    // Update last checkpoint time
                    LocalDateTime checkpointTime = LocalDateTime.now();
                    broadcast.setLastCheckpointTime(checkpointTime);
                    
                    // Calculate and store current duration
                    if (broadcast.getActualStart() != null) {
                        java.time.Duration duration = java.time.Duration.between(
                            broadcast.getActualStart(), 
                            checkpointTime
                        );
                        broadcast.setCurrentDurationSeconds(duration.getSeconds());
                    }
                    
                    BroadcastEntity savedBroadcast = broadcastRepository.save(broadcast);
                    broadcastRepository.flush(); // Force immediate write to database
                    
                    logger.debug("Checkpointed broadcast {}: duration={}s, checkpointTime={}", 
                        savedBroadcast.getId(), 
                        savedBroadcast.getCurrentDurationSeconds(),
                        savedBroadcast.getLastCheckpointTime());
                    
                    // Audit log: Periodic checkpoint (only log every 10th checkpoint to avoid log spam)
                    if (savedBroadcast.getCurrentDurationSeconds() != null && savedBroadcast.getCurrentDurationSeconds() % 600 == 0) {
                        Map<String, Object> metadata = new java.util.HashMap<>();
                        metadata.put("durationSeconds", broadcast.getCurrentDurationSeconds());
                        metadata.put("checkpointTime", broadcast.getLastCheckpointTime().toString());
                        activityLogService.logSystemAuditWithMetadata(
                            ActivityLogEntity.ActivityType.BROADCAST_CHECKPOINT,
                            String.format("Checkpoint saved for broadcast: %s (duration: %ds)", broadcast.getTitle(), broadcast.getCurrentDurationSeconds()),
                            broadcast.getId(),
                            metadata
                        );
                    }
                } catch (Exception e) {
                    logger.error("Error checkpointing broadcast {}: {}", broadcast.getId(), e.getMessage());
                }
            }
        } catch (Exception e) {
            logger.error("Error during broadcast checkpointing: {}", e.getMessage());
        }
    }

    /**
     * Periodic cleanup of stale LIVE broadcasts.
     * Cleans up broadcasts that were terminated ungracefully and left in LIVE status.
     * This prevents the database from being clogged with stale LIVE broadcast statuses.
     */
    @Scheduled(fixedRateString = "#{${broadcast.cleanup.intervalMinutes:30} * 60 * 1000}") // Convert minutes to milliseconds
    public void cleanupStaleLiveBroadcasts() {
        if (!cleanupEnabled) {
            return;
        }

        try {
            logger.info("Starting cleanup of stale LIVE broadcasts");

            List<BroadcastEntity> liveBroadcasts = getLiveBroadcasts();
            if (liveBroadcasts.isEmpty()) {
                logger.debug("No live broadcasts to clean up");
                return;
            }

            int cleanedUp = 0;
            LocalDateTime now = LocalDateTime.now();

            for (BroadcastEntity broadcast : liveBroadcasts) {
                try {
                    boolean shouldCleanup = false;
                    String cleanupReason = "";

                    // Check 1: Broadcast running too long (> 24 hours by default)
                    if (broadcast.getActualStart() != null) {
                        long hoursRunning = java.time.Duration.between(
                            broadcast.getActualStart(),
                            now
                        ).toHours();

                        if (hoursRunning > cleanupMaxLiveDurationHours) {
                            shouldCleanup = true;
                            cleanupReason = String.format("Broadcast running too long (%d hours > %d max)",
                                hoursRunning, cleanupMaxLiveDurationHours);
                        }
                    }

                    // Check 2: No recent checkpoint (stale, possibly crashed server)
                    if (!shouldCleanup && broadcast.getLastCheckpointTime() != null) {
                        long minutesSinceCheckpoint = java.time.Duration.between(
                            broadcast.getLastCheckpointTime(),
                            now
                        ).toMinutes();

                        if (minutesSinceCheckpoint > cleanupStaleThresholdMinutes) {
                            shouldCleanup = true;
                            cleanupReason = String.format("No checkpoint for %d minutes (> %d threshold)",
                                minutesSinceCheckpoint, cleanupStaleThresholdMinutes);
                        }
                    }

                    // Check 3: No checkpoint at all and running for extended period (> 2 hours)
                    if (!shouldCleanup && broadcast.getLastCheckpointTime() == null &&
                        broadcast.getActualStart() != null) {
                        long hoursRunning = java.time.Duration.between(
                            broadcast.getActualStart(),
                            now
                        ).toHours();

                        if (hoursRunning > 2) { // 2 hours without any checkpoint is suspicious
                            shouldCleanup = true;
                            cleanupReason = String.format("No checkpoint for %d hours (suspicious)", hoursRunning);
                        }
                    }

                    if (shouldCleanup) {
                        logger.warn("Auto-cleaning up stale LIVE broadcast {}: {}", broadcast.getId(), cleanupReason);

                        // Audit log: Cleanup of stale broadcast
                        Map<String, Object> metadata = new java.util.HashMap<>();
                        metadata.put("reason", cleanupReason);
                        metadata.put("hoursRunning", broadcast.getActualStart() != null ?
                            java.time.Duration.between(broadcast.getActualStart(), now).toHours() : null);
                        metadata.put("lastCheckpointTime", broadcast.getLastCheckpointTime() != null ?
                            broadcast.getLastCheckpointTime().toString() : "null");
                        metadata.put("currentDurationSeconds", broadcast.getCurrentDurationSeconds());
                        metadata.put("cleanupMaxLiveDurationHours", cleanupMaxLiveDurationHours);
                        metadata.put("cleanupStaleThresholdMinutes", cleanupStaleThresholdMinutes);
                        activityLogService.logSystemAuditWithMetadata(
                            ActivityLogEntity.ActivityType.BROADCAST_AUTO_END,
                            String.format("Auto-cleaned up stale LIVE broadcast: %s", broadcast.getTitle()),
                            broadcast.getId(),
                            metadata
                        );

                        // Auto-end the stale broadcast
                        endBroadcast(broadcast.getId());
                        cleanedUp++;

                        logger.info("Cleaned up stale broadcast {}: {}", broadcast.getId(), broadcast.getTitle());
                    }
                } catch (Exception e) {
                    logger.error("Error cleaning up broadcast {}: {}", broadcast.getId(), e.getMessage());
                }
            }

            if (cleanedUp > 0) {
                logger.info("Cleanup completed: auto-ended {} stale LIVE broadcasts", cleanedUp);
            } else {
                logger.debug("Cleanup completed: no stale broadcasts found");
            }
        } catch (Exception e) {
            logger.error("Error during stale broadcast cleanup: {}", e.getMessage());
        }
    }

    /**
     * Recover live broadcasts on server startup.
     * Checks if broadcasts marked as LIVE are actually still streaming and handles stale broadcasts.
     */
    @jakarta.annotation.PostConstruct
    public void recoverLiveBroadcasts() {
        try {
            List<BroadcastEntity> liveBroadcasts = getLiveBroadcasts();
            
            if (liveBroadcasts.isEmpty()) {
                logger.info("No live broadcasts to recover on startup");
                return;
            }
            
            logger.info("Recovering {} live broadcast(s) on startup", liveBroadcasts.size());
            
            for (BroadcastEntity broadcast : liveBroadcasts) {
                try {
                    // Check if broadcast is actually still live by checking stream status
                    Map<String, Object> streamStatus = icecastService.getStreamStatus(false);
                    boolean actuallyLive = Boolean.TRUE.equals(streamStatus.get("live")) || Boolean.TRUE.equals(streamStatus.get("isLive"));
                    
                    if (!actuallyLive) {
                        // Auto-end stale broadcasts
                        logger.warn("Auto-ending stale broadcast {} on startup: {}", broadcast.getId(), broadcast.getTitle());
                        
                        // Audit log: Auto-end stale broadcast
                        Map<String, Object> metadata = new java.util.HashMap<>();
                        metadata.put("reason", "Stale broadcast detected on startup");
                        metadata.put("lastCheckpointTime", broadcast.getLastCheckpointTime() != null ? broadcast.getLastCheckpointTime().toString() : "null");
                        activityLogService.logSystemAuditWithMetadata(
                            ActivityLogEntity.ActivityType.BROADCAST_AUTO_END,
                            String.format("Auto-ended stale broadcast on startup: %s", broadcast.getTitle()),
                            broadcast.getId(),
                            metadata
                        );
                        
                        endBroadcast(broadcast.getId());
                    } else {
                        // Verify health and restore state
                        logger.info("Recovering live broadcast {}: {}", broadcast.getId(), broadcast.getTitle());
                        
                        // Audit log: Broadcast recovery
                        Map<String, Object> metadata = new java.util.HashMap<>();
                        metadata.put("reason", "Server startup recovery");
                        metadata.put("lastCheckpointTime", broadcast.getLastCheckpointTime() != null ? broadcast.getLastCheckpointTime().toString() : "null");
                        metadata.put("currentDurationSeconds", broadcast.getCurrentDurationSeconds());
                        activityLogService.logSystemAuditWithMetadata(
                            ActivityLogEntity.ActivityType.BROADCAST_RECOVERY,
                            String.format("Recovered live broadcast on startup: %s", broadcast.getTitle()),
                            broadcast.getId(),
                            metadata
                        );
                        
                        // Send recovery notification to clients
                        Map<String, Object> recoveryMessage = new java.util.HashMap<>();
                        recoveryMessage.put("type", "BROADCAST_RECOVERED");
                        recoveryMessage.put("broadcast", BroadcastDTO.fromEntity(broadcast));
                        messagingTemplate.convertAndSend("/topic/broadcast/status", recoveryMessage);
                    }
                } catch (Exception e) {
                    logger.error("Error recovering broadcast {}: {}", broadcast.getId(), e.getMessage());
                }
            }
        } catch (Exception e) {
            logger.error("Error during broadcast recovery on startup: {}", e.getMessage());
        }
    }
} 
