package com.wildcastradio.util;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

import org.springframework.stereotype.Component;

/**
 * Utility class for handling date/time operations with proper timezone awareness
 */
@Component
public class DateTimeUtil {
    
    /**
     * Converts a LocalDateTime that may have been created in a different timezone
     * to a LocalDateTime in UTC. This helps ensure consistency when storing dates.
     * 
     * @param localDateTime The input LocalDateTime which may be in any timezone
     * @return A LocalDateTime normalized to UTC
     */
    public LocalDateTime normalizeToUTC(LocalDateTime localDateTime) {
        if (localDateTime == null) {
            return null;
        }
        
        // Since LocalDateTime doesn't have timezone info, we need to explicitly set it
        // We assume the input was from the system default timezone
        ZonedDateTime zonedDateTime = localDateTime.atZone(ZoneId.systemDefault());
        
        // Convert to UTC
        ZonedDateTime utcDateTime = zonedDateTime.withZoneSameInstant(ZoneId.of("UTC"));
        
        // Return as LocalDateTime
        return utcDateTime.toLocalDateTime();
    }
    
    /**
     * Preserves the exact time values from the input LocalDateTime by converting
     * from UTC back to the local timezone.
     * 
     * @param utcDateTime A LocalDateTime stored in UTC
     * @return A LocalDateTime with time preserved as if in the local timezone
     */
    public LocalDateTime preserveTimeFromUTC(LocalDateTime utcDateTime) {
        if (utcDateTime == null) {
            return null;
        }
        
        // Treat the input as being in UTC
        ZonedDateTime utcZoned = utcDateTime.atZone(ZoneId.of("UTC"));
        
        // Convert to system default timezone
        ZonedDateTime localZoned = utcZoned.withZoneSameInstant(ZoneId.systemDefault());
        
        // Return as LocalDateTime
        return localZoned.toLocalDateTime();
    }
} 