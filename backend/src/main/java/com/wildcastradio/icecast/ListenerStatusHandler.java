package com.wildcastradio.icecast;

import java.io.IOException;
import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.util.UriComponentsBuilder;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wildcastradio.User.UserService;
import com.wildcastradio.config.JwtUtil;

/**
 * WebSocket handler for broadcasting stream status updates to listeners.
 * Provides real-time updates about stream status and listener count.
 * Now supports JWT authentication and LISTENER_STATUS message handling.
 */
@Component
public class ListenerStatusHandler extends TextWebSocketHandler {
    private static final Logger logger = LoggerFactory.getLogger(ListenerStatusHandler.class);

    private final IcecastService icecastService;
    private final ObjectMapper objectMapper;
    private final Map<String, WebSocketSession> listenerSessions = new ConcurrentHashMap<>();
    private final Map<String, Boolean> activeListeners = new ConcurrentHashMap<>();
    private final Map<String, String> sessionToUser = new ConcurrentHashMap<>(); // Track authenticated users
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private UserService userService;

    @Autowired
    public ListenerStatusHandler(IcecastService icecastService) {
        this.icecastService = icecastService;
        this.objectMapper = new ObjectMapper();

        // Start periodic status broadcasting
        scheduler.scheduleAtFixedRate(this::broadcastStatus, 0, 5, TimeUnit.SECONDS);
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        logger.info("Listener WebSocket connection established: {}", session.getId());
        
        // Extract and validate JWT token from URL parameters
        String username = extractAndValidateToken(session);
        if (username != null) {
            sessionToUser.put(session.getId(), username);
            logger.info("Authenticated user '{}' connected to listener WebSocket: {}", username, session.getId());
        } else {
            logger.info("Anonymous user connected to listener WebSocket: {}", session.getId());
        }
        
        listenerSessions.put(session.getId(), session);

        // Send initial status immediately
        sendStatusToSession(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String username = sessionToUser.get(session.getId());
        logger.info("Listener WebSocket connection closed: {} (user: {}) with status: {}", 
                   session.getId(), username != null ? username : "anonymous", status);
        
        listenerSessions.remove(session.getId());
        activeListeners.remove(session.getId());
        sessionToUser.remove(session.getId());
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        String username = sessionToUser.get(session.getId());
        logger.error("Transport error in listener WebSocket session: {} (user: {})", 
                    session.getId(), username != null ? username : "anonymous", exception);
        
        listenerSessions.remove(session.getId());
        activeListeners.remove(session.getId());
        sessionToUser.remove(session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        try {
            String payload = message.getPayload();
            JsonNode jsonNode = objectMapper.readTree(payload);
            String username = sessionToUser.get(session.getId());

            logger.debug("Received message from session {} (user: {}): {}", 
                        session.getId(), username != null ? username : "anonymous", payload);

            if (jsonNode.has("type")) {
                String type = jsonNode.get("type").asText();

                // Handle both PLAYER_STATUS (legacy) and LISTENER_STATUS (new) messages
                if ("PLAYER_STATUS".equals(type) && jsonNode.has("isPlaying")) {
                    boolean isPlaying = jsonNode.get("isPlaying").asBoolean();
                    handleListenerStatusChange(session, isPlaying, username, "PLAYER_STATUS");
                } else if ("LISTENER_STATUS".equals(type) && jsonNode.has("action")) {
                    String action = jsonNode.get("action").asText();
                    handleListenerAction(session, action, jsonNode, username);
                } else {
                    logger.warn("Unknown message type '{}' or missing required fields from session: {}", type, session.getId());
                }
            } else {
                logger.warn("Message missing 'type' field from session: {}", session.getId());
            }
        } catch (JsonProcessingException e) {
            logger.error("Error parsing message from listener session {}: {}", session.getId(), e.getMessage());
        } catch (Exception e) {
            logger.error("Unexpected error handling message from session {}: {}", session.getId(), e.getMessage(), e);
        }
    }

    /**
     * Handle LISTENER_STATUS action messages
     */
    private void handleListenerAction(WebSocketSession session, String action, JsonNode jsonNode, String username) {
        String sessionId = session.getId();
        
        logger.info("Processing listener action '{}' from session {} (user: {})", action, sessionId, 
                   username != null ? username : "anonymous");

        switch (action) {
            case "START_LISTENING":
                activeListeners.put(sessionId, true);
                logger.info("Listener started playing: {} (user: {})", sessionId, 
                           username != null ? username : "anonymous");
                break;
                
            case "STOP_LISTENING":
                activeListeners.remove(sessionId);
                logger.info("Listener stopped playing: {} (user: {})", sessionId, 
                           username != null ? username : "anonymous");
                break;
                
            case "HEARTBEAT":
                // Just confirm the listener is still active if they're marked as playing
                if (activeListeners.containsKey(sessionId)) {
                    logger.debug("Heartbeat from active listener: {} (user: {})", sessionId, 
                                username != null ? username : "anonymous");
                }
                break;
                
            default:
                logger.warn("Unknown listener action '{}' from session: {}", action, sessionId);
                return;
        }

        // Broadcast updated status to all listeners after any status change
        broadcastStatus();
    }

    /**
     * Handle legacy PLAYER_STATUS messages
     */
    private void handleListenerStatusChange(WebSocketSession session, boolean isPlaying, String username, String messageType) {
        String sessionId = session.getId();

        if (isPlaying) {
            logger.info("Listener started playing ({}): {} (user: {})", messageType, sessionId, 
                       username != null ? username : "anonymous");
            activeListeners.put(sessionId, true);
        } else {
            logger.info("Listener stopped playing ({}): {} (user: {})", messageType, sessionId, 
                       username != null ? username : "anonymous");
            activeListeners.remove(sessionId);
        }

        // Broadcast updated status to all listeners
        broadcastStatus();
    }

    /**
     * Extract JWT token from WebSocket URL parameters and validate it
     */
    private String extractAndValidateToken(WebSocketSession session) {
        try {
            URI uri = session.getUri();
            if (uri != null) {
                String query = uri.getQuery();
                if (query != null && query.contains("token=")) {
                    Map<String, String> params = UriComponentsBuilder.fromUriString("?" + query)
                            .build()
                            .getQueryParams()
                            .toSingleValueMap();
                    
                    String token = params.get("token");
                    if (token != null && !token.trim().isEmpty()) {
                        logger.debug("Found JWT token in WebSocket URL for session: {}", session.getId());
                        
                        try {
                            String username = jwtUtil.extractUsername(token);
                            if (username != null) {
                                UserDetails userDetails = userService.loadUserByUsername(username);
                                if (jwtUtil.validateToken(token, userDetails)) {
                                    // Set authentication context for this session
                                    Authentication auth = new UsernamePasswordAuthenticationToken(
                                            userDetails, null, userDetails.getAuthorities());
                                    SecurityContextHolder.getContext().setAuthentication(auth);
                                    
                                    logger.info("Successfully authenticated WebSocket user: {}", username);
                                    return username;
                                } else {
                                    logger.warn("Invalid JWT token for WebSocket session: {}", session.getId());
                                }
                            } else {
                                logger.warn("Could not extract username from JWT token for session: {}", session.getId());
                            }
                        } catch (Exception e) {
                            logger.warn("Error validating JWT token for WebSocket session {}: {}", session.getId(), e.getMessage());
                        }
                    }
                }
            }
        } catch (Exception e) {
            logger.warn("Error extracting token from WebSocket URL for session {}: {}", session.getId(), e.getMessage());
        }
        
        return null; // No valid authentication
    }

    /**
     * Event listener for stream status changes
     */
    @EventListener
    public void handleStreamStatusChange(StreamStatusChangeEvent event) {
        logger.info("Stream status changed to: {}", event.isLive() ? "LIVE" : "OFFLINE");
        // Trigger immediate status broadcast
        broadcastStatus();
    }

    /**
     * Broadcast current stream status to all connected listeners
     */
    public void broadcastStatus() {
        try {
            Map<String, Object> streamStatus = icecastService.getStreamStatus();
            Integer listenerCount = icecastService.getCurrentListenerCount();

            Map<String, Object> message = new HashMap<>();
            message.put("type", "STREAM_STATUS");
            message.put("isLive", streamStatus.get("live"));
            message.put("listenerCount", listenerCount != null ? listenerCount : 0);
            message.put("timestamp", System.currentTimeMillis());

            String jsonMessage = objectMapper.writeValueAsString(message);

            // Send to all connected listener sessions
            listenerSessions.entrySet().removeIf(entry -> {
                WebSocketSession session = entry.getValue();
                if (session.isOpen()) {
                    try {
                        session.sendMessage(new TextMessage(jsonMessage));
                        return false; // Keep the session
                    } catch (IOException e) {
                        logger.warn("Failed to send message to listener session {}: {}", 
                                  entry.getKey(), e.getMessage());
                        return true; // Remove the session
                    }
                } else {
                    return true; // Remove closed sessions
                }
            });

            logger.debug("Broadcasted status to {} listener sessions", listenerSessions.size());

        } catch (Exception e) {
            logger.error("Error broadcasting stream status", e);
        }
    }

    /**
     * Send status to a specific session
     */
    private void sendStatusToSession(WebSocketSession session) {
        try {
            Map<String, Object> streamStatus = icecastService.getStreamStatus();
            Integer listenerCount = icecastService.getCurrentListenerCount();

            Map<String, Object> message = new HashMap<>();
            message.put("type", "STREAM_STATUS");
            message.put("isLive", streamStatus.get("live"));
            message.put("listenerCount", listenerCount != null ? listenerCount : 0);
            message.put("timestamp", System.currentTimeMillis());

            String jsonMessage = objectMapper.writeValueAsString(message);
            session.sendMessage(new TextMessage(jsonMessage));

        } catch (Exception e) {
            logger.error("Error sending status to session {}: {}", session.getId(), e.getMessage());
        }
    }

    /**
     * Trigger immediate status update (called when broadcast starts/stops)
     */
    public void triggerStatusUpdate() {
        broadcastStatus();
    }

    /**
     * Get number of connected listeners to this status service
     */
    public int getConnectedListenersCount() {
        return listenerSessions.size();
    }

    /**
     * Get number of active listeners (those who are actually playing the stream)
     */
    public int getActiveListenersCount() {
        return activeListeners.size();
    }
} 
