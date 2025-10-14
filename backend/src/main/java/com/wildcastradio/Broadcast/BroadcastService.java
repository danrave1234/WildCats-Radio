package com.wildcastradio.Broadcast;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.wildcastradio.ActivityLog.ActivityLogEntity;
import com.wildcastradio.ActivityLog.ActivityLogService;
import com.wildcastradio.Analytics.ListenerTrackingService;
import com.wildcastradio.Broadcast.DTO.BroadcastDTO;
import com.wildcastradio.Broadcast.DTO.CreateBroadcastRequest;
import com.wildcastradio.Notification.NotificationService;
import com.wildcastradio.Notification.NotificationType;
import com.wildcastradio.Schedule.ScheduleEntity;
import com.wildcastradio.Schedule.ScheduleService;
import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserRepository;
import com.wildcastradio.icecast.IcecastService;

@Service
public class BroadcastService {
    private static final Logger logger = LoggerFactory.getLogger(BroadcastService.class);

    @Autowired
    private BroadcastRepository broadcastRepository;

    @Autowired
    private ScheduleService scheduleService;

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

    @Autowired(required = false)
    private com.wildcastradio.radio.RadioAgentClient radioAgentClient;

    // Live stream health check configuration
    @Value("${broadcast.healthCheck.enabled:true}")
    private boolean healthCheckEnabled;

    @Value("${broadcast.healthCheck.intervalMs:15000}")
    private long healthCheckIntervalMs;

    @Value("${broadcast.healthCheck.unhealthyConsecutiveThreshold:3}")
    private int unhealthyConsecutiveThreshold;

    @Value("${broadcast.healthCheck.startupGraceMs:60000}")
    private long healthCheckStartupGraceMs;

    // In-memory tracking for consecutive unhealthy checks
    private int consecutiveUnhealthyChecks = 0;
    private Long lastCheckedBroadcastId = null;

    @Value("${broadcast.healthCheck.autoEnd:false}")
    private boolean autoEndOnUnhealthy;

    // Recovery state and last health snapshot for UI/clients
    private volatile boolean recovering = false;
    private volatile java.util.Map<String, Object> lastHealthSnapshot = new java.util.HashMap<>();
    private volatile LocalDateTime lastHealthCheckTime = null;

    public BroadcastDTO createBroadcast(CreateBroadcastRequest request) {
        logger.info("Creating broadcast: {}", request.getTitle());

        // Get current user from security context (this will be handled by the controller)
        // For now, we'll assume the user is passed separately or we'll update this later

        // First create the schedule
        ScheduleEntity schedule = scheduleService.createSchedule(
            request.getScheduledStart(), 
            request.getScheduledEnd(), 
            getCurrentUser() // This will need to be passed from controller
        );

        // Then create the broadcast with the schedule
        BroadcastEntity broadcast = new BroadcastEntity();
        broadcast.setTitle(request.getTitle());
        broadcast.setDescription(request.getDescription());
        broadcast.setSchedule(schedule);
        broadcast.setCreatedBy(getCurrentUser()); // This will need to be passed from controller
        broadcast.setStatus(BroadcastEntity.BroadcastStatus.SCHEDULED);

        BroadcastEntity savedBroadcast = broadcastRepository.save(broadcast);

        // Log the activity
        activityLogService.logActivity(
            getCurrentUser(), // This will need to be passed from controller
            ActivityLogEntity.ActivityType.BROADCAST_START,
            "Broadcast created: " + savedBroadcast.getTitle()
        );

        // Only send a schedule notification if this broadcast is not being immediately started
        if (savedBroadcast.getScheduledStart() != null &&
            savedBroadcast.getScheduledStart().isAfter(LocalDateTime.now().plusMinutes(1))) {
            String notificationMessage = "New broadcast scheduled: " + savedBroadcast.getTitle() +
                                        " at " + savedBroadcast.getScheduledStart();
            sendNotificationToAllUsers(notificationMessage, NotificationType.BROADCAST_SCHEDULED);
        }

        return BroadcastDTO.fromEntity(savedBroadcast);
    }

