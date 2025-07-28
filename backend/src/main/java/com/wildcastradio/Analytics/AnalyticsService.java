package com.wildcastradio.Analytics;

import java.time.LocalDate;
import java.time.Period;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.wildcastradio.ActivityLog.ActivityLogService;
import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.Broadcast.BroadcastService;
import com.wildcastradio.Broadcast.DTO.BroadcastDTO;
import com.wildcastradio.ChatMessage.ChatMessageService;
import com.wildcastradio.SongRequest.SongRequestService;
import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserService;

/**
 * Service for aggregating analytics metrics from various domain services
 */
@Service
public class AnalyticsService {

    private static final Logger logger = LoggerFactory.getLogger(AnalyticsService.class);

    @Autowired
    private BroadcastService broadcastService;

    @Autowired
    private UserService userService;

    @Autowired
    private SongRequestService songRequestService;

    @Autowired
    private ActivityLogService activityLogService;

    @Autowired
    private ChatMessageService chatMessageService;

    @Autowired
    private ListenerTrackingService listenerTrackingService;

    /**
     * Get broadcast statistics including real-time listener data
     */
    public Map<String, Object> getBroadcastStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalBroadcasts", broadcastService.getTotalBroadcastCount());
        stats.put("liveBroadcasts", broadcastService.getLiveBroadcastCount());
        stats.put("upcomingBroadcasts", broadcastService.getUpcomingBroadcastCount());
        stats.put("completedBroadcasts", broadcastService.getCompletedBroadcastCount());
        stats.put("averageDuration", broadcastService.getAverageBroadcastDuration());

        // Add real-time listener data
        stats.put("currentListeners", listenerTrackingService.getCurrentListenerCount());
        stats.put("streamLive", listenerTrackingService.isStreamLive());
        return stats;
    }

    /**
     * Get user statistics
     */
    public Map<String, Object> getUserStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalUsers", userService.getTotalUserCount());
        stats.put("listeners", userService.getListenerCount());
        stats.put("djs", userService.getDjCount());
        stats.put("admins", userService.getAdminCount());
        stats.put("newUsersThisMonth", userService.getNewUsersThisMonthCount());
        return stats;
    }

    /**
     * Get engagement statistics
     */
    public Map<String, Object> getEngagementStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalChatMessages", chatMessageService.getTotalMessageCount());
        stats.put("totalSongRequests", songRequestService.getTotalSongRequestCount());
        stats.put("averageMessagesPerBroadcast", chatMessageService.getAverageMessagesPerBroadcast());
        stats.put("averageRequestsPerBroadcast", songRequestService.getAverageRequestsPerBroadcast());
        return stats;
    }

    /**
     * Get activity statistics
     */
    public Map<String, Object> getActivityStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("todayActivities", activityLogService.getTodayActivityCount());
        stats.put("weekActivities", activityLogService.getWeekActivityCount());
        stats.put("monthActivities", activityLogService.getMonthActivityCount());
        stats.put("recentActivities", activityLogService.getRecentActivities(10));
        return stats;
    }

    /**
     * Get popular broadcasts
     */
    public List<BroadcastDTO> getPopularBroadcasts(int limit) {
        List<BroadcastEntity> popularBroadcasts = broadcastService.getPopularBroadcasts(limit);
        return popularBroadcasts.stream()
            .map(BroadcastDTO::fromEntity)
            .collect(Collectors.toList());
    }

    /**
     * Get real-time analytics metrics
     */
    public Map<String, Object> getRealtimeAnalytics() {
        return listenerTrackingService.getAnalyticsMetrics();
    }

    /**
     * Get demographic analytics including age group breakdowns
     */
    public Map<String, Object> getDemographicAnalytics() {
        Map<String, Object> demographics = new HashMap<>();
        try {
            List<UserEntity> users = userService.getAllUsers();
            int teens = 0, youngAdults = 0, adults = 0, middleAged = 0, seniors = 0, unknown = 0;
            LocalDate today = LocalDate.now();
            for (UserEntity user : users) {
                if (user.getBirthdate() != null) {
                    int age = Period.between(user.getBirthdate(), today).getYears();
                    if (age >= 13 && age <= 19) {
                        teens++;
                    } else if (age >= 20 && age <= 29) {
                        youngAdults++;
                    } else if (age >= 30 && age <= 49) {
                        adults++;
                    } else if (age >= 50 && age <= 64) {
                        middleAged++;
                    } else if (age >= 65) {
                        seniors++;
                    }
                } else {
                    unknown++;
                }
            }
            Map<String, Object> ageGroups = new HashMap<>();
            ageGroups.put("teens", teens);
            ageGroups.put("youngAdults", youngAdults);
            ageGroups.put("adults", adults);
            ageGroups.put("middleAged", middleAged);
            ageGroups.put("seniors", seniors);
            ageGroups.put("unknown", unknown);

            demographics.put("ageGroups", ageGroups);
            demographics.put("totalUsers", users.size());
            demographics.put("usersWithBirthdate", users.size() - unknown);
            demographics.put("lastUpdated", System.currentTimeMillis());
        } catch (Exception e) {
            logger.error("Error getting demographic analytics", e);
        }
        return demographics;
    }

    /**
     * Summary of all analytics
     */
    public Map<String, Object> getAnalyticsSummary() {
        Map<String, Object> summary = new HashMap<>();
        summary.put("broadcasts", getBroadcastStats());
        summary.put("users", getUserStats());
        summary.put("engagement", getEngagementStats());
        summary.put("activity", getActivityStats());
        summary.put("realtime", getRealtimeAnalytics());
        summary.put("lastUpdated", System.currentTimeMillis());
        return summary;
    }
}
