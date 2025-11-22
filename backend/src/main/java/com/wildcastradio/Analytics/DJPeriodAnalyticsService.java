package com.wildcastradio.Analytics;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.Broadcast.BroadcastRepository;
import com.wildcastradio.ChatMessage.ChatMessageEntity;
import com.wildcastradio.ChatMessage.ChatMessageRepository;
import com.wildcastradio.DJHandover.DJHandoverEntity;
import com.wildcastradio.DJHandover.DJHandoverRepository;
import com.wildcastradio.SongRequest.SongRequestEntity;
import com.wildcastradio.SongRequest.SongRequestRepository;
import com.wildcastradio.User.UserEntity;

/**
 * Service for calculating time-based analytics attribution per DJ period
 */
@Service
public class DJPeriodAnalyticsService {

    @Autowired
    private DJHandoverRepository handoverRepository;

    @Autowired
    private BroadcastRepository broadcastRepository;

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Autowired
    private SongRequestRepository songRequestRepository;

    /**
     * Represents a time period when a DJ was active
     */
    public static class TimePeriod {
        private LocalDateTime startTime;
        private LocalDateTime endTime;
        private UserEntity dj;

        public TimePeriod(LocalDateTime startTime, LocalDateTime endTime, UserEntity dj) {
            this.startTime = startTime;
            this.endTime = endTime;
            this.dj = dj;
        }

        public LocalDateTime getStartTime() { return startTime; }
        public LocalDateTime getEndTime() { return endTime; }
        public UserEntity getDJ() { return dj; }
        public long getDurationMinutes() {
            if (startTime == null || endTime == null) return 0;
            return Duration.between(startTime, endTime).toMinutes();
        }
    }

    /**
     * Get all DJ periods for a broadcast
     * 
     * @param broadcastId The broadcast ID
     * @return List of time periods per DJ
     */
    public List<TimePeriod> getDJPeriodsForBroadcast(Long broadcastId) {
        BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
                .orElseThrow(() -> new IllegalArgumentException("Broadcast not found"));

        if (broadcast.getActualStart() == null) {
            return new ArrayList<>();
        }

        List<DJHandoverEntity> handovers = handoverRepository
                .findByBroadcast_IdOrderByHandoverTimeAsc(broadcastId);

        List<TimePeriod> periods = new ArrayList<>();
        LocalDateTime broadcastStart = broadcast.getActualStart();
        LocalDateTime broadcastEnd = broadcast.getActualEnd() != null ? 
                broadcast.getActualEnd() : LocalDateTime.now();

        // Start with the initial DJ (startedBy or currentActiveDJ)
        UserEntity currentDJ = broadcast.getCurrentActiveDJ() != null ? 
                broadcast.getCurrentActiveDJ() : broadcast.getStartedBy();

        if (currentDJ == null) {
            currentDJ = broadcast.getCreatedBy();
        }

        LocalDateTime periodStart = broadcastStart;

        // Process each handover to create periods
        for (DJHandoverEntity handover : handovers) {
            // Close previous period
            if (currentDJ != null && periodStart != null) {
                periods.add(new TimePeriod(periodStart, handover.getHandoverTime(), currentDJ));
            }

            // Start new period
            currentDJ = handover.getNewDJ();
            periodStart = handover.getHandoverTime();
        }

        // Close final period
        if (currentDJ != null && periodStart != null) {
            periods.add(new TimePeriod(periodStart, broadcastEnd, currentDJ));
        }

        return periods;
    }

    /**
     * Get chat message counts per DJ for a broadcast
     * 
     * @param broadcastId The broadcast ID
     * @return Map of DJ ID to message count
     */
    public Map<Long, Long> getChatMessageCountsPerDJ(Long broadcastId) {
        List<TimePeriod> periods = getDJPeriodsForBroadcast(broadcastId);
        Map<Long, Long> messageCounts = new HashMap<>();

        // Get all chat messages for the broadcast
        List<ChatMessageEntity> messages = chatMessageRepository
                .findByBroadcast_IdOrderByCreatedAtAsc(broadcastId);

        // Attribute messages to DJs based on time periods
        for (ChatMessageEntity message : messages) {
            Long djId = getActiveDJAtTime(broadcastId, message.getCreatedAt(), periods);
            if (djId != null) {
                messageCounts.put(djId, messageCounts.getOrDefault(djId, 0L) + 1);
            }
        }

        return messageCounts;
    }