    // Overloaded method that accepts user parameter
    public BroadcastDTO createBroadcast(CreateBroadcastRequest request, UserEntity user) {
        logger.info("Creating broadcast: {} for user: {}", request.getTitle(), user.getEmail());

        // First create the schedule
        ScheduleEntity schedule = scheduleService.createSchedule(
            request.getScheduledStart(), 
            request.getScheduledEnd(), 
            user
        );

        // Then create the broadcast with the schedule
        BroadcastEntity broadcast = new BroadcastEntity();
        broadcast.setTitle(request.getTitle());
        broadcast.setDescription(request.getDescription());
        broadcast.setSchedule(schedule);
        broadcast.setCreatedBy(user);
        broadcast.setStatus(BroadcastEntity.BroadcastStatus.SCHEDULED);

        BroadcastEntity savedBroadcast = broadcastRepository.save(broadcast);

        // Log the activity
        activityLogService.logActivity(
            user,
            ActivityLogEntity.ActivityType.BROADCAST_START,
            "Broadcast created: " + savedBroadcast.getTitle()
        );

        // Only send a schedule notification if this broadcast is not being immediately started
        if (savedBroadcast.getScheduledStart() != null &&
            savedBroadcast.getScheduledStart().isAfter(LocalDateTime.now().plusMinutes(1))) {
            String notificationMessage = "New broadcast scheduled: " + savedBroadcast.getTitle() +
                                        " at " + savedBroadcast.getScheduledStart();
            sendNotificationToAllUsers(notificationMessage, NotificationType.BROADCAST_SCHEDULED);
        }

        return BroadcastDTO.fromEntity(savedBroadcast);
    }

    public BroadcastDTO updateBroadcast(Long id, CreateBroadcastRequest request) {
        logger.info("Updating broadcast: {}", id);

        BroadcastEntity broadcast = broadcastRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Broadcast not found"));

        // Update broadcast details
        broadcast.setTitle(request.getTitle());
        broadcast.setDescription(request.getDescription());

        // Update the associated schedule
        scheduleService.updateSchedule(
            broadcast.getSchedule().getId(),
            request.getScheduledStart(),
            request.getScheduledEnd(),
            broadcast.getCreatedBy()
        );

        BroadcastEntity updatedBroadcast = broadcastRepository.save(broadcast);
        return BroadcastDTO.fromEntity(updatedBroadcast);
    }

    public BroadcastDTO updateSlowMode(Long id, Boolean enabled, Integer seconds) {
        logger.info("Updating slow mode for broadcast {}: enabled={}, seconds={}", id, enabled, seconds);
        BroadcastEntity broadcast = broadcastRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Broadcast not found"));
        boolean isEnabled = enabled != null && enabled;
        int secs = seconds != null ? Math.max(0, Math.min(seconds, 3600)) : 0; // clamp to [0, 3600]
        broadcast.setSlowModeEnabled(isEnabled);
        broadcast.setSlowModeSeconds(secs);
        BroadcastEntity saved = broadcastRepository.save(broadcast);
        return BroadcastDTO.fromEntity(saved);
    }

    // Keep the existing scheduleBroadcast method for backward compatibility
    public BroadcastEntity scheduleBroadcast(BroadcastEntity broadcast, UserEntity dj) {
        broadcast.setCreatedBy(dj);
        broadcast.setStatus(BroadcastEntity.BroadcastStatus.SCHEDULED);
        BroadcastEntity savedBroadcast = broadcastRepository.save(broadcast);

        // Log the activity
        activityLogService.logActivity(
            dj,
            ActivityLogEntity.ActivityType.SCHEDULE_CREATE,
            "Broadcast scheduled: " + savedBroadcast.getTitle() + " from " + 
            savedBroadcast.getScheduledStart() + " to " + savedBroadcast.getScheduledEnd()
        );

        // Send notification to all users about the new broadcast schedule
        String notificationMessage = "New broadcast scheduled: " + savedBroadcast.getTitle() + 
                                    " on " + savedBroadcast.getScheduledStart();
        sendNotificationToAllUsers(notificationMessage, NotificationType.BROADCAST_SCHEDULED);

        return savedBroadcast;
    }

