package com.wildcastradio.ActivityLog;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.wildcastradio.ActivityLog.DTO.ActivityLogDTO;
import com.wildcastradio.User.UserEntity;

@Service
public class ActivityLogService {

    private final ActivityLogRepository activityLogRepository;

    public ActivityLogService(ActivityLogRepository activityLogRepository) {
        this.activityLogRepository = activityLogRepository;
    }

    public ActivityLogEntity logActivity(UserEntity user, ActivityLogEntity.ActivityType activityType, String description) {
        ActivityLogEntity activityLog = new ActivityLogEntity(activityType, description, user);
        return activityLogRepository.save(activityLog);
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