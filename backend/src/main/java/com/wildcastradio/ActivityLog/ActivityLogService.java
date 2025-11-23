package com.wildcastradio.ActivityLog;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wildcastradio.ActivityLog.DTO.ActivityLogDTO;
import com.wildcastradio.User.UserEntity;

@Service
public class ActivityLogService {

    private final ActivityLogRepository activityLogRepository;
    private final ObjectMapper objectMapper;

    public ActivityLogService(ActivityLogRepository activityLogRepository) {
        this.activityLogRepository = activityLogRepository;
        this.objectMapper = new ObjectMapper();
    }

    public ActivityLogEntity logActivity(UserEntity user, ActivityLogEntity.ActivityType activityType, String description) {
        ActivityLogEntity activityLog = new ActivityLogEntity(activityType, description, user);
        return activityLogRepository.save(activityLog);
    }

    /**
     * Log system-level audit event (no user required)
     */
    public ActivityLogEntity logSystemAudit(ActivityLogEntity.ActivityType activityType, String description) {
        ActivityLogEntity activityLog = new ActivityLogEntity(activityType, description);
        return activityLogRepository.save(activityLog);
    }

    /**
     * Log audit event with metadata (for enhanced tracking)
     */
    public ActivityLogEntity logAuditWithMetadata(
            UserEntity user,
            ActivityLogEntity.ActivityType activityType,
            String description,
            Long broadcastId,
            Map<String, Object> metadata) {
        try {
            String metadataJson = metadata != null && !metadata.isEmpty() 
                ? objectMapper.writeValueAsString(metadata) 
                : null;
            
            ActivityLogEntity activityLog = new ActivityLogEntity(
                activityType, 
                description, 
                user, 
                broadcastId, 
                metadataJson
            );
            return activityLogRepository.save(activityLog);
        } catch (JsonProcessingException e) {
            // Fallback to simple logging if JSON serialization fails
            ActivityLogEntity activityLog = new ActivityLogEntity(activityType, description, user);
            activityLog.setBroadcastId(broadcastId);
            return activityLogRepository.save(activityLog);
        }
    }

    /**
     * Log system audit event with metadata (no user)
     */
    public ActivityLogEntity logSystemAuditWithMetadata(
            ActivityLogEntity.ActivityType activityType,
            String description,
            Long broadcastId,
            Map<String, Object> metadata) {
        try {
            String metadataJson = metadata != null && !metadata.isEmpty()
                ? objectMapper.writeValueAsString(metadata)
                : null;

            // Use constructor that sets all fields properly for system events
            ActivityLogEntity activityLog = new ActivityLogEntity(activityType, description, null, broadcastId, metadataJson);
            activityLog.setIsSystemEvent(true); // Explicitly mark as system event
            return activityLogRepository.save(activityLog);
        } catch (JsonProcessingException e) {
            // Fallback to simple logging if JSON serialization fails - use proper constructor
            ActivityLogEntity activityLog = new ActivityLogEntity(activityType, description, null, broadcastId, null);
            activityLog.setIsSystemEvent(true);
            return activityLogRepository.save(activityLog);
        }
    }

    /**
     * Log broadcast state transition for audit trail
     */
    public ActivityLogEntity logBroadcastStateTransition(
            UserEntity user,
            Long broadcastId,
            String broadcastTitle,
            String oldStatus,
            String newStatus,
            String reason) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("oldStatus", oldStatus);
        metadata.put("newStatus", newStatus);
        if (reason != null) {
            metadata.put("reason", reason);
        }
        
        String description = String.format("Broadcast state transition: %s -> %s (%s)", 
            oldStatus, newStatus, broadcastTitle);
        
        return logAuditWithMetadata(
            user,
            ActivityLogEntity.ActivityType.BROADCAST_STATE_TRANSITION,
            description,
            broadcastId,
            metadata
        );
    }

    public List<ActivityLogDTO> getActivityLogsForUser(UserEntity user) {
        return activityLogRepository.findByUser(user).stream()
                .map(ActivityLogDTO::fromEntity)
                .collect(Collectors.toList());
    }

    public List<ActivityLogDTO> getRecentActivityLogsForUser(UserEntity user) {
        return activityLogRepository.findTop10ByUserOrderByTimestampDesc(user).stream()
                .map(ActivityLogDTO::fromEntity)
                .collect(Collectors.toList());
    }

    public List<ActivityLogDTO> getActivityLogsByType(UserEntity user, ActivityLogEntity.ActivityType activityType) {
        return activityLogRepository.findByUserAndActivityType(user, activityType).stream()
                .map(ActivityLogDTO::fromEntity)
                .collect(Collectors.toList());
    }

    public List<ActivityLogDTO> getActivityLogsByDateRange(UserEntity user, LocalDateTime start, LocalDateTime end) {
        return activityLogRepository.findByUserAndTimestampBetween(user, start, end).stream()
                .map(ActivityLogDTO::fromEntity)
                .collect(Collectors.toList());
    }

    public List<ActivityLogDTO> getSystemActivityLogs(LocalDateTime start, LocalDateTime end) {
        return activityLogRepository.findByTimestampBetween(start, end).stream()
                .map(ActivityLogDTO::fromEntity)
                .collect(Collectors.toList());
    }

    public List<ActivityLogDTO> getAllActivityLogs() {
        return activityLogRepository.findAll().stream()
                .map(ActivityLogDTO::fromEntity)
                .collect(Collectors.toList());
    }

    // Analytics methods for data retrieval
    public long getTodayActivityCount() {
        LocalDateTime startOfDay = LocalDateTime.now().withHour(0).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime endOfDay = startOfDay.plusDays(1);
        return activityLogRepository.countByTimestampBetween(startOfDay, endOfDay);
    }

    public long getWeekActivityCount() {
        LocalDateTime startOfWeek = LocalDateTime.now().minusDays(7).withHour(0).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime now = LocalDateTime.now();
        return activityLogRepository.countByTimestampBetween(startOfWeek, now);
    }

    public long getMonthActivityCount() {
        LocalDateTime startOfMonth = LocalDateTime.now().minusDays(30).withHour(0).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime now = LocalDateTime.now();
        return activityLogRepository.countByTimestampBetween(startOfMonth, now);
    }

    public List<ActivityLogDTO> getRecentActivities(int limit) {
        return activityLogRepository.findAll().stream()
                .sorted((a, b) -> b.getTimestamp().compareTo(a.getTimestamp()))
                .limit(limit)
                .map(ActivityLogDTO::fromEntity)
                .collect(Collectors.toList());
    }
} 