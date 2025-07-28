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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wildcastradio.config.NetworkConfig;

/**
 * Service to manage Icecast streaming related operations.
 * Updated for icecast.software domain deployment.
 */
@Service
public class IcecastService {
    private static final Logger logger = LoggerFactory.getLogger(IcecastService.class);

    // Icecast Configuration
    @Value("${icecast.host:icecast.software}")
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

    @Value("${app.domain:https://api.wildcat-radio.live}")
    private String appDomain;

    private final NetworkConfig networkConfig;

    // Track active broadcasting sessions
    private final Map<String, BroadcastInfo> activeBroadcasts = new ConcurrentHashMap<>();

    // Reference to the listener status handler (will be set after construction)
    private ListenerStatusHandler listenerStatusHandler;

    @Autowired
    public IcecastService(NetworkConfig networkConfig) {
        this.networkConfig = networkConfig;
    }

    public void setListenerStatusHandler(ListenerStatusHandler handler) {
        this.listenerStatusHandler = handler;
    }

    /**
     * Notify that a new broadcast has started
     * @param sessionId The session ID of the broadcast
     */
    public void notifyBroadcastStarted(String sessionId) {
        logger.info("Broadcast started for session: {}", sessionId);
        activeBroadcasts.put(sessionId, new BroadcastInfo(sessionId, System.currentTimeMillis()));

        // Notify listener status handler if available
        if (listenerStatusHandler != null) {
            listenerStatusHandler.triggerStatusUpdate();
        }
    }

    /**
     * Notify that a broadcast has ended
     * @param sessionId The session ID of the broadcast
     */
    public void notifyBroadcastEnded(String sessionId) {
        logger.info("Broadcast ended for session: {}", sessionId);
        activeBroadcasts.remove(sessionId);

        // Notify listener status handler if available
        if (listenerStatusHandler != null) {
            listenerStatusHandler.triggerStatusUpdate();
        }
    }

    /**
     * Notify that a broadcast failed
     * @param sessionId The session ID of the broadcast
     * @param reason The reason for failure
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
     * Get the Icecast URL for web interface (through reverse proxy)
     * @return URL for web access to Icecast (admin, status pages)
     */
    public String getIcecastUrl() {
        // For web interface, use HTTPS through reverse proxy
        return "https://" + icecastHost;
    }

    /**
     * Get the Icecast URL for FFmpeg streaming (direct connection)
     * @return URL for FFmpeg to connect directly to Icecast server
     */
    public String getIcecastStreamingUrl() {
        // For FFmpeg streaming, connect directly to Icecast server port
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
        return isStreamLive(true);
    }

    /**
     * Check if the stream is live
     * This checks both the Icecast server status and our internal tracking of active broadcasts
     * @param logWarnings whether to log warnings when unable to check Icecast status
     * @return true if the stream is live on Icecast or there are active broadcasts
     */
    public boolean isStreamLive(boolean logWarnings) {
        // First check if we have any active broadcasts
        if (!activeBroadcasts.isEmpty()) {
            return true;
        }

        // If no active broadcasts, check Icecast server status
        try {
            URL url = new URL(getIcecastStreamingUrl() + "/status-json.xsl");
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
            if (logWarnings) {
                logger.warn("Failed to check Icecast stream status: {}", e.getMessage());
            } else {
                logger.debug("Failed to check Icecast stream status: {}", e.getMessage());
            }
        }
        return false;
    }

    /**
     * Get the current listener count from Icecast and active WebSocket listeners
     * @return Number of current listeners
     */
    public Integer getCurrentListenerCount() {
        return getCurrentListenerCount(true);
    }

