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
import com.wildcastradio.Schedule.ScheduleEntity;
import com.wildcastradio.Schedule.ScheduleService;
import com.wildcastradio.ServerSchedule.ServerScheduleService;
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
    private ServerScheduleService serverScheduleService;

    @Autowired
    private ActivityLogService activityLogService;

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

        // Send notification to all users about the new broadcast
        String notificationMessage = "New broadcast scheduled: " + savedBroadcast.getTitle() + 
                                    " at " + savedBroadcast.getScheduledStart();
        sendNotificationToAllUsers(notificationMessage, NotificationType.BROADCAST_SCHEDULED);

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

        // Send notification to all users about the new broadcast
        String notificationMessage = "New broadcast scheduled: " + savedBroadcast.getTitle() + 
                                    " at " + savedBroadcast.getScheduledStart();
        sendNotificationToAllUsers(notificationMessage, NotificationType.BROADCAST_SCHEDULED);

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
            // Check if the server schedule is running
            boolean serverScheduleRunning = serverScheduleService.isServerRunning();

            // If either the Google Cloud Icecast server is accessible or the server schedule is running, we can proceed
            if (icecastServerAccessible || serverScheduleRunning) {
                logger.info("Google Cloud Icecast server is available (Icecast accessible: {}, Server schedule running: {}), proceeding with broadcast", 
                        icecastServerAccessible, serverScheduleRunning);

                // If the server is accessible but not tracked in the database, create a record
                if (icecastServerAccessible && !serverScheduleRunning) {
                    logger.info("Creating server schedule record for manually started Google Cloud Icecast server");
                    serverScheduleService.startServerNow(dj);
                }

                // Set the stream URL from Google Cloud Icecast service
                broadcast.setStreamUrl(icecastService.getStreamUrl());
            } else {
                // If neither the Google Cloud Icecast server is accessible nor the server schedule is running, throw an exception
                logger.error("Failed to start broadcast: Google Cloud Icecast server checks failed. Icecast accessible: {}, Server schedule running: {}", 
                        icecastServerAccessible, serverScheduleRunning);
                throw new IllegalStateException("Google Cloud Icecast server is not running or not accessible. Please check the server configuration.");
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

        // Complete the schedule when ending the broadcast
        if (broadcast.getSchedule() != null) {
            scheduleService.completeSchedule(broadcast.getSchedule().getId());
        }

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

        // Complete the schedule when ending the broadcast
        if (broadcast.getSchedule() != null) {
            scheduleService.completeSchedule(broadcast.getSchedule().getId());
        }

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
            // Send notification to all users that the broadcast is about to start
            String notificationMessage = "Broadcast starting soon: " + broadcast.getTitle() + 
                                        " at " + broadcast.getScheduledStart();
            sendNotificationToAllUsers(notificationMessage, NotificationType.BROADCAST_STARTING_SOON);

            logger.info("Sent 'starting soon' notification for broadcast: {}", broadcast.getTitle());
        }
    }

    // Temporary method to get current user - this will be replaced with proper authentication
    private UserEntity getCurrentUser() {
        // This is a placeholder - in a real implementation, you'd get this from SecurityContext
        // For now, we'll throw an exception to indicate this needs to be handled by the controller
        throw new RuntimeException("User must be passed explicitly to this method");
    }
} 
