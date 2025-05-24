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
import com.wildcastradio.Broadcast.DTO.BroadcastDTO;
import com.wildcastradio.Broadcast.DTO.CreateBroadcastRequest;
import com.wildcastradio.Notification.NotificationService;
import com.wildcastradio.Notification.NotificationType;
import com.wildcastradio.ServerSchedule.ServerScheduleService;
import com.wildcastradio.icecast.IcecastService;
import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserRepository;

@Service
public class BroadcastService {
    private static final Logger logger = LoggerFactory.getLogger(BroadcastService.class);

    @Autowired
    private BroadcastRepository broadcastRepository;

    @Autowired
    private IcecastService icecastService;

    @Autowired
    private ServerScheduleService serverScheduleService;

    @Autowired
    private ActivityLogService activityLogService;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private UserRepository userRepository;

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

        // Allow any DJ to start a broadcast, not just the creator
        // This enables site-wide broadcast control

        if (testMode) {
            // Test mode - bypass server checks
            logger.info("Starting broadcast in TEST MODE (Icecast integration bypassed)");
            // Generate a test stream URL
            broadcast.setStreamUrl("http://localhost:8000/live.ogg?test=true");
        } else {
            // Check if the Icecast server is accessible
            boolean icecastServerAccessible = icecastService.checkIcecastServer();
            // Check if the server schedule is running
            boolean serverScheduleRunning = serverScheduleService.isServerRunning();

            // If either the Icecast server is accessible or the server schedule is running, we can proceed
            if (icecastServerAccessible || serverScheduleRunning) {
                logger.info("Server is available (Icecast accessible: {}, Server schedule running: {}), proceeding with broadcast", 
                        icecastServerAccessible, serverScheduleRunning);

                // If the server is accessible but not tracked in the database, create a record
                if (icecastServerAccessible && !serverScheduleRunning) {
                    logger.info("Creating server schedule record for manually started server");
                    serverScheduleService.startServerNow(dj);
                }

                // Set the stream URL from Icecast service
                broadcast.setStreamUrl(icecastService.getStreamUrl());
            } else {
                // If neither the Icecast server is accessible nor the server schedule is running, throw an exception
                logger.error("Failed to start broadcast: Server checks failed. Icecast accessible: {}, Server schedule running: {}", 
                        icecastServerAccessible, serverScheduleRunning);
                throw new IllegalStateException("Icecast server is not running. Please start the server before broadcasting.");
            }
        }

        broadcast.setActualStart(LocalDateTime.now());
        broadcast.setStatus(BroadcastEntity.BroadcastStatus.LIVE);

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
        }

        return savedBroadcast;
    }

    public BroadcastEntity endBroadcast(Long broadcastId, UserEntity dj) {
        BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
                .orElseThrow(() -> new RuntimeException("Broadcast not found"));

        // Allow any DJ to end a broadcast, not just the creator
        // This enables site-wide broadcast control

        // End the stream (no specific action needed with Icecast as WebSocket close will handle this)
        broadcast.setActualEnd(LocalDateTime.now());
        broadcast.setStatus(BroadcastEntity.BroadcastStatus.ENDED);

        BroadcastEntity savedBroadcast = broadcastRepository.save(broadcast);

        // Log the activity
        activityLogService.logActivity(
            dj,
            ActivityLogEntity.ActivityType.BROADCAST_END,
            "Broadcast ended: " + savedBroadcast.getTitle()
        );

        // Send notification to all users that the broadcast has ended
        String notificationMessage = "Broadcast ended: " + savedBroadcast.getTitle();
        sendNotificationToAllUsers(notificationMessage, NotificationType.BROADCAST_ENDED);

        return savedBroadcast;
    }

    /**
     * Simplified version of endBroadcast that doesn't require a user parameter
     * This is used for API calls that don't have user authentication
     */
    public BroadcastEntity endBroadcast(Long broadcastId) {
        BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
                .orElseThrow(() -> new RuntimeException("Broadcast not found"));

        // End the stream
        broadcast.setActualEnd(LocalDateTime.now());
        broadcast.setStatus(BroadcastEntity.BroadcastStatus.ENDED);

        BroadcastEntity savedBroadcast = broadcastRepository.save(broadcast);
        
        logger.info("Broadcast ended without user info: {}", savedBroadcast.getTitle());

        return savedBroadcast;
    }

    public BroadcastEntity testBroadcast(Long broadcastId, UserEntity dj) {
        BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
                .orElseThrow(() -> new RuntimeException("Broadcast not found"));

        // Allow any DJ to test a broadcast, not just the creator
        // This enables site-wide broadcast control

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
        return broadcastRepository.findByStatus(BroadcastEntity.BroadcastStatus.LIVE);
    }

    public List<BroadcastEntity> getUpcomingBroadcasts() {
        return broadcastRepository.findByStatusAndScheduledStartAfter(
            BroadcastEntity.BroadcastStatus.SCHEDULED, 
            LocalDateTime.now()
        );
    }

    // Method to get engagement data for analytics
    public BroadcastAnalytics getAnalytics(Long broadcastId) {
        // In a real implementation, this would gather view counts, chat activity, etc.
        // For now, we'll return a placeholder
        return new BroadcastAnalytics(broadcastId, 0, 0);
    }

    // Simple inner class for analytics data
    public static class BroadcastAnalytics {
        private Long broadcastId;
        private int viewerCount;
        private int chatMessageCount;

        public BroadcastAnalytics(Long broadcastId, int viewerCount, int chatMessageCount) {
            this.broadcastId = broadcastId;
            this.viewerCount = viewerCount;
            this.chatMessageCount = chatMessageCount;
        }

        public Long getBroadcastId() {
            return broadcastId;
        }

        public int getViewerCount() {
            return viewerCount;
        }

        public int getChatMessageCount() {
            return chatMessageCount;
        }
    }

    public BroadcastDTO createBroadcast(CreateBroadcastRequest request) {
        // Implementation would go here
        return new BroadcastDTO();
    }

    public BroadcastDTO updateBroadcast(Long id, CreateBroadcastRequest request) {
        // Implementation would go here
        return new BroadcastDTO();
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
        // and have not been notified yet
        List<BroadcastEntity> upcomingBroadcasts = broadcastRepository.findByScheduledStartBetween(
            now,
            fifteenMinutesFromNow
        );

        // Filter to only include broadcasts with SCHEDULED status
        upcomingBroadcasts = upcomingBroadcasts.stream()
            .filter(broadcast -> broadcast.getStatus() == BroadcastEntity.BroadcastStatus.SCHEDULED)
            .collect(java.util.stream.Collectors.toList());

        for (BroadcastEntity broadcast : upcomingBroadcasts) {
            // Send notification to all users that the broadcast is about to start
            String notificationMessage = "Broadcast starting soon: " + broadcast.getTitle() + 
                                        " at " + broadcast.getScheduledStart();
            sendNotificationToAllUsers(notificationMessage, NotificationType.BROADCAST_STARTING_SOON);

            logger.info("Sent 'starting soon' notification for broadcast: {}", broadcast.getTitle());
        }
    }
} 
