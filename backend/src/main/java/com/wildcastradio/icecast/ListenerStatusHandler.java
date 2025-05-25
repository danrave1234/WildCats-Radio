package com.wildcastradio.icecast;

import java.io.IOException;
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
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * WebSocket handler for broadcasting stream status updates to listeners.
 * Provides real-time updates about stream status and listener count.
 */
@Component
public class ListenerStatusHandler extends TextWebSocketHandler {
    private static final Logger logger = LoggerFactory.getLogger(ListenerStatusHandler.class);

    private final IcecastService icecastService;
    private final ObjectMapper objectMapper;
    private final Map<String, WebSocketSession> listenerSessions = new ConcurrentHashMap<>();
    private final Map<String, Boolean> activeListeners = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);

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
        listenerSessions.put(session.getId(), session);

        // Send initial status immediately
        sendStatusToSession(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        logger.info("Listener WebSocket connection closed: {} with status: {}", session.getId(), status);
        listenerSessions.remove(session.getId());
        activeListeners.remove(session.getId());
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        logger.error("Transport error in listener WebSocket session: {}", session.getId(), exception);
        listenerSessions.remove(session.getId());
        activeListeners.remove(session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        try {
            String payload = message.getPayload();
            JsonNode jsonNode = objectMapper.readTree(payload);

            if (jsonNode.has("type")) {
                String type = jsonNode.get("type").asText();

                if ("PLAYER_STATUS".equals(type) && jsonNode.has("isPlaying")) {
                    boolean isPlaying = jsonNode.get("isPlaying").asBoolean();
                    String sessionId = session.getId();

                    if (isPlaying) {
                        logger.info("Listener started playing: {}", sessionId);
                        activeListeners.put(sessionId, true);
                    } else {
                        logger.info("Listener stopped playing: {}", sessionId);
                        activeListeners.remove(sessionId);
                    }

                    // Broadcast updated status to all listeners
                    broadcastStatus();
                }
            }
        } catch (JsonProcessingException e) {
            logger.error("Error parsing message from listener: {}", e.getMessage());
        }
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
