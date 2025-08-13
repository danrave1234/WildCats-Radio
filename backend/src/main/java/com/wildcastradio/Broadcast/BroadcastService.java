package com.wildcastradio.Broadcast;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
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
                // If the Google Cloud Icecast server is not accessible, throw an exception
                logger.error("Failed to start broadcast: Google Cloud Icecast server is not accessible");
                throw new IllegalStateException("Google Cloud Icecast server is not running or not accessible. Please check the server configuration.");
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
        // For now, return all broadcasts ordered by creation date
        // In the future, this could be ordered by listener count or other metrics
        return broadcastRepository.findAll().stream()
            .limit(limit)
            .collect(java.util.stream.Collectors.toList());
    }
} 
