package com.wildcastradio.utils;

import org.slf4j.Logger;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Utility class for rate-limited logging.
 * Ensures that log messages with the same key are only logged at most once per specified interval.
 */
public class RateLimitedLogger {
    
    private static final Map<String, AtomicLong> lastLogTimeMap = new ConcurrentHashMap<>();
    
    /**
     * Log a message at INFO level with rate limiting
     * 
     * @param logger The SLF4J logger to use
     * @param key A unique key to identify this type of log message
     * @param interval The minimum interval between logs in milliseconds
     * @param format The log message format
     * @param args The log message arguments
     * @return true if the message was logged, false if it was suppressed due to rate limiting
     */
    public static boolean info(Logger logger, String key, long interval, String format, Object... args) {
        if (shouldLog(key, interval)) {
            logger.info(format, args);
            return true;
        }
        return false;
    }
    
    /**
     * Log a message at DEBUG level with rate limiting
     * 
     * @param logger The SLF4J logger to use
     * @param key A unique key to identify this type of log message
     * @param interval The minimum interval between logs in milliseconds
     * @param format The log message format
     * @param args The log message arguments
     * @return true if the message was logged, false if it was suppressed due to rate limiting
     */
    public static boolean debug(Logger logger, String key, long interval, String format, Object... args) {
        if (shouldLog(key, interval)) {
            logger.debug(format, args);
            return true;
        }
        return false;
    }
    
    /**
     * Log a message at WARN level with rate limiting
     * 
     * @param logger The SLF4J logger to use
     * @param key A unique key to identify this type of log message
     * @param interval The minimum interval between logs in milliseconds
     * @param format The log message format
     * @param args The log message arguments
     * @return true if the message was logged, false if it was suppressed due to rate limiting
     */
    public static boolean warn(Logger logger, String key, long interval, String format, Object... args) {
        if (shouldLog(key, interval)) {
            logger.warn(format, args);
            return true;
        }
        return false;
    }
    
    /**
     * Log a message at ERROR level with rate limiting
     * 
     * @param logger The SLF4J logger to use
     * @param key A unique key to identify this type of log message
     * @param interval The minimum interval between logs in milliseconds
     * @param format The log message format
     * @param args The log message arguments
     * @return true if the message was logged, false if it was suppressed due to rate limiting
     */
    public static boolean error(Logger logger, String key, long interval, String format, Object... args) {
        if (shouldLog(key, interval)) {
            logger.error(format, args);
            return true;
        }
        return false;
    }
    
    /**
     * Convenience method for logging with a Duration instead of milliseconds
     */
    public static boolean info(Logger logger, String key, Duration interval, String format, Object... args) {
        return info(logger, key, interval.toMillis(), format, args);
    }
    
    /**
     * Convenience method for logging with a Duration instead of milliseconds
     */
    public static boolean debug(Logger logger, String key, Duration interval, String format, Object... args) {
        return debug(logger, key, interval.toMillis(), format, args);
    }
    
    /**
     * Convenience method for logging with a Duration instead of milliseconds
     */
    public static boolean warn(Logger logger, String key, Duration interval, String format, Object... args) {
        return warn(logger, key, interval.toMillis(), format, args);
    }
    
    /**
     * Convenience method for logging with a Duration instead of milliseconds
     */
    public static boolean error(Logger logger, String key, Duration interval, String format, Object... args) {
        return error(logger, key, interval.toMillis(), format, args);
    }
    
    private static boolean shouldLog(String key, long intervalMillis) {
        long now = System.currentTimeMillis();
        AtomicLong lastLogTime = lastLogTimeMap.computeIfAbsent(key, k -> new AtomicLong(0));
        
        long previous = lastLogTime.get();
        if (now - previous >= intervalMillis) {
            if (lastLogTime.compareAndSet(previous, now)) {
                return true;
            }
        }
        return false;
    }
} 