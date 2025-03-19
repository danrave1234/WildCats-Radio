package com.wildcastradio.ShoutCast;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

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
    
    private final HttpClient httpClient;
    
    public ShoutcastService() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
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
            
            String requestBody = String.format("action=startstream&mount=%s&password=%s",
                    URLEncoder.encode(mountPoint, StandardCharsets.UTF_8),
                    URLEncoder.encode(adminPassword, StandardCharsets.UTF_8));
            
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(startStreamUrl))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();
            
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            // Log response for debugging
            logger.info("Shoutcast stream start response: {}", response.statusCode());
            
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                String streamUrl = String.format("http://%s:%d%s", serverUrl, serverPort, mountPoint);
                logger.info("Stream started successfully: {}", streamUrl);
                
                // Update StreamingConfig in database for persistence
                updateStreamingConfig();
                
                return streamUrl;
            } else {
                logger.error("Failed to start Shoutcast stream: {}", response.body());
                throw new RuntimeException("Failed to start Shoutcast stream");
            }
        } catch (IOException | InterruptedException e) {
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
            
            String requestBody = String.format("action=stopstream&mount=%s&password=%s",
                    URLEncoder.encode(mountPoint, StandardCharsets.UTF_8),
                    URLEncoder.encode(adminPassword, StandardCharsets.UTF_8));
            
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(stopStreamUrl))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();
            
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            // Log response for debugging
            logger.info("Shoutcast stream stop response: {}", response.statusCode());
            
            if (response.statusCode() >= 400) {
                logger.error("Failed to stop Shoutcast stream: {}", response.body());
                throw new RuntimeException("Failed to stop Shoutcast stream");
            }
            
            logger.info("Stream stopped successfully");
        } catch (IOException | InterruptedException e) {
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
            
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(statusUrl))
                    .GET()
                    .build();
            
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            boolean isAccessible = response.statusCode() >= 200 && response.statusCode() < 300;
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
}
