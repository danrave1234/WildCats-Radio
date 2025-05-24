package com.wildcastradio.icecast;

import com.wildcastradio.config.NetworkConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service to manage Icecast streaming related operations.
 * Handles broadcast status tracking and interacts with the broadcast system.
 */
@Service
public class IcecastService {
    private static final Logger logger = LoggerFactory.getLogger(IcecastService.class);
    
    private final NetworkConfig networkConfig;
    
    // Track active broadcasting sessions
    private final Map<String, BroadcastInfo> activeBroadcasts = new ConcurrentHashMap<>();
    
    @Autowired
    public IcecastService(NetworkConfig networkConfig) {
        this.networkConfig = networkConfig;
    }
    
    /**
     * Notify that a broadcast has started
     * @param sessionId The WebSocket session ID
     */
    public void notifyBroadcastStarted(String sessionId) {
        logger.info("Broadcast started for session: {}", sessionId);
        BroadcastInfo info = new BroadcastInfo(sessionId, System.currentTimeMillis());
        activeBroadcasts.put(sessionId, info);
        // Here you could also update a BroadcastEntity or similar in your database
    }
    
    /**
     * Notify that a broadcast has ended
     * @param sessionId The WebSocket session ID
     */
    public void notifyBroadcastEnded(String sessionId) {
        logger.info("Broadcast ended for session: {}", sessionId);
        BroadcastInfo info = activeBroadcasts.remove(sessionId);
        if (info != null) {
            long duration = System.currentTimeMillis() - info.startTime;
            logger.info("Broadcast lasted {} ms", duration);
            // Here you could update your database with broadcast end time/duration
        }
    }
    
    /**
     * Notify that a broadcast has failed
     * @param sessionId The WebSocket session ID
     * @param reason The failure reason
     */
    public void notifyBroadcastFailed(String sessionId, String reason) {
        logger.error("Broadcast failed for session: {}, reason: {}", sessionId, reason);
        activeBroadcasts.remove(sessionId);
        // Here you could update your database with failure information
    }
    
    /**
     * Check if there's an active broadcast
     * @return true if there's at least one active broadcast
     */
    public boolean isAnyBroadcastActive() {
        return !activeBroadcasts.isEmpty();
    }
    
    /**
     * Check if the stream is actually live on Icecast server
     * This queries Icecast's status-json.xsl endpoint to see if /live.ogg mountpoint is active
     * @return true if the stream is live on Icecast
     */
    public boolean isStreamLive() {
        try {
            URL url = new URL(networkConfig.getIcecastUrl() + "/status-json.xsl");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(3000);
            connection.setReadTimeout(3000);
            
            int responseCode = connection.getResponseCode();
            if (responseCode == 200) {
                // Read the JSON response
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        response.append(line);
                    }
                    
                    // Simple check for /live.ogg mountpoint in the response
                    String jsonResponse = response.toString();
                    return jsonResponse.contains("/live.ogg") && jsonResponse.contains("\"mount\":\"/live.ogg\"");
                }
            }
        } catch (IOException e) {
            logger.warn("Failed to check Icecast stream status: {}", e.getMessage());
        }
        return false;
    }
    
    /**
     * Check if Icecast server is running and reachable
     * @return true if Icecast server is reachable
     */
    public boolean isServerUp() {
        try {
            URL url = new URL(networkConfig.getIcecastUrl());
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("HEAD");
            connection.setConnectTimeout(3000);
            connection.setReadTimeout(3000);
            int responseCode = connection.getResponseCode();
            return responseCode < 400;
        } catch (IOException e) {
            logger.warn("Failed to connect to Icecast server: {}", e.getMessage());
            return false;
        }
    }
    
    /**
     * Get information about all active broadcasts and stream status
     * @return Map of stream info
     */
    public Map<String, Object> getStreamStatus() {
        Map<String, Object> status = new HashMap<>();
        
        // Check actual Icecast stream status
        boolean isLive = isStreamLive();
        boolean serverUp = isServerUp();
        
        status.put("live", isLive);
        status.put("server", serverUp ? "UP" : "DOWN");
        status.put("streamUrl", networkConfig.getStreamUrl());
        status.put("icecastUrl", networkConfig.getIcecastUrl());
        status.put("activeBroadcasts", activeBroadcasts.size());
        status.put("icecastReachable", serverUp);
        
        return status;
    }
    
    /**
     * Get network configuration information
     * @return Map of configuration info
     */
    public Map<String, Object> getStreamConfig() {
        Map<String, Object> config = new HashMap<>();
        config.put("serverIp", networkConfig.getServerIp());
        config.put("serverPort", networkConfig.getServerPort());
        config.put("icecastPort", networkConfig.getIcecastPort());
        config.put("webSocketUrl", networkConfig.getWebSocketUrl());
        config.put("streamUrl", networkConfig.getStreamUrl());
        config.put("icecastUrl", networkConfig.getIcecastUrl());
        return config;
    }
    
    /**
     * Get the stream URL
     * @return URL for accessing the Icecast stream
     */
    public String getStreamUrl() {
        return networkConfig.getStreamUrl();
    }
    
    /**
     * Get the WebSocket URL
     * @return URL for WebSocket connection
     */
    public String getWebSocketUrl() {
        return networkConfig.getWebSocketUrl();
    }
    
    /**
     * Check if Icecast server is running and reachable (legacy method)
     * @return true if Icecast server is reachable
     */
    public boolean checkIcecastServer() {
        return isServerUp();
    }
    
    /**
     * Inner class to track broadcast information
     */
    private static class BroadcastInfo {
        private final String sessionId;
        private final long startTime;
        
        public BroadcastInfo(String sessionId, long startTime) {
            this.sessionId = sessionId;
            this.startTime = startTime;
        }
    }
} 