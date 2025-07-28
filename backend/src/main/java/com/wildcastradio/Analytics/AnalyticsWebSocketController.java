package com.wildcastradio.Analytics;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Controller;

import com.wildcastradio.Analytics.ListenerTrackingService;
import com.wildcastradio.Broadcast.BroadcastService;
import com.wildcastradio.SongRequest.SongRequestService;
import com.wildcastradio.User.UserService;
import com.wildcastradio.ActivityLog.ActivityLogService;
import com.wildcastradio.ChatMessage.ChatMessageService;

import java.time.LocalDate;
import java.time.Period;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * WebSocket controller for analytics real-time updates
 */
@Controller
public class AnalyticsWebSocketController {

    private static final Logger logger = LoggerFactory.getLogger(AnalyticsWebSocketController.class);

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

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
     * Periodically broadcast analytics updates to connected clients
     */
    @Scheduled(fixedRate = 30000) // Every 30 seconds
    public void broadcastAnalyticsUpdates() {
        try {
            // Send broadcast statistics
            Map<String, Object> broadcastStats = getBroadcastStats();
            messagingTemplate.convertAndSend("/topic/analytics/broadcasts", broadcastStats);

            // Send user statistics (admin only for privacy)
            Map<String, Object> userStats = getUserStats();
            messagingTemplate.convertAndSend("/topic/analytics/users", userStats);

            // Send engagement statistics
            Map<String, Object> engagementStats = getEngagementStats();
            messagingTemplate.convertAndSend("/topic/analytics/engagement", engagementStats);

            // Send activity statistics
            Map<String, Object> activityStats = getActivityStats();
            messagingTemplate.convertAndSend("/topic/analytics/activity", activityStats);

            // Send real-time metrics
            Map<String, Object> realtimeStats = getRealtimeStats();
            messagingTemplate.convertAndSend("/topic/analytics/realtime", realtimeStats);

            // Send demographic analytics (age groups)
            Map<String, Object> demographicStats = getDemographicStats();
            messagingTemplate.convertAndSend("/topic/analytics/demographics", demographicStats);

            logger.debug("Analytics updates sent successfully");

        } catch (Exception e) {
            logger.error("Error broadcasting analytics updates: ", e);
        }
    }

    /**
     * Handle manual analytics refresh request
     */
    @MessageMapping("/analytics/refresh")
    public void handleAnalyticsRefresh() {
        logger.info("Manual analytics refresh requested");
        broadcastAnalyticsUpdates();
    }

    private Map<String, Object> getBroadcastStats() {
        Map<String, Object> stats = new HashMap<>();
        try {
            long totalBroadcasts = broadcastService.getTotalBroadcastCount();
            long liveBroadcasts = broadcastService.getLiveBroadcastCount();
            long upcomingBroadcasts = broadcastService.getUpcomingBroadcastCount();
            long completedBroadcasts = broadcastService.getCompletedBroadcastCount();

            stats.put("totalBroadcasts", totalBroadcasts);
            stats.put("liveBroadcasts", liveBroadcasts);
            stats.put("upcomingBroadcasts", upcomingBroadcasts);
            stats.put("completedBroadcasts", completedBroadcasts);
            stats.put("totalDuration", 0); // Will be calculated later
            stats.put("averageDuration", 0); // Will be calculated later

            // Add real-time listener data
            stats.put("currentListeners", listenerTrackingService.getCurrentListenerCount());
            stats.put("streamLive", listenerTrackingService.isStreamLive());

        } catch (Exception e) {
            logger.error("Error getting broadcast stats: ", e);
            // Return default stats on error
            stats.put("totalBroadcasts", 0);
            stats.put("liveBroadcasts", 0);
            stats.put("upcomingBroadcasts", 0);
            stats.put("completedBroadcasts", 0);
        }
        return stats;
    }

    private Map<String, Object> getUserStats() {
        Map<String, Object> stats = new HashMap<>();
        try {
            long totalUsers = userService.getTotalUserCount();
            long listeners = userService.getUserCountByRole("LISTENER");
            long djs = userService.getUserCountByRole("DJ");
            long admins = userService.getUserCountByRole("ADMIN");
            long newUsersThisMonth = userService.getNewUsersThisMonth();

            stats.put("totalUsers", totalUsers);
            stats.put("listeners", listeners);
            stats.put("djs", djs);
            stats.put("admins", admins);
            stats.put("newUsersThisMonth", newUsersThisMonth);

        } catch (Exception e) {
            logger.error("Error getting user stats: ", e);
            // Return default stats on error
            stats.put("totalUsers", 0);
            stats.put("listeners", 0);
            stats.put("djs", 0);
            stats.put("admins", 0);
            stats.put("newUsersThisMonth", 0);
        }
        return stats;
    }

