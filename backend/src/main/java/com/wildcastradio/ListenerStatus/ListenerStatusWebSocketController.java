package com.wildcastradio.ListenerStatus;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Controller;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;

import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserService;
import com.wildcastradio.icecast.IcecastService;
import com.wildcastradio.icecast.StreamStatusChangeEvent;
import com.wildcastradio.Broadcast.BroadcastService;
import com.wildcastradio.Analytics.ListenerTrackingService;

import java.util.Map;
import java.util.HashMap;
import java.util.concurrent.ConcurrentHashMap;

/**
 * STOMP WebSocket controller for listener status updates
 * Replaces raw WebSocket ListenerStatusHandler
 * 
 * HARD REFACTOR: This is a breaking change - no backward compatibility with /ws/listener endpoint
 */
@Controller
public class ListenerStatusWebSocketController {
    private static final Logger logger = LoggerFactory.getLogger(ListenerStatusWebSocketController.class);

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private IcecastService icecastService;

    @Autowired
    private BroadcastService broadcastService;

    @Autowired
    private ListenerTrackingService listenerTrackingService;

    @Autowired
    private UserService userService;

    // Track active listener sessions (sessionId -> session info)
    private final Map<String, ListenerSession> activeSessions = new ConcurrentHashMap<>();

    /**
     * Handle listener status messages via STOMP
     * Message destination: /app/listener/status
     */
    @MessageMapping("/listener/status")
    public void handleListenerStatus(
            @Payload ListenerStatusMessage message,
            SimpMessageHeaderAccessor headerAccessor) {
        
        String sessionId = headerAccessor.getSessionId();
        String username = headerAccessor.getUser() != null ? headerAccessor.getUser().getName() : null;
        
        logger.debug("Received listener status message from session {} (user: {}): {}", 
                    sessionId, username, message);

        if (message == null || message.getAction() == null) {
            logger.warn("Invalid listener status message from session {}", sessionId);
            return;
        }

        // Handle different action types
        switch (message.getAction()) {
            case "START_LISTENING":
                handleListenerStart(sessionId, username, message);
                break;
            case "STOP_LISTENING":
                handleListenerStop(sessionId, username);
                break;
            case "PLAYER_STATUS":
                handlePlayerStatus(sessionId, username, message);
                break;
            case "HEARTBEAT":
                handleHeartbeat(sessionId, username);
                break;
            default:
                logger.warn("Unknown listener action: {}", message.getAction());
        }
    }

    private void handleListenerStart(String sessionId, String username, ListenerStatusMessage message) {
        // Record listener join if broadcast ID is provided
        Long broadcastId = message.getBroadcastId();
        if (broadcastId != null) {
            try {
                UserEntity user = null;
                if (username != null) {
                    user = userService.getUserByEmail(username).orElse(null);
                }
                broadcastService.recordListenerJoin(broadcastId, user);
            } catch (Exception e) {
                logger.warn("Error recording listener join for broadcast {}: {}", broadcastId, e.getMessage());
            }
        }

        // Track session
        activeSessions.put(sessionId, new ListenerSession(username, message.getBroadcastId(), true));
        
        logger.info("Listener started: session {} (user: {}, broadcast: {})", 
                   sessionId, username != null ? username : "anonymous", broadcastId);
        
        // Send current status to this listener immediately
        sendStatusToSession(sessionId);
    }

    private void handleListenerStop(String sessionId, String username) {
        ListenerSession session = activeSessions.remove(sessionId);
        if (session != null && session.getBroadcastId() != null) {
            try {
                UserEntity user = null;
                if (username != null) {
                    user = userService.getUserByEmail(username).orElse(null);
                }
                broadcastService.recordListenerLeave(session.getBroadcastId(), user);
            } catch (Exception e) {
                logger.warn("Error recording listener leave for broadcast {}: {}", 
                           session.getBroadcastId(), e.getMessage());
            }
        }
        
        logger.info("Listener stopped: session {} (user: {})", 
                   sessionId, username != null ? username : "anonymous");
    }

    private void handlePlayerStatus(String sessionId, String username, ListenerStatusMessage message) {
        ListenerSession session = activeSessions.get(sessionId);
        if (session != null) {
            session.setPlaying(message.isPlaying() != null ? message.isPlaying() : false);
            logger.debug("Player status updated for session {}: playing={}", sessionId, session.isPlaying());
        }
    }

    private void handleHeartbeat(String sessionId, String username) {
        // Just confirm the listener is still active
        if (activeSessions.containsKey(sessionId)) {
            logger.debug("Heartbeat from active listener: session {} (user: {})", 
                        sessionId, username != null ? username : "anonymous");
        }
    }

    /**
     * Send status update to a specific session via user-specific queue
     */
    private void sendStatusToSession(String sessionId) {
        try {
            Map<String, Object> status = buildStatusMessage();
            messagingTemplate.convertAndSendToUser(sessionId, "/queue/listener-status", status);
        } catch (Exception e) {
            logger.error("Error sending status to session {}", sessionId, e);
        }
    }