    /**
     * Get the current listener count from Icecast and active WebSocket listeners
     * @param logWarnings whether to log warnings when unable to get count from Icecast
     * @return Number of current listeners
     */
    public Integer getCurrentListenerCount(boolean logWarnings) {
        int icecastListeners = 0;
        int webSocketListeners = listenerStatusHandler != null ? listenerStatusHandler.getActiveListenersCount() : 0;

        try {
            URL url = new URL(getIcecastStreamingUrl() + "/status-json.xsl");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);

            if (connection.getResponseCode() == 200) {
                ObjectMapper mapper = new ObjectMapper();
                JsonNode rootNode = mapper.readTree(connection.getInputStream());
                JsonNode icestats = rootNode.path("icestats");

                if (icestats.has("source")) {
                    JsonNode sourceNode = icestats.path("source");
                    if (sourceNode.isArray()) {
                        for (JsonNode source : sourceNode) {
                            if (icecastMount.equals(source.path("listenurl").asText().substring(source.path("listenurl").asText().lastIndexOf("/")))) {
                                icecastListeners = source.path("listeners").asInt();
                                break;
                            }
                        }
                    } else {
                        if (icecastMount.equals(sourceNode.path("listenurl").asText().substring(sourceNode.path("listenurl").asText().lastIndexOf("/")))) {
                            icecastListeners = sourceNode.path("listeners").asInt();
                        }
                    }
                }
            }
        } catch (Exception e) {
            if (logWarnings) {
                logger.warn("Failed to get listener count from Icecast: {}", e.getMessage());
            } else {
                logger.debug("Failed to get listener count from Icecast: {}", e.getMessage());
            }
        }

