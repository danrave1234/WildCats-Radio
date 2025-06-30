package com.wildcastradio.Analytics;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.wildcastradio.ActivityLog.ActivityLogService;
import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.Broadcast.BroadcastService;
import com.wildcastradio.Broadcast.DTO.BroadcastDTO;
import com.wildcastradio.ChatMessage.ChatMessageService;
import com.wildcastradio.SongRequest.SongRequestService;
import com.wildcastradio.User.UserService;

/**
 * Analytics Controller for retrieving application statistics and metrics
 */
@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

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

    /**
     * Get broadcast statistics
     */
    @GetMapping("/broadcasts")
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getBroadcastStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalBroadcasts", broadcastService.getTotalBroadcastCount());
        stats.put("liveBroadcasts", broadcastService.getLiveBroadcastCount());
        stats.put("upcomingBroadcasts", broadcastService.getUpcomingBroadcastCount());
        stats.put("completedBroadcasts", broadcastService.getCompletedBroadcastCount());
        stats.put("averageDuration", broadcastService.getAverageBroadcastDuration());
        
        return ResponseEntity.ok(stats);
    }

    /**
     * Get user statistics
     */
    @GetMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getUserStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalUsers", userService.getTotalUserCount());
        stats.put("listeners", userService.getListenerCount());
        stats.put("djs", userService.getDjCount());
        stats.put("admins", userService.getAdminCount());
        stats.put("newUsersThisMonth", userService.getNewUsersThisMonthCount());
        
        return ResponseEntity.ok(stats);
    }

    /**
     * Get engagement statistics
     */
    @GetMapping("/engagement")
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getEngagementStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalChatMessages", chatMessageService.getTotalMessageCount());
        stats.put("totalSongRequests", songRequestService.getTotalSongRequestCount());
        stats.put("averageMessagesPerBroadcast", chatMessageService.getAverageMessagesPerBroadcast());
        stats.put("averageRequestsPerBroadcast", songRequestService.getAverageRequestsPerBroadcast());
        
        return ResponseEntity.ok(stats);
    }

    /**
     * Get activity statistics
     */
    @GetMapping("/activity")
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getActivityStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("todayActivities", activityLogService.getTodayActivityCount());
        stats.put("weekActivities", activityLogService.getWeekActivityCount());
        stats.put("monthActivities", activityLogService.getMonthActivityCount());
        stats.put("recentActivities", activityLogService.getRecentActivities(10));
        
        return ResponseEntity.ok(stats);
    }

    /**
     * Get popular broadcasts
     */
    @GetMapping("/popular-broadcasts")
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<List<BroadcastDTO>> getPopularBroadcasts() {
        List<BroadcastEntity> popularBroadcasts = broadcastService.getPopularBroadcasts(5);
        List<BroadcastDTO> broadcastDTOs = popularBroadcasts.stream()
                .map(BroadcastDTO::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(broadcastDTOs);
    }

    /**
     * Get comprehensive analytics summary
     */
    @GetMapping("/summary")
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getAnalyticsSummary() {
        Map<String, Object> summary = new HashMap<>();
        
        summary.put("broadcasts", getBroadcastStats().getBody());
        summary.put("users", getUserStats().getBody());
        summary.put("engagement", getEngagementStats().getBody());
        summary.put("activity", getActivityStats().getBody());
        summary.put("lastUpdated", System.currentTimeMillis());
        
        return ResponseEntity.ok(summary);
    }

    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> getHealthStatus() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "UP");
        health.put("timestamp", System.currentTimeMillis());
        health.put("message", "Analytics service is running");
        
        return ResponseEntity.ok(health);
    }
} 