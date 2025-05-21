package com.wildcastradio.ShoutCast;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.Broadcast.BroadcastService;
import com.wildcastradio.config.WebSocketEventListener;

import jakarta.servlet.http.HttpServletRequest;

/**
 * REST controller for audio streaming operations.
 * Provides endpoints for starting and stopping streams,
 * and checking stream status.
 */
@RestController
@RequestMapping("/api/stream")
public class StreamController {

    private static final Logger logger = LoggerFactory.getLogger(StreamController.class);

    @Autowired
    private ShoutcastService shoutcastService;

    @Autowired
    private BroadcastService broadcastService;

    @Autowired
    private AudioStreamHandler audioStreamHandler;

    @Autowired
    private SimpMessagingTemplate simpMessagingTemplate;

    @Autowired
    private WebSocketEventListener webSocketEventListener;

    /**
     * Endpoint to authorize and start a stream.
     * This is called before the DJ's browser establishes a WebSocket connection.
     * 
     * @return A response indicating success or failure
     */
    @PostMapping("/start")
    @PreAuthorize("hasRole('DJ')")
    public ResponseEntity<Map<String, Object>> startStream() {
        logger.info("Stream start requested");

        Map<String, Object> response = new HashMap<>();

        try {
            // Check if the ShoutCast server is accessible
            boolean serverAccessible = shoutcastService.isServerAccessible();

            if (!serverAccessible && !shoutcastService.isInTestMode()) {
                logger.warn("Stream start request denied: ShoutCast server not accessible");
                response.put("success", false);
                response.put("message", "ShoutCast server is not accessible. Please check server status.");
                return ResponseEntity.badRequest().body(response);
            }

            // For now, just return success since authentication is already handled by Spring Security
            // We'll get user info from broadcast service later when needed
            response.put("success", true);
            response.put("message", "Stream authorized successfully");
            response.put("streamUrl", getWebSocketUrl());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error authorizing stream start", e);
            response.put("success", false);
            response.put("message", "Failed to authorize stream: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * Endpoint to stop a stream.
     * Called when the DJ wants to end their broadcast.
     * 
     * @return A response indicating success or failure
     */
    @PostMapping("/stop")
    @PreAuthorize("hasRole('DJ')")
    public ResponseEntity<Map<String, Object>> stopStream() {
        logger.info("Stream stop requested");

        Map<String, Object> response = new HashMap<>();

        try {
            // Find the active broadcast
            List<BroadcastEntity> liveBroadcasts = broadcastService.getLiveBroadcasts();
            BroadcastEntity liveBroadcast = liveBroadcasts.stream()
                .findFirst()
                .orElse(null);

            if (liveBroadcast == null) {
                logger.warn("No active broadcast found");
                response.put("success", false);
                response.put("message", "No active broadcast found");
                return ResponseEntity.badRequest().body(response);
            }

            // End the broadcast using a simplified method that doesn't require user
            // Assuming we have a method that doesn't require user information
            broadcastService.endBroadcast(liveBroadcast.getId());

            logger.info("Broadcast ended: {}", liveBroadcast.getId());
            response.put("success", true);
            response.put("message", "Stream stopped successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error stopping stream", e);
            response.put("success", false);
            response.put("message", "Failed to stop stream: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * Endpoint to check the current status of the stream server.
     * 
     * @return A response with the server status information
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStreamStatus() {
        logger.info("Stream status check requested");

        Map<String, Object> response = new HashMap<>();

        try {
            // Check if the ShoutCast server is accessible
            boolean serverAccessible = shoutcastService.isServerAccessible();
            
            // Log detailed server information regardless of accessibility
            logger.info("ShoutCast server info - URL: {}, Port: {}, Mount: {}, Accessible: {}, TestMode: {}", 
                shoutcastService.getServerUrl(), 
                shoutcastService.getServerPort(),
                shoutcastService.getMountPoint(),
                serverAccessible,
                shoutcastService.isInTestMode());

            // Get any live broadcasts
            List<BroadcastEntity> liveBroadcasts = broadcastService.getLiveBroadcasts();
            boolean hasLiveBroadcast = !liveBroadcasts.isEmpty();
            
            // Add diagnostic info about broadcasts
            if (hasLiveBroadcast) {
                logger.info("Found {} live broadcasts in database", liveBroadcasts.size());
                
                // Check if broadcasts are recent (within last 24 hours)
                BroadcastEntity broadcast = liveBroadcasts.get(0);
                
                if (broadcast.getActualStart() != null) {
                    boolean isRecent = broadcast.getActualStart().isAfter(
                        java.time.LocalDateTime.now().minusHours(24));
                    
                    if (!isRecent) {
                        logger.warn("Live broadcast {} appears to be stale - started at {}", 
                            broadcast.getId(), broadcast.getActualStart());
                    }
                    
                    // Add diagnostic info
                    response.put("broadcastCreatedAt", broadcast.getActualStart());
                    response.put("broadcastIsRecent", isRecent);
                } else {
                    logger.warn("Live broadcast {} has null start time", broadcast.getId());
                    response.put("broadcastHasValidStartTime", false);
                }
            } else {
                logger.info("No live broadcasts found in database");
            }

            // Get broadcasting status from AudioStreamHandler
            boolean isStreaming = audioStreamHandler.isBroadcasting();
            logger.info("Audio streaming active: {}", isStreaming);

            response.put("server", serverAccessible ? "UP" : "DOWN");
            response.put("live", hasLiveBroadcast);
            response.put("streaming", isStreaming);
            
            // Add validation flag to check if all conditions are met
            boolean isStreamActive = serverAccessible && hasLiveBroadcast && isStreaming;
            response.put("isActive", isStreamActive);

            // Add audio levels and broadcast details if available
            if (isStreaming) {
                response.put("broadcastDetails", audioStreamHandler.getBroadcastStatus());
            }

            // Include broadcast info for debugging regardless of active state
            if (hasLiveBroadcast) {
                BroadcastEntity broadcast = liveBroadcasts.get(0);
                Map<String, Object> broadcastInfo = new HashMap<>();
                broadcastInfo.put("id", broadcast.getId());
                broadcastInfo.put("title", broadcast.getTitle());
                broadcastInfo.put("startTime", broadcast.getActualStart());
                broadcastInfo.put("status", broadcast.getStatus().toString());
                
                if (broadcast.getCreatedBy() != null) {
                    broadcastInfo.put("dj", broadcast.getCreatedBy().getName());
                } else {
                    broadcastInfo.put("dj", "Unknown");
                    logger.warn("Broadcast {} has no creator", broadcast.getId());
                }

                response.put("broadcast", broadcastInfo);

                // Generate the stream URL for listeners only if fully active
                if (isStreamActive) {
                    // Format for Shoutcast v2.x with mountpoint is: http://server:port/mountpoint
                    String streamUrl = String.format("http://%s:%s%s", 
                            shoutcastService.getServerUrl(), 
                            shoutcastService.getServerPort(),
                            shoutcastService.getMountPoint());
                    
                    // Add format and authentication parameters if needed
                    // The format and authentication parameters are added by the frontend when connecting
                    logger.info("Generated stream URL for clients: {}", streamUrl);
                    response.put("streamUrl", streamUrl);
    
                    // Also include metadata for the player
                    response.put("metadata", new HashMap<String, String>() {{
                        put("title", broadcast.getTitle());
                        put("artist", "WildCats Radio");
                        put("album", "Live Broadcast");
                    }});
                } else {
                    response.put("streamUrl", null);
                    response.put("streamingDisabledReason", 
                        serverAccessible ? 
                            (isStreaming ? "Unknown reason" : "No DJ connected") :
                            "Server not running");
                }
            } else {
                logger.info("No live broadcasts found");
                // No stream URL is provided when there's no live broadcast
                response.put("streamUrl", null);
            }

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error checking stream status", e);
            
            // Get any live broadcasts even in case of error
            try {
                List<BroadcastEntity> liveBroadcasts = broadcastService.getLiveBroadcasts();
                if (!liveBroadcasts.isEmpty()) {
                    BroadcastEntity broadcast = liveBroadcasts.get(0);
                    Map<String, Object> broadcastInfo = new HashMap<>();
                    broadcastInfo.put("id", broadcast.getId());
                    broadcastInfo.put("title", broadcast.getTitle());
                    broadcastInfo.put("startTime", broadcast.getActualStart());
                    broadcastInfo.put("dj", broadcast.getCreatedBy() != null ? 
                            broadcast.getCreatedBy().getName() : "Unknown");
                    response.put("broadcast", broadcastInfo);
                    
                    // Do NOT include a stream URL on error, client should handle this gracefully
                    response.put("streamUrl", null);
                }
            } catch (Exception broadcastError) {
                logger.error("Error getting broadcast info during error handling", broadcastError);
            }

            response.put("server", "ERROR");
            response.put("live", false);
            response.put("streaming", false);
            response.put("isActive", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(200).body(response);  // Return 200 with error info instead of 500
        }
    }

    /**
     * Endpoint to get detailed diagnostics about the ShoutCast server
     * 
     * @return Detailed server diagnostics
     */
    @GetMapping("/diagnostics")
    public ResponseEntity<Map<String, Object>> getServerDiagnostics() {
        logger.info("ShoutCast server diagnostics requested");

        try {
            // Get detailed diagnostics from the service
            Map<String, Object> diagnostics = shoutcastService.getServerDiagnostics();
            
            // Add broadcast info if available
            try {
                List<BroadcastEntity> liveBroadcasts = broadcastService.getLiveBroadcasts();
                if (!liveBroadcasts.isEmpty()) {
                    Map<String, Object> broadcastInfo = new HashMap<>();
                    BroadcastEntity broadcast = liveBroadcasts.get(0);
                    broadcastInfo.put("id", broadcast.getId());
                    broadcastInfo.put("title", broadcast.getTitle());
                    broadcastInfo.put("startTime", broadcast.getActualStart());
                    broadcastInfo.put("dj", broadcast.getCreatedBy().getName());
                    diagnostics.put("liveBroadcast", broadcastInfo);
                }
            } catch (Exception e) {
                logger.warn("Error getting live broadcast info for diagnostics", e);
            }
            
            // Add streaming status
            diagnostics.put("streaming", audioStreamHandler.isBroadcasting());
            
            // Add additional connection info
            diagnostics.put("clientConnectionUrl", String.format("http://%s:%s%s", 
                    shoutcastService.getServerUrl(), 
                    shoutcastService.getServerPort(),
                    shoutcastService.getMountPoint()));
            
            diagnostics.put("adminUrl", String.format("http://%s:%s/admin.cgi", 
                    shoutcastService.getServerUrl(), 
                    shoutcastService.getServerPort()));
            
            return ResponseEntity.ok(diagnostics);
        } catch (Exception e) {
            logger.error("Error getting server diagnostics", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("status", "ERROR");
            errorResponse.put("error", e.getMessage());
            return ResponseEntity.status(200).body(errorResponse);
        }
    }
    
    /**
     * Endpoint to launch the ShoutCast server (if it's not running)
     * Only works if the server is on the same machine as the application
     * 
     * @return Status of the launch attempt
     */
    @PostMapping("/launch-server")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> launchServer() {
        logger.info("ShoutCast server launch requested");
        Map<String, Object> response = new HashMap<>();
        
        try {
            if (shoutcastService.isServerAccessible()) {
                logger.info("ShoutCast server is already running");
                response.put("success", false);
                response.put("message", "ShoutCast server is already running");
                return ResponseEntity.ok(response);
            }
            
            boolean launched = shoutcastService.launchServer();
            
            if (launched) {
                logger.info("ShoutCast server launched successfully");
                response.put("success", true);
                response.put("message", "ShoutCast server launched successfully");
                return ResponseEntity.ok(response);
            } else {
                logger.warn("Failed to launch ShoutCast server");
                response.put("success", false);
                response.put("message", "Failed to launch ShoutCast server");
                return ResponseEntity.status(500).body(response);
            }
        } catch (Exception e) {
            logger.error("Error launching ShoutCast server", e);
            response.put("success", false);
            response.put("message", "Error launching server: " + e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    /**
     * WebSocket endpoint for receiving audio level check requests
     * 
     * @return Current audio levels
     */
    @MessageMapping("/check-levels")
    @SendTo("/topic/audio-levels")
    public Map<String, Object> checkAudioLevels() {
        try {
            return audioStreamHandler.getBroadcastStatus();
        } catch (Exception e) {
            logger.error("Error getting audio levels", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Failed to get audio levels");
            errorResponse.put("timestamp", System.currentTimeMillis());
            return errorResponse;
        }
    }

    /**
     * Helper method to safely send a message to WebSocket topics
     * 
     * @param topic The topic to send to
     * @param payload The payload to send
     */
    private void safeSendToTopic(String topic, Object payload) {
        try {
            // Assuming you have a SimpMessagingTemplate autowired
            simpMessagingTemplate.convertAndSend(topic, payload);
        } catch (Exception e) {
            logger.warn("Error sending message to topic {}: {}", topic, e.getMessage());
            // Don't rethrow - we want to fail gracefully
        }
    }

    /**
     * Helper method to generate the WebSocket URL for streaming
     * 
     * @return The WebSocket URL to connect to for streaming
     */
    private String getWebSocketUrl() {
        String protocol = "ws";
        // In production with SSL, use wss instead
        // String protocol = "wss";

        String host = shoutcastService.getServerUrl();
        String port = "8080"; // Default Spring Boot port for WebSocket connections

        return String.format("%s://%s:%s/stream", protocol, host, port);
    }

    /**
     * Direct proxy endpoint to stream audio from ShoutCast server
     * This helps bypass CORS issues when accessing the ShoutCast server directly
     * 
     * @param format The format to request (mp3, aac, etc.)
     * @return ResponseEntity with the audio stream
     */
    @GetMapping(value = "/proxy", produces = "audio/mpeg")
    public ResponseEntity<byte[]> proxyShoutcastStream(
            @RequestParam(value = "format", defaultValue = "mp3") String format,
            HttpServletRequest request) {
        
        logger.info("Stream proxy requested, format: {}", format);
        
        try {
            // Check if the ShoutCast server is accessible
            boolean serverAccessible = shoutcastService.isServerAccessible();
            
            if (!serverAccessible && !shoutcastService.isInTestMode()) {
                logger.warn("Stream proxy denied: ShoutCast server not accessible");
                return ResponseEntity.status(503)
                        .header("Content-Type", "text/plain")
                        .body("ShoutCast server is not accessible.".getBytes());
            }
            
            // Build the target URL to the actual ShoutCast server
            String streamUrl = String.format("http://%s:%s%s?pass=%s", 
                    shoutcastService.getServerUrl(), 
                    shoutcastService.getServerPort(),
                    shoutcastService.getMountPoint(),
                    "pass123"); // Use the source password from your configuration
            
            logger.info("Proxying request to ShoutCast server: {}", streamUrl);
            
            // Use RestTemplate to forward the request to ShoutCast
            // Note: For real streaming, this is not efficient and should use
            // a different approach like servlet forwarding or streaming response
            ResponseEntity<byte[]> response = new RestTemplate().getForEntity(streamUrl, byte[].class);
            
            // Create our own response with proper CORS headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("audio/mpeg"));
            
            // Add CORS headers with specific origins instead of wildcard
            headers.add("Access-Control-Allow-Origin", 
                request.getHeader("Origin") != null ? request.getHeader("Origin") : "http://localhost:5173");
            headers.add("Access-Control-Allow-Methods", "GET, OPTIONS");
            headers.add("Access-Control-Allow-Headers", "Origin, Content-Type, Accept");
            headers.add("Access-Control-Allow-Credentials", "true");
            
            // Copy content headers from the ShoutCast response
            if (response.getHeaders().getContentLength() > 0) {
                headers.setContentLength(response.getHeaders().getContentLength());
            }
            
            if (response.getHeaders().getContentType() != null) {
                headers.setContentType(response.getHeaders().getContentType());
            }
            
            // Return our new response with the streaming content
            return new ResponseEntity<>(response.getBody(), headers, response.getStatusCode());
            
        } catch (Exception e) {
            logger.error("Error proxying audio stream: {}", e.getMessage(), e);
            return ResponseEntity.status(500)
                    .header("Content-Type", "text/plain")
                    .header("Access-Control-Allow-Origin", "*")
                    .body(("Error streaming audio: " + e.getMessage()).getBytes());
        }
    }

    /**
     * Endpoint to clean up stale broadcasts that are still in LIVE status
     * but have been running for more than 24 hours
     * 
     * @return Status and counts of cleaned broadcasts
     */
    @PostMapping("/cleanup-stale-broadcasts")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> cleanupStaleStreams() {
        logger.info("Cleanup stale broadcasts requested");
        Map<String, Object> response = new HashMap<>();
        
        try {
            // Get all broadcasts marked as LIVE
            List<BroadcastEntity> liveBroadcasts = broadcastService.getLiveBroadcasts();
            logger.info("Found {} broadcasts marked as LIVE", liveBroadcasts.size());
            
            // Count how many we'll cleanup
            int cleanupCount = 0;
            List<Long> cleanedIds = new ArrayList<>();
            
            // Check each broadcast
            for (BroadcastEntity broadcast : liveBroadcasts) {
                if (broadcast.getActualStart() == null) {
                    logger.warn("Broadcast {} has LIVE status but null start time - forcing cleanup", broadcast.getId());
                    broadcastService.endBroadcast(broadcast.getId());
                    cleanupCount++;
                    cleanedIds.add(broadcast.getId());
                    continue;
                }
                
                // Check if broadcast has been running for more than 24 hours
                boolean isStale = broadcast.getActualStart().isBefore(
                    java.time.LocalDateTime.now().minusHours(24));
                
                if (isStale) {
                    logger.info("Ending stale broadcast {}: started at {}", 
                        broadcast.getId(), broadcast.getActualStart());
                    broadcastService.endBroadcast(broadcast.getId());
                    cleanupCount++;
                    cleanedIds.add(broadcast.getId());
                }
            }
            
            response.put("success", true);
            response.put("totalLiveCount", liveBroadcasts.size());
            response.put("cleanedCount", cleanupCount);
            response.put("cleanedIds", cleanedIds);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error cleaning up stale broadcasts", e);
            response.put("success", false);
            response.put("message", "Error cleaning up: " + e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    /**
     * Endpoint to get information about current WebSocket connections
     * 
     * @return Status and information about WebSocket connections
     */
    @GetMapping("/websocket-diagnostics")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getWebSocketDiagnostics() {
        logger.info("WebSocket diagnostics requested");
        Map<String, Object> response = new HashMap<>();
        
        try {
            // Get WebSocket stats from the event listener
            Map<String, Object> stats = webSocketEventListener.getWebSocketStats();
            response.put("websocketStats", stats);
            
            // Add information about audio streaming
            response.put("audioStreaming", audioStreamHandler.isBroadcasting());
            
            // Get any live broadcasts
            List<BroadcastEntity> liveBroadcasts = broadcastService.getLiveBroadcasts();
            response.put("liveBroadcastCount", liveBroadcasts.size());
            
            if (!liveBroadcasts.isEmpty()) {
                List<Map<String, Object>> broadcastDetails = new ArrayList<>();
                for (BroadcastEntity broadcast : liveBroadcasts) {
                    Map<String, Object> details = new HashMap<>();
                    details.put("id", broadcast.getId());
                    details.put("title", broadcast.getTitle());
                    details.put("startTime", broadcast.getActualStart());
                    details.put("status", broadcast.getStatus().toString());
                    
                    // Check if broadcast is stale (over 24 hours old)
                    boolean isStale = broadcast.getActualStart() != null && 
                        broadcast.getActualStart().isBefore(
                            java.time.LocalDateTime.now().minusHours(24));
                    details.put("isStale", isStale);
                    
                    broadcastDetails.add(details);
                }
                response.put("broadcasts", broadcastDetails);
            }
            
            response.put("success", true);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error getting WebSocket diagnostics", e);
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }
} 
