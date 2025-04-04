package com.wildcastradio.Broadcast;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import com.wildcastradio.ActivityLog.ActivityLogEntity;
import com.wildcastradio.ActivityLog.ActivityLogService;
import com.wildcastradio.ShoutCast.ShoutcastService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import com.wildcastradio.Broadcast.DTO.BroadcastDTO;
import com.wildcastradio.Broadcast.DTO.CreateBroadcastRequest;
import com.wildcastradio.ServerSchedule.ServerScheduleService;
import com.wildcastradio.User.UserEntity;

@Service
public class BroadcastService {

    @Autowired
    private BroadcastRepository broadcastRepository;

    @Autowired
    private ShoutcastService shoutcastService;

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
        BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
                .orElseThrow(() -> new RuntimeException("Broadcast not found"));

        if (!broadcast.getCreatedBy().getId().equals(dj.getId())) {
            throw new AccessDeniedException("Only the creator DJ can start this broadcast");
        }

        if (!serverScheduleService.isServerRunning()) {
            throw new IllegalStateException("Server is not running. Please ensure the server schedule is active.");
        }

        // Start the stream using ShoutcastService
        String streamUrl = shoutcastService.startStream(broadcast);
        broadcast.setStreamUrl(streamUrl);
        broadcast.setActualStart(LocalDateTime.now());
        broadcast.setStatus(BroadcastEntity.BroadcastStatus.LIVE);

        BroadcastEntity savedBroadcast = broadcastRepository.save(broadcast);

        // Log the activity
        activityLogService.logActivity(
            dj,
            ActivityLogEntity.ActivityType.BROADCAST_START,
            "Broadcast started: " + savedBroadcast.getTitle()
        );

        return savedBroadcast;
    }

    public BroadcastEntity endBroadcast(Long broadcastId, UserEntity dj) {
        BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
                .orElseThrow(() -> new RuntimeException("Broadcast not found"));

        if (!broadcast.getCreatedBy().getId().equals(dj.getId())) {
            throw new AccessDeniedException("Only the creator DJ can end this broadcast");
        }

        // End the stream using ShoutcastService
        shoutcastService.endStream(broadcast);
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

        if (!broadcast.getCreatedBy().getId().equals(dj.getId())) {
            throw new AccessDeniedException("Only the creator DJ can test this broadcast");
        }

        broadcast.setStatus(BroadcastEntity.BroadcastStatus.TESTING);
        return broadcastRepository.save(broadcast);
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
