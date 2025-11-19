package com.wildcastradio.controller;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

import com.wildcastradio.icecast.IcecastService;

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

            logger.info("Stream config requested: {}", config);
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

            logger.debug("Stream status requested: {}", status);
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
     * Get WebSocket URLs for streaming and listening
     */
    @GetMapping("/websocket-url")
    public ResponseEntity<Map<String, Object>> getWebSocketUrl() {
        try {
            String djWsUrl = icecastService.getWebSocketUrl();

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("webSocketUrl", djWsUrl);  // For DJ streaming
            // listenerWebSocketUrl removed - listener status now via STOMP /topic/listener-status

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

    @GetMapping("/mount-status")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getMountPointStatus() {
        try {
            Map<String, Object> mountStatus = icecastService.checkMountPointStatus();
            logger.info("Mount point status check: {}", mountStatus);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", mountStatus);
            response.put("timestamp", System.currentTimeMillis());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error checking mount point status", e);

            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "Failed to check mount point status: " + e.getMessage());
            errorResponse.put("timestamp", System.currentTimeMillis());

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    /**
     * CORS test endpoint to validate cross-origin configurations
     */
    @GetMapping("/cors-test")
    public ResponseEntity<Map<String, Object>> corsTest() {
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "CORS is working correctly");
        response.put("timestamp", System.currentTimeMillis());
        response.put("backend", "cloud");

        return ResponseEntity.ok(response);
    }

    @GetMapping("/icecast-test")
    public ResponseEntity<Map<String, Object>> testIcecastConnection() {
        Map<String, Object> result = new HashMap<>();

        // Get Icecast configuration
        String host = icecastService.getIcecastHost();
        int port = icecastService.getIcecastPort();
        String username = icecastService.getIcecastUsername();
        String password = icecastService.getIcecastPassword();
        String mount = icecastService.getIcecastMount();

        Map<String, Object> config = new HashMap<>();
        config.put("host", host);
        config.put("port", port);
        config.put("username", username);
        config.put("password", "***"); // Hide password
        config.put("mount", mount);
        result.put("config", config);

        try {
            // Test basic TCP connectivity
            logger.info("Testing TCP connectivity to {}:{}", host, port);
            java.net.Socket testSocket = new java.net.Socket();
            testSocket.connect(new java.net.InetSocketAddress(host, port), 5000);
            testSocket.close();
            result.put("tcpConnectivity", "SUCCESS");
            logger.info("TCP connectivity test passed");

            // Test HTTP connectivity to Icecast status page
            URL statusUrl = new URL(icecastService.getIcecastStreamingUrl() + "/status.xsl");
            HttpURLConnection connection = (HttpURLConnection) statusUrl.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);

            int responseCode = connection.getResponseCode();
            result.put("httpConnectivity", responseCode == 200 ? "SUCCESS" : "FAILED");
            result.put("httpResponseCode", responseCode);
            logger.info("HTTP connectivity test - response code: {}", responseCode);

            // Test authentication by trying to access admin interface
            try {
                URL adminUrl = new URL(icecastService.getIcecastStreamingUrl() + "/admin/stats.xml");
                HttpURLConnection adminConnection = (HttpURLConnection) adminUrl.openConnection();
                adminConnection.setRequestMethod("GET");
                adminConnection.setConnectTimeout(5000);
                adminConnection.setReadTimeout(5000);

                // Add basic auth for admin interface
                String adminAuth = icecastService.getIcecastAdminUsername() + ":" + icecastService.getIcecastAdminPassword();
                String encodedAuth = java.util.Base64.getEncoder().encodeToString(adminAuth.getBytes());
                adminConnection.setRequestProperty("Authorization", "Basic " + encodedAuth);

                int adminResponseCode = adminConnection.getResponseCode();
                result.put("adminAccess", adminResponseCode == 200 ? "SUCCESS" : "FAILED");
                result.put("adminResponseCode", adminResponseCode);
                logger.info("Admin access test - response code: {}", adminResponseCode);

            } catch (Exception e) {
                result.put("adminAccess", "ERROR");
                result.put("adminError", e.getMessage());
                logger.warn("Admin access test failed: {}", e.getMessage());
            }

            // Check if mount point exists
            Map<String, Object> mountStatus = icecastService.checkMountPointStatus();
            result.put("mountPointStatus", mountStatus);

        } catch (IOException e) {
            result.put("tcpConnectivity", "FAILED");
            result.put("error", e.getMessage());
            logger.error("Icecast connectivity test failed: {}", e.getMessage());
        }

        return ResponseEntity.ok(result);
    }
} 
