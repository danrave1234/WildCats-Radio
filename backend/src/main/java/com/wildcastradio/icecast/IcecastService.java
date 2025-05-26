package com.wildcastradio.icecast;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.wildcastradio.config.NetworkConfig;

/**
 * Service to manage Icecast streaming related operations.
 * Updated for Google Cloud deployment.
 */
@Service
public class IcecastService {
    private static final Logger logger = LoggerFactory.getLogger(IcecastService.class);

    // Google Cloud Icecast Configuration
    @Value("${icecast.host:34.142.131.206}")
    private String icecastHost;

    @Value("${icecast.port:8000}")
    private int icecastPort;

    @Value("${icecast.source.username:source}")
    private String icecastUsername;

    @Value("${icecast.source.password:hackme}")
    private String icecastPassword;

    @Value("${icecast.mount.point:/live.ogg}")
    private String icecastMount;

    @Value("${icecast.admin.username:admin}")
    private String icecastAdminUsername;

    @Value("${icecast.admin.password:hackme}")
    private String icecastAdminPassword;

    private final NetworkConfig networkConfig;

    // Track active broadcasting sessions
    private final Map<String, BroadcastInfo> activeBroadcasts = new ConcurrentHashMap<>();

    // Reference to the listener status handler (will be set after construction)
    private ListenerStatusHandler listenerStatusHandler;

    @Autowired
    public IcecastService(NetworkConfig networkConfig) {
        this.networkConfig = networkConfig;
    }

