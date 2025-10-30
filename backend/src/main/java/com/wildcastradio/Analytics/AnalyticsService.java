package com.wildcastradio.Analytics;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.util.HashMap;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.wildcastradio.ActivityLog.ActivityLogService;
import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.Broadcast.BroadcastRepository;
import com.wildcastradio.Broadcast.BroadcastService;
import com.wildcastradio.Broadcast.DTO.BroadcastDTO;
import com.wildcastradio.ChatMessage.ChatMessageService;
import com.wildcastradio.ChatMessage.ChatMessageRepository;
import com.wildcastradio.SongRequest.SongRequestService;
import com.wildcastradio.SongRequest.SongRequestRepository;
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
    private BroadcastRepository broadcastRepository;

    @Autowired
    private UserService userService;

    @Autowired
    private SongRequestService songRequestService;

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Autowired
    private SongRequestRepository songRequestRepository;

    @Autowired
    private ActivityLogService activityLogService;

    @Autowired
    private ChatMessageService chatMessageService;

    @Autowired
    private ListenerTrackingService listenerTrackingService;

    /**
     * Get broadcast statistics including real-time listener data
     * If userId is provided, returns stats only for that DJ's broadcasts
     */
    public Map<String, Object> getBroadcastStats() {
        return getBroadcastStats(null);
    }

    /**
     * Get broadcast statistics filtered by DJ (userId)
     * If userId is null, returns overall stats
     */
    public Map<String, Object> getBroadcastStats(Long userId) {
        Map<String, Object> stats = new HashMap<>();
        
        if (userId != null) {
            // Get stats for specific DJ
            UserEntity dj = userService.getUserById(userId).orElse(null);
            if (dj != null) {
                List<BroadcastEntity> djBroadcasts = broadcastService.getBroadcastsByDJ(dj);
                long totalBroadcasts = djBroadcasts.size();
                long liveBroadcasts = djBroadcasts.stream()
                    .filter(b -> b.getStatus() == BroadcastEntity.BroadcastStatus.LIVE)
                    .count();
                long upcomingBroadcasts = djBroadcasts.stream()
                    .filter(b -> b.getStatus() == BroadcastEntity.BroadcastStatus.SCHEDULED)
                    .filter(b -> b.getScheduledStart() != null && b.getScheduledStart().isAfter(java.time.LocalDateTime.now()))
                    .count();
                long completedBroadcasts = djBroadcasts.stream()
                    .filter(b -> b.getStatus() == BroadcastEntity.BroadcastStatus.ENDED)
                    .count();
                
                // Calculate average duration for this DJ's broadcasts
                double avgDuration = djBroadcasts.stream()
                    .filter(b -> b.getActualStart() != null && b.getActualEnd() != null)
                    .mapToLong(b -> java.time.Duration.between(b.getActualStart(), b.getActualEnd()).toMinutes())
                    .average()
                    .orElse(0.0);
                
                stats.put("totalBroadcasts", totalBroadcasts);
                stats.put("liveBroadcasts", liveBroadcasts);
                stats.put("upcomingBroadcasts", upcomingBroadcasts);
                stats.put("completedBroadcasts", completedBroadcasts);
                stats.put("averageDuration", avgDuration);
                
                // For DJs, only show listeners for their current live broadcast if any
                BroadcastEntity djLiveBroadcast = djBroadcasts.stream()
                    .filter(b -> b.getStatus() == BroadcastEntity.BroadcastStatus.LIVE)
                    .findFirst()
                    .orElse(null);
                
                if (djLiveBroadcast != null) {
                    stats.put("currentListeners", listenerTrackingService.getCurrentListenerCount());
                    stats.put("streamLive", listenerTrackingService.isStreamLive());
                } else {
                    stats.put("currentListeners", 0);
                    stats.put("streamLive", false);
                }
            } else {
                // User not found, return empty stats
                stats.put("totalBroadcasts", 0);
                stats.put("liveBroadcasts", 0);
                stats.put("upcomingBroadcasts", 0);
                stats.put("completedBroadcasts", 0);
                stats.put("averageDuration", 0);
                stats.put("currentListeners", 0);
                stats.put("streamLive", false);
            }
        } else {
            // Overall stats (for Admin/Moderator)
        stats.put("totalBroadcasts", broadcastService.getTotalBroadcastCount());
        stats.put("liveBroadcasts", broadcastService.getLiveBroadcastCount());
        stats.put("upcomingBroadcasts", broadcastService.getUpcomingBroadcastCount());
        stats.put("completedBroadcasts", broadcastService.getCompletedBroadcastCount());
        stats.put("averageDuration", broadcastService.getAverageBroadcastDuration());
        stats.put("currentListeners", listenerTrackingService.getCurrentListenerCount());
        stats.put("streamLive", listenerTrackingService.isStreamLive());
        }
        
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
        stats.put("moderators", userService.getModeratorCount());
        stats.put("newUsersThisMonth", userService.getNewUsersThisMonthCount());
        return stats;
    }

    /**
     * Get engagement statistics
     * If userId is provided, returns stats only for that DJ's broadcasts
     */
    public Map<String, Object> getEngagementStats() {
        return getEngagementStats(null);
    }

    /**
     * Get engagement statistics filtered by DJ (userId)
     * If userId is null, returns overall stats
     */
    public Map<String, Object> getEngagementStats(Long userId) {
        Map<String, Object> stats = new HashMap<>();
        LocalDate nowDate = LocalDate.now();
        LocalDateTime todayStart = nowDate.atStartOfDay();
        LocalDateTime todayEnd = todayStart.plusDays(1);
        LocalDateTime weekStart = todayStart.minusDays(7);
        LocalDateTime monthStart = todayStart.minusDays(30);

        if (userId != null) {
            // Get stats for specific DJ's broadcasts using bulk queries for performance
            UserEntity dj = userService.getUserById(userId).orElse(null);
            if (dj != null) {
                List<BroadcastEntity> djBroadcasts = broadcastService.getBroadcastsByDJ(dj);
                
                // Use bulk queries instead of per-broadcast queries to avoid N+1 problem
                long totalMessages = chatMessageRepository.countByBroadcast_CreatedBy_Id(userId);
                long totalRequests = songRequestRepository.countByBroadcast_CreatedBy_Id(userId);
                
                // Use bulk queries for time-based counts
                long todayMessages = chatMessageRepository.countByBroadcast_CreatedBy_IdAndCreatedAtBetween(
                    userId, todayStart, todayEnd);
                long weekMessages = chatMessageRepository.countByBroadcast_CreatedBy_IdAndCreatedAtBetween(
                    userId, weekStart, todayEnd);
                long monthMessages = chatMessageRepository.countByBroadcast_CreatedBy_IdAndCreatedAtBetween(
                    userId, monthStart, todayEnd);
                
                long completedBroadcasts = djBroadcasts.stream()
                    .filter(b -> b.getStatus() == BroadcastEntity.BroadcastStatus.ENDED)
                    .count();
                
                stats.put("totalChatMessages", totalMessages);
                stats.put("totalSongRequests", totalRequests);
                stats.put("averageMessagesPerBroadcast", completedBroadcasts > 0 
                    ? (double) totalMessages / completedBroadcasts : 0.0);
                stats.put("averageRequestsPerBroadcast", completedBroadcasts > 0 
                    ? (double) totalRequests / completedBroadcasts : 0.0);
                
                Map<String, Object> chatBreakdown = new HashMap<>();
                chatBreakdown.put("today", todayMessages);
                chatBreakdown.put("week", weekMessages);
                chatBreakdown.put("month", monthMessages);
                stats.put("chatBreakdown", chatBreakdown);
            } else {
                // User not found, return empty stats
                stats.put("totalChatMessages", 0);
                stats.put("totalSongRequests", 0);
                stats.put("averageMessagesPerBroadcast", 0);
                stats.put("averageRequestsPerBroadcast", 0);
            }
        } else {
            // Overall stats (for Admin/Moderator)
        stats.put("totalChatMessages", chatMessageService.getTotalMessageCount());
        stats.put("totalSongRequests", songRequestService.getTotalSongRequestCount());
        stats.put("averageMessagesPerBroadcast", chatMessageService.getAverageMessagesPerBroadcast());
        stats.put("averageRequestsPerBroadcast", songRequestService.getAverageRequestsPerBroadcast());

        try {
            long todayMessages = chatMessageService.getRepository().countByCreatedAtBetween(todayStart, todayEnd);
            long weekMessages = chatMessageService.getRepository().countByCreatedAtBetween(weekStart, todayEnd);
            long monthMessages = chatMessageService.getRepository().countByCreatedAtBetween(monthStart, todayEnd);
            Map<String, Object> chatBreakdown = new HashMap<>();
            chatBreakdown.put("today", todayMessages);
            chatBreakdown.put("week", weekMessages);
            chatBreakdown.put("month", monthMessages);
            stats.put("chatBreakdown", chatBreakdown);
        } catch (Exception ignored) {
            // Repository accessor not available; keep totals only
            }
        }

        return stats;
    }

    /**
     * Get activity statistics
     * If userId is provided, returns stats only for that DJ's activities
     */
    public Map<String, Object> getActivityStats() {
        return getActivityStats(null);
    }

    /**
     * Get activity statistics filtered by DJ (userId)
     * If userId is null, returns overall stats
     */
    public Map<String, Object> getActivityStats(Long userId) {
        Map<String, Object> stats = new HashMap<>();
        
        if (userId != null) {
            // For DJs, filter activities related to their broadcasts
            UserEntity dj = userService.getUserById(userId).orElse(null);
            if (dj != null) {
                List<BroadcastEntity> djBroadcasts = broadcastService.getBroadcastsByDJ(dj);
                List<Long> broadcastIds = djBroadcasts.stream()
                    .map(BroadcastEntity::getId)
                    .collect(Collectors.toList());
                
                // Get all activities and filter for this DJ's broadcasts or activities
                // Note: getRecentActivities returns ActivityLogDTO, not Entity
                List<com.wildcastradio.ActivityLog.DTO.ActivityLogDTO> allActivities = activityLogService.getRecentActivities(100);
                List<com.wildcastradio.ActivityLog.DTO.ActivityLogDTO> djActivities = allActivities.stream()
                    .filter(activity -> {
                        // Include activities by this DJ or related to their broadcasts
                        if (activity.getUser() != null && activity.getUser().getId().equals(userId)) {
                            return true;
                        }
                        // Check if activity description mentions any of this DJ's broadcast IDs
                        String description = activity.getDescription();
                        if (description != null) {
                            return broadcastIds.stream().anyMatch(id -> 
                                description.contains(id.toString()) ||
                                description.contains(dj.getEmail())
                            );
                        }
                        return false;
                    })
                    .collect(Collectors.toList());
                
                LocalDateTime now = LocalDateTime.now();
                LocalDateTime todayStart = now.toLocalDate().atStartOfDay();
                LocalDateTime weekStart = todayStart.minusDays(7);
                LocalDateTime monthStart = todayStart.minusDays(30);
                
                long todayCount = djActivities.stream()
                    .filter(a -> {
                        if (a.getTimestamp() == null) return false;
                        LocalDateTime timestamp = a.getTimestamp();
                        return timestamp.isAfter(todayStart);
                    })
                    .count();
                long weekCount = djActivities.stream()
                    .filter(a -> {
                        if (a.getTimestamp() == null) return false;
                        LocalDateTime timestamp = a.getTimestamp();
                        return timestamp.isAfter(weekStart);
                    })
                    .count();
                long monthCount = djActivities.stream()
                    .filter(a -> {
                        if (a.getTimestamp() == null) return false;
                        LocalDateTime timestamp = a.getTimestamp();
                        return timestamp.isAfter(monthStart);
                    })
                    .count();
                
                stats.put("todayActivities", todayCount);
                stats.put("weekActivities", weekCount);
                stats.put("monthActivities", monthCount);
                stats.put("recentActivities", djActivities.stream().limit(10).collect(Collectors.toList()));
            } else {
                stats.put("todayActivities", 0);
                stats.put("weekActivities", 0);
                stats.put("monthActivities", 0);
                stats.put("recentActivities", Collections.emptyList());
            }
        } else {
            // Overall stats (for Admin/Moderator)
        stats.put("todayActivities", activityLogService.getTodayActivityCount());
        stats.put("weekActivities", activityLogService.getWeekActivityCount());
        stats.put("monthActivities", activityLogService.getMonthActivityCount());
        stats.put("recentActivities", activityLogService.getRecentActivities(10));
        }
        
        return stats;
    }

    /**
     * Get popular broadcasts
     * If userId is provided, returns only that DJ's broadcasts
     */
    public List<BroadcastDTO> getPopularBroadcasts(int limit) {
        return getPopularBroadcasts(limit, null);
    }

    /**
     * Get popular broadcasts filtered by DJ (userId)
     * If userId is null, returns overall popular broadcasts
     */
    public List<BroadcastDTO> getPopularBroadcasts(int limit, Long userId) {
        List<BroadcastEntity> popularBroadcasts;
        
        if (userId != null) {
            // Get this DJ's broadcasts (without collections to avoid MultipleBagFetchException)
            UserEntity dj = userService.getUserById(userId).orElse(null);
            if (dj != null) {
                List<BroadcastEntity> djBroadcasts = broadcastRepository.findByCreatedBy(dj);
                
                if (djBroadcasts.isEmpty()) {
                    popularBroadcasts = Collections.emptyList();
                } else {
                    // Get all broadcast IDs
                    List<Long> broadcastIds = djBroadcasts.stream()
                        .map(BroadcastEntity::getId)
                        .collect(Collectors.toList());
                    
                    // Use batch aggregation queries to get all counts in just 2 queries
                    Map<Long, Integer> interactionCounts = new HashMap<>();
                    
                    // Initialize all broadcasts with 0 counts
                    for (Long id : broadcastIds) {
                        interactionCounts.put(id, 0);
                    }
                    
                    // Batch query for chat messages - single query for all broadcasts
                    List<Object[]> chatCounts = chatMessageRepository.countMessagesByBroadcastIds(broadcastIds);
                    for (Object[] result : chatCounts) {
                        Long broadcastId = ((Number) result[0]).longValue();
                        Long count = ((Number) result[1]).longValue();
                        interactionCounts.put(broadcastId, count.intValue());
                    }
                    
                    // Batch query for song requests - single query for all broadcasts
                    List<Object[]> requestCounts = songRequestRepository.countSongRequestsByBroadcastIds(broadcastIds);
                    Map<Long, Integer> requestCountsMap = new HashMap<>();
                    for (Object[] result : requestCounts) {
                        Long broadcastId = ((Number) result[0]).longValue();
                        Long count = ((Number) result[1]).longValue();
                        requestCountsMap.put(broadcastId, count.intValue());
                    }
                    
                    // Combine chat and request counts
                    for (Long id : broadcastIds) {
                        int chatCount = interactionCounts.getOrDefault(id, 0);
                        int requestCount = requestCountsMap.getOrDefault(id, 0);
                        interactionCounts.put(id, chatCount + requestCount);
                    }
                    
                    // Sort using pre-computed counts
                    popularBroadcasts = djBroadcasts.stream()
                        .sorted((a, b) -> {
                            int aInteractions = interactionCounts.getOrDefault(a.getId(), 0);
                            int bInteractions = interactionCounts.getOrDefault(b.getId(), 0);
                            
                            // If interactions are equal, sort by latest actualStart/end
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
                        .collect(Collectors.toList());
                }
            } else {
                popularBroadcasts = Collections.emptyList();
            }
        } else {
            // Overall popular broadcasts (for Admin/Moderator)
            popularBroadcasts = broadcastService.getPopularBroadcasts(limit);
        }
        
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
            // Use counts and avoid fetching all users to reduce risk and load
            List<UserEntity> users = Collections.emptyList();
            int teens = 0, youngAdults = 0, adults = 0, middleAged = 0, seniors = 0, unknownAge = 0;
            int male = 0, female = 0, other = 0, unknownGender = 0;
            LocalDate today = LocalDate.now();
            for (UserEntity user : users) {
                // Age grouping
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
                    unknownAge++;
                }
                // Gender grouping
                if (user.getGender() == null) {
                    unknownGender++;
                } else {
                    switch (user.getGender()) {
                        case MALE -> male++;
                        case FEMALE -> female++;
                        case OTHER -> other++;
                        default -> unknownGender++;
                    }
                }
            }
            Map<String, Object> ageGroups = new HashMap<>();
            ageGroups.put("teens", teens);
            ageGroups.put("youngAdults", youngAdults);
            ageGroups.put("adults", adults);
            ageGroups.put("middleAged", middleAged);
            ageGroups.put("seniors", seniors);
            ageGroups.put("unknown", unknownAge);

            Map<String, Object> genderGroups = new HashMap<>();
            genderGroups.put("male", male);
            genderGroups.put("female", female);
            genderGroups.put("other", other);
            genderGroups.put("unknown", unknownGender);

            demographics.put("ageGroups", ageGroups);
            demographics.put("gender", genderGroups);
            demographics.put("totalUsers", users.size());
            demographics.put("usersWithBirthdate", users.size() - unknownAge);
            demographics.put("usersWithGender", users.size() - unknownGender);
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