    private Map<String, Object> getEngagementStats() {
        Map<String, Object> stats = new HashMap<>();
        try {
            long totalSongRequests = songRequestService.getTotalSongRequestCount();
            double averageRequestsPerBroadcast = songRequestService.getAverageRequestsPerBroadcast();
            long totalChatMessages = chatMessageService.getTotalMessageCount();
            double averageMessagesPerBroadcast = chatMessageService.getAverageMessagesPerBroadcast();

            stats.put("totalSongRequests", totalSongRequests);
            stats.put("averageRequestsPerBroadcast", averageRequestsPerBroadcast);
            stats.put("totalChatMessages", totalChatMessages);
            stats.put("averageMessagesPerBroadcast", averageMessagesPerBroadcast);

        } catch (Exception e) {
            logger.error("Error getting engagement stats: ", e);
            // Return default stats on error
            stats.put("totalSongRequests", 0);
            stats.put("averageRequestsPerBroadcast", 0);
            stats.put("totalChatMessages", 0);
            stats.put("averageMessagesPerBroadcast", 0);
        }
        return stats;
    }

    private Map<String, Object> getActivityStats() {
        Map<String, Object> stats = new HashMap<>();
        try {
            long todayActivities = activityLogService.getTodayActivityCount();
            long weekActivities = activityLogService.getWeekActivityCount();
            long monthActivities = activityLogService.getMonthActivityCount();

            stats.put("todayActivities", todayActivities);
            stats.put("weekActivities", weekActivities);
            stats.put("monthActivities", monthActivities);

        } catch (Exception e) {
            logger.error("Error getting activity stats: ", e);
            // Return default stats on error
            stats.put("todayActivities", 0);
            stats.put("weekActivities", 0);
            stats.put("monthActivities", 0);
        }
        return stats;
    }

    private Map<String, Object> getRealtimeStats() {
        Map<String, Object> stats = new HashMap<>();
        try {
            Map<String, Object> realtimeMetrics = listenerTrackingService.getAnalyticsMetrics();
            stats.putAll(realtimeMetrics);

        } catch (Exception e) {
            logger.error("Error getting real-time stats: ", e);
            // Return default stats on error
            stats.put("currentListeners", 0);
            stats.put("streamLive", false);
            stats.put("serverStatus", "DOWN");
            stats.put("lastUpdated", System.currentTimeMillis());
        }
        return stats;
    }

    private Map<String, Object> getDemographicStats() {
        Map<String, Object> stats = new HashMap<>();
        try {
            // Get all users with birthdates directly from userService
            // This bypasses the security layer since it's an internal scheduled operation
            List<com.wildcastradio.User.UserEntity> users = userService.getAllUsers();

            // Age group counters
            int teens = 0; // 13-19
            int youngAdults = 0; // 20-29
            int adults = 0; // 30-49
            int middleAged = 0; // 50-64
            int seniors = 0; // 65+
            int unknown = 0; // No birthdate

            LocalDate today = LocalDate.now();

            for (com.wildcastradio.User.UserEntity user : users) {
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

            // Age group statistics
            Map<String, Object> ageGroups = new HashMap<>();
            ageGroups.put("teens", teens); // 13-19
            ageGroups.put("youngAdults", youngAdults); // 20-29
            ageGroups.put("adults", adults); // 30-49
            ageGroups.put("middleAged", middleAged); // 50-64
            ageGroups.put("seniors", seniors); // 65+
            ageGroups.put("unknown", unknown);

            stats.put("ageGroups", ageGroups);
            stats.put("totalUsers", users.size());
            stats.put("usersWithBirthdate", users.size() - unknown);
            stats.put("lastUpdated", System.currentTimeMillis());

        } catch (Exception e) {
            logger.error("Error getting demographic stats: ", e);
            // Return default demographic stats on error
            Map<String, Object> ageGroups = new HashMap<>();
            ageGroups.put("teens", 0);
            ageGroups.put("youngAdults", 0);
            ageGroups.put("adults", 0);
            ageGroups.put("middleAged", 0);
            ageGroups.put("seniors", 0);
            ageGroups.put("unknown", 0);

            stats.put("ageGroups", ageGroups);
            stats.put("totalUsers", 0);
            stats.put("usersWithBirthdate", 0);
            stats.put("lastUpdated", System.currentTimeMillis());
        }
        return stats;
    }
}
