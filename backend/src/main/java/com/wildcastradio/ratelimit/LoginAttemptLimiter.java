package com.wildcastradio.ratelimit;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Limits failed authentication attempts per username and per IP.
 *
 * Usage in controller:
 * - Check isBlocked(username, ip) BEFORE attempting authentication; return 429 if true
 * - Call onFailure(username, ip) when authentication fails
 * - Do NOT reset on success; allow natural refill to enforce cool-down
 */
@Component
public class LoginAttemptLimiter {
    private final RateLimitProperties properties;
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    public LoginAttemptLimiter(RateLimitProperties properties) {
        this.properties = properties;
    }

    public boolean isBlocked(String username, String ip) {
        if (!properties.isEnabled()) return false;
        boolean ipBlocked = getIpBucket(ip).getAvailableTokens() <= 0;
        boolean userBlocked = getUserBucket(username).getAvailableTokens() <= 0;
        return ipBlocked || userBlocked;
    }

    public void onFailure(String username, String ip) {
        if (!properties.isEnabled()) return;
        getIpBucket(ip).tryConsume(1);
        getUserBucket(username).tryConsume(1);
    }

    public void onSuccess(String username, String ip) {
        // No-op: keep counters; lockout ends when tokens naturally refill
    }

    public long retryAfterSeconds() {
        // Fixed window of 60 seconds for refilling
        return 60L;
    }

    private Bucket getIpBucket(String ip) {
        int capacity = Math.max(1, properties.getAuth().getPerIpPerMinute());
        String key = "auth:ip:" + normalize(ip);
        return buckets.computeIfAbsent(key, k -> buildPerMinuteBucket(capacity));
    }

    private Bucket getUserBucket(String username) {
        int capacity = Math.max(1, properties.getAuth().getPerUsernamePerMinute());
        String key = "auth:user:" + normalize(username);
        return buckets.computeIfAbsent(key, k -> buildPerMinuteBucket(capacity));
    }

    private String normalize(String s) {
        return s == null ? "" : s.trim().toLowerCase();
    }

    private Bucket buildPerMinuteBucket(int capacity) {
        Bandwidth limit = Bandwidth.classic(capacity, Refill.greedy(capacity, Duration.ofMinutes(1)));
        return Bucket.builder().addLimit(limit).build();
    }
}
