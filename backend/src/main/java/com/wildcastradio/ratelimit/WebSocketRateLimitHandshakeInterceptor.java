package com.wildcastradio.ratelimit;

import io.github.bucket4j.Bucket;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserService;
import com.wildcastradio.config.JwtUtil;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import java.util.Optional;
import java.time.Duration;

/**
 * WebSocket handshake rate limiting interceptor.
 *
 * Applies per-IP handshake limits to prevent reconnect storms.
 *
 * Special case: Authenticated users with role DJ are EXEMPT from handshake
 * rate limiting on the broadcaster endpoint (/ws/live), to avoid impacting
 * critical broadcast sessions.
 */
@Component
public class WebSocketRateLimitHandshakeInterceptor implements HandshakeInterceptor {
    private final RateLimiterService rateLimiterService;
    private final RateLimitProperties properties;
    private final JwtUtil jwtUtil;
    private final UserService userService;

    public WebSocketRateLimitHandshakeInterceptor(
            RateLimiterService rateLimiterService,
            RateLimitProperties properties,
            JwtUtil jwtUtil,
            UserService userService) {
        this.rateLimiterService = rateLimiterService;
        this.properties = properties;
        this.jwtUtil = jwtUtil;
        this.userService = userService;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Map<String, Object> attributes) {
        if (!properties.isEnabled()) return true;
        if (request instanceof ServletServerHttpRequest servletRequest) {
            HttpServletRequest httpServletRequest = servletRequest.getServletRequest();

            // Role-aware bypass for broadcaster endpoint
            String requestUri = httpServletRequest.getRequestURI();
            if (requestUri != null && requestUri.startsWith("/ws/live")) {
                String token = extractTokenFromCookiesOrHeader(httpServletRequest);
                if (token != null && !token.isBlank()) {
                    try {
                        String username = jwtUtil.extractUsername(token);
                        if (username != null) {
                            // Validate token before trusting
                            org.springframework.security.core.userdetails.UserDetails ud = userService.loadUserByUsername(username);
                            if (jwtUtil.validateToken(token, ud)) {
                                Optional<UserEntity> userOpt = userService.getUserByEmail(username);
                                if (userOpt.isPresent() && userOpt.get().getRole() == UserEntity.UserRole.DJ) {
                                    // DJ broadcaster is exempt from handshake rate limiting on /ws/live
                                    return true;
                                }
                            }
                        }
                    } catch (Exception ignored) {
                        // If token parsing/validation fails, fall through to normal rate limiting
                    }
                }
            }

            // Apply per-IP handshake limiting for all others
            String ip = IpUtils.extractClientIp(httpServletRequest, properties.isUseXForwardedFor());
            Bucket bucket = rateLimiterService.resolveWsHandshakeBucketForIp(ip);
            if (!bucket.tryConsume(1)) {
                response.setStatusCode(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS);
                response.getHeaders().set("Retry-After", String.valueOf(Duration.ofMinutes(1).toSeconds()));
                return false;
            }
        }
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Exception exception) {
    }

    private String extractTokenFromCookiesOrHeader(HttpServletRequest request) {
        // Prefer HttpOnly cookie named "token"
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("token".equals(cookie.getName())) {
                    String v = cookie.getValue();
                    if (v != null && !v.isBlank()) return v;
                }
            }
        }
        // Fallback to Authorization Bearer header if present
        String authorizationHeader = request.getHeader("Authorization");
        if (authorizationHeader != null && authorizationHeader.startsWith("Bearer ")) {
            return authorizationHeader.substring(7);
        }
        return null;
    }
}
