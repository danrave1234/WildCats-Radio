package com.wildcastradio.config;

import org.springframework.stereotype.Service;

/**
 * Service to manage the state of scheduling.
 * This service is used to enable or disable scheduling based on how the server is started.
 */
@Service
public class SchedulingStateService {
    
    private boolean schedulingEnabled = true;
    
    /**
     * Check if scheduling is enabled.
     * 
     * @return true if scheduling is enabled, false otherwise
     */
    public boolean isSchedulingEnabled() {
        return schedulingEnabled;
    }
    
    /**
     * Enable scheduling.
     */
    public void enableScheduling() {
        this.schedulingEnabled = true;
    }
    
    /**
     * Disable scheduling.
     */
    public void disableScheduling() {
        this.schedulingEnabled = false;
    }
}