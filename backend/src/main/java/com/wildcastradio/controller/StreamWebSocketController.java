package com.wildcastradio.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Controller;

import com.wildcastradio.icecast.IcecastService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Controller for broadcasting stream status updates via WebSocket
 */
@Controller
public class StreamWebSocketController {

    private static final Logger logger = LoggerFactory.getLogger(StreamWebSocketController.class);
    private final SimpMessagingTemplate messagingTemplate;
    private final IcecastService icecastService;
    private final AtomicReference<Map<String, Object>> lastStatus = new AtomicReference<>(null);

    @Autowired
    public StreamWebSocketController(SimpMessagingTemplate messagingTemplate, IcecastService icecastService) {
        this.messagingTemplate = messagingTemplate;
        this.icecastService = icecastService;
    }

    /**
     * Check stream status and broadcast updates if changed
     * Runs every 10 seconds
     */
    @Scheduled(fixedRate = 10000)
    public void broadcastStreamStatus() {
        try {
            Map<String, Object> currentStatus = icecastService.getStreamStatus();
            
            // Only broadcast if the status has changed
            if (hasStatusChanged(currentStatus)) {
                messagingTemplate.convertAndSend("/topic/stream/status", currentStatus);
                logger.debug("Broadcasting stream status update: {}", currentStatus);
            }
            
        } catch (Exception e) {
            logger.error("Error broadcasting stream status", e);
            
            // Send error status
            Map<String, Object> errorStatus = new HashMap<>();
            errorStatus.put("error", true);
            errorStatus.put("message", "Error fetching stream status");
            errorStatus.put("server", "DOWN");
            errorStatus.put("live", false);
            messagingTemplate.convertAndSend("/topic/stream/status", errorStatus);
        }
    }
    
    /**
     * Check if the stream status has changed significantly
     * @param currentStatus Current status map
     * @return true if status has changed or is null
     */
    private boolean hasStatusChanged(Map<String, Object> currentStatus) {
        Map<String, Object> previousStatus = lastStatus.get();
        
        // First status update
        if (previousStatus == null) {
            lastStatus.set(new HashMap<>(currentStatus));
            return true;
        }
        
        // Check for significant changes
        boolean changed = !currentStatus.getOrDefault("server", "DOWN").equals(previousStatus.getOrDefault("server", "DOWN"))
                || !currentStatus.getOrDefault("live", false).equals(previousStatus.getOrDefault("live", false))
                || !currentStatus.getOrDefault("activeBroadcasts", 0).equals(previousStatus.getOrDefault("activeBroadcasts", 0));
        
        if (changed) {
            lastStatus.set(new HashMap<>(currentStatus));
        }
        
        return changed;
    }
} 