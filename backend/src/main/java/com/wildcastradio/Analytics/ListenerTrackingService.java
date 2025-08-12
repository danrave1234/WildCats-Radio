package com.wildcastradio.Analytics;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.wildcastradio.icecast.IcecastService;

/**
 * Service for tracking real-time listener counts and metrics
 * Integrates with IcecastService to provide consistent, cached listener data
 */
@Service
public class ListenerTrackingService {

    private static final Logger logger = LoggerFactory.getLogger(ListenerTrackingService.class);

    @Autowired
    private IcecastService icecastService;

    // Cache for real-time metrics to avoid frequent Icecast API calls
    private final Map<String, Object> realtimeMetricsCache = new ConcurrentHashMap<>();
    private long lastUpdateTime = 0;
    private static final long CACHE_DURATION_MS = 10000; // 10 seconds cache

    /**
     * Get current listener count with caching
     * @return Current listener count
     */
    public Integer getCurrentListenerCount() {
        updateCacheIfNeeded();
        return (Integer) realtimeMetricsCache.getOrDefault("listenerCount", 0);
    }

    /**
     * Get comprehensive real-time metrics
     * @return Map containing all real-time metrics
     */
    public Map<String, Object> getRealtimeMetrics() {
        updateCacheIfNeeded();
        return new HashMap<>(realtimeMetricsCache);
    }

    /**
     * Check if stream is currently live
     * @return true if stream is live
     */
    public boolean isStreamLive() {
        updateCacheIfNeeded();
        return (Boolean) realtimeMetricsCache.getOrDefault("isLive", false);
    }

    /**
     * Get stream status information
     * @return Map containing stream status details
     */
    public Map<String, Object> getStreamStatus() {
        updateCacheIfNeeded();
        return (Map<String, Object>) realtimeMetricsCache.getOrDefault("streamStatus", new HashMap<>());
    }

    /**
     * Force refresh of real-time metrics from Icecast
     */
    public void refreshMetrics() {
        try {
            logger.debug("Refreshing real-time metrics from Icecast...");

            // Get listener count from Icecast (suppress warnings for frequent calls)
            Integer listenerCount = icecastService.getCurrentListenerCount(false);

            // Check if stream is live
            boolean isLive = icecastService.isStreamLive(false);

            // Get comprehensive stream status
            Map<String, Object> streamStatus = icecastService.getStreamStatus(false);

            // Update cache
            realtimeMetricsCache.put("listenerCount", listenerCount != null ? listenerCount : 0);
            realtimeMetricsCache.put("isLive", isLive);
            realtimeMetricsCache.put("streamStatus", streamStatus);
            realtimeMetricsCache.put("serverUp", icecastService.isServerUp(false));
            realtimeMetricsCache.put("lastUpdated", System.currentTimeMillis());

            lastUpdateTime = System.currentTimeMillis();

            logger.debug("Real-time metrics updated: listeners={}, live={}", listenerCount, isLive);

        } catch (Exception e) {
            logger.warn("Failed to refresh real-time metrics: {}", e.getMessage());

            // Set default values on error
            realtimeMetricsCache.put("listenerCount", 0);
            realtimeMetricsCache.put("isLive", false);
            realtimeMetricsCache.put("streamStatus", new HashMap<>());
            realtimeMetricsCache.put("serverUp", false);
            realtimeMetricsCache.put("lastUpdated", System.currentTimeMillis());
            realtimeMetricsCache.put("error", e.getMessage());
        }
    }

    /**
     * Update cache if it's stale
     */
    private void updateCacheIfNeeded() {
        long currentTime = System.currentTimeMillis();
        if (currentTime - lastUpdateTime > CACHE_DURATION_MS || realtimeMetricsCache.isEmpty()) {
            refreshMetrics();
        }
    }

    /**
     * Scheduled task to periodically refresh metrics
     * Runs every 15 seconds to keep data fresh
     */
    @Scheduled(fixedRate = 15000)
    public void scheduledMetricsRefresh() {
        refreshMetrics();
    }

    /**
     * Get metrics for analytics dashboard
     * @return Map containing metrics formatted for analytics
     */
    public Map<String, Object> getAnalyticsMetrics() {
        Map<String, Object> metrics = getRealtimeMetrics();
        Map<String, Object> analyticsMetrics = new HashMap<>();

        analyticsMetrics.put("currentListeners", metrics.getOrDefault("listenerCount", 0));
        analyticsMetrics.put("streamLive", metrics.getOrDefault("isLive", false));
        analyticsMetrics.put("serverStatus", ((Boolean) metrics.getOrDefault("serverUp", false)) ? "UP" : "DOWN");
        analyticsMetrics.put("lastUpdated", metrics.getOrDefault("lastUpdated", System.currentTimeMillis()));

        // Add stream quality metrics if available
        Map<String, Object> streamStatus = (Map<String, Object>) metrics.getOrDefault("streamStatus", new HashMap<>());
        if (!streamStatus.isEmpty()) {
            analyticsMetrics.put("streamQuality", streamStatus);
        }

        return analyticsMetrics;
    }

    /**
     * Record listener join event (for future historical tracking)
     * @param broadcastId The broadcast ID
     * @param userId The user ID (can be null for anonymous)
     */
    public void recordListenerJoin(Long broadcastId, Long userId) {
        logger.debug("Listener joined broadcast {}: user {}", broadcastId, userId != null ? userId : "anonymous");
        // Future: Store in database for historical analytics
        // For now, just trigger a metrics refresh to get updated count
        refreshMetrics();
    }

    /**
     * Record listener leave event (for future historical tracking)
     * @param broadcastId The broadcast ID
     * @param userId The user ID (can be null for anonymous)
     */
    public void recordListenerLeave(Long broadcastId, Long userId) {
        logger.debug("Listener left broadcast {}: user {}", broadcastId, userId != null ? userId : "anonymous");
        // Future: Store in database for historical analytics
        // For now, just trigger a metrics refresh to get updated count
        refreshMetrics();
    }
}