    /**
     * Broadcast status updates to all listeners via STOMP topic
     * Runs every 5 seconds (matches previous ListenerStatusHandler behavior)
     */
    @Scheduled(fixedRate = 5000)
    public void broadcastStatus() {
        if (activeSessions.isEmpty()) {
            // Skip if no listeners connected and no active broadcasts
            if (!icecastService.isAnyBroadcastActive()) {
                return;
            }
        }

        try {
            Map<String, Object> status = buildStatusMessage();
            messagingTemplate.convertAndSend("/topic/listener-status", status);
        } catch (Exception e) {
            logger.error("Error broadcasting listener status", e);
        }
    }

    /**
     * Build status message with current stream state
     */
    private Map<String, Object> buildStatusMessage() {
        boolean isLive = icecastService.isStreamLive(false);
        Integer listenerCount = listenerTrackingService.getCurrentListenerCount();
        
        Map<String, Object> message = new HashMap<>();
        message.put("type", "STREAM_STATUS");
        message.put("isLive", isLive);
        message.put("listenerCount", listenerCount != null ? listenerCount : 0);
        message.put("timestamp", System.currentTimeMillis());

        // Include peak listener count if available
        try {
            Integer peak = listenerTrackingService.getPeakListenerCount();
            if (peak != null) {
                message.put("peakListenerCount", peak);
            }
        } catch (Exception e) {
            logger.debug("Could not include peak listener count: {}", e.getMessage());
        }

        // Include current live broadcast id (if any)
        try {
            broadcastService.getCurrentLiveBroadcast().ifPresent(b -> {
                message.put("broadcastId", b.getId());
            });
        } catch (Exception e) {
            logger.debug("Could not include broadcast ID: {}", e.getMessage());
        }

        // Include health data for real-time radio server status updates
        try {
            Map<String, Object> healthStatus = broadcastService.getLiveStreamHealthStatus();
            if (healthStatus != null && !healthStatus.isEmpty()) {
                Map<String, Object> healthData = new HashMap<>();
                healthData.put("healthy", healthStatus.getOrDefault("healthy", false));
                healthData.put("recovering", healthStatus.getOrDefault("recovering", false));
                healthData.put("broadcastLive", healthStatus.getOrDefault("broadcastLive", false));
                healthData.put("serverReachable", healthStatus.getOrDefault("serverReachable", false));
                healthData.put("radioServerState", broadcastService.isRadioServerRunning() ? "running" : "stopped");
                
                Object bitrateObj = healthStatus.get("bitrate");
                if (bitrateObj instanceof Number) {
                    healthData.put("bitrate", ((Number) bitrateObj).intValue());
                }
                
                Object errorMsg = healthStatus.get("errorMessage");
                if (errorMsg != null) {
                    healthData.put("errorMessage", errorMsg);
                }
                
                message.put("health", healthData);
            }
        } catch (Exception e) {
            logger.debug("Could not include health data in status message: {}", e.getMessage());
        }

        return message;
    }

    /**
     * Handle stream status change events (from IcecastService)
     */
    @EventListener
    public void handleStreamStatusChange(StreamStatusChangeEvent event) {
        logger.info("Stream status changed: isLive={}", event.isLive());
        // Trigger immediate status broadcast
        broadcastStatus();
    }

    /**
     * Get number of connected listeners
     */
    public int getConnectedListenersCount() {
        return activeSessions.size();
    }

    /**
     * Get number of active listeners (those who are actually playing the stream)
     */
    public int getActiveListenersCount() {
        return (int) activeSessions.values().stream()
                .filter(ListenerSession::isPlaying)
                .count();
    }

    /**
     * Inner class to track listener sessions
     */
    private static class ListenerSession {
        private final String username;
        private final Long broadcastId;
        private boolean playing;

        public ListenerSession(String username, Long broadcastId, boolean playing) {
            this.username = username;
            this.broadcastId = broadcastId;
            this.playing = playing;
        }

        public String getUsername() { return username; }
        public Long getBroadcastId() { return broadcastId; }
        public boolean isPlaying() { return playing; }
        public void setPlaying(boolean playing) { this.playing = playing; }
    }

    /**
     * DTO for listener status messages
     */
    public static class ListenerStatusMessage {
        private String action; // START_LISTENING, STOP_LISTENING, PLAYER_STATUS, HEARTBEAT
        private Long broadcastId;
        private Boolean isPlaying;
        private Long userId;
        private String userName;

        // Getters and setters
        public String getAction() { return action; }
        public void setAction(String action) { this.action = action; }
        public Long getBroadcastId() { return broadcastId; }
        public void setBroadcastId(Long broadcastId) { this.broadcastId = broadcastId; }
        public Boolean isPlaying() { return isPlaying; }
        public void setIsPlaying(Boolean isPlaying) { this.isPlaying = isPlaying; }
        public Long getUserId() { return userId; }
        public void setUserId(Long userId) { this.userId = userId; }
        public String getUserName() { return userName; }
        public void setUserName(String userName) { this.userName = userName; }
    }
}

