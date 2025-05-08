package com.wildcastradio.ShoutCast;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.Broadcast.BroadcastService;

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
            
            // Get any live broadcasts
            List<BroadcastEntity> liveBroadcasts = broadcastService.getLiveBroadcasts();
            boolean hasLiveBroadcast = !liveBroadcasts.isEmpty();
            
            response.put("server", serverAccessible ? "UP" : "DOWN");
            response.put("live", hasLiveBroadcast);
            
            if (hasLiveBroadcast) {
                BroadcastEntity broadcast = liveBroadcasts.get(0);
                Map<String, Object> broadcastInfo = new HashMap<>();
                broadcastInfo.put("id", broadcast.getId());
                broadcastInfo.put("title", broadcast.getTitle());
                broadcastInfo.put("startTime", broadcast.getActualStart());
                broadcastInfo.put("dj", broadcast.getCreatedBy().getName());
                
                response.put("broadcast", broadcastInfo);
                
                // Generate the stream URL for listeners
                String streamUrl = String.format("http://%s:%s/;stream.mp3", 
                        shoutcastService.getServerUrl(), 
                        shoutcastService.getServerPort());
                response.put("streamUrl", streamUrl);
            }
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error checking stream status", e);
            response.put("server", "ERROR");
            response.put("live", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }
} 