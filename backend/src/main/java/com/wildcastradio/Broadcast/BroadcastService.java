package com.wildcastradio.Broadcast;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import com.wildcastradio.ActivityLog.ActivityLogEntity;
import com.wildcastradio.ActivityLog.ActivityLogService;
import com.wildcastradio.Broadcast.DTO.BroadcastDTO;
import com.wildcastradio.Broadcast.DTO.CreateBroadcastRequest;
import com.wildcastradio.ServerSchedule.ServerScheduleService;
import com.wildcastradio.ShoutCast.ShoutcastService;
import com.wildcastradio.User.UserEntity;

@Service
public class BroadcastService {
    private static final Logger logger = LoggerFactory.getLogger(BroadcastService.class);

    @Autowired
    private BroadcastRepository broadcastRepository;

    @Autowired
    private ShoutcastService shoutCastService;

    @Autowired
    private ServerScheduleService serverScheduleService;

    @Autowired
    private ActivityLogService activityLogService;

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

        return savedBroadcast;
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
            logger.info("Starting broadcast in TEST MODE (ShoutCast integration bypassed)");
            // Set the ShoutcastService to test mode
            shoutCastService.setTestMode(true);
            String testStreamUrl = shoutCastService.getTestStreamUrl(broadcast);
            broadcast.setStreamUrl(testStreamUrl);
        } else {
            // Reset ShoutcastService test mode
            shoutCastService.setTestMode(false);
            // Check if the ShoutCast server is accessible
            boolean shoutCastServerAccessible = shoutCastService.isServerAccessible();
            // Check if the server schedule is running
            boolean serverScheduleRunning = serverScheduleService.isServerRunning();

            // If either the ShoutCast server is accessible or the server schedule is running, we can proceed
            if (shoutCastServerAccessible || serverScheduleRunning) {
                logger.info("Server is available (ShoutCast accessible: {}, Server schedule running: {}), proceeding with broadcast", 
                        shoutCastServerAccessible, serverScheduleRunning);

                // If the server is accessible but not tracked in the database, create a record
                if (shoutCastServerAccessible && !serverScheduleRunning) {
                    logger.info("Creating server schedule record for manually started server");
                    serverScheduleService.startServerNow(dj);
                }

                // Start the stream using ShoutCastService
                String streamUrl = shoutCastService.startStream(broadcast);
                broadcast.setStreamUrl(streamUrl);
            } else {
                // If neither the ShoutCast server is accessible nor the server schedule is running, throw an exception
                logger.error("Failed to start broadcast: Server checks failed. ShoutCast accessible: {}, Server schedule running: {}", 
                        shoutCastServerAccessible, serverScheduleRunning);
                throw new IllegalStateException("Server is not running. Please start the server before broadcasting.");
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

        return savedBroadcast;
    }

    public BroadcastEntity endBroadcast(Long broadcastId, UserEntity dj) {
        BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
                .orElseThrow(() -> new RuntimeException("Broadcast not found"));

        // Allow any DJ to end a broadcast, not just the creator
        // This enables site-wide broadcast control

        // End the stream using ShoutCastService
        shoutCastService.endStream(broadcast);
        broadcast.setActualEnd(LocalDateTime.now());
        broadcast.setStatus(BroadcastEntity.BroadcastStatus.ENDED);

        BroadcastEntity savedBroadcast = broadcastRepository.save(broadcast);

        // Log the activity
        activityLogService.logActivity(
            dj,
            ActivityLogEntity.ActivityType.BROADCAST_END,
            "Broadcast ended: " + savedBroadcast.getTitle()
        );

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
        // Implementation would go here
    }
} 
