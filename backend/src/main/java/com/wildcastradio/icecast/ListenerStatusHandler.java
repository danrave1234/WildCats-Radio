package com.wildcastradio.icecast;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

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

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wildcastradio.Broadcast.BroadcastService;
import com.wildcastradio.User.UserService;
import com.wildcastradio.config.JwtUtil;
import com.wildcastradio.Analytics.ListenerTrackingService;

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
    private final Map<String, Object> sessionLocks = new ConcurrentHashMap<>(); // Per-session send locks to prevent concurrent writes
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
    private final AtomicBoolean isBroadcasting = new AtomicBoolean(false);

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private UserService userService;

    @Autowired
    private BroadcastService broadcastService;

    @Autowired
    private ListenerTrackingService listenerTrackingService;

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

        try {
            // Extract and validate JWT token from URL parameters
            String username = extractAndValidateToken(session);
            if (username != null) {
                sessionToUser.put(session.getId(), username);
                logger.info("Authenticated user '{}' connected to listener WebSocket: {}", username, session.getId());
            } else {
                logger.info("Anonymous user connected to listener WebSocket: {}", session.getId());
            }

            listenerSessions.put(session.getId(), session);
            // Initialize per-session lock
            sessionLocks.put(session.getId(), new Object());

            // Send initial status immediately
            sendStatusToSession(session);
        } catch (Exception e) {
            logger.error("Error during WebSocket connection establishment for session {}: {}", 
                        session.getId(), e.getMessage(), e);
            // Clean up any partial session data
            listenerSessions.remove(session.getId());
            activeListeners.remove(session.getId());
            sessionToUser.remove(session.getId());
            // Rethrow to let Spring WebSocket framework handle the connection failure
            throw e;
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String username = sessionToUser.get(session.getId());
        logger.info("Listener WebSocket connection closed: {} (user: {}) with status: {}", 
                   session.getId(), username != null ? username : "anonymous", status);

        listenerSessions.remove(session.getId());
        activeListeners.remove(session.getId());
        sessionToUser.remove(session.getId());
        sessionLocks.remove(session.getId());
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        String username = sessionToUser.get(session.getId());
        // Downgrade common disconnect errors to WARN to reduce log noise
        boolean isExpectedDisconnect = exception instanceof java.io.IOException
                || exception instanceof java.nio.channels.ClosedChannelException
                || (exception.getCause() instanceof java.io.IOException);
        if (isExpectedDisconnect) {
            logger.warn("Transport error in listener WebSocket session: {} (user: {}) - {}",
                    session.getId(), username != null ? username : "anonymous",
                    exception.getMessage());
        } else {
            logger.error("Transport error in listener WebSocket session: {} (user: {})",
                    session.getId(), username != null ? username : "anonymous", exception);
        }

        listenerSessions.remove(session.getId());
        activeListeners.remove(session.getId());
        sessionToUser.remove(session.getId());
        sessionLocks.remove(session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        try {
            String payload = message.getPayload();
            String trimmed = payload != null ? payload.trim() : "";

            // Gracefully handle non-JSON keepalive messages sent by some clients
            if (trimmed.isEmpty()) {
                return; // ignore empty payloads
            }
            if ("ping".equalsIgnoreCase(trimmed) || "pong".equalsIgnoreCase(trimmed) || "keepalive".equalsIgnoreCase(trimmed)) {
                // Optionally respond to pings to keep proxies happy
                try {
                    if (session.isOpen() && "ping".equalsIgnoreCase(trimmed)) {
                        Object lock = sessionLocks.computeIfAbsent(session.getId(), id -> new Object());
                        synchronized (lock) {
                            if (session.isOpen()) {
                                session.sendMessage(new TextMessage("pong"));
                            }
                        }
                    }
                } catch (Exception ignored) { }
                return; // do not attempt JSON parsing
            }

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
            // Downgrade to WARN to avoid noisy logs when clients send unexpected payloads
            logger.warn("Error parsing non-JSON message from listener session {}: {}", session.getId(), e.getOriginalMessage());
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
     * Extract JWT token from WebSocket headers and validate it
     * NOTE: URL parameter token extraction has been removed for security reasons
     * to prevent token leakage in logs and referrer headers
     */
    private String extractAndValidateToken(WebSocketSession session) {
        try {
            // Try Authorization header or handshake attribute populated by handshake interceptor
            String authHeader = (String) session.getAttributes().get("Authorization");
            if (authHeader == null && session.getHandshakeHeaders() != null) {
                authHeader = session.getHandshakeHeaders().getFirst("Authorization");
            }
            
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                if (!token.trim().isEmpty()) {
                    logger.debug("Found JWT token in WebSocket Authorization header for session: {}", session.getId());

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

            // If no Authorization header, try to parse JWT from Cookie header
            if (session.getHandshakeHeaders() != null) {
                String cookieHeader = session.getHandshakeHeaders().getFirst("cookie");
                if (cookieHeader != null && !cookieHeader.isBlank()) {
                    String[] cookies = cookieHeader.split("; ");
                    for (String cookieStr : cookies) {
                        if (cookieStr.startsWith("token=")) {
                            String token = cookieStr.substring("token=".length());
                            if (!token.trim().isEmpty()) {
                                try {
                                    String username = jwtUtil.extractUsername(token);
                                    if (username != null) {
                                        UserDetails userDetails = userService.loadUserByUsername(username);
                                        if (jwtUtil.validateToken(token, userDetails)) {
                                            Authentication auth = new UsernamePasswordAuthenticationToken(
                                                    userDetails, null, userDetails.getAuthorities());
                                            SecurityContextHolder.getContext().setAuthentication(auth);
                                            logger.info("Successfully authenticated WebSocket user via cookie: {}", username);
                                            return username;
                                        }
                                    }
                                } catch (Exception e) {
                                    logger.warn("Error validating JWT token from cookie for WebSocket session {}: {}", session.getId(), e.getMessage());
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            logger.warn("Error extracting token from WebSocket headers for session {}: {}", session.getId(), e.getMessage());
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
        if (!isBroadcasting.compareAndSet(false, true)) {
            // Prevent overlapping broadcasts which can cause concurrent writes
            return;
        }
        try {
            // Skip polling if no listeners are connected and no broadcasts are active
            if (listenerSessions.isEmpty() && !icecastService.isAnyBroadcastActive()) {
                logger.debug("Skipping status broadcast - no listeners connected and no active broadcasts");
                return;
            }

            // Suppress warnings if no broadcasts are active to reduce log noise
            boolean logWarnings = icecastService.isAnyBroadcastActive();
            Map<String, Object> streamStatus = icecastService.getStreamStatus(logWarnings);
            Integer listenerCount = icecastService.getCurrentListenerCount(logWarnings);

            Map<String, Object> message = new HashMap<>();
            message.put("type", "STREAM_STATUS");
            message.put("isLive", streamStatus.get("live"));
            message.put("listenerCount", listenerCount != null ? listenerCount : 0);
            try {
                Integer peak = listenerTrackingService.getPeakListenerCount();
                if (peak != null) {
                    message.put("peakListenerCount", peak);
                }
            } catch (Exception ignored) { }
            message.put("timestamp", System.currentTimeMillis());

            // Include current live broadcast id (if any) to let clients switch contexts immediately
            try {
                broadcastService.getCurrentLiveBroadcast().ifPresent(b -> {
                    message.put("broadcastId", b.getId());
                });
            } catch (Exception ignored) { /* keep status resilient */ }

            String jsonMessage = objectMapper.writeValueAsString(message);

            // Send to all connected listener sessions and clean up any closed or error sessions
            listenerSessions.entrySet().removeIf(entry -> {
                String sessionId = entry.getKey();
                WebSocketSession session = entry.getValue();

                // Double-check session open status inside lock due to race conditions
                Object lock = sessionLocks.computeIfAbsent(sessionId, id -> new Object());
                synchronized (lock) {
                    if (session.isOpen()) {
                        try {
                            session.sendMessage(new TextMessage(jsonMessage));
                            return false; // Keep the session
                        } catch (Exception e) {
                            String username = sessionToUser.get(sessionId);
                            logger.warn("Failed to send message to listener session {} (user: {}): {}",
                                    sessionId, username != null ? username : "anonymous", e.getMessage());

                            // Clean up maps for this session
                            activeListeners.remove(sessionId);
                            sessionToUser.remove(sessionId);
                            sessionLocks.remove(sessionId);
                            return true; // Remove the session
                        }
                    } else {
                        // Clean up maps for this closed session
                        activeListeners.remove(sessionId);
                        sessionToUser.remove(sessionId);
                        sessionLocks.remove(sessionId);
                        return true; // Remove closed sessions
                    }
                }
            });

            logger.debug("Broadcasted status to {} listener sessions", listenerSessions.size());

        } catch (Exception e) {
            logger.error("Error broadcasting stream status", e);
        } finally {
            isBroadcasting.set(false);
        }
    }

    /**
     * Send status to a specific session
     */
    private void sendStatusToSession(WebSocketSession session) {
        try {
            // Suppress warnings if no broadcasts are active to reduce log noise
            boolean logWarnings = icecastService.isAnyBroadcastActive();
            Map<String, Object> streamStatus = icecastService.getStreamStatus(logWarnings);
            Integer listenerCount = icecastService.getCurrentListenerCount(logWarnings);

            Map<String, Object> message = new HashMap<>();
            message.put("type", "STREAM_STATUS");
            message.put("isLive", streamStatus.get("live"));
            message.put("listenerCount", listenerCount != null ? listenerCount : 0);
            try {
                Integer peak = listenerTrackingService.getPeakListenerCount();
                if (peak != null) {
                    message.put("peakListenerCount", peak);
                }
            } catch (Exception ignored) { }
            message.put("timestamp", System.currentTimeMillis());

            // Include current live broadcast id (if any)
            try {
                broadcastService.getCurrentLiveBroadcast().ifPresent(b -> {
                    message.put("broadcastId", b.getId());
                });
            } catch (Exception ignored) { }

            String jsonMessage = objectMapper.writeValueAsString(message);

            // Send under per-session lock to avoid concurrent writes
            Object lock = sessionLocks.computeIfAbsent(session.getId(), id -> new Object());
            synchronized (lock) {
                // Check if session is still open before attempting to send
                if (!session.isOpen()) {
                    logger.debug("Not sending status to closed session: {}", session.getId());
                    return;
                }
                try {
                    session.sendMessage(new TextMessage(jsonMessage));
                } catch (Exception e) {
                    logger.warn("Failed to send message to listener session {}: {}",
                            session.getId(), e.getMessage());
                    // Remove the session from our maps since it's likely broken
                    listenerSessions.remove(session.getId());
                    activeListeners.remove(session.getId());
                    sessionToUser.remove(session.getId());
                    sessionLocks.remove(session.getId());
                }
            }
        } catch (Exception e) {
            logger.error("Error sending status to session {}: {}", session.getId(), e.getMessage(), e);
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
