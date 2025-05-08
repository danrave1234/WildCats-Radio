package com.wildcastradio.ShoutCast;

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

@Service
public class ShoutcastService {
    private static final Logger logger = LoggerFactory.getLogger(ShoutcastService.class);

    @Value("${shoutcast.server.url:localhost}")
    private String serverUrl;

    @Value("${shoutcast.server.port:8000}")
    private int serverPort;

    @Value("${shoutcast.server.admin.password:123}")
    private String adminPassword;

    @Value("${shoutcast.server.source.password:1234}")
    private String sourcePassword;

    @Value("${shoutcast.server.mount:/stream/1}")
    private String mountPoint;
    
    private boolean testMode = false;

    @Autowired
    private StreamingConfigService streamingConfigService;

    private final RestTemplate restTemplate;
    
    /**
     * Constructor for ShoutcastService
     * Initializes RestTemplate and enables test mode for development
     */
    public ShoutcastService() {
        this.restTemplate = new RestTemplate();
        // Enable test mode by default for development/testing
        this.testMode = true;
        logger.info("ShoutCast service initialized with test mode ENABLED by default");
    }

    /**
     * PostConstruct method to log the loaded configuration
     */
    @PostConstruct
    public void init() {
        logger.info("ShoutCast service initialized with configuration:");
        logger.info("Server URL: {}", serverUrl);
        logger.info("Server Port: {}", serverPort);
        logger.info("Mount Point: {}", mountPoint);
        logger.info("Test Mode: {}", testMode);
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
     * 
     * @return true if the server is accessible, false otherwise
     */
    public boolean isServerAccessible() {
        if (testMode) {
            logger.info("ShoutCast server accessible check bypassed in TEST MODE");
            return true;
        }
        
        try {
            String statusUrl = String.format("http://%s:%d/7.html", serverUrl, serverPort);

            ResponseEntity<String> response = restTemplate.getForEntity(statusUrl, String.class);

            boolean isAccessible = response.getStatusCode().is2xxSuccessful();
            logger.info("ShoutCast server accessible: {}", isAccessible);
            return isAccessible;
        } catch (Exception e) {
            logger.warn("ShoutCast server not accessible", e);
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
        String testStreamUrl = String.format("http://%s:%d/stream/1", serverUrl, serverPort);

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
}
