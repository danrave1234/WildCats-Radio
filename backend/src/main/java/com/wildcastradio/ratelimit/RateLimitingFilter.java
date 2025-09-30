package com.wildcastradio.ratelimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@Component
public class RateLimitingFilter extends OncePerRequestFilter {
    private final RateLimiterService rateLimiterService;
    private final RateLimitProperties properties;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public RateLimitingFilter(RateLimiterService rateLimiterService, RateLimitProperties properties) {
        this.rateLimiterService = rateLimiterService;
        this.properties = properties;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (HttpMethod.OPTIONS.matches(request.getMethod())) return true; // skip preflight
        if (path.startsWith("/assets/") || path.startsWith("/static/") || path.equals("/") || path.startsWith("/actuator/health")) return true;
        return !properties.isEnabled();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (!properties.isEnabled()) {
            filterChain.doFilter(request, response);
            return;
        }

        String path = request.getRequestURI();
        String clientIp = IpUtils.extractClientIp(request, properties.isUseXForwardedFor());

        boolean isAuth = path.startsWith("/api/auth/");
        boolean isApi = path.startsWith("/api/");

        if (isAuth) {
            // Per-IP
            Bucket ipBucket = rateLimiterService.resolveAuthBucketForIp(clientIp);
            if (!ipBucket.tryConsume(1)) {
                tooMany(response, Duration.ofMinutes(1));
                return;
            }
            // Per-username for login-related endpoints when available
            if (path.equals("/api/auth/login") || path.equals("/api/auth/register") || path.equals("/api/auth/verify")) {
                String bodyEmail = request.getParameter("email"); // fallback if form
                String username = bodyEmail != null ? bodyEmail : request.getHeader("X-Auth-Username");
                if (username != null && !username.isBlank()) {
                    Bucket userBucket = rateLimiterService.resolveAuthBucketForUsername(username.trim().toLowerCase());
                    if (!userBucket.tryConsume(1)) {
                        tooMany(response, Duration.ofMinutes(1));
                        return;
                    }
                }
            }
        } else if (isApi) {
            Bucket ipBucket = rateLimiterService.resolveApiBucketForIp(clientIp);
            if (!ipBucket.tryConsume(1)) {
                tooMany(response, Duration.ofMinutes(1));
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private void tooMany(HttpServletResponse response, Duration retryAfter) throws IOException {
        response.setStatus(429);
        response.setHeader("Retry-After", String.valueOf(retryAfter.toSeconds()));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        Map<String, Object> body = new HashMap<>();
        body.put("status", 429);
        body.put("error", "Too Many Requests");
        body.put("message", "Rate limit exceeded. Please retry later.");
        response.getWriter().write(objectMapper.writeValueAsString(body));
    }
}
