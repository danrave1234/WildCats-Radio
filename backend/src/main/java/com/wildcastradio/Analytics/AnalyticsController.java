package com.wildcastradio.Analytics;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.util.*;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.Broadcast.DTO.BroadcastDTO;
import com.wildcastradio.Broadcast.BroadcastService;
import com.wildcastradio.Analytics.ListenerTrackingService;

/**
 * Analytics Controller for retrieving application statistics and metrics
 */
@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private static final Logger logger = LoggerFactory.getLogger(AnalyticsController.class);

    @Autowired
    private AnalyticsService analyticsService;

    @Autowired
    private BroadcastService broadcastService;

    @Autowired
    private ListenerTrackingService listenerTrackingService;

    /**
     * Get broadcast statistics including real-time listener data
     */
    @GetMapping("/broadcasts")
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getBroadcastStats() {
        return ResponseEntity.ok(analyticsService.getBroadcastStats());
    }

    /**
     * Get user statistics
     */
    @GetMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getUserStats() {
        return ResponseEntity.ok(analyticsService.getUserStats());
    }

    /**
     * Get engagement statistics
     */
    @GetMapping("/engagement")
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getEngagementStats() {
        return ResponseEntity.ok(analyticsService.getEngagementStats());
    }

    /**
     * Get activity statistics
     */
    @GetMapping("/activity")
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getActivityStats() {
        return ResponseEntity.ok(analyticsService.getActivityStats());
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
     * Get real-time analytics metrics
     */
    @GetMapping("/realtime")
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getRealtimeAnalytics() {
        return ResponseEntity.ok(analyticsService.getRealtimeAnalytics());
    }

    /**
     * Get demographic analytics including age group breakdowns
     */
    @GetMapping("/demographics")
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getDemographicAnalytics() {
        try {
            Map<String, Object> demographics = analyticsService.getDemographicAnalytics();
            return ResponseEntity.ok(demographics);
        } catch (Exception e) {
            logger.error("Error getting demographic analytics: ", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get topic performance analytics
     */
    @GetMapping("/topics/performance")
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getTopicPerformanceAnalytics() {
        Map<String, Object> topicAnalytics = new HashMap<>();

        try {
            List<com.wildcastradio.Broadcast.BroadcastEntity> broadcasts = broadcastService.getAllBroadcasts();

            // Map to store topic performance data
            Map<String, Map<String, Object>> topicPerformance = new HashMap<>();

            for (com.wildcastradio.Broadcast.BroadcastEntity broadcast : broadcasts) {
                String title = broadcast.getTitle();
                if (title == null || title.trim().isEmpty()) {
                    continue;
                }

                // Extract topic keywords (simple approach - could be enhanced with NLP)
                String[] keywords = extractKeywords(title);

                int chatMessages = broadcast.getChatMessages() != null ? broadcast.getChatMessages().size() : 0;
                int songRequests = broadcast.getSongRequests() != null ? broadcast.getSongRequests().size() : 0;
                int totalInteractions = chatMessages + songRequests;

                // Calculate duration for engagement rate
                Long durationMinutes = null;
                if (broadcast.getActualStart() != null && broadcast.getActualEnd() != null) {
                    durationMinutes = java.time.Duration.between(broadcast.getActualStart(), broadcast.getActualEnd()).toMinutes();
                }

                Double engagementRate = null;
                if (durationMinutes != null && durationMinutes > 0) {
                    engagementRate = (double) totalInteractions / durationMinutes;
                }

                // Store broadcast performance data
                Map<String, Object> broadcastData = new HashMap<>();
                broadcastData.put("title", title);
                broadcastData.put("totalInteractions", totalInteractions);
                broadcastData.put("chatMessages", chatMessages);
                broadcastData.put("songRequests", songRequests);
                broadcastData.put("durationMinutes", durationMinutes);
                broadcastData.put("engagementRate", engagementRate);
                broadcastData.put("createdBy", broadcast.getCreatedBy().getEmail());
                broadcastData.put("scheduledStart", broadcast.getScheduledStart());

                // Aggregate by keywords/topics
                for (String keyword : keywords) {
                    if (!topicPerformance.containsKey(keyword)) {
                        Map<String, Object> topicData = new HashMap<>();
                        topicData.put("keyword", keyword);
                        topicData.put("broadcastCount", 0);
                        topicData.put("totalInteractions", 0);
                        topicData.put("totalChatMessages", 0);
                        topicData.put("totalSongRequests", 0);
                        topicData.put("averageEngagementRate", 0.0);
                        topicData.put("broadcasts", new ArrayList<Map<String, Object>>());
                        topicPerformance.put(keyword, topicData);
                    }

                    Map<String, Object> topicData = topicPerformance.get(keyword);
                    topicData.put("broadcastCount", (Integer) topicData.get("broadcastCount") + 1);
                    topicData.put("totalInteractions", (Integer) topicData.get("totalInteractions") + totalInteractions);
                    topicData.put("totalChatMessages", (Integer) topicData.get("totalChatMessages") + chatMessages);
                    topicData.put("totalSongRequests", (Integer) topicData.get("totalSongRequests") + songRequests);

                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> broadcastList = (List<Map<String, Object>>) topicData.get("broadcasts");
                    broadcastList.add(broadcastData);
                }
            }

            // Calculate average engagement rates for topics
            for (Map<String, Object> topicData : topicPerformance.values()) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> broadcastList = (List<Map<String, Object>>) topicData.get("broadcasts");

                double totalEngagementRate = 0.0;
                int validRates = 0;

                for (Map<String, Object> broadcastData : broadcastList) {
                    Double rate = (Double) broadcastData.get("engagementRate");
                    if (rate != null) {
                        totalEngagementRate += rate;
                        validRates++;
                    }
                }

                if (validRates > 0) {
                    topicData.put("averageEngagementRate", totalEngagementRate / validRates);
                }
            }

            // Sort topics by total interactions (descending)
            List<Map<String, Object>> sortedTopics = topicPerformance.values().stream()
                .sorted((a, b) -> Integer.compare((Integer) b.get("totalInteractions"), (Integer) a.get("totalInteractions")))
                .collect(Collectors.toList());

            topicAnalytics.put("topicPerformance", sortedTopics);
            topicAnalytics.put("totalTopics", sortedTopics.size());
            topicAnalytics.put("totalBroadcasts", broadcasts.size());
            topicAnalytics.put("lastUpdated", System.currentTimeMillis());

            return ResponseEntity.ok(topicAnalytics);

        } catch (Exception e) {
            logger.error("Error getting topic performance analytics: ", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get broadcast analytics with age group interaction breakdowns
     */
    @GetMapping("/broadcast/{broadcastId}/demographics")
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getBroadcastDemographicAnalytics(@PathVariable Long broadcastId) {
        Map<String, Object> analytics = new HashMap<>();

        try {
            // Get broadcast details
            Optional<com.wildcastradio.Broadcast.BroadcastEntity> broadcastOpt = broadcastService.getBroadcastById(broadcastId);
            if (!broadcastOpt.isPresent()) {
                return ResponseEntity.notFound().build();
            }

            com.wildcastradio.Broadcast.BroadcastEntity broadcast = broadcastOpt.get();

            // Age group interaction counters
            Map<String, Integer> ageGroupChatMessages = new HashMap<>();
            Map<String, Integer> ageGroupSongRequests = new HashMap<>();

            // Initialize counters
            String[] ageGroups = {"teens", "youngAdults", "adults", "middleAged", "seniors", "unknown"};
            for (String group : ageGroups) {
                ageGroupChatMessages.put(group, 0);
                ageGroupSongRequests.put(group, 0);
            }

            LocalDate today = LocalDate.now();

            // Analyze chat messages by age group
            if (broadcast.getChatMessages() != null) {
                for (com.wildcastradio.ChatMessage.ChatMessageEntity message : broadcast.getChatMessages()) {
                    String ageGroup = getAgeGroup(message.getSender().getBirthdate(), today);
                    ageGroupChatMessages.put(ageGroup, ageGroupChatMessages.get(ageGroup) + 1);
                }
            }

            // Analyze song requests by age group
            if (broadcast.getSongRequests() != null) {
                for (com.wildcastradio.SongRequest.SongRequestEntity request : broadcast.getSongRequests()) {
                    String ageGroup = getAgeGroup(request.getRequestedBy().getBirthdate(), today);
                    ageGroupSongRequests.put(ageGroup, ageGroupSongRequests.get(ageGroup) + 1);
                }
            }

            // Calculate total interactions by age group
            Map<String, Integer> totalInteractionsByAge = new HashMap<>();
            for (String group : ageGroups) {
                int total = ageGroupChatMessages.get(group) + ageGroupSongRequests.get(group);
                totalInteractionsByAge.put(group, total);
            }

            // Build response
            analytics.put("broadcastId", broadcastId);
            analytics.put("broadcastTitle", broadcast.getTitle());
            analytics.put("ageGroupChatMessages", ageGroupChatMessages);
            analytics.put("ageGroupSongRequests", ageGroupSongRequests);
            analytics.put("totalInteractionsByAge", totalInteractionsByAge);
            analytics.put("lastUpdated", System.currentTimeMillis());

            return ResponseEntity.ok(analytics);

        } catch (Exception e) {
            logger.error("Error getting broadcast demographic analytics for ID {}: ", broadcastId, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get detailed analytics for a specific broadcast
     */
    @GetMapping("/broadcast/{broadcastId}")
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getBroadcastAnalytics(@PathVariable Long broadcastId) {
        Map<String, Object> analytics = new HashMap<>();

        try {
            // Get broadcast details
            Optional<BroadcastEntity> broadcastOpt = broadcastService.getBroadcastById(broadcastId);
            if (!broadcastOpt.isPresent()) {
                return ResponseEntity.notFound().build();
            }

            BroadcastEntity broadcast = broadcastOpt.get();

            // Basic broadcast information
            analytics.put("id", broadcast.getId());
            analytics.put("title", broadcast.getTitle());
            analytics.put("description", broadcast.getDescription());
            analytics.put("status", broadcast.getStatus().toString());
            analytics.put("createdBy", broadcast.getCreatedBy().getEmail());
            analytics.put("startedBy", broadcast.getStartedBy() != null ? broadcast.getStartedBy().getEmail() : null);

            // Timing information
            analytics.put("scheduledStart", broadcast.getScheduledStart());
            analytics.put("scheduledEnd", broadcast.getScheduledEnd());
            analytics.put("actualStart", broadcast.getActualStart());
            analytics.put("actualEnd", broadcast.getActualEnd());

            // Calculate duration
            Long durationMinutes = null;
            if (broadcast.getActualStart() != null && broadcast.getActualEnd() != null) {
                durationMinutes = java.time.Duration.between(broadcast.getActualStart(), broadcast.getActualEnd()).toMinutes();
            } else if (broadcast.getActualStart() != null && broadcast.getStatus() == BroadcastEntity.BroadcastStatus.LIVE) {
                durationMinutes = java.time.Duration.between(broadcast.getActualStart(), LocalDateTime.now()).toMinutes();
            }
            analytics.put("durationMinutes", durationMinutes);

            // Interaction metrics
            int chatMessageCount = broadcast.getChatMessages() != null ? broadcast.getChatMessages().size() : 0;
            int songRequestCount = broadcast.getSongRequests() != null ? broadcast.getSongRequests().size() : 0;
            analytics.put("totalChatMessages", chatMessageCount);
            analytics.put("totalSongRequests", songRequestCount);
            analytics.put("totalInteractions", chatMessageCount + songRequestCount);

            // Real-time metrics (if broadcast is live)
            if (broadcast.getStatus() == BroadcastEntity.BroadcastStatus.LIVE) {
                analytics.put("currentListeners", listenerTrackingService.getCurrentListenerCount());
                analytics.put("streamLive", listenerTrackingService.isStreamLive());
            } else {
                analytics.put("currentListeners", 0);
                analytics.put("streamLive", false);
            }

            // Peak listeners (placeholder - would need historical tracking)
            // For now, use current listeners if live, or 0 if ended
            analytics.put("peakListeners", broadcast.getStatus() == BroadcastEntity.BroadcastStatus.LIVE ? 
                listenerTrackingService.getCurrentListenerCount() : 0);

            // Engagement rate (interactions per minute)
            Double engagementRate = null;
            if (durationMinutes != null && durationMinutes > 0) {
                engagementRate = (double) (chatMessageCount + songRequestCount) / durationMinutes;
            }
            analytics.put("engagementRate", engagementRate);

            analytics.put("lastUpdated", System.currentTimeMillis());

            return ResponseEntity.ok(analytics);

        } catch (Exception e) {
            logger.error("Error getting broadcast analytics for ID {}: ", broadcastId, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get analytics for all broadcasts with summary metrics
     */
    @GetMapping("/broadcasts/detailed")
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> getAllBroadcastAnalytics() {
        try {
            List<BroadcastEntity> broadcasts = broadcastService.getAllBroadcasts();
            List<Map<String, Object>> analyticsData = new ArrayList<>();

            for (BroadcastEntity broadcast : broadcasts) {
                Map<String, Object> broadcastAnalytics = new HashMap<>();

                // Basic information
                broadcastAnalytics.put("id", broadcast.getId());
                broadcastAnalytics.put("title", broadcast.getTitle());
                broadcastAnalytics.put("status", broadcast.getStatus().toString());
                broadcastAnalytics.put("createdBy", broadcast.getCreatedBy().getEmail());
                broadcastAnalytics.put("scheduledStart", broadcast.getScheduledStart());
                broadcastAnalytics.put("actualStart", broadcast.getActualStart());
                broadcastAnalytics.put("actualEnd", broadcast.getActualEnd());

                // Duration calculation
                Long durationMinutes = null;
                if (broadcast.getActualStart() != null && broadcast.getActualEnd() != null) {
                    durationMinutes = java.time.Duration.between(broadcast.getActualStart(), broadcast.getActualEnd()).toMinutes();
                } else if (broadcast.getActualStart() != null && broadcast.getStatus() == BroadcastEntity.BroadcastStatus.LIVE) {
                    durationMinutes = java.time.Duration.between(broadcast.getActualStart(), LocalDateTime.now()).toMinutes();
                }
                broadcastAnalytics.put("durationMinutes", durationMinutes);

                // Interaction counts
                int chatMessages = broadcast.getChatMessages() != null ? broadcast.getChatMessages().size() : 0;
                int songRequests = broadcast.getSongRequests() != null ? broadcast.getSongRequests().size() : 0;
                broadcastAnalytics.put("totalInteractions", chatMessages + songRequests);
                broadcastAnalytics.put("totalChatMessages", chatMessages);
                broadcastAnalytics.put("totalSongRequests", songRequests);

                analyticsData.add(broadcastAnalytics);
            }

            return ResponseEntity.ok(analyticsData);

        } catch (Exception e) {
            logger.error("Error getting all broadcast analytics: ", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get comprehensive analytics summary including real-time data
     */
    @GetMapping("/summary")
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getAnalyticsSummary() {
        return ResponseEntity.ok(analyticsService.getAnalyticsSummary());
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

    /**
     * Helper method to determine age group from birthdate
     */
    private String getAgeGroup(LocalDate birthdate, LocalDate today) {
        if (birthdate == null) {
            return "unknown";
        }

        int age = Period.between(birthdate, today).getYears();

        if (age >= 13 && age <= 19) {
            return "teens";
        } else if (age >= 20 && age <= 29) {
            return "youngAdults";
        } else if (age >= 30 && age <= 49) {
            return "adults";
        } else if (age >= 50 && age <= 64) {
            return "middleAged";
        } else if (age >= 65) {
            return "seniors";
        } else {
            return "unknown";
        }
    }

    /**
     * Helper method to extract keywords from broadcast titles for topic analysis
     */
    private String[] extractKeywords(String title) {
        if (title == null || title.trim().isEmpty()) {
            return new String[]{"untitled"};
        }

        // Simple keyword extraction - normalize and split
        String normalized = title.toLowerCase()
            .replaceAll("[^a-zA-Z0-9\\s]", "") // Remove special characters
            .replaceAll("\\s+", " ") // Normalize whitespace
            .trim();

        // Common stop words to filter out
        String[] stopWords = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "is", "are", "was", "were", "be", "been", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "can", "this", "that", "these", "those"};

        String[] words = normalized.split("\\s+");
        List<String> keywords = new ArrayList<>();

        for (String word : words) {
            if (word.length() >= 3) { // Only consider words with 3+ characters
                boolean isStopWord = false;
                for (String stopWord : stopWords) {
                    if (word.equals(stopWord)) {
                        isStopWord = true;
                        break;
                    }
                }
                if (!isStopWord) {
                    keywords.add(word);
                }
            }
        }

        // If no keywords found, use the full title as a single keyword
        if (keywords.isEmpty()) {
            keywords.add(normalized.isEmpty() ? "untitled" : normalized);
        }

        return keywords.toArray(new String[0]);
    }
} 
