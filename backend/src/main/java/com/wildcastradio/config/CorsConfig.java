package com.wildcastradio.config;

import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Enumeration;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;

/**
 * Dynamic CORS configuration that automatically detects local network IPs
 * and generates comprehensive allowed origins list for development.
 */
@Component
public class CorsConfig {
    private static final Logger logger = LoggerFactory.getLogger(CorsConfig.class);

    @Value("${CORS_ALLOWED_ORIGINS:}")
    private String customAllowedOrigins;

    @Value("${app.production:false}")
    private boolean isProduction;

    private List<String> allowedOrigins;

    @PostConstruct
    public void init() {
        allowedOrigins = generateAllowedOrigins();
        logger.info("CORS initialized: mode={}, totalOrigins={}, origins={}",
                isProduction ? "production" : "development",
                allowedOrigins.size(),
                allowedOrigins);
    }

    private List<String> generateAllowedOrigins() {
        Set<String> origins = new LinkedHashSet<>();

        // Always allow first-party production domains.
        origins.addAll(Arrays.asList(
            "https://wildcat-radio.vercel.app",
            "https://api.wildcat-radio.live",
            "https://wildcat-radio.live",
            "https://www.wildcat-radio.live"
        ));

        // In production, keep the allowlist strict and explicit.
        if (isProduction) {
            addCustomOrigins(origins);
            return new ArrayList<>(origins);
        }

        // Add standard localhost origins
        origins.addAll(Arrays.asList(
            "http://localhost:3000",
            "http://localhost:5173",
            "http://localhost:5174",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5174"
        ));

        // Add mobile app origins (React Native/Expo)
        origins.addAll(Arrays.asList(
            "exp://192.168.1.2:8081",  // Expo development server
            "exp://192.168.1.2:8083",  // Alternative Expo port
            "exp://localhost:8081",   // Localhost Expo
            "exp://localhost:8083",   // Alternative localhost port
            "exp://127.0.0.1:8081",   // Localhost alternative
            "exp://127.0.0.1:8083"    // Localhost alternative
        ));

        // Dynamically detect local network IPs
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface networkInterface = interfaces.nextElement();

                if (networkInterface.isLoopback() || !networkInterface.isUp()) {
                    continue;
                }

                Enumeration<InetAddress> addresses = networkInterface.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress address = addresses.nextElement();
                    String ip = address.getHostAddress();

                    // Skip IPv6 and loopback
                    if (address.isLoopbackAddress() || ip.contains(":")) {
                        continue;
                    }

                    // Add common development ports for this IP
                    origins.add("http://" + ip + ":3000");
                    origins.add("http://" + ip + ":5173");
                    origins.add("http://" + ip + ":5174");
                    
                    // Add Expo development server ports for mobile apps
                    origins.add("exp://" + ip + ":8081");
                    origins.add("exp://" + ip + ":8083");
                    origins.add("exp://" + ip + ":19000");
                    origins.add("exp://" + ip + ":19001");
                }
            }
        } catch (Exception e) {
            logger.warn("Failed to detect local network IPs for CORS: {}", e.getMessage());
        }

        // Add common local network ranges (backup in case detection fails)
        for (int i = 100; i <= 105; i++) {
            origins.add("http://192.168.1." + i + ":5173");
            origins.add("http://192.168.0." + i + ":5173");
            origins.add("http://10.0.0." + i + ":5173");
        }

        addCustomOrigins(origins);

        return new ArrayList<>(origins);
    }

    private void addCustomOrigins(Set<String> origins) {
        if (customAllowedOrigins == null || customAllowedOrigins.trim().isEmpty()) {
            return;
        }

        String[] customOrigins = customAllowedOrigins.split(",");
        for (String origin : customOrigins) {
            String normalized = origin.trim();
            if (!normalized.isEmpty()) {
                origins.add(normalized);
            }
        }
    }

    public List<String> getAllowedOrigins() {
        return allowedOrigins;
    }
} 