    // Helper method to send notifications to all users
    private void sendNotificationToAllUsers(String message, NotificationType type) {
        List<UserEntity> allUsers = userRepository.findAll();
        for (UserEntity user : allUsers) {
            notificationService.sendNotification(user, message, type);
        }
    }

    public BroadcastEntity startBroadcast(Long broadcastId, UserEntity dj) {
        return startBroadcast(broadcastId, dj, false);
    }

    public BroadcastEntity startBroadcastTestMode(Long broadcastId, UserEntity dj) {
        return startBroadcast(broadcastId, dj, true);
    }

    private BroadcastEntity startBroadcast(Long broadcastId, UserEntity dj, boolean testMode) {
        BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
                .orElseThrow(() -> new RuntimeException("Broadcast not found"));

        // Activate the schedule when starting the broadcast
        if (broadcast.getSchedule() != null) {
            scheduleService.activateSchedule(broadcast.getSchedule().getId());
        }

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

        broadcast.setActualStart(LocalDateTime.now());
        broadcast.setStatus(BroadcastEntity.BroadcastStatus.LIVE);
        broadcast.setStartedBy(dj);

        BroadcastEntity savedBroadcast = broadcastRepository.save(broadcast);

        // Log the activity
        activityLogService.logActivity(
            dj,
            ActivityLogEntity.ActivityType.BROADCAST_START,
            (testMode ? "TEST MODE: " : "") + "Broadcast started: " + savedBroadcast.getTitle()
        );

        // Only send notifications if not in test mode
        if (!testMode) {
            // Send notification to all users that the broadcast has started
            String notificationMessage = "Broadcast started: " + savedBroadcast.getTitle();
            sendNotificationToAllUsers(notificationMessage, NotificationType.BROADCAST_STARTED);

            // Clear transient key used for "starting soon" notifications for this broadcast
            if (savedBroadcast.getId() != null) {
                notificationService.clearTransientKey("starting-soon:" + savedBroadcast.getId());
            }

            // WebSocket status updates are handled by the broadcast WebSocket controller
        }

        return savedBroadcast;
    }

    public BroadcastEntity endBroadcast(Long broadcastId, UserEntity dj) {
        BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
                .orElseThrow(() -> new RuntimeException("Broadcast not found"));

        // Complete the schedule when ending the broadcast
        if (broadcast.getSchedule() != null) {
            scheduleService.completeSchedule(broadcast.getSchedule().getId());
        }

        // Allow any DJ to end a broadcast, not just the creator
        // This enables site-wide broadcast control

        // End the stream
        broadcast.setActualEnd(LocalDateTime.now());
        broadcast.setStatus(BroadcastEntity.BroadcastStatus.ENDED);

        BroadcastEntity savedBroadcast = broadcastRepository.save(broadcast);

        // CRITICAL FIX: Clear all active broadcasts from IcecastService to ensure stream status is updated
        // This fixes the issue where the stream still shows as live after ending
        icecastService.clearAllActiveBroadcasts();

        // Log the activity
        activityLogService.logActivity(
            dj,
            ActivityLogEntity.ActivityType.BROADCAST_END,
            "Broadcast ended: " + savedBroadcast.getTitle()
        );

        // Send notification to all users that the broadcast has ended
        String notificationMessage = "Broadcast ended: " + savedBroadcast.getTitle();
        sendNotificationToAllUsers(notificationMessage, NotificationType.BROADCAST_ENDED);

        // WebSocket status updates are handled by the broadcast WebSocket controller

        return savedBroadcast;
    }

