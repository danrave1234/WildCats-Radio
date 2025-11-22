package com.wildcastradio.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import com.wildcastradio.icecast.IcecastService;

/**
 * Startup validator that checks system configuration and connectivity
 * on application startup for Google Cloud deployment.
 */
@Component
public class StartupValidator implements CommandLineRunner {
    private static final Logger logger = LoggerFactory.getLogger(StartupValidator.class);

    @Autowired
    private IcecastService icecastService;

    @Autowired
    private GoogleCloudConfig googleCloudConfig;

    @Autowired
    private NetworkConfig networkConfig;

    @Override
    public void run(String... args) throws Exception {
        logger.info("=== WildCats Radio Startup Validation ===");
        
        validateGoogleCloudConfiguration();
        validateNetworkConfiguration();
        validateIcecastConnectivity();
        validateWebSocketConfiguration();
        
        logger.info("=== Startup Validation Complete ===");
    }

    private void validateGoogleCloudConfiguration() {
        logger.info("Validating Google Cloud configuration...");
        
        try {
            String icecastUrl = googleCloudConfig.getIcecastServerUrl();
            String streamUrl = googleCloudConfig.getStreamUrl();
            String sourceUrl = googleCloudConfig.getIcecastSourceUrl();
            
            logger.info("✓ Google Cloud Icecast Server URL: {}", icecastUrl);
            logger.info("✓ Stream URL for listeners: {}", streamUrl);
            logger.info("✓ Source URL configured for FFmpeg");
            logger.info("✓ Mount point: {}", googleCloudConfig.getIcecastMountPoint());
            logger.info("✓ Cloud deployment mode: {}", googleCloudConfig.isCloudDeployment());
            
            // Check if required credentials are set
            if (googleCloudConfig.getIcecastUsername() != null && 
                googleCloudConfig.getIcecastPassword() != null) {
                logger.info("✓ Icecast credentials configured");
            } else {
                logger.warn("⚠ Icecast credentials may not be properly configured");
            }
            
        } catch (Exception e) {
            logger.error("✗ Error validating Google Cloud configuration: {}", e.getMessage());
        }
    }

    private void validateNetworkConfiguration() {
        logger.info("Validating network configuration...");
        
        try {
            String serverIp = networkConfig.getServerIp();
            int serverPort = networkConfig.getServerPort();
            int icecastPort = networkConfig.getPreferredIcecastPort();
            
            logger.info("✓ Server IP detected: {}", serverIp);
            logger.info("✓ Server port: {}", serverPort);
            logger.info("✓ Icecast port: {}", icecastPort);
            
            // Validate URLs (bare-bones)
            String webSocketUrl = networkConfig.getWebSocketUrl();
            
            logger.info("✓ DJ WebSocket URL: {}", webSocketUrl);
            // Listener WebSocket URL removed - listener status now via STOMP /topic/listener-status
            
        } catch (Exception e) {
            logger.error("✗ Error validating network configuration: {}", e.getMessage());
        }
    }

    private void validateIcecastConnectivity() {
        logger.info("Testing Google Cloud Icecast connectivity...");
        
        try {
            // Test basic connectivity to Icecast server
            boolean serverUp = icecastService.isServerUp();
            if (serverUp) {
                logger.info("✓ Google Cloud Icecast server is accessible");
                
                // Test stream status
                boolean streamLive = icecastService.isStreamLive();
                logger.info("✓ Stream status checked - Currently live: {}", streamLive);
                
                // Test listener count functionality
                Integer listenerCount = icecastService.getCurrentListenerCount();
                logger.info("✓ Listener count functionality working - Current: {}", 
                           listenerCount != null ? listenerCount : "0");
                
            } else {
                logger.warn("⚠ Google Cloud Icecast server is not accessible at startup");
                logger.warn("  This may be normal if the server starts on-demand");
                logger.warn("  Server URL: {}", icecastService.getIcecastUrl());
            }
            
        } catch (Exception e) {
            logger.warn("⚠ Could not test Icecast connectivity: {}", e.getMessage());
            logger.warn("  This may be normal if the server is not running yet");
        }
    }

    private void validateWebSocketConfiguration() {
        logger.info("Validating WebSocket configuration...");
        
        try {
            String djWebSocketUrl = icecastService.getWebSocketUrl();
            
            logger.info("✓ DJ WebSocket endpoint: {}", djWebSocketUrl);
            // Listener WebSocket endpoint removed - listener status now via STOMP /topic/listener-status
            
            // Validate WebSocket paths
            if (djWebSocketUrl.contains("/ws/live")) {
                logger.info("✓ DJ WebSocket path configured correctly");
            } else {
                logger.warn("⚠ DJ WebSocket path may be incorrect");
            }
            
            logger.info("✓ Listener status now handled via STOMP /topic/listener-status");
            
        } catch (Exception e) {
            logger.error("✗ Error validating WebSocket configuration: {}", e.getMessage());
        }
    }
} 