    /**
     * Set the listener status handler (called by Spring after both beans are created)
     * Using @Lazy to break circular dependency
     */
    @Autowired
    public void setListenerStatusHandler(@org.springframework.context.annotation.Lazy ListenerStatusHandler listenerStatusHandler) {
        this.listenerStatusHandler = listenerStatusHandler;
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
     * Get the Google Cloud Icecast URL
     * @return URL for the Google Cloud Icecast server
     */
    public String getIcecastUrl() {
        return "http://" + icecastHost + ":" + icecastPort;
    }

    /**
     * Get the stream URL for listeners
     * @return URL for accessing the live stream
     */
    public String getStreamUrl() {
        return getIcecastUrl() + icecastMount;
    }

    /**
     * Check if the stream is live
     * This checks both the Icecast server status and our internal tracking of active broadcasts
     * @return true if the stream is live on Icecast or there are active broadcasts
     */
    public boolean isStreamLive() {
        // First check if we have any active broadcasts
        if (!activeBroadcasts.isEmpty()) {
            return true;
        }

        // If no active broadcasts, check Google Cloud Icecast server status
        try {
            URL url = new URL(getIcecastUrl() + "/status-json.xsl");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);

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
                    return jsonResponse.contains(icecastMount) && jsonResponse.contains("\"mount\":\"" + icecastMount + "\"");
                }
            }
        } catch (IOException e) {
            logger.warn("Failed to check Google Cloud Icecast stream status: {}", e.getMessage());
        }
        return false;
    }

    /**
     * Get the current listener count from Google Cloud Icecast and active WebSocket listeners
     * @return Number of current listeners
     */
    public Integer getCurrentListenerCount() {
        int activeListeners = 0;

        // Get active listeners from the WebSocket handler if available
        if (listenerStatusHandler != null) {
            activeListeners = listenerStatusHandler.getActiveListenersCount();
            logger.debug("Active listeners from WebSocket: {}", activeListeners);
        }

        // If we have active listeners, return that count
        if (activeListeners > 0) {
            return activeListeners;
        }

        // Otherwise, try to get the count from Google Cloud Icecast
        try {
            URL url = new URL(getIcecastUrl() + "/status-json.xsl");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);

            int responseCode = connection.getResponseCode();
            if (responseCode == 200) {
                // Read the JSON response
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        response.append(line);
                    }

                    String jsonResponse = response.toString();

                    // Parse JSON manually to extract listener count for /live.ogg
                    if (jsonResponse.contains(icecastMount)) {
                        // Look for the pattern: "mount":"/live.ogg"..."listeners":number
                        int mountIndex = jsonResponse.indexOf("\"mount\":\"" + icecastMount + "\"");
                        if (mountIndex != -1) {
                            // Find the listeners field after the mount
                            int listenersIndex = jsonResponse.indexOf("\"listeners\":", mountIndex);
                            if (listenersIndex != -1) {
                                // Extract the number after "listeners":
                                int startIndex = listenersIndex + "\"listeners\":".length();
                                int endIndex = startIndex;

                                // Find the end of the number (comma, brace, or end of string)
                                while (endIndex < jsonResponse.length() &&
                                        Character.isDigit(jsonResponse.charAt(endIndex))) {
                                    endIndex++;
                                }

                                if (endIndex > startIndex) {
                                    String listenersStr = jsonResponse.substring(startIndex, endIndex);
                                    int icecastListeners = Integer.parseInt(listenersStr);
                                    logger.debug("Listeners from Google Cloud Icecast: {}", icecastListeners);
                                    return icecastListeners;
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            logger.warn("Failed to get current listener count from Google Cloud Icecast: {}", e.getMessage());
        }

        return activeListeners; // Return active listeners count (which might be 0)
    }

    /**
     * Check if Google Cloud Icecast server is running and reachable
     * @return true if Icecast server is reachable
     */
    public boolean isServerUp() {
        // Try HTTPS first (as configured in getIcecastUrl)
        boolean httpsResult = checkServerWithProtocol(getIcecastUrl());
        if (httpsResult) {
            return true;
        }

        // If HTTPS fails, try HTTP as fallback
        String httpUrl = getIcecastUrl().replace("https://", "http://");
        boolean httpResult = checkServerWithProtocol(httpUrl);

        // Log which protocol worked
        if (httpResult) {
            logger.info("Icecast server is UP using HTTP protocol (HTTPS failed)");
        } else {
            logger.warn("Icecast server is DOWN on both HTTPS and HTTP protocols");
        }

        return httpResult;
    }

    /**
     * Helper method to check server with a specific protocol
     * @param urlString the full URL to check
     * @return true if server is reachable with the given protocol
     */
    private boolean checkServerWithProtocol(String urlString) {
        try {
            URL url = new URL(urlString);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            int responseCode = connection.getResponseCode();
            boolean isUp = responseCode < 400;
            logger.debug("Icecast server status check for {}: {} (response code: {})",
                    urlString, isUp ? "UP" : "DOWN", responseCode);
            return isUp;
        } catch (IOException e) {
            logger.debug("Failed to connect to Icecast server at {}: {}", urlString, e.getMessage());
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
        boolean icecastLive = isStreamLive();
        boolean serverUp = isServerUp();

        // Consider a stream live if either Icecast reports it as live OR we have active broadcasts
        boolean isLive = icecastLive || !activeBroadcasts.isEmpty();

        status.put("live", isLive);
        status.put("server", serverUp ? "UP" : "DOWN");
        status.put("streamUrl", getStreamUrl());
        status.put("icecastUrl", getIcecastUrl());
        status.put("activeBroadcasts", activeBroadcasts.size());
        status.put("icecastReachable", serverUp);
        status.put("icecastHost", icecastHost);
        status.put("icecastPort", icecastPort);

        return status;
    }

    /**
     * Get network configuration information
     * @return Map of configuration info
     */
    public Map<String, Object> getStreamConfig() {
        Map<String, Object> config = new HashMap<>();

        // CRITICAL: serverIp should be the Spring Boot app IP, NOT the Icecast host!
        config.put("serverIp", networkConfig != null ? networkConfig.getServerIp() : "localhost");
        config.put("serverPort", networkConfig != null ? networkConfig.getServerPort() : 8080);
        config.put("icecastPort", icecastPort);
        config.put("icecastHost", icecastHost); // Add separate field for Icecast host
        config.put("webSocketUrl", getWebSocketUrl());
        config.put("listenerWebSocketUrl", getListenerWebSocketUrl()); // Add listener WebSocket URL
        config.put("streamUrl", getStreamUrl());
        config.put("icecastUrl", getIcecastUrl());
        config.put("mountPoint", icecastMount);

        return config;
    }

    /**
     * Get the WebSocket URL for DJ streaming
     * @return URL for WebSocket connection to stream audio
     */
    public String getWebSocketUrl() {
        // Use the WebSocket URL from NetworkConfig (points to Spring Boot app, not Icecast)
        if (networkConfig != null) {
            return networkConfig.getWebSocketUrl();
        }
        // Fallback - construct from current server context
        return "ws://localhost:8080/ws/live";
    }

    /**
     * Get the WebSocket URL for listener status updates
     * @return URL for WebSocket connection to receive status updates
     */
    public String getListenerWebSocketUrl() {
        if (networkConfig != null) {
            return networkConfig.getListenerWebSocketUrl();
        }
        return "ws://localhost:8080/ws/listener";
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
