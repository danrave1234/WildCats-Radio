package com.wildcastradio.config;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Security headers filter to add missing security headers for XSS, clickjacking,
 * MIME sniffing, and data exfiltration protection.
 */
@Component
public class SecurityHeadersFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        // Content Security Policy - prevent XSS attacks
        // Allow 'unsafe-inline' and 'unsafe-eval' for React development and WebSocket connections
        httpResponse.setHeader("Content-Security-Policy", 
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: blob:; " +
            "font-src 'self'; " +
            "connect-src 'self' ws: wss:; " +
            "media-src 'self' blob:; " +
            "object-src 'none'; " +
            "base-uri 'self'; " +
            "form-action 'self'; " +
            "frame-ancestors 'none';"
        );

        // X-Frame-Options - prevent clickjacking
        httpResponse.setHeader("X-Frame-Options", "DENY");

        // X-Content-Type-Options - prevent MIME sniffing
        httpResponse.setHeader("X-Content-Type-Options", "nosniff");

        // Referrer-Policy - control referrer information to prevent data exfiltration
        httpResponse.setHeader("Referrer-Policy", "no-referrer");

        // Permissions-Policy - restrict access to browser features (minimal permissions)
        httpResponse.setHeader("Permissions-Policy", 
            "geolocation=(), " +
            "microphone=(), " +
            "camera=(), " +
            "payment=(), " +
            "usb=(), " +
            "accelerometer=(), " +
            "gyroscope=(), " +
            "magnetometer=(), " +
            "midi=(), " +
            "picture-in-picture=(), " +
            "display-capture=(), " +
            "fullscreen=(self)"
        );

        // HTTP Strict Transport Security - enforce HTTPS (only add if request is HTTPS)
        if (httpRequest.isSecure()) {
            httpResponse.setHeader("Strict-Transport-Security", 
                "max-age=31536000; includeSubDomains"
            );
        }

        chain.doFilter(request, response);
    }
}