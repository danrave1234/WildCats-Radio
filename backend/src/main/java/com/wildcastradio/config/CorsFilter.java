package com.wildcastradio.config;

import java.io.IOException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.FilterConfig;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Custom CORS filter to intercept all requests and apply CORS headers.
 * This is an additional measure to ensure CORS is properly applied,
 * especially for preflight requests.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorsFilter implements Filter {

    @Value("${CORS_ALLOWED_ORIGINS:http://localhost:5173,http://localhost:5174,https://wildcat-radio-f05d362144e6.herokuapp.com,https://wildcat-radio.vercel.app,https://wildcat-radio-f05d362144e6.autoidleapp.com}")
    private String allowedOrigins;

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        HttpServletResponse response = (HttpServletResponse) res;
        HttpServletRequest request = (HttpServletRequest) req;
        
        String origin = request.getHeader("Origin");
        
        // Check if the origin is in our allowed list
        if (origin != null && isAllowedOrigin(origin)) {
            response.setHeader("Access-Control-Allow-Origin", origin);
            response.setHeader("Access-Control-Allow-Credentials", "true");
            response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept");
            response.setHeader("Access-Control-Max-Age", "3600");
        }
        
        // For preflight requests (OPTIONS)
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            response.setStatus(HttpServletResponse.SC_OK);
        } else {
            chain.doFilter(req, res);
        }
    }

    private boolean isAllowedOrigin(String origin) {
        String[] origins = allowedOrigins.split(",");
        for (String allowedOrigin : origins) {
            if (allowedOrigin.trim().equals(origin)) {
                return true;
            }
        }
        return false;
    }

    @Override
    public void init(FilterConfig filterConfig) {}

    @Override
    public void destroy() {}
} 