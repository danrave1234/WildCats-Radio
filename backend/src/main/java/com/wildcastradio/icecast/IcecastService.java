package com.wildcastradio.icecast;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URL;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
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
import com.wildcastradio.radio.RadioAgentClient;

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

    @Value("${icecast.port:443}")
    private int icecastPort;

    // Dedicated source publishing port (direct Icecast, typically 8000). Can differ from listener port.
    @Value("${icecast.source.port:8000}")
    private int icecastSourcePort;

    // Optional alternate source port (e.g., 443 via TCP stream proxy)
    @Value("${icecast.alt.port:-1}")
    private int icecastAltPort;

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

    // Allow starting broadcasts even if Icecast is not reachable (degraded mode)
    @Value("${icecast.allowDegradedStart:true}")
    private boolean allowDegradedStart;

    // Fallback stream URL used when Icecast server is not reachable
    @Value("${icecast.fallbackStreamUrl:https://icecast.software/live.ogg}")
    private String fallbackStreamUrl;

    private final NetworkConfig networkConfig;
    
    // Optional: Radio agent client to confirm Liquidsoap service state
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private RadioAgentClient radioAgentClient;

    // Track active broadcasting sessions
    private final Map<String, BroadcastInfo> activeBroadcasts = new ConcurrentHashMap<>();

    // ListenerStatusHandler removed - listener status now handled via STOMP ListenerStatusWebSocketController

    @Autowired
    public IcecastService(NetworkConfig networkConfig) {
        this.networkConfig = networkConfig;
    }

    /**
     * Notify that a new broadcast has started
     * @param sessionId The session ID of the broadcast
     */
    public void notifyBroadcastStarted(String sessionId) {
        logger.info("Broadcast started for session: {}", sessionId);
        activeBroadcasts.put(sessionId, new BroadcastInfo(sessionId, System.currentTimeMillis()));

        // Listener status update now handled via STOMP ListenerStatusWebSocketController
        // Status updates are broadcast automatically via @Scheduled method
    }

    /**
     * Notify that a broadcast has ended
     * @param sessionId The session ID of the broadcast
     */
    public void notifyBroadcastEnded(String sessionId) {
        logger.info("Broadcast ended for session: {}", sessionId);
        activeBroadcasts.remove(sessionId);

        // Listener status update now handled via STOMP ListenerStatusWebSocketController
        // Status updates are broadcast automatically via @Scheduled method
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
     * Clear all active broadcasts (used when ending broadcasts via HTTP endpoint)
     * This ensures the stream status is properly updated when broadcasts are ended
     */
    public void clearAllActiveBroadcasts() {
        logger.info("Clearing all active broadcasts from session tracking");
        activeBroadcasts.clear();
        
        // Listener status update now handled via STOMP ListenerStatusWebSocketController
        // Status updates are broadcast automatically via @Scheduled method
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
        // Always use HTTPS for listener/admin access
        return "https://" + icecastHost + (icecastPort == 443 ? "" : (":" + icecastPort));
    }

    /**
     * Get the stream URL for listeners
     * @return URL for accessing the live stream
     */
    public String getStreamUrl() {
        return getIcecastUrl() + icecastMount;
    }

    public int getIcecastAltPort() {
        return icecastAltPort;
    }

    /**
     * Run connectivity diagnostics to the Icecast server.
     * Provides detailed status to aid troubleshooting (ports, DNS, HTTP status pages).
     */
    public Map<String, Object> diagnoseConnectivity() {
        Map<String, Object> result = new HashMap<>();
        result.put("icecastHost", icecastHost);
        result.put("primaryPort", icecastPort);
        result.put("sourcePort", getIcecastSourcePort());
        result.put("altPort", getIcecastAltPort());
        result.put("directUrl", getIcecastStreamingUrl());
        result.put("httpsUrl", getIcecastUrl());

        // DNS resolution
        try {
            InetAddress[] addresses = InetAddress.getAllByName(icecastHost);
            List<String> ips = Arrays.stream(addresses).map(InetAddress::getHostAddress).toList();
            result.put("resolvedIps", ips);
        } catch (Exception e) {
            result.put("dnsError", e.getMessage());
        }

        // TCP connect tests
        Map<String, Object> tcp = new HashMap<>();
        tcp.put("sourcePortReachable", tcpCheck(icecastHost, getIcecastSourcePort(), 3000));
        if (getIcecastAltPort() > 0) {
            tcp.put("altPortReachable", tcpCheck(icecastHost, getIcecastAltPort(), 3000));
        }
        // Common listener/admin port too
        tcp.put("listenerPortReachable", tcpCheck(icecastHost, icecastPort, 3000));
        result.put("tcpChecks", tcp);

        // HTTP status checks
        try {
            URL url = new URL("http://" + icecastHost + ":" + getIcecastSourcePort() + "/status-json.xsl");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(3000);
            result.put("directStatusHttp", conn.getResponseCode());
        } catch (Exception e) {
            result.put("directStatusError", e.getMessage());
        }
        try {
            URL url = new URL(getIcecastUrl() + "/status-json.xsl");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(4000);
            conn.setReadTimeout(4000);
            result.put("httpsStatusHttp", conn.getResponseCode());
        } catch (Exception e) {
            result.put("httpsStatusError", e.getMessage());
        }

        // Recommendations
        StringBuilder guidance = new StringBuilder();
        guidance.append("If sourcePortReachable=false, check VM egress firewall (allow tcp ")
                .append(getIcecastSourcePort())
                .append(") to ")
                .append(icecastHost)
                .append(". If altPortReachable=true, set icecast.source.port=")
                .append(getIcecastAltPort() > 0 ? getIcecastAltPort() : 443)
                .append(" and/or enable publishing over 443 with tls=1. Also verify DNS resolves to the same IP across VMs and no corporate proxy blocks raw TCP.");
        result.put("guidance", guidance.toString());
        return result;
    }

    private Map<String, Object> tcpCheck(String host, int port, int timeoutMs) {
        Map<String, Object> out = new HashMap<>();
        out.put("port", port);
        long start = System.currentTimeMillis();
        try (Socket s = new Socket()) {
            s.connect(new InetSocketAddress(host, port), timeoutMs);
            out.put("reachable", true);
        } catch (Exception e) {
            out.put("reachable", false);
            out.put("error", e.getMessage());
        } finally {
            out.put("durationMs", System.currentTimeMillis() - start);
        }
        return out;
    }

    public boolean isDegradedStartAllowed() {
        // Bare-bones: do not allow degraded start
        return false;
    }

    public String getFallbackStreamUrl() {
        // Bare-bones: use the main stream URL as fallback
        return getStreamUrl();
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

                    // Simple check: consider stream live if the configured mount appears anywhere in status JSON (e.g., via listenurl)
                    String jsonResponse = response.toString();
                    return jsonResponse.contains(icecastMount);
                }
            }
        } catch (IOException e) {
            if (logWarnings) {
                logger.warn("Failed to check Icecast stream status via direct port: {}", e.getMessage());
            } else {
                logger.debug("Failed to check Icecast stream status via direct port: {}", e.getMessage());
            }
            // Try HTTPS fallback
            try {
                URL httpsUrl = new URL(getIcecastUrl() + "/status-json.xsl");
                HttpURLConnection httpsConn = (HttpURLConnection) httpsUrl.openConnection();
                httpsConn.setRequestMethod("GET");
                httpsConn.setConnectTimeout(5000);
                httpsConn.setReadTimeout(5000);
                if (httpsConn.getResponseCode() == 200) {
                    try (BufferedReader reader = new BufferedReader(new InputStreamReader(httpsConn.getInputStream()))) {
                        StringBuilder response = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) {
                            response.append(line);
                        }
                        String jsonResponse = response.toString();
                        return jsonResponse.contains(icecastMount);
                    }
                }
            } catch (IOException e2) {
                if (logWarnings) {
                    logger.warn("HTTPS fallback for stream status failed: {}", e2.getMessage());
                } else {
                    logger.debug("HTTPS fallback for stream status failed: {}", e2.getMessage());
                }
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
        // WebSocket listener count now tracked via STOMP ListenerStatusWebSocketController
        // Use ListenerTrackingService for listener count instead
        int webSocketListeners = 0; // Deprecated - use ListenerTrackingService.getCurrentListenerCount()

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
            // Try HTTPS fallback via reverse proxy
            try {
                URL httpsUrl = new URL(getIcecastUrl() + "/status-json.xsl");
                HttpURLConnection httpsConn = (HttpURLConnection) httpsUrl.openConnection();
                httpsConn.setRequestMethod("GET");
                httpsConn.setConnectTimeout(5000);
                httpsConn.setReadTimeout(5000);
                if (httpsConn.getResponseCode() == 200) {
                    ObjectMapper mapper = new ObjectMapper();
                    JsonNode rootNode = mapper.readTree(httpsConn.getInputStream());
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
            } catch (Exception e2) {
                if (logWarnings) {
                    logger.warn("Failed to get listener count from Icecast (both direct and HTTPS): {} / {}", e.getMessage(), e2.getMessage());
                } else {
                    logger.debug("Failed to get listener count from Icecast (both direct and HTTPS): {} / {}", e.getMessage(), e2.getMessage());
                }
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
        // First try direct Icecast port (e.g., http://host:8000)
        try {
            URL url = new URL(getIcecastStreamingUrl() + "/status.xsl");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(3000);
            connection.setReadTimeout(3000);
            int responseCode = connection.getResponseCode();
            if (responseCode == 200) {
                logger.debug("Icecast server status check via direct port succeeded (HTTP 200)");
                return true;
            }
            logger.debug("Direct port status.xsl returned HTTP {} — will try HTTPS fallback", responseCode);
        } catch (IOException e) {
            if (logWarnings) {
                logger.warn("Direct Icecast check failed ({}). Trying HTTPS fallback...", e.getMessage());
            } else {
                logger.debug("Direct Icecast check failed ({}). Trying HTTPS fallback...", e.getMessage());
            }
        }
        // Fallback to reverse-proxied HTTPS (e.g., https://host)
        try {
            URL httpsUrl = new URL(getIcecastUrl() + "/status.xsl");
            HttpURLConnection httpsConn = (HttpURLConnection) httpsUrl.openConnection();
            httpsConn.setRequestMethod("GET");
            httpsConn.setConnectTimeout(4000);
            httpsConn.setReadTimeout(4000);
            int code = httpsConn.getResponseCode();
            boolean isUp = code == 200;
            logger.debug("Icecast HTTPS status check: {} (HTTP {})", isUp ? "UP" : "DOWN", code);
            return isUp;
        } catch (IOException e2) {
            if (logWarnings) {
                logger.warn("Icecast HTTPS status check failed: {}", e2.getMessage());
            } else {
                logger.debug("Icecast HTTPS status check failed: {}", e2.getMessage());
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

        // Consider stream live ONLY if Icecast reports live.
        // Optionally also require radio-agent Liquidsoap state to be running when available.
        boolean agentSaysRunning = true; // graceful default
        try {
            if (radioAgentClient != null) {
                Map<String, Object> agent = radioAgentClient.status();
                Object st = agent != null ? agent.get("state") : null;
                agentSaysRunning = "running".equals(st);
            }
        } catch (Exception ignored) { /* degrade gracefully */ }

        boolean isLive = icecastLive && agentSaysRunning;

        // Backward-compatible fields and aliases expected by frontend
        status.put("live", isLive);
        status.put("isLive", isLive); // alias used by frontend
        status.put("listenerCount", getCurrentListenerCount(false));
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
        // listenerWebSocketUrl removed - listener status now via STOMP /topic/listener-status
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
     * @deprecated Removed in hard refactor - listener status now via STOMP /topic/listener-status
     * @return null - method removed
     */
    @Deprecated
    public String getListenerWebSocketUrl() {
        // HARD REFACTOR: This method is deprecated and returns null
        // Listener status is now handled via STOMP /topic/listener-status
        return null;
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
        status.put("bitrate", 0);
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

                try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        response.append(line);
                    }
                    String jsonResponse = response.toString();

                    try {
                        ObjectMapper mapper = new ObjectMapper();
                        JsonNode rootNode = mapper.readTree(jsonResponse);
                        JsonNode icestats = rootNode.path("icestats");
                        JsonNode sourceNode = icestats.path("source");

                        // Support dual mounts (/live.ogg and /live.mp3): treat either as healthy
                        String primaryMount = icecastMount;
                        String altMount;
                        if (primaryMount.endsWith(".ogg")) {
                            altMount = primaryMount.substring(0, primaryMount.length() - 4) + ".mp3";
                        } else if (primaryMount.endsWith(".mp3")) {
                            altMount = primaryMount.substring(0, primaryMount.length() - 4) + ".ogg";
                        } else {
                            // If no extension specified, consider both
                            altMount = primaryMount + ".mp3";
                            primaryMount = primaryMount + ".ogg";
                        }
                        final String mountA = primaryMount;
                        final String mountB = altMount;

                        final boolean[] anyMountMatched = { false };
                        final boolean[] anyActiveSource = { false };
                        final int[] totalListeners = { 0 };
                        final int[] maxBitrate = { 0 };

                        java.util.function.Consumer<JsonNode> processSource = (JsonNode src) -> {
                            String listenurl = src.path("listenurl").asText("");
                            String mount = src.path("mount").asText("");

                            boolean matches = false;
                            if (!listenurl.isEmpty()) {
                                try {
                                    int idx = listenurl.lastIndexOf('/');
                                    String fromUrl = idx >= 0 ? listenurl.substring(idx) : listenurl;
                                    matches = mountA.equals(fromUrl) || mountB.equals(fromUrl);
                                } catch (Exception ignore) { }
                            }
                            if (!matches && !mount.isEmpty()) {
                                matches = mountA.equals(mount) || mountB.equals(mount);
                            }
                            if (!matches) {
                                return;
                            }

                            anyMountMatched[0] = true;

                            int listeners = src.path("listeners").asInt(0);
                            totalListeners[0] += listeners;

                            boolean hasSourceIp = src.has("source_ip") && !src.path("source_ip").asText("").isEmpty();
                            anyActiveSource[0] = anyActiveSource[0] || hasSourceIp;

                            int bitrate = src.path("bitrate").asInt(0);
                            if (bitrate == 0) {
                                // Try to parse from audio_info: "bitrate=128"
                                String audioInfo = src.path("audio_info").asText("");
                                if (audioInfo != null && !audioInfo.isEmpty()) {
                                    for (String part : audioInfo.split(";")) {
                                        String p = part.trim();
                                        if (p.startsWith("bitrate=")) {
                                            try {
                                                bitrate = Integer.parseInt(p.substring("bitrate=".length()).trim());
                                            } catch (NumberFormatException ignore) { }
                                        }
                                    }
                                }
                            }
                            if (bitrate > maxBitrate[0]) {
                                maxBitrate[0] = bitrate;
                            }
                        };

                        if (sourceNode.isArray()) {
                            for (JsonNode src : sourceNode) {
                                processSource.accept(src);
                            }
                        } else if (sourceNode.isObject()) {
                            processSource.accept(sourceNode);
                        } else {
                            // No source present
                            status.put("errorMessage", "No source information present in status");
                        }

                        // Aggregate results across mounts
                        status.put("mountPointExists", anyMountMatched[0]);
                        status.put("listenerCount", totalListeners[0]);
                        status.put("hasActiveSource", anyActiveSource[0]);
                        status.put("bitrate", maxBitrate[0]);

                        if (anyMountMatched[0]) {
                            if (!anyActiveSource[0]) {
                                status.put("errorMessage", "Mount point exists but no active source connected");
                            } else if (maxBitrate[0] <= 0) {
                                status.put("errorMessage", "Active source detected but bitrate is 0 (stalled)");
                            }
                        }

                        if (!(Boolean) status.get("mountPointExists")) {
                            status.put("errorMessage", "Mount point " + icecastMount + " not found in server response");
                            if (logWarnings) {
                                logger.warn("Mount point {} not found in Icecast server response", icecastMount);
                            } else {
                                logger.debug("Mount point {} not found in Icecast server response", icecastMount);
                            }
                        }
                    } catch (Exception parseEx) {
                        status.put("errorMessage", "Failed to parse Icecast JSON: " + parseEx.getMessage());
                        if (logWarnings) {
                            logger.warn("Failed to parse Icecast JSON: {}", parseEx.getMessage());
                        } else {
                            logger.debug("Failed to parse Icecast JSON: {}", parseEx.getMessage());
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
            // Try HTTPS fallback via reverse proxy
            if (logWarnings) {
                logger.warn("Direct Icecast mount status check failed: {}. Trying HTTPS fallback...", e.getMessage());
            } else {
                logger.debug("Direct Icecast mount status check failed: {}. Trying HTTPS fallback...", e.getMessage());
            }
            try {
                URL httpsUrl = new URL(getIcecastUrl() + "/status-json.xsl");
                HttpURLConnection httpsConn = (HttpURLConnection) httpsUrl.openConnection();
                httpsConn.setRequestMethod("GET");
                httpsConn.setConnectTimeout(5000);
                httpsConn.setReadTimeout(5000);
                int responseCode = httpsConn.getResponseCode();
                if (responseCode == 200) {
                    status.put("serverReachable", true);
                    try (BufferedReader reader = new BufferedReader(new InputStreamReader(httpsConn.getInputStream()))) {
                        StringBuilder response = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) {
                            response.append(line);
                        }
                        String jsonResponse = response.toString();
                        try {
                            ObjectMapper mapper = new ObjectMapper();
                            JsonNode rootNode = mapper.readTree(jsonResponse);
                            JsonNode icestats = rootNode.path("icestats");
                            JsonNode sourceNode = icestats.path("source");

                            String primaryMount = icecastMount;
                            String altMount;
                            if (primaryMount.endsWith(".ogg")) {
                                altMount = primaryMount.substring(0, primaryMount.length() - 4) + ".mp3";
                            } else if (primaryMount.endsWith(".mp3")) {
                                altMount = primaryMount.substring(0, primaryMount.length() - 4) + ".ogg";
                            } else {
                                altMount = primaryMount + ".mp3";
                                primaryMount = primaryMount + ".ogg";
                            }
                            final String mountA = primaryMount;
                            final String mountB = altMount;

                            final boolean[] anyMountMatched = { false };
                            final boolean[] anyActiveSource = { false };
                            final int[] totalListeners = { 0 };
                            final int[] maxBitrate = { 0 };

                            java.util.function.Consumer<JsonNode> processSource = (JsonNode src) -> {
                                String listenurl = src.path("listenurl").asText("");
                                String mount = src.path("mount").asText("");
                                boolean matches = false;
                                if (!listenurl.isEmpty()) {
                                    try {
                                        int idx = listenurl.lastIndexOf('/');
                                        String fromUrl = idx >= 0 ? listenurl.substring(idx) : listenurl;
                                        matches = mountA.equals(fromUrl) || mountB.equals(fromUrl);
                                    } catch (Exception ignore) { }
                                }
                                if (!matches && !mount.isEmpty()) {
                                    matches = mountA.equals(mount) || mountB.equals(mount);
                                }
                                if (!matches) {
                                    return;
                                }
                                anyMountMatched[0] = true;
                                int listeners = src.path("listeners").asInt(0);
                                totalListeners[0] += listeners;
                                boolean hasSourceIp = src.has("source_ip") && !src.path("source_ip").asText("").isEmpty();
                                anyActiveSource[0] = anyActiveSource[0] || hasSourceIp;
                                int bitrate = src.path("bitrate").asInt(0);
                                if (bitrate == 0) {
                                    String audioInfo = src.path("audio_info").asText("");
                                    if (audioInfo != null && !audioInfo.isEmpty()) {
                                        for (String part : audioInfo.split(";")) {
                                            String p = part.trim();
                                            if (p.startsWith("bitrate=")) {
                                                try {
                                                    bitrate = Integer.parseInt(p.substring("bitrate=".length()).trim());
                                                } catch (NumberFormatException ignore) { }
                                            }
                                        }
                                    }
                                }
                                if (bitrate > maxBitrate[0]) {
                                    maxBitrate[0] = bitrate;
                                }
                            };

                            if (sourceNode.isArray()) {
                                for (JsonNode src : sourceNode) {
                                    processSource.accept(src);
                                }
                            } else if (sourceNode.isObject()) {
                                processSource.accept(sourceNode);
                            } else {
                                status.put("errorMessage", "No source information present in status");
                            }

                            status.put("mountPointExists", anyMountMatched[0]);
                            status.put("listenerCount", totalListeners[0]);
                            status.put("hasActiveSource", anyActiveSource[0]);
                            status.put("bitrate", maxBitrate[0]);

                            if (anyMountMatched[0]) {
                                if (!anyActiveSource[0]) {
                                    status.put("errorMessage", "Mount point exists but no active source connected");
                                } else if (maxBitrate[0] <= 0) {
                                    status.put("errorMessage", "Active source detected but bitrate is 0 (stalled)");
                                }
                            }

                            if (!(Boolean) status.get("mountPointExists")) {
                                status.put("errorMessage", "Mount point " + icecastMount + " not found in server response");
                                if (logWarnings) {
                                    logger.warn("Mount point {} not found in Icecast server response (HTTPS)", icecastMount);
                                } else {
                                    logger.debug("Mount point {} not found in Icecast server response (HTTPS)", icecastMount);
                                }
                            }
                        } catch (Exception parseEx) {
                            status.put("errorMessage", "Failed to parse Icecast JSON (HTTPS): " + parseEx.getMessage());
                            if (logWarnings) {
                                logger.warn("Failed to parse Icecast JSON (HTTPS): {}", parseEx.getMessage());
                            } else {
                                logger.debug("Failed to parse Icecast JSON (HTTPS): {}", parseEx.getMessage());
                            }
                        }
                    }
                } else {
                    status.put("errorMessage", "Icecast HTTPS returned HTTP " + responseCode);
                    if (logWarnings) {
                        logger.warn("Icecast HTTPS returned HTTP {}", responseCode);
                    } else {
                        logger.debug("Icecast HTTPS returned HTTP {}", responseCode);
                    }
                }
            } catch (IOException e2) {
                status.put("errorMessage", "Cannot connect to Icecast server (both direct and HTTPS): " + e.getMessage() + " / " + e2.getMessage());
                if (logWarnings) {
                    logger.warn("Failed to check Icecast mount point status (both direct and HTTPS): {} / {}", e.getMessage(), e2.getMessage());
                } else {
                    logger.debug("Failed to check Icecast mount point status (both direct and HTTPS): {} / {}", e.getMessage(), e2.getMessage());
                }
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

    /**
     * Port used for source publishing (FFmpeg -> Icecast). Defaults to 8000.
     */
    public int getIcecastSourcePort() {
        // If explicitly configured, use it; else fall back to icecastPort
        return icecastSourcePort > 0 ? icecastSourcePort : icecastPort;
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
     * Get the earliest start time (epoch millis) among active broadcasts, or null if none.
     */
    public Long getEarliestActiveBroadcastStartTimeMillis() {
        if (activeBroadcasts.isEmpty()) {
            return null;
        }
        long earliest = Long.MAX_VALUE;
        for (BroadcastInfo bi : activeBroadcasts.values()) {
            if (bi.startTime > 0 && bi.startTime < earliest) {
                earliest = bi.startTime;
            }
        }
        return earliest == Long.MAX_VALUE ? null : earliest;
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
