package com.wildcastradio.ratelimit;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.Refill;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RateLimiterService {
    private final RateLimitProperties properties;
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    public RateLimiterService(RateLimitProperties properties) {
        this.properties = properties;
    }

    public boolean isEnabled() {
        return properties.isEnabled();
    }

    public Bucket resolveApiBucketForIp(String ip) {
        int capacity = Math.max(1, properties.getApi().getPerIpPerMinute());
        return buckets.computeIfAbsent("api:" + ip, key -> buildPerMinuteBucket(capacity));
    }

    public Bucket resolveAuthBucketForIp(String ip) {
        int capacity = Math.max(1, properties.getAuth().getPerIpPerMinute());
        return buckets.computeIfAbsent("auth:ip:" + ip, key -> buildPerMinuteBucket(capacity));
    }

    public Bucket resolveAuthBucketForUsername(String username) {
        int capacity = Math.max(1, properties.getAuth().getPerUsernamePerMinute());
        return buckets.computeIfAbsent("auth:user:" + username.toLowerCase(), key -> buildPerMinuteBucket(capacity));
    }

    public Bucket resolveWsHandshakeBucketForIp(String ip) {
        int capacity = Math.max(1, properties.getWs().getHandshakePerIpPerMinute());
        return buckets.computeIfAbsent("ws:handshake:" + ip, key -> buildPerMinuteBucket(capacity));
    }

    private Bucket buildPerMinuteBucket(int capacity) {
        Bandwidth limit = Bandwidth.classic(capacity, Refill.greedy(capacity, Duration.ofMinutes(1)));
        BucketConfiguration config = BucketConfiguration.builder().addLimit(limit).build();
        return Bucket.builder().addLimit(limit).build();
    }
}
