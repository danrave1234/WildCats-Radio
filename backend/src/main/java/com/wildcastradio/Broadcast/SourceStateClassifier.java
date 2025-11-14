package com.wildcastradio.Broadcast;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.wildcastradio.radio.RadioAgentClient;

/**
 * Classifies source disconnection types based on health check data.
 * Determines the appropriate recovery strategy for stream source issues.
 */
@Component
public class SourceStateClassifier {
    private static final Logger logger = LoggerFactory.getLogger(SourceStateClassifier.class);
    
    @Autowired(required = false)
    private RadioAgentClient radioAgentClient;
    
    @Value("${broadcast.recovery.classification.networkIssueTimeoutMs:30000}")
    private long networkIssueTimeoutMs;
    
    @Value("${broadcast.recovery.classification.enabled:true}")
    private boolean classificationEnabled;
    
    /**
     * Classify the type of source disconnection based on health check data.
     * 
     * @param healthCheck Health check results from IcecastService
     * @param icecastReachable Whether Icecast server is reachable
     * @param liquidsoapRunning Whether Liquidsoap service is running
     * @param mountPointExists Whether the mount point exists in Icecast
     * @param hasActiveSource Whether there's an active source connected
     * @param bitrate Current bitrate (0 if no source)
     * @return Classified disconnection type
     */
    public SourceDisconnectionType classify(
            Map<String, Object> healthCheck,
            boolean icecastReachable,
            boolean liquidsoapRunning,
            boolean mountPointExists,
            boolean hasActiveSource,
            int bitrate) {
        
        if (!classificationEnabled) {
            logger.debug("Source state classification is disabled, returning UNKNOWN");
            return SourceDisconnectionType.UNKNOWN;
        }
        
        // Check for server-side issues first (highest priority)
        if (!liquidsoapRunning) {
            logger.debug("Liquidsoap service is not running - classified as SERVER_ISSUE");
            return SourceDisconnectionType.SERVER_ISSUE;
        }
        
        if (!icecastReachable) {
            logger.debug("Icecast server is not reachable - classified as SERVER_ISSUE");
            return SourceDisconnectionType.SERVER_ISSUE;
        }
        
        // If server is reachable and Liquidsoap is running, but no source
        if (icecastReachable && liquidsoapRunning && mountPointExists && !hasActiveSource) {
            // This indicates DJ source disconnected
            logger.debug("Server healthy but no active source - classified as DJ_SOURCE_DISCONNECTED");
            return SourceDisconnectionType.DJ_SOURCE_DISCONNECTED;
        }
        
        // If mount point doesn't exist but server is reachable
        if (icecastReachable && liquidsoapRunning && !mountPointExists) {
            // Could be network issue or source never connected
            // Check if this is a new broadcast (within grace period)
            Object errorMessage = healthCheck.get("errorMessage");
            if (errorMessage != null && errorMessage.toString().contains("grace period")) {
                logger.debug("Within grace period - classified as UNKNOWN (too early to classify)");
                return SourceDisconnectionType.UNKNOWN;
            }
            
            // If bitrate is 0 and no source, likely DJ source disconnected
            if (bitrate == 0) {
                logger.debug("Mount point missing with zero bitrate - classified as DJ_SOURCE_DISCONNECTED");
                return SourceDisconnectionType.DJ_SOURCE_DISCONNECTED;
            }
        }
        
        // If server is reachable but source has low/zero bitrate
        if (icecastReachable && liquidsoapRunning && mountPointExists && hasActiveSource && bitrate == 0) {
            // Source connected but no data flowing - likely network issue
            logger.debug("Source connected but zero bitrate - classified as NETWORK_ISSUE");
            return SourceDisconnectionType.NETWORK_ISSUE;
        }
        
        // If source exists but bitrate is very low (below threshold)
        if (icecastReachable && liquidsoapRunning && mountPointExists && hasActiveSource && bitrate > 0 && bitrate < 32) {
            // Very low bitrate suggests network issues or poor connection
            logger.debug("Source has very low bitrate ({} kbps) - classified as NETWORK_ISSUE", bitrate);
            return SourceDisconnectionType.NETWORK_ISSUE;
        }
        
        // Default: cannot determine
        logger.debug("Unable to classify disconnection type - returning UNKNOWN");
        return SourceDisconnectionType.UNKNOWN;
    }
    
    /**
     * Classify disconnection type using health check map directly.
     * Convenience method that extracts values from health check map.
     * 
     * @param healthCheck Health check results map
     * @return Classified disconnection type
     */
    public SourceDisconnectionType classify(Map<String, Object> healthCheck) {
        if (healthCheck == null || healthCheck.isEmpty()) {
            logger.debug("Empty health check map - returning UNKNOWN");
            return SourceDisconnectionType.UNKNOWN;
        }
        
        boolean icecastReachable = Boolean.TRUE.equals(healthCheck.get("serverReachable"));
        boolean mountPointExists = Boolean.TRUE.equals(healthCheck.get("mountPointExists"));
        boolean hasActiveSource = Boolean.TRUE.equals(healthCheck.get("hasActiveSource"));
        
        int bitrate = 0;
        Object bitrateObj = healthCheck.get("bitrate");
        if (bitrateObj instanceof Number) {
            bitrate = ((Number) bitrateObj).intValue();
        } else if (bitrateObj != null) {
            try {
                bitrate = Integer.parseInt(String.valueOf(bitrateObj));
            } catch (NumberFormatException e) {
                logger.debug("Failed to parse bitrate: {}", bitrateObj);
            }
        }
        
        // Check Liquidsoap status via Radio Agent
        boolean liquidsoapRunning = true; // Default to true for graceful degradation
        try {
            if (radioAgentClient != null) {
                Map<String, Object> agentStatus = radioAgentClient.status();
                Object state = agentStatus != null ? agentStatus.get("state") : null;
                liquidsoapRunning = "running".equals(state);
            }
        } catch (Exception e) {
            logger.debug("Failed to check Liquidsoap status via Radio Agent: {}", e.getMessage());
            // Graceful degradation - assume running if agent unavailable
        }
        
        return classify(healthCheck, icecastReachable, liquidsoapRunning, mountPointExists, hasActiveSource, bitrate);
    }
}

