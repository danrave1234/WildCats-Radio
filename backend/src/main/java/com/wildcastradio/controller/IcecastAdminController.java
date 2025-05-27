package com.wildcastradio.controller;

import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.wildcastradio.icecast.IcecastService;

/**
 * REST Controller for Icecast administration and monitoring.
 * Provides endpoints to check Google Cloud Icecast server status and configuration.
 */
@RestController
@RequestMapping("/api/icecast")
@CrossOrigin(origins = "*")
public class IcecastAdminController {
    private static final Logger logger = LoggerFactory.getLogger(IcecastAdminController.class);

    @Autowired
    private IcecastService icecastService;

    /**
     * Check if Google Cloud Icecast server is running and accessible
     */
    @GetMapping("/server-status")
    public ResponseEntity<Map<String, Object>> getServerStatus() {
        try {
            boolean isServerUp = icecastService.isServerUp();
            boolean isStreamLive = icecastService.isStreamLive();
            Integer listenerCount = icecastService.getCurrentListenerCount();
            boolean hasActiveBroadcasts = icecastService.isAnyBroadcastActive();

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("serverUp", isServerUp);
            response.put("streamLive", isStreamLive);
            response.put("listenerCount", listenerCount != null ? listenerCount : 0);
            response.put("activeBroadcasts", hasActiveBroadcasts);
            response.put("icecastUrl", icecastService.getIcecastUrl());
            response.put("streamUrl", icecastService.getStreamUrl());
            response.put("timestamp", System.currentTimeMillis());

            logger.info("Icecast server status check - Up: {}, Live: {}, Listeners: {}", 
                       isServerUp, isStreamLive, listenerCount);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("Error checking Icecast server status", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "Failed to check server status: " + e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }

    /**
     * Get comprehensive streaming configuration information
     */
    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getStreamingConfig() {
        try {
            Map<String, Object> config = icecastService.getStreamConfig();
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("config", config);
            response.put("timestamp", System.currentTimeMillis());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("Error getting streaming configuration", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "Failed to get configuration: " + e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }

    /**
     * Get all WebSocket URLs for different purposes
     */
    @GetMapping("/websocket-urls")
    public ResponseEntity<Map<String, Object>> getAllWebSocketUrls() {
        try {
            String djWebSocketUrl = icecastService.getWebSocketUrl();
            String listenerWebSocketUrl = icecastService.getListenerWebSocketUrl();

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("djWebSocketUrl", djWebSocketUrl);
            response.put("listenerWebSocketUrl", listenerWebSocketUrl);
            response.put("timestamp", System.currentTimeMillis());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("Error getting WebSocket URLs", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "Failed to get WebSocket URLs: " + e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }

    /**
     * Health check endpoint specifically for Google Cloud Icecast connectivity
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        try {
            boolean serverAccessible = icecastService.checkIcecastServer();
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("status", serverAccessible ? "UP" : "DOWN");
            response.put("icecastAccessible", serverAccessible);
            response.put("message", serverAccessible ? 
                "Google Cloud Icecast server is accessible" : 
                "Google Cloud Icecast server is not accessible");
            response.put("timestamp", System.currentTimeMillis());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("Health check failed", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("status", "ERROR");
            errorResponse.put("error", "Health check failed: " + e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }
} 