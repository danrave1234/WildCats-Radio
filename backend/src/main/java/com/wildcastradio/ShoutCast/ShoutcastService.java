package com.wildcastradio.ShoutCast;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.StreamingConfig.StreamingConfigEntity;
import com.wildcastradio.StreamingConfig.StreamingConfigService;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

@Service
public class ShoutcastService {
    private static final Logger logger = LoggerFactory.getLogger(ShoutcastService.class);

    @Value("${shoutcast.server.url:localhost}")
    private String serverUrl;

    @Value("${shoutcast.server.port:8000}")
    private int serverPort;

    @Value("${shoutcast.server.admin.password:admin}")
    private String adminPassword;

    @Value("${shoutcast.server.source.password:pass123}")
    private String sourcePassword;

    @Value("${shoutcast.server.mount:/stream}")
    private String mountPoint;

    @Value("${shoutcast.test.mode:false}")
    private boolean testMode;
    
    @Value("${shoutcast.monitor.interval:60}")
    private int monitorIntervalSeconds;

    @Autowired
    private StreamingConfigService streamingConfigService;

    private final RestTemplate restTemplate;
    
    // Status monitoring
    private final AtomicBoolean serverStatus = new AtomicBoolean(false);
    private final Map<String, Object> serverDiagnostics = new HashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
    
    /**
     * Constructor for ShoutcastService
     * Initializes RestTemplate
     */
    public ShoutcastService() {
        this.restTemplate = new RestTemplate();
    }

    /**
     * PostConstruct method to log the loaded configuration and start monitoring
     */
    @PostConstruct
    public void init() {
        logger.info("ShoutCast service initialized with configuration:");
        logger.info("Server URL: {}", serverUrl);
        logger.info("Server Port: {}", serverPort);
        logger.info("Mount Point: {}", mountPoint);
        logger.info("Test Mode: {}", testMode);
        
        // Start the server status monitoring if not in test mode
        if (!testMode) {
            startServerMonitoring();
        } else {
            // In test mode, always report server as up
            serverStatus.set(true);
            serverDiagnostics.put("status", "UP");
            serverDiagnostics.put("mode", "TEST");
            logger.info("ShoutCast monitoring disabled in TEST MODE");
        }
    }
    
    /**
     * Start periodic monitoring of the ShoutCast server
     */
    private void startServerMonitoring() {
        logger.info("Starting ShoutCast server monitoring with interval of {} seconds", monitorIntervalSeconds);
        
        // Run initial check immediately
        checkServerStatus();
        
        // Schedule periodic checks
        scheduler.scheduleAtFixedRate(this::checkServerStatus, 
            monitorIntervalSeconds, monitorIntervalSeconds, TimeUnit.SECONDS);
    }
    
    /**
     * Check the server status and update the internal state
     */
    private void checkServerStatus() {
        try {
            boolean accessible = isServerAccessible();
            serverStatus.set(accessible);
            
            // Update diagnostics
            serverDiagnostics.put("status", accessible ? "UP" : "DOWN");
            serverDiagnostics.put("lastChecked", System.currentTimeMillis());
            serverDiagnostics.put("url", serverUrl);
            serverDiagnostics.put("port", serverPort);
            serverDiagnostics.put("mountPoint", mountPoint);
            
            // If accessible, try to get more details
            if (accessible) {
                try {
                    int listeners = getCurrentListeners();
                    serverDiagnostics.put("listeners", listeners);
                    
                    // Try to get stream status from stats endpoint
                    String statsUrl = String.format("http://%s:%d/stats?sid=1", serverUrl, serverPort);
                    ResponseEntity<String> statsResponse = restTemplate.getForEntity(statsUrl, String.class);
                    
                    if (statsResponse.getStatusCode().is2xxSuccessful()) {
                        String content = statsResponse.getBody();
                        
                        // Parse STREAMSTATUS value
                        if (content != null && content.contains("<STREAMSTATUS>")) {
                            int startIndex = content.indexOf("<STREAMSTATUS>") + "<STREAMSTATUS>".length();
                            int endIndex = content.indexOf("</STREAMSTATUS>");
                            
                            if (startIndex >= 0 && endIndex >= 0) {
                                String streamStatus = content.substring(startIndex, endIndex).trim();
                                serverDiagnostics.put("streamActive", "1".equals(streamStatus));
                            }
                        }
                    }
                } catch (Exception e) {
                    logger.warn("Error getting additional server details", e);
                }
            }
        } catch (Exception e) {
            logger.error("Error in server monitoring task", e);
            serverStatus.set(false);
            serverDiagnostics.put("status", "ERROR");
            serverDiagnostics.put("lastError", e.getMessage());
        }
    }

