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

    @Autowired
    private StreamingConfigService streamingConfigService;

    private final RestTemplate restTemplate;

    public ShoutcastService() {
        this.restTemplate = new RestTemplate();
    }

    /**
     * Starts a stream on the Shoutcast DNAS server
     * 
     * @param broadcast The broadcast entity for which to start the stream
     * @return The stream URL that clients can use to connect
     */
    public String startStream(BroadcastEntity broadcast) {
        try {
            // For Shoutcast, typically we need to make an admin request to start the stream
            // This is a simplified example - real implementation would depend on Shoutcast API
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
            logger.info("Shoutcast stream start response: {}", response.getStatusCode());

            if (response.getStatusCode().is2xxSuccessful()) {
                String streamUrl = String.format("http://%s:%d%s", serverUrl, serverPort, mountPoint);
                logger.info("Stream started successfully: {}", streamUrl);

                // Update StreamingConfig in database for persistence
                updateStreamingConfig();

                return streamUrl;
            } else {
                logger.error("Failed to start Shoutcast stream: {}", response.getBody());
                throw new RuntimeException("Failed to start Shoutcast stream");
            }
        } catch (RestClientException e) {
            logger.error("Error starting Shoutcast stream", e);
            throw new RuntimeException("Error starting Shoutcast stream", e);
        }
    }

    /**
     * Ends a stream on the Shoutcast DNAS server
     * 
     * @param broadcast The broadcast entity for which to end the stream
     */
    public void endStream(BroadcastEntity broadcast) {
        try {
            // For Shoutcast, typically we need to make an admin request to stop the stream
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
            logger.info("Shoutcast stream stop response: {}", response.getStatusCode());

            if (response.getStatusCode().is4xxClientError()) {
                logger.error("Failed to stop Shoutcast stream: {}", response.getBody());
                throw new RuntimeException("Failed to stop Shoutcast stream");
            }

            logger.info("Stream stopped successfully");
        } catch (RestClientException e) {
            logger.error("Error stopping Shoutcast stream", e);
            throw new RuntimeException("Error stopping Shoutcast stream", e);
        }
    }

    /**
     * Checks if the Shoutcast server is running and accessible
     * 
     * @return true if the server is accessible, false otherwise
     */
    public boolean isServerAccessible() {
        try {
            String statusUrl = String.format("http://%s:%d/7.html", serverUrl, serverPort);

            ResponseEntity<String> response = restTemplate.getForEntity(statusUrl, String.class);

            boolean isAccessible = response.getStatusCode().is2xxSuccessful();
            logger.info("Shoutcast server accessible: {}", isAccessible);
            return isAccessible;
        } catch (Exception e) {
            logger.warn("Shoutcast server not accessible", e);
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
     * Test mode method that doesn't try to connect to the actual Shoutcast server.
     * For use during development when Shoutcast integration is not available.
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