        return icecastListeners + webSocketListeners;
    }

    /**
     * Check if Icecast server is running and reachable
     * @return true if Icecast server is reachable
     */
    public boolean isServerUp() {
        return isServerUp(true);
    }

    /**
     * Check if Icecast server is running and reachable
     * @param logWarnings whether to log warnings when server is not reachable
     * @return true if Icecast server is reachable
     */
    public boolean isServerUp(boolean logWarnings) {
        try {
            URL url = new URL(getIcecastStreamingUrl() + "/status.xsl");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(3000);
            connection.setReadTimeout(3000);

            int responseCode = connection.getResponseCode();
            boolean isUp = responseCode == 200;

            logger.debug("Icecast server status check: {} (response code: {})", 
                        isUp ? "UP" : "DOWN", responseCode);

            return isUp;
        } catch (IOException e) {
            if (logWarnings) {
                logger.warn("Icecast server is not reachable: {}", e.getMessage());
            } else {
                logger.debug("Icecast server is not reachable: {}", e.getMessage());
            }
            return false;
        }
    }

    /**
     * Get comprehensive stream status information
     * @return Map containing stream status details
     */
    public Map<String, Object> getStreamStatus() {
        return getStreamStatus(true);
    }

    /**
     * Get comprehensive stream status information
     * @param logWarnings whether to log warnings when unable to check Icecast status
     * @return Map containing stream status details
     */
    public Map<String, Object> getStreamStatus(boolean logWarnings) {
        Map<String, Object> status = new HashMap<>();

        // If no active broadcasts, suppress warnings to reduce log noise
        boolean shouldLogWarnings = logWarnings && !activeBroadcasts.isEmpty();

        // Check actual Icecast stream status
        boolean icecastLive = isStreamLive(shouldLogWarnings);
        boolean serverUp = isServerUp(shouldLogWarnings);

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
        // Fallback - use app domain from configuration or default to deployed URL
        String protocol = appDomain != null && appDomain.startsWith("https://") ? "wss" : "ws";
        String baseUrl = appDomain != null ? appDomain.replaceFirst("https?://", "") : "api.wildcat-radio.live";
        return protocol + "://" + baseUrl + "/ws/live";
    }

    /**
     * Get the WebSocket URL for listener status updates
     * @return URL for WebSocket connection to receive status updates
     */
    public String getListenerWebSocketUrl() {
        if (networkConfig != null) {
            return networkConfig.getListenerWebSocketUrl();
        }
        // Fallback - use app domain from configuration or default to deployed URL
        String protocol = appDomain != null && appDomain.startsWith("https://") ? "wss" : "ws";
        String baseUrl = appDomain != null ? appDomain.replaceFirst("https?://", "") : "api.wildcat-radio.live";
        return protocol + "://" + baseUrl + "/ws/listener";
    }

    /**
     * Check if Icecast server is running and reachable (legacy method)
     * @return true if Icecast server is reachable
     */
    public boolean checkIcecastServer() {
        return isServerUp();
    }

    /**
     * Check if the /live.ogg mount point is active and streaming
     * @return Map containing mount point status information
     */
    public Map<String, Object> checkMountPointStatus() {
        return checkMountPointStatus(true);
    }

    /**
     * Check if the /live.ogg mount point is active and streaming
     * @param logWarnings whether to log warnings when unable to check mount point status
     * @return Map containing mount point status information
     */
    public Map<String, Object> checkMountPointStatus(boolean logWarnings) {
        Map<String, Object> status = new HashMap<>();
        status.put("mountPoint", icecastMount);
        status.put("serverReachable", false);
        status.put("mountPointExists", false);
        status.put("hasActiveSource", false);
        status.put("listenerCount", 0);
        status.put("errorMessage", null);

        try {
            // Check if we can reach the Icecast server
            URL url = new URL(getIcecastStreamingUrl() + "/status-json.xsl");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);

            int responseCode = connection.getResponseCode();
            if (responseCode == 200) {
                status.put("serverReachable", true);

                // Read the JSON response
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        response.append(line);
                    }

                    String jsonResponse = response.toString();
                    logger.debug("Icecast status JSON: {}", jsonResponse);

                    // Check if our mount point exists in the response
                    if (jsonResponse.contains("\"mount\":\"" + icecastMount + "\"")) {
                        status.put("mountPointExists", true);

                        // Extract mount point section
                        int mountIndex = jsonResponse.indexOf("\"mount\":\"" + icecastMount + "\"");
                        int nextMountIndex = jsonResponse.indexOf("\"mount\":", mountIndex + 1);

                        String mountSection = nextMountIndex > 0 ? 
                            jsonResponse.substring(mountIndex, nextMountIndex) : 
                            jsonResponse.substring(mountIndex);

                        // Check for listeners
                        int listenersIndex = mountSection.indexOf("\"listeners\":");
                        if (listenersIndex > 0) {
                            int startIndex = listenersIndex + 12;
                            int endIndex = mountSection.indexOf(',', startIndex);
                            if (endIndex == -1) endIndex = mountSection.indexOf('}', startIndex);

                            if (endIndex > startIndex) {
                                String listenersStr = mountSection.substring(startIndex, endIndex).trim();
                                try {
                                    int listeners = Integer.parseInt(listenersStr);
                                    status.put("listenerCount", listeners);
                                } catch (NumberFormatException e) {
                                    if (logWarnings) {
                                        logger.warn("Could not parse listener count: {}", listenersStr);
                                    } else {
                                        logger.debug("Could not parse listener count: {}", listenersStr);
                                    }
                                }
                            }
                        }

                        // Check if there's an active source (has source_ip)
                        if (mountSection.contains("\"source_ip\"")) {
                            status.put("hasActiveSource", true);
                        } else {
                            status.put("errorMessage", "Mount point exists but no active source connected");
                        }

                    } else {
                        status.put("errorMessage", "Mount point " + icecastMount + " not found in server response");
                        if (logWarnings) {
                            logger.warn("Mount point {} not found in Icecast server response", icecastMount);
                        } else {
                            logger.debug("Mount point {} not found in Icecast server response", icecastMount);
                        }
                    }
                }
            } else {
                status.put("errorMessage", "Icecast server returned HTTP " + responseCode);
                if (logWarnings) {
                    logger.warn("Icecast server returned HTTP {}", responseCode);
                } else {
                    logger.debug("Icecast server returned HTTP {}", responseCode);
                }
            }
        } catch (IOException e) {
            status.put("errorMessage", "Cannot connect to Icecast server: " + e.getMessage());
            if (logWarnings) {
                logger.warn("Failed to check Icecast mount point status: {}", e.getMessage());
            } else {
                logger.debug("Failed to check Icecast mount point status: {}", e.getMessage());
            }
        }

        return status;
    }

    // Getter methods for Icecast configuration
    public String getIcecastHost() {
        return icecastHost;
    }

    public int getIcecastPort() {
        return icecastPort;
    }

    public String getIcecastUsername() {
        return icecastUsername;
    }

    public String getIcecastPassword() {
        return icecastPassword;
    }

    public String getIcecastMount() {
        return icecastMount;
    }

    public String getIcecastAdminUsername() {
        return icecastAdminUsername;
    }

    public String getIcecastAdminPassword() {
        return icecastAdminPassword;
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
