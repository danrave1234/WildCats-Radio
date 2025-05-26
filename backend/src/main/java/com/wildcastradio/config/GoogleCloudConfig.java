package com.wildcastradio.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import jakarta.annotation.PostConstruct;

/**
 * Configuration class for Google Cloud specific settings.
 * Handles deployment-specific configurations for Icecast and network settings.
 */
@Configuration
public class GoogleCloudConfig {
    private static final Logger logger = LoggerFactory.getLogger(GoogleCloudConfig.class);

    @Value("${icecast.host:34.142.131.206}")
    private String icecastHost;

    @Value("${icecast.port:8000}")
    private int icecastPort;

    @Value("${icecast.source.username:source}")
    private String icecastUsername;

    @Value("${icecast.source.password:hackme}")
    private String icecastPassword;

    @Value("${icecast.admin.username:admin}")
    private String icecastAdminUsername;

    @Value("${icecast.admin.password:hackme}")
    private String icecastAdminPassword;

    @Value("${icecast.mount.point:/live.ogg}")
    private String icecastMountPoint;

    @Value("${server.port:8080}")
    private int serverPort;

    // Deployment environment detection
    @Value("${spring.profiles.active:default}")
    private String activeProfile;

    @Value("${PORT:#{null}}")
    private String herokuPort;

    @PostConstruct
    public void logConfiguration() {
        logger.info("=== Google Cloud Icecast Configuration ===");
        logger.info("Icecast Host: {}", icecastHost);
        logger.info("Icecast Port: {}", icecastPort);
        logger.info("Icecast Mount Point: {}", icecastMountPoint);
        logger.info("Server Port: {}", serverPort);
        logger.info("Active Profile: {}", activeProfile);
        logger.info("Heroku Port Environment: {}", herokuPort != null ? herokuPort : "Not set");
        logger.info("==========================================");

        // Validate configuration
        validateConfiguration();
    }

    private void validateConfiguration() {
        if (icecastHost == null || icecastHost.trim().isEmpty()) {
            logger.warn("Icecast host is not configured properly");
        }

        if (icecastPort <= 0 || icecastPort > 65535) {
            logger.warn("Icecast port {} is not in valid range", icecastPort);
        }

        if (icecastMountPoint == null || !icecastMountPoint.startsWith("/")) {
            logger.warn("Icecast mount point '{}' should start with '/'", icecastMountPoint);
        }

        logger.info("Configuration validation completed");
    }

    /**
     * Check if we're running in a cloud environment
     */
    public boolean isCloudDeployment() {
        return herokuPort != null || "prod".equals(activeProfile) || "cloud".equals(activeProfile);
    }

    /**
     * Get the complete Icecast server URL
     */
    public String getIcecastServerUrl() {
        return "http://" + icecastHost + ":" + icecastPort;
    }

    /**
     * Get the complete stream URL for listeners
     */
    public String getStreamUrl() {
        return getIcecastServerUrl() + icecastMountPoint;
    }

    /**
     * Get Icecast source connection string for FFmpeg
     */
    public String getIcecastSourceUrl() {
        return "icecast://" + icecastUsername + ":" + icecastPassword + 
               "@" + icecastHost + ":" + icecastPort + icecastMountPoint;
    }

    /**
     * Get Icecast admin URL for status checking
     */
    public String getIcecastAdminUrl() {
        return getIcecastServerUrl() + "/admin/";
    }

    // Getters for all configuration values
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

    public String getIcecastAdminUsername() {
        return icecastAdminUsername;
    }

    public String getIcecastAdminPassword() {
        return icecastAdminPassword;
    }

    public String getIcecastMountPoint() {
        return icecastMountPoint;
    }

    public int getServerPort() {
        return serverPort;
    }

    public String getActiveProfile() {
        return activeProfile;
    }
} 