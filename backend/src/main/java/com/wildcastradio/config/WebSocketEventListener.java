package com.wildcastradio.config;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;
import org.springframework.web.socket.messaging.SessionUnsubscribeEvent;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

/**
 * Event listener to handle WebSocket events such as connect, disconnect, subscribe and unsubscribe.
 * Includes session tracking and health monitoring.
 */
@Component
public class WebSocketEventListener {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketEventListener.class);

    @Autowired
    private SimpMessageSendingOperations messagingTemplate;
    
    // Track active sessions with timestamps to monitor health
    private final Map<String, SessionInfo> activeSessions = new ConcurrentHashMap<>();
    // Track topic subscriptions by session ID
    private final Map<String, Set<String>> sessionSubscriptions = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    
    /**
     * Class to store information about a WebSocket session
     */
    private static class SessionInfo {
        final long connectedAt;
        String lastAction;
        long lastActivityTime;
        
        SessionInfo(String action) {
            this.connectedAt = System.currentTimeMillis();
            this.lastAction = action;
            this.lastActivityTime = this.connectedAt;
        }
        
        void updateActivity(String action) {
            this.lastAction = action;
            this.lastActivityTime = System.currentTimeMillis();
        }
    }
    
    @PostConstruct
    public void init() {
        // Schedule periodic health check for WebSocket sessions
        scheduler.scheduleAtFixedRate(this::checkSessionsHealth, 30, 30, TimeUnit.SECONDS);
        logger.info("WebSocket session health monitoring initialized");
    }
    
    @PreDestroy
    public void cleanup() {
        scheduler.shutdown();
        try {
            if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
        }
        
        logger.info("WebSocket session health monitoring shutdown");
    }
    
    /**
     * Check the health of all active WebSocket sessions
     */
    private void checkSessionsHealth() {
        try {
            long now = System.currentTimeMillis();
            int sessionCount = activeSessions.size();
            
            if (sessionCount > 0) {
                logger.debug("Active WebSocket sessions: {}", sessionCount);
                
                // Log sessions that haven't had activity in more than 5 minutes
                activeSessions.forEach((sessionId, info) -> {
                    long inactiveMs = now - info.lastActivityTime;
                    if (inactiveMs > 5 * 60 * 1000) { // 5 minutes
                        logger.warn("Session {} inactive for {} seconds. Last action: {}", 
                            sessionId, inactiveMs/1000, info.lastAction);
                    }
                });
            }
        } catch (Exception e) {
            logger.error("Error during session health check", e);
        }
    }

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();
        
        if (sessionId != null) {
            logger.info("New WebSocket connection established: {}", sessionId);
            activeSessions.put(sessionId, new SessionInfo("CONNECTED"));
            sessionSubscriptions.put(sessionId, new HashSet<>());
        }
    }
    
    @EventListener
    public void handleWebSocketSubscribeListener(SessionSubscribeEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();
        String destination = headerAccessor.getDestination();
        
        if (sessionId != null && destination != null) {
            logger.debug("WebSocket subscription to {}: {}", destination, sessionId);
            
            // Update existing session or create new one
            activeSessions.compute(sessionId, (id, info) -> {
                if (info == null) {
                    logger.warn("Session {} subscribed without prior CONNECT event", sessionId);
                    return new SessionInfo("SUBSCRIBED:" + destination);
                } else {
                    info.updateActivity("SUBSCRIBED:" + destination);
                    return info;
                }
            });
            
            // Track this subscription
            sessionSubscriptions.computeIfAbsent(sessionId, k -> new HashSet<>()).add(destination);
        }
    }
    
    @EventListener
    public void handleWebSocketUnsubscribeListener(SessionUnsubscribeEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();
        String destination = headerAccessor.getDestination();
        
        if (sessionId != null) {
            logger.debug("WebSocket unsubscribe: {}", sessionId);
            
            // Update session activity
            activeSessions.computeIfPresent(sessionId, (id, info) -> {
                info.updateActivity("UNSUBSCRIBED");
                return info;
            });
            
            // Remove from subscription tracking if destination is provided
            if (destination != null && sessionSubscriptions.containsKey(sessionId)) {
                sessionSubscriptions.get(sessionId).remove(destination);
            }
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();
        
        if (sessionId != null) {
            CloseStatus closeStatus = event.getCloseStatus();
            logger.info("WebSocket connection disconnected: {}", sessionId);
            
            // Log detailed information about the disconnection
            if (closeStatus != null) {
                logger.debug("Disconnect reason: {}, code: {}", 
                    closeStatus.getReason(), closeStatus.getCode());
            }
            
            try {
                // Get subscriptions before removing
                Set<String> subscriptions = sessionSubscriptions.get(sessionId);
                
                // Clean up resources
                activeSessions.remove(sessionId);
                sessionSubscriptions.remove(sessionId);
                
                // Safely handle any lingering messages
                if (subscriptions != null) {
                    for (String destination : subscriptions) {
                        // Optionally notify other systems about this disconnection
                        // This is a safer approach than relying on SubProtocolWebSocketHandler's
                        // afterSessionEnded which can cause MessageDeliveryException
                        logger.debug("Cleaning up subscription for session {}: {}", sessionId, destination);
                    }
                }
            } catch (Exception e) {
                logger.error("Error handling WebSocket disconnect event", e);
            }
        }
    }
    
    /**
     * Safely send a message to a topic, handling common exceptions gracefully
     * 
     * @param destination The destination topic
     * @param payload The message payload
     * @return true if message was sent successfully, false otherwise
     */
    public boolean safeSendMessage(String destination, Object payload) {
        try {
            // Create a message with broadcast session ID to avoid "Could not find session id" errors
            SimpMessageHeaderAccessor headerAccessor = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
            headerAccessor.setLeaveMutable(true);
            headerAccessor.setSessionId("broadcast-" + System.currentTimeMillis());
            
            messagingTemplate.convertAndSendToUser(
                headerAccessor.getSessionId(),
                destination,
                payload,
                headerAccessor.getMessageHeaders());
            
            return true;
        } catch (MessageDeliveryException e) {
            // This happens when trying to send to a client that has disconnected
            logger.warn("Failed to deliver message to {}: {}", destination, e.getMessage());
            return false;
        } catch (MessagingException e) {
            // More general messaging exception
            logger.warn("Messaging error while sending to {}: {}", destination, e.getMessage());
            return false;
        } catch (Exception e) {
            // Catch any other unexpected errors
            logger.error("Unexpected error sending message to {}", destination, e);
            return false;
        }
    }
    
    /**
     * Check if a session is still connected
     * 
     * @param sessionId The session ID to check
     * @return true if the session is active, false otherwise
     */
    public boolean isSessionActive(String sessionId) {
        return sessionId != null && activeSessions.containsKey(sessionId);
    }
    
    /**
     * Get a snapshot of current WebSocket connection status for diagnostics
     * 
     * @return Map with diagnostic information
     */
    public Map<String, Object> getWebSocketStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("activeSessionCount", activeSessions.size());
        stats.put("sessionIds", new HashSet<>(activeSessions.keySet()));
        
        // Add more detailed statistics for monitoring
        long now = System.currentTimeMillis();
        List<Map<String, Object>> sessionDetails = new ArrayList<>();
        
        activeSessions.forEach((id, info) -> {
            Map<String, Object> sessionInfo = new HashMap<>();
            sessionInfo.put("sessionId", id);
            sessionInfo.put("connectedSince", new Date(info.connectedAt));
            sessionInfo.put("lastAction", info.lastAction);
            sessionInfo.put("lastActivity", new Date(info.lastActivityTime));
            sessionInfo.put("inactiveSecs", (now - info.lastActivityTime) / 1000);
            
            // Add subscription information
            Set<String> subscriptions = sessionSubscriptions.getOrDefault(id, new HashSet<>());
            sessionInfo.put("subscriptions", subscriptions);
            sessionInfo.put("subscriptionCount", subscriptions.size());
            
            sessionDetails.add(sessionInfo);
        });
        
        stats.put("sessionDetails", sessionDetails);
        return stats;
    }
} 