    /**
     * Get song request counts per DJ for a broadcast
     * 
     * @param broadcastId The broadcast ID
     * @return Map of DJ ID to request count
     */
    public Map<Long, Long> getSongRequestCountsPerDJ(Long broadcastId) {
        List<TimePeriod> periods = getDJPeriodsForBroadcast(broadcastId);
        Map<Long, Long> requestCounts = new HashMap<>();

        // Get all song requests for the broadcast
        List<SongRequestEntity> requests = songRequestRepository
                .findByBroadcast(broadcastRepository.findById(broadcastId).orElse(null));

        // Attribute requests to DJs based on time periods
        for (SongRequestEntity request : requests) {
            Long djId = getActiveDJAtTime(broadcastId, request.getTimestamp(), periods);
            if (djId != null) {
                requestCounts.put(djId, requestCounts.getOrDefault(djId, 0L) + 1);
            }
        }

        return requestCounts;
    }

    /**
     * Get the active DJ at a specific time
     * 
     * @param broadcastId The broadcast ID
     * @param timestamp The timestamp to check
     * @param periods Pre-computed periods (optional, will compute if null)
     * @return DJ ID, or null if none
     */
    public Long getActiveDJAtTime(Long broadcastId, LocalDateTime timestamp, List<TimePeriod> periods) {
        if (periods == null) {
            periods = getDJPeriodsForBroadcast(broadcastId);
        }

        for (TimePeriod period : periods) {
            if (timestamp.isAfter(period.getStartTime()) && 
                (period.getEndTime() == null || timestamp.isBefore(period.getEndTime()) || timestamp.isEqual(period.getEndTime()))) {
                return period.getDJ().getId();
            }
        }

        return null;
    }

    /**
     * Get analytics breakdown per DJ period for a broadcast
     * 
     * @param broadcastId The broadcast ID
     * @return Map containing DJ period analytics
     */
    public Map<String, Object> getDJPeriodAnalytics(Long broadcastId) {
        List<TimePeriod> periods = getDJPeriodsForBroadcast(broadcastId);
        Map<Long, Long> chatCounts = getChatMessageCountsPerDJ(broadcastId);
        Map<Long, Long> requestCounts = getSongRequestCountsPerDJ(broadcastId);

        List<Map<String, Object>> djPeriods = periods.stream()
                .map(period -> {
                    Map<String, Object> periodData = new HashMap<>();
                    periodData.put("djId", period.getDJ().getId());
                    periodData.put("djName", period.getDJ().getFullName());
                    periodData.put("djEmail", period.getDJ().getEmail());
                    periodData.put("startTime", period.getStartTime());
                    periodData.put("endTime", period.getEndTime());
                    periodData.put("durationMinutes", period.getDurationMinutes());
                    periodData.put("chatMessages", chatCounts.getOrDefault(period.getDJ().getId(), 0L));
                    periodData.put("songRequests", requestCounts.getOrDefault(period.getDJ().getId(), 0L));
                    
                    // Calculate engagement rate (messages + requests per minute)
                    long totalEngagement = chatCounts.getOrDefault(period.getDJ().getId(), 0L) + 
                                          requestCounts.getOrDefault(period.getDJ().getId(), 0L);
                    double durationMinutes = period.getDurationMinutes();
                    double engagementRate = durationMinutes > 0 ? totalEngagement / durationMinutes : 0.0;
                    periodData.put("engagementRate", engagementRate);
                    
                    return periodData;
                })
                .collect(Collectors.toList());

        Map<String, Object> result = new HashMap<>();
        result.put("broadcastId", broadcastId);
        result.put("djPeriods", djPeriods);
        return result;
    }
}

