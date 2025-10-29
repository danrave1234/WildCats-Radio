package com.wildcastradio.config;

import java.util.TimeZone;

import org.springframework.context.annotation.Configuration;

import jakarta.annotation.PostConstruct;

@Configuration
public class TimeConfig {
    
    /**
     * Configure the JVM's default timezone to ensure consistent handling of datetime values
     * This is important for handling LocalDateTime correctly without timezone issues
     */
    @PostConstruct
    public void init() {
        // Set default timezone for the JVM to Asia/Manila to keep times consistent in PH
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Manila"));
    }
} 