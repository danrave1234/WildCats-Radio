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

@Service
public class ShoutcastService {
    private static final Logger logger = LoggerFactory.getLogger(ShoutcastService.class);

    @Value("${shoutcast.server.url:localhost}")
    private String serverUrl;

    @Value("${shoutcast.server.port:8000}")
    private int serverPort;

    @Value("${shoutcast.server.admin.password:admin}")
    private String adminPassword;

    @Value("${shoutcast.server.source.password:hackme}")
    private String sourcePassword;

    @Value("${shoutcast.server.mount:/stream/1}")
    private String mountPoint;
    
    private boolean testMode = false;

    @Autowired
    private StreamingConfigService streamingConfigService;

    private final RestTemplate restTemplate;

    public ShoutcastService() {
        this.restTemplate = new RestTemplate();
        // Enable test mode by default for development/testing
        this.testMode = true;
        logger.info("ShoutCast service initialized with test mode ENABLED by default");
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
            // For ShoutCast, typically we need to make an admin request to start the stream
            // This is a simplified example - real implementation would depend on ShoutCast API
            String startStreamUrl = String.format("http://%s:%d/admin.cgi", 
                    serverUrl, serverPort);

            // Create headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            // Create form data
            MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
            formData.add("action", "startstream");
            formData.add("mount", mountPoint);
            formData.add("password", adminPassword);

            // Create the request entity
            HttpEntity<MultiValueMap<String, String>> requestEntity = new HttpEntity<>(formData, headers);

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
            // For ShoutCast, typically we need to make an admin request to stop the stream
            String stopStreamUrl = String.format("http://%s:%d/admin.cgi", 
                    serverUrl, serverPort);

            // Create headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            // Create form data
            MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
            formData.add("action", "stopstream");
            formData.add("mount", mountPoint);
            formData.add("password", adminPassword);

            // Create the request entity
            HttpEntity<MultiValueMap<String, String>> requestEntity = new HttpEntity<>(formData, headers);

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

        // Generate a mock stream URL
        String testStreamUrl = String.format("http://test-stream.wildcastradio.example.com/stream/%d", broadcast.getId());

        // Log the operation
        logger.info("Test stream URL generated: {}", testStreamUrl);

        return testStreamUrl;
    }
}