    /**
     * Enables test mode for the ShoutCast service
     * When enabled, the service will always report the server as accessible
     * 
     * @param enabled true to enable test mode, false to disable
     */
    public void setTestMode(boolean enabled) {
        this.testMode = enabled;
        logger.info("ShoutCast service test mode set to: {}", enabled);
        
        // If changing modes, update monitoring
        if (enabled) {
            // Stop monitoring
            scheduler.shutdown();
            try {
                scheduler.awaitTermination(5, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            
            // Set status to UP in test mode
            serverStatus.set(true);
            serverDiagnostics.put("status", "UP");
            serverDiagnostics.put("mode", "TEST");
        } else {
            // Start monitoring again
            startServerMonitoring();
        }
    }

    /**
     * Returns the current test mode state
     * 
     * @return true if test mode is enabled, false otherwise
     */
    public boolean isInTestMode() {
        return this.testMode;
    }
    
    /**
     * Returns the server diagnostics map with detailed status information
     * 
     * @return Map with server diagnostics
     */
    public Map<String, Object> getServerDiagnostics() {
        return new HashMap<>(serverDiagnostics);
    }

    /**
     * Starts a stream on the ShoutCast DNAS server
     * 
     * @param broadcast The broadcast entity for which to start the stream
     * @return The stream URL that clients can use to connect
     */
    public String startStream(BroadcastEntity broadcast) {
        if (testMode) {
            logger.info("Starting stream in TEST MODE for: {}", broadcast.getTitle());
            return getTestStreamUrl(broadcast);
        }

        try {
            // For ShoutCast, we need to authenticate in the URL itself (not in the form data)
            // ShoutCast v2.x expects the password as a URL parameter
            String startStreamUrl = String.format("http://%s:%d/admin.cgi?pass=%s", 
                    serverUrl, serverPort, adminPassword);

            // Create headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            // Create form data - ShoutCast expects action parameters in the form data
            MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
            formData.add("action", "startstream");
            formData.add("mount", mountPoint);

            // Create the request entity
            HttpEntity<MultiValueMap<String, String>> requestEntity = new HttpEntity<>(formData, headers);

            // Log the request for debugging
            logger.info("Sending request to ShoutCast server: URL={}, Mount={}", startStreamUrl, mountPoint);

            // Make the request
            ResponseEntity<String> response = restTemplate.exchange(
                    startStreamUrl,
                    HttpMethod.POST,
                    requestEntity,
                    String.class
            );

            // Log response for debugging
            logger.info("ShoutCast stream start response: {}", response.getStatusCode());

            if (response.getStatusCode().is2xxSuccessful()) {
                String streamUrl = String.format("http://%s:%d%s", serverUrl, serverPort, mountPoint);
                logger.info("Stream started successfully: {}", streamUrl);

                // Update StreamingConfig in database for persistence
                updateStreamingConfig();
                
                // Update diagnostics
                serverDiagnostics.put("lastStreamStart", System.currentTimeMillis());
                serverDiagnostics.put("currentBroadcast", broadcast.getTitle());

                return streamUrl;
            } else {
                logger.error("Failed to start ShoutCast stream: {}", response.getBody());
                throw new RuntimeException("Failed to start ShoutCast stream");
            }
        } catch (RestClientException e) {
            logger.error("Error starting ShoutCast stream", e);
            throw new RuntimeException("Error starting ShoutCast stream", e);
        }
    }

    /**
     * Ends a stream on the ShoutCast DNAS server
     * 
     * @param broadcast The broadcast entity for which to end the stream
     */
    public void endStream(BroadcastEntity broadcast) {
        if (testMode) {
            logger.info("Ending stream in TEST MODE for: {}", broadcast.getTitle());
            return;
        }

        try {
            // For ShoutCast, we need to authenticate in the URL itself (not in the form data)
            String stopStreamUrl = String.format("http://%s:%d/admin.cgi?pass=%s", 
                    serverUrl, serverPort, adminPassword);

            // Create headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            // Create form data
            MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
            formData.add("action", "stopstream");
            formData.add("mount", mountPoint);

            // Create the request entity
            HttpEntity<MultiValueMap<String, String>> requestEntity = new HttpEntity<>(formData, headers);

            // Log the request for debugging
            logger.info("Sending request to stop ShoutCast stream: URL={}, Mount={}", stopStreamUrl, mountPoint);

            // Make the request
            ResponseEntity<String> response = restTemplate.exchange(
                    stopStreamUrl,
                    HttpMethod.POST,
                    requestEntity,
                    String.class
            );

            // Log response for debugging
            logger.info("ShoutCast stream stop response: {}", response.getStatusCode());
            
            // Update server diagnostics
            serverDiagnostics.put("lastStreamEnd", System.currentTimeMillis());
            serverDiagnostics.put("currentBroadcast", null);

            if (response.getStatusCode().is4xxClientError()) {
                logger.error("Failed to stop ShoutCast stream: {}", response.getBody());
                throw new RuntimeException("Failed to stop ShoutCast stream");
            }

            logger.info("Stream stopped successfully");
        } catch (RestClientException e) {
            logger.error("Error stopping ShoutCast stream", e);
            throw new RuntimeException("Error stopping ShoutCast stream", e);
        }
    }

    /**
     * Checks if the ShoutCast server is running and accessible
     * Uses the cached status if monitoring is enabled (unless in test mode)
     * 
     * @return true if the server is accessible, false otherwise
     */
    public boolean isServerAccessible() {
        if (testMode) {
            logger.info("ShoutCast server accessible check bypassed in TEST MODE");
            return true;
        }
        
        // If monitoring is active, use the cached status
        if (monitorIntervalSeconds > 0 && serverDiagnostics.containsKey("lastChecked")) {
            // Only use cached value if it's less than double the check interval old
            long lastChecked = (long) serverDiagnostics.getOrDefault("lastChecked", 0L);
            long maxAge = monitorIntervalSeconds * 2 * 1000L;
            
            if (System.currentTimeMillis() - lastChecked < maxAge) {
                return serverStatus.get();
            }
        }

        // Otherwise, do a live check
        try {
            logger.debug("Performing live ShoutCast server accessibility check");
            
            // Try the standard ShoutCast status URL (7.html) first - fastest check
            String statusUrl = String.format("http://%s:%d/7.html", serverUrl, serverPort);
            try {
                ResponseEntity<String> response = restTemplate.getForEntity(statusUrl, String.class);
                if (response.getStatusCode().is2xxSuccessful()) {
                    logger.debug("ShoutCast server accessible via 7.html");
                    return true;
                }
            } catch (Exception e) {
                // Just try the next method
                logger.debug("7.html check failed, trying stats URL: {}", e.getMessage());
            }
            
            // If first check fails, try the stats endpoint
            String statsUrl = String.format("http://%s:%d/stats", serverUrl, serverPort);
            try {
                ResponseEntity<String> statsResponse = restTemplate.getForEntity(statsUrl, String.class);
                if (statsResponse.getStatusCode().is2xxSuccessful()) {
                    logger.debug("ShoutCast server accessible via stats endpoint");
                    return true;
                }
            } catch (Exception e) {
                // Just try the next method
                logger.debug("Stats check failed, trying direct socket connection: {}", e.getMessage());
            }
            
            // If both HTTP methods fail, try a direct socket connection
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(serverUrl, serverPort), 3000);
                logger.debug("ShoutCast server accessible via direct socket connection");
                return true;
            } catch (IOException socketException) {
                logger.warn("All ShoutCast server accessibility checks failed. Server appears to be down.");
                return false;
            }
        } catch (Exception e) {
            logger.error("Error checking ShoutCast server accessibility", e);
            return false;
        }
    }
    
