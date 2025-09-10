package com.wildcastradio.config;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;

/**
 * Handshake interceptor that extracts JWT from HttpOnly cookies during the initial
 * WebSocket HTTP handshake and exposes it to the WebSocket session attributes.
 * This allows downstream STOMP ChannelInterceptor and WebSocket handlers to
 * authenticate connections even when clients cannot send Authorization headers
 * (e.g., due to HttpOnly cookie storage).
 */
@Component
public class WebSocketHandshakeAuthInterceptor implements HandshakeInterceptor {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketHandshakeAuthInterceptor.class);

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        try {
            if (request instanceof ServletServerHttpRequest) {
                HttpServletRequest servletRequest = ((ServletServerHttpRequest) request).getServletRequest();
                Cookie[] cookies = servletRequest.getCookies();
                if (cookies != null) {
                    for (Cookie cookie : cookies) {
                        if ("token".equals(cookie.getName())) {
                            String token = cookie.getValue();
                            if (token != null && !token.isBlank()) {
                                // Expose as both a raw token and an Authorization-style header value
                                attributes.put("jwtToken", token);
                                attributes.put("Authorization", "Bearer " + token);
                                logger.debug("WebSocket handshake: JWT token found in cookies and stored in attributes");
                            }
                            break;
                        }
                    }
                }
            }
        } catch (Exception e) {
            logger.warn("WebSocket handshake token extraction failed: {}", e.getMessage());
        }
        return true; // Never block handshake here; downstream auth will decide
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // no-op
    }
}






