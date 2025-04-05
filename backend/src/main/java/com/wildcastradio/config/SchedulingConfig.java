package com.wildcastradio.config;

import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.type.AnnotatedTypeMetadata;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Configuration class for scheduling.
 * Scheduling is only enabled when the SchedulingStateService indicates that scheduling should be enabled.
 * This allows us to disable scheduling when the server is started manually.
 */
@Configuration
@EnableScheduling
@Conditional(SchedulingConfig.SchedulingEnabledCondition.class)
public class SchedulingConfig {

    /**
     * Condition that checks if scheduling is enabled using the SchedulingStateService.
     */
    public static class SchedulingEnabledCondition implements Condition {

        @Override
        public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
            // Get the SchedulingStateService bean from the application context
            SchedulingStateService schedulingStateService = context.getBeanFactory().getBean(SchedulingStateService.class);
            // Return true if scheduling is enabled, false otherwise
            return schedulingStateService.isSchedulingEnabled();
        }
    }
}