    /**
     * Launches the ShoutCast server process. Only works if the server is on the same machine.
     * 
     * @return true if server was launched successfully, false otherwise
     */
    public boolean launchServer() {
        if (!serverUrl.equals("localhost") && !serverUrl.equals("127.0.0.1")) {
            logger.warn("Cannot launch ShoutCast server on remote host: {}", serverUrl);
            return false;
        }
        
        try {
            // Attempt to find the server executable in common locations
            String[] possibleLocations = {
                "ShoutcastV2/sc_serv.exe",
                "ShoutcastV2/sc_serv2_win64-latest.exe",
                "sc_serv.exe",
                "sc_serv2_win64-latest.exe"
            };
            
            String executablePath = null;
            for (String location : possibleLocations) {
                if (new java.io.File(location).exists()) {
                    executablePath = location;
                    break;
                }
            }
            
            if (executablePath == null) {
                logger.error("Could not find ShoutCast server executable");
                return false;
            }
            
            // Look for config file
            String configPath = "ShoutcastV2/sc_serv.conf";
            if (!new java.io.File(configPath).exists()) {
                configPath = "sc_serv.conf";
                if (!new java.io.File(configPath).exists()) {
                    logger.error("Could not find ShoutCast server configuration");
                    return false;
                }
            }
            
            // Start the process
            ProcessBuilder pb = new ProcessBuilder(executablePath, configPath);
            pb.redirectErrorStream(true);
            Process process = pb.start();
            
            // Start a thread to read and log the output
            new Thread(() -> {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        logger.info("ShoutCast Server: {}", line);
                    }
                } catch (IOException e) {
                    logger.error("Error reading ShoutCast server output", e);
                }
            }).start();
            
