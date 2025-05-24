package com.wildcastradio.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Enumeration;

/**
 * NetworkConfig component that automatically detects the server's IP address
 * to facilitate device discovery on the network for Icecast streaming.
 */
@Component
public class NetworkConfig {
    private static final Logger logger = LoggerFactory.getLogger(NetworkConfig.class);
    
    @Value("${server.port:8080}")
    private int serverPort;
    
    @Value("${icecast.port:8000}")
    private int icecastPort;
    
    private String serverIp;
    
    @PostConstruct
    public void init() {
        serverIp = detectServerIp();
        logger.info("Server running on IP: {} and port: {}, Icecast on port: {}", 
                serverIp, serverPort, icecastPort);
    }
    
    /**
     * Automatically detects the server's IP address, preferring non-localhost IPv4 addresses
     */
    private String detectServerIp() {
        try {
            // First look for non-loopback addresses
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface networkInterface = interfaces.nextElement();
                // Skip loopback, virtual, and inactive interfaces
                if (networkInterface.isLoopback() || !networkInterface.isUp() ||
                        networkInterface.isVirtual() || networkInterface.isPointToPoint()) {
                    continue;
                }

                // Look for IPv4 addresses
                Enumeration<InetAddress> addresses = networkInterface.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress address = addresses.nextElement();
                    // Skip IPv6 addresses and loopback
                    String ip = address.getHostAddress();
                    if (address.isLoopbackAddress() || ip.contains(":")) {
                        continue;
                    }

                    // Found a suitable address
                    return ip;
                }
            }

            // If no suitable address found, fall back to localhost
            return InetAddress.getLocalHost().getHostAddress();
        } catch (Exception e) {
            logger.error("Error detecting server IP address", e);
            return "localhost"; // Fallback to localhost
        }
    }
    
    // URL helpers for various components
    public String getIcecastUrl() {
        return "http://" + serverIp + ":" + icecastPort;
    }
    
    public String getWebSocketUrl() {
        return "ws://" + serverIp + ":" + serverPort + "/ws/live";
    }
    
    public String getStreamUrl() {
        return getIcecastUrl() + "/live.ogg";
    }
    
    // Getters
    public String getServerIp() {
        return serverIp;
    }
    
    public int getServerPort() {
        return serverPort;
    }
    
    public int getIcecastPort() {
        return icecastPort;
    }
} 