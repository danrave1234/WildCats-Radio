package com.wildcastradio.util;

import java.time.Duration;
import java.time.LocalDateTime;

/**
 * Utility class for common date and time operations
 */
public class DateTimeUtils {
    
    /**
     * Calculate duration in minutes between two LocalDateTime objects
     * @param start Start time
     * @param end End time
     * @return Duration in minutes, or 0 if either parameter is null
     */
    public static long calculateDurationMinutes(LocalDateTime start, LocalDateTime end) {
        if (start == null || end == null) {
            return 0;
        }
        return Duration.between(start, end).toMinutes();
    }
    
    /**
     * Calculate duration in seconds between two LocalDateTime objects
     * @param start Start time
     * @param end End time
     * @return Duration in seconds, or 0 if either parameter is null
     */
    public static long calculateDurationSeconds(LocalDateTime start, LocalDateTime end) {
        if (start == null || end == null) {
            return 0;
        }
        return Duration.between(start, end).getSeconds();
    }
    
    /**
     * Check if a time is within a specified time range
     * @param time Time to check
     * @param start Start of range
     * @param end End of range
     * @return true if time is within range, false otherwise
     */
    public static boolean isWithinTimeRange(LocalDateTime time, LocalDateTime start, LocalDateTime end) {
        if (time == null || start == null || end == null) {
            return false;
        }
        return time.isAfter(start) && time.isBefore(end);
    }
    
    /**
     * Check if a time is within a specified time range (inclusive)
     * @param time Time to check
     * @param start Start of range
     * @param end End of range
     * @return true if time is within range (inclusive), false otherwise
     */
    public static boolean isWithinTimeRangeInclusive(LocalDateTime time, LocalDateTime start, LocalDateTime end) {
        if (time == null || start == null || end == null) {
            return false;
        }
        return (time.isAfter(start) || time.isEqual(start)) && 
               (time.isBefore(end) || time.isEqual(end));
    }
    
    /**
     * Check if a broadcast is currently active based on its scheduled times
     * @param scheduledStart Scheduled start time
     * @param scheduledEnd Scheduled end time
     * @return true if broadcast should be active now, false otherwise
     */
    public static boolean isBroadcastActive(LocalDateTime scheduledStart, LocalDateTime scheduledEnd) {
        LocalDateTime now = LocalDateTime.now();
        return isWithinTimeRangeInclusive(now, scheduledStart, scheduledEnd);
    }
    
    /**
     * Check if a broadcast is upcoming (starts in the future)
     * @param scheduledStart Scheduled start time
     * @return true if broadcast is upcoming, false otherwise
     */
    public static boolean isBroadcastUpcoming(LocalDateTime scheduledStart) {
        if (scheduledStart == null) {
            return false;
        }
        return LocalDateTime.now().isBefore(scheduledStart);
    }
    
    /**
     * Check if a broadcast is past (ended)
     * @param scheduledEnd Scheduled end time
     * @return true if broadcast is past, false otherwise
     */
    public static boolean isBroadcastPast(LocalDateTime scheduledEnd) {
        if (scheduledEnd == null) {
            return false;
        }
        return LocalDateTime.now().isAfter(scheduledEnd);
    }
    
    /**
     * Format duration in minutes to a human-readable string
     * @param minutes Duration in minutes
     * @return Formatted string (e.g., "2h 30m", "45m", "1h")
     */
    public static String formatDuration(long minutes) {
        if (minutes < 0) {
            return "0m";
        }
        
        long hours = minutes / 60;
        long remainingMinutes = minutes % 60;
        
        if (hours > 0 && remainingMinutes > 0) {
            return hours + "h " + remainingMinutes + "m";
        } else if (hours > 0) {
            return hours + "h";
        } else {
            return remainingMinutes + "m";
        }
    }
    
    /**
     * Get the current timestamp
     * @return Current LocalDateTime
     */
    public static LocalDateTime now() {
        return LocalDateTime.now();
    }
}