            // Wait a bit to see if the process stays alive
            Thread.sleep(1000);
            if (!process.isAlive()) {
                logger.error("ShoutCast server process terminated immediately with exit code: {}", process.exitValue());
                return false;
            }
            
            logger.info("ShoutCast server launched successfully");
            return true;
        } catch (Exception e) {
            logger.error("Error launching ShoutCast server", e);
            return false;
        }
    }

    /**
     * Updates the StreamingConfig entity in the database with the current property values
     */
    private void updateStreamingConfig() {
        StreamingConfigEntity config = new StreamingConfigEntity(
                serverUrl,
                serverPort,
                mountPoint,
                adminPassword,
                "SHOUTCAST"
        );
        streamingConfigService.updateConfig(config);
    }

    /**
     * Test mode method that doesn't try to connect to the actual ShoutCast server.
     * For use during development when ShoutCast integration is not available.
     * 
     * @param broadcast The broadcast entity for which to simulate starting a stream
     * @return A mock stream URL
     */
    public String getTestStreamUrl(BroadcastEntity broadcast) {
        logger.info("Getting test stream URL for broadcast: {}", broadcast.getTitle());

        // Generate a stream URL that points to the local Shoutcast instance
        String testStreamUrl = String.format("http://%s:%d%s", serverUrl, serverPort, mountPoint);

        // Log the operation
        logger.info("Test stream URL generated: {}", testStreamUrl);

        return testStreamUrl;
    }

    /**
     * Get the server URL for the Shoutcast server
     * 
     * @return The server URL
     */
    public String getServerUrl() {
        return serverUrl;
    }

    /**
     * Get the server port for the Shoutcast server
     * 
     * @return The server port
     */
    public String getServerPort() {
        return String.valueOf(serverPort);
    }

    /**
     * Get the mount point for the Shoutcast server
     * 
     * @return The mount point
     */
    public String getMountPoint() {
        return mountPoint;
    }

    /**
     * Get the current number of listeners connected to the ShoutCast server
     * 
     * @return The number of listeners, or 0 if test mode or error
     */
    public int getCurrentListeners() {
        if (testMode) {
            // In test mode, return a random number of listeners for demo purposes
            return (int)(Math.random() * 10);
        }

        try {
            // Query the ShoutCast XML status API
            // Format: /stats?sid=1
            String statusUrl = String.format("http://%s:%d/stats?sid=1", serverUrl, serverPort);

            ResponseEntity<String> response = restTemplate.getForEntity(statusUrl, String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                String xmlResponse = response.getBody();

                // Parse the simple XML response to get listener count
                // SHOUTcast XML response format: <SHOUTCASTSERVER><CURRENTLISTENERS>X</CURRENTLISTENERS>...</SHOUTCASTSERVER>
                if (xmlResponse != null && xmlResponse.contains("<CURRENTLISTENERS>")) {
                    int startIndex = xmlResponse.indexOf("<CURRENTLISTENERS>") + "<CURRENTLISTENERS>".length();
                    int endIndex = xmlResponse.indexOf("</CURRENTLISTENERS>");

                    if (startIndex >= 0 && endIndex >= 0) {
                        String listenerCountStr = xmlResponse.substring(startIndex, endIndex).trim();
                        try {
                            return Integer.parseInt(listenerCountStr);
                        } catch (NumberFormatException e) {
                            logger.warn("Failed to parse listener count from: {}", listenerCountStr);
                        }
                    }
                }
            }

            logger.warn("Could not retrieve listener count from ShoutCast server");
            return 0;
        } catch (Exception e) {
            logger.warn("Error getting listener count from ShoutCast server", e);
            return 0;
        }
    }
    
    /**
     * Clean up resources when the bean is destroyed
     */
    @PreDestroy
    public void cleanup() {
        logger.info("Shutting down ShoutCast service");
        
        // Shutdown the scheduler
        if (scheduler != null && !scheduler.isShutdown()) {
            try {
                scheduler.shutdown();
                if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                    scheduler.shutdownNow();
                }
            } catch (InterruptedException e) {
                scheduler.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }
    }
}
