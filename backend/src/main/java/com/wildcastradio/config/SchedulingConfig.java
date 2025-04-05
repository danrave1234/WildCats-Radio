package com.wildcastradio.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Configuration class for scheduling.
 * Scheduling is only enabled when the SchedulingStateService indicates that scheduling should be enabled.
 * This allows us to disable scheduling when the server is started manually.
 */
@Configuration
public class SchedulingConfig {

    @Autowired
    private SchedulingStateService schedulingStateService;

    /**
     * Bean that conditionally enables scheduling based on the state of the SchedulingStateService.
     * This avoids the circular dependency issue by using a bean method instead of a condition.
     */
    @Bean
    public SchedulingEnabler schedulingEnabler() {
        boolean enabled = schedulingStateService.isSchedulingEnabled();
        if (enabled) {
            return new SchedulingEnabler();
        }
        return null;
    }

    /**
     * Helper class that enables scheduling when instantiated.
     */
    @EnableScheduling
    public static class SchedulingEnabler {
        // This class doesn't need any methods, its presence is enough to enable scheduling
    }
}