    /**
     * Simplified version of endBroadcast that doesn't require a user parameter
     * This is used for API calls that don't have user authentication
     */
    public BroadcastEntity endBroadcast(Long broadcastId) {
        BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
                .orElseThrow(() -> new RuntimeException("Broadcast not found"));

        // Complete the schedule when ending the broadcast
        if (broadcast.getSchedule() != null) {
            scheduleService.completeSchedule(broadcast.getSchedule().getId());
        }

        // End the stream
        broadcast.setActualEnd(LocalDateTime.now());
        broadcast.setStatus(BroadcastEntity.BroadcastStatus.ENDED);

        BroadcastEntity savedBroadcast = broadcastRepository.save(broadcast);

        // CRITICAL FIX: Clear all active broadcasts from IcecastService to ensure stream status is updated
        // This fixes the issue where the stream still shows as live after ending
        icecastService.clearAllActiveBroadcasts();

        logger.info("Broadcast ended without user info: {}", savedBroadcast.getTitle());

        return savedBroadcast;
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
        return broadcastRepository.findByCreatedBy(dj);
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

    public List<BroadcastEntity> getEndedBroadcastsSince(LocalDateTime since) {
        return broadcastRepository.findEndedSince(since);
    }

    public Page<BroadcastEntity> getEndedBroadcastsSince(LocalDateTime since, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        Pageable pageable = PageRequest.of(safePage, safeSize);
        return broadcastRepository.findEndedSince(since, pageable);
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
        BroadcastEntity broadcast = broadcastRepository.findById(id)
                .orElseThrow(() -> {
                    logger.error("Failed to delete broadcast: Broadcast not found with ID: {}", id);
                    return new RuntimeException("Broadcast not found with id: " + id);
                });

        try {
            // Cancel the associated schedule if it exists
            if (broadcast.getSchedule() != null) {
                scheduleService.cancelSchedule(broadcast.getSchedule().getId(), broadcast.getCreatedBy());
            }

            // Delete the broadcast
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
            now,
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

    // Temporary method to get current user - this will be replaced with proper authentication
    private UserEntity getCurrentUser() {
        // This is a placeholder - in a real implementation, you'd get this from SecurityContext
        // For now, we'll throw an exception to indicate this needs to be handled by the controller
        throw new RuntimeException("User must be passed explicitly to this method");
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
        List<BroadcastEntity> all = broadcastRepository.findAll();
        return all.stream()
            .sorted((a, b) -> {
                int aInteractions = (a.getChatMessages() != null ? a.getChatMessages().size() : 0)
                    + (a.getSongRequests() != null ? a.getSongRequests().size() : 0);
                int bInteractions = (b.getChatMessages() != null ? b.getChatMessages().size() : 0)
                    + (b.getSongRequests() != null ? b.getSongRequests().size() : 0);
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
     * Periodically verify live stream health and auto-end broadcast if stalled.
     * Healthy criteria: Icecast server reachable, mount exists, active source present, bitrate > 0.
     * Uses consecutive unhealthy checks to avoid false positives during brief network hiccups.
     */
    @Scheduled(fixedDelayString = "${broadcast.healthCheck.intervalMs:15000}")
    public void monitorLiveStreamHealth() {
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
                if (consecutiveUnhealthyChecks > 0 || recovering) {
                    logger.info("Live stream recovered health for broadcast id={}; resetting recovering state", id);
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
            // Update snapshot for unhealthy state
            lastHealthSnapshot = new java.util.HashMap<>(status);
            lastHealthSnapshot.put("healthy", false);
            lastHealthSnapshot.put("recovering", true);
            lastHealthSnapshot.put("consecutiveUnhealthyChecks", consecutiveUnhealthyChecks);
            lastHealthSnapshot.put("broadcastId", id);
            lastHealthSnapshot.put("broadcastLive", true);
            lastHealthCheckTime = LocalDateTime.now();

            if (consecutiveUnhealthyChecks >= unhealthyConsecutiveThreshold) {
                if (autoEndOnUnhealthy) {
                    logger.warn("Auto-ending broadcast id={} due to sustained unhealthy stream (serverReachable={}, mountExists={}, hasSource={}, bitrate={})", id, serverReachable, mountExists, hasSource, bitrate);
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
                    logger.warn("Stream unhealthy for broadcast id={}, keeping LIVE (autoEndOnUnhealthy=false). Waiting for source reconnection. (serverReachable={}, mountExists={}, hasSource={}, bitrate={})", id, serverReachable, mountExists, hasSource, bitrate);
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
        return snapshot;
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
} 
