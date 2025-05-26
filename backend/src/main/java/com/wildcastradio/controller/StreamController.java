package com.wildcastradio.controller;

import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.wildcastradio.icecast.IcecastService;
import com.wildcastradio.utils.RateLimitedLogger;

import java.time.Duration;

/**
 * REST controller for stream management and configuration.
 * Provides endpoints for getting stream configuration and status.
 */
@RestController
@RequestMapping("/api/stream")
public class StreamController {
    private static final Logger logger = LoggerFactory.getLogger(StreamController.class);
    
    private final IcecastService icecastService;
    
    @Autowired
    public StreamController(IcecastService icecastService) {
        this.icecastService = icecastService;
    }
    
    /**
     * Get stream configuration including URLs and network settings
     */
    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getStreamConfig() {
        try {
            Map<String, Object> config = icecastService.getStreamConfig();
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", config);
            
            // Use rate-limited logging - only log every 30 seconds
            RateLimitedLogger.info(logger, "stream-config-requested", Duration.ofSeconds(30),
                    "Stream config requested: {}", config);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Error getting stream config", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "Failed to get stream configuration: " + e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }
    
    /**
     * Get current stream status including live status and listener count
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStreamStatus() {
        try {
            Map<String, Object> status = icecastService.getStreamStatus();
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", status);
            response.put("timestamp", System.currentTimeMillis());
            
            // Use rate-limited logging for debug logs as well
            RateLimitedLogger.debug(logger, "stream-status-requested", Duration.ofSeconds(30),
                    "Stream status requested: {}", status);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Error getting stream status", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "Failed to get stream status: " + e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }
    
    /**
     * Simple status endpoint that returns only essential information
     * designed to avoid triggering CORS preflight requests
     */
    @GetMapping("/simple-status")
    public String getSimpleStatus() {
        boolean isLive = icecastService.isStreamLive();
        boolean isUp = icecastService.isServerUp();
        return String.format("%b,%b", isLive, isUp);  // Returns "true,true" or "false,false" etc.
    }
    
    /**
     * Get WebSocket URL for streaming
     */
    @GetMapping("/websocket-url")
    public ResponseEntity<Map<String, Object>> getWebSocketUrl() {
        try {
            String wsUrl = icecastService.getWebSocketUrl();
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("webSocketUrl", wsUrl);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Error getting WebSocket URL", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "Failed to get WebSocket URL: " + e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }
    
    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "UP");
        health.put("icecastServer", icecastService.isServerUp() ? "UP" : "DOWN");
        health.put("streamLive", icecastService.isStreamLive());
        health.put("timestamp", System.currentTimeMillis());
        
        return ResponseEntity.ok(health);
    }
} 