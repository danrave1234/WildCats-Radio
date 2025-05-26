package com.wildcastradio.config;

import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;

/**
 * NetworkConfig component that automatically detects the server's IP address
 * to facilitate device discovery on the network for Icecast streaming.
 * Prioritizes Wi-Fi and Ethernet connections over virtual adapters.
 */
@Component
public class NetworkConfig {
    private static final Logger logger = LoggerFactory.getLogger(NetworkConfig.class);

    @Value("${server.port:8080}")
    private int serverPort;

    @Value("${icecast.port:8000}")
    private int icecastPort;

    @Value("${icecast.host:#{null}}")
    private String configuredIcecastHost;

    @Value("${ffmpeg.reconnect.enabled:true}")
    private boolean ffmpegReconnectEnabled;

    @Value("${ffmpeg.reconnect.delay.max:5}")
    private int ffmpegReconnectDelayMax;

    @Value("${ffmpeg.rw.timeout:5000000}")
    private int ffmpegRwTimeout;

    @Value("${ffmpeg.retry.attempts:3}")
    private int ffmpegRetryAttempts;

    private String serverIp;

    // Known virtual adapter patterns to avoid
    private static final Set<String> VIRTUAL_ADAPTER_PATTERNS = Collections.unmodifiableSet(new HashSet<>(Arrays.asList(
        "virtualbox", "vmware", "vbox", "docker", "hyper-v", "tap", "tun"
    )));

    // Known VirtualBox IP ranges to avoid
    private static final Set<String> VIRTUAL_IP_PREFIXES = Collections.unmodifiableSet(new HashSet<>(Arrays.asList(
        "192.168.56.", "10.0.2.", "172.16.", "169.254."
    )));

    @PostConstruct
    public void init() {
        serverIp = detectServerIp();
        logger.info("Detected network interfaces:");
        logAllNetworkInterfaces();
        logger.info("Selected server IP: {} on port: {}, Icecast on port: {}", 
                serverIp, serverPort, icecastPort);
    }

    /**
     * Enhanced IP detection that prioritizes real network connections over virtual adapters
     * or uses a manually configured host if available
     */
    private String detectServerIp() {
        // Check if a host is configured in properties
        if (configuredIcecastHost != null && !configuredIcecastHost.isEmpty()) {
            logger.info("Using configured Icecast host: {}", configuredIcecastHost);
            return configuredIcecastHost;
        }

        try {
            List<NetworkCandidate> candidates = new ArrayList<>();

            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface networkInterface = interfaces.nextElement();

                // Skip obviously bad interfaces
                if (networkInterface.isLoopback() || !networkInterface.isUp()) {
                    continue;
                }

                String interfaceName = networkInterface.getName().toLowerCase();
                String displayName = networkInterface.getDisplayName() != null ? 
                    networkInterface.getDisplayName().toLowerCase() : "";

                // Skip virtual interfaces based on name patterns
                if (isVirtualInterface(interfaceName, displayName)) {
                    logger.debug("Skipping virtual interface: {} ({})", interfaceName, displayName);
                    continue;
                }

                // Get IPv4 addresses from this interface
                Enumeration<InetAddress> addresses = networkInterface.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress address = addresses.nextElement();
                    String ip = address.getHostAddress();

                    // Skip IPv6, loopback, and virtual IPs
                    if (address.isLoopbackAddress() || ip.contains(":") || isVirtualIp(ip)) {
                        continue;
                    }

                    // Calculate priority for this candidate
                    int priority = calculatePriority(interfaceName, displayName, ip, networkInterface);
                    candidates.add(new NetworkCandidate(ip, interfaceName, displayName, priority));

                    logger.debug("Found network candidate: {} on {} ({}) - Priority: {}", 
                        ip, interfaceName, displayName, priority);
                }
            }

            // Sort by priority (highest first) and return the best candidate
            if (!candidates.isEmpty()) {
                candidates.sort((a, b) -> Integer.compare(b.priority, a.priority));
                NetworkCandidate best = candidates.get(0);
                logger.info("Selected best network candidate: {} on {} ({}) - Priority: {}", 
                    best.ip, best.interfaceName, best.displayName, best.priority);
                return best.ip;
            }

            // Fallback to localhost if no suitable interface found
            logger.warn("No suitable network interface found, falling back to localhost");
            return InetAddress.getLocalHost().getHostAddress();

        } catch (Exception e) {
            logger.error("Error detecting server IP address", e);
            return "localhost";
        }
    }

    /**
     * Check if an interface is virtual based on name patterns
     */
    private boolean isVirtualInterface(String interfaceName, String displayName) {
        String combined = (interfaceName + " " + displayName).toLowerCase();
        return VIRTUAL_ADAPTER_PATTERNS.stream().anyMatch(combined::contains);
    }

    /**
     * Check if an IP address belongs to a virtual network range
     */
    private boolean isVirtualIp(String ip) {
        return VIRTUAL_IP_PREFIXES.stream().anyMatch(ip::startsWith);
    }

    /**
     * Calculate priority for a network interface candidate
     * Higher priority = more likely to be the correct interface
     */
    private int calculatePriority(String interfaceName, String displayName, String ip, NetworkInterface networkInterface) {
        int priority = 0;

        // Prefer Wi-Fi interfaces
        if (interfaceName.contains("wlan") || interfaceName.contains("wifi") || 
            displayName.contains("wi-fi") || displayName.contains("wireless")) {
            priority += 100;
        }

        // Prefer Ethernet interfaces
        if (interfaceName.contains("eth") || displayName.contains("ethernet")) {
            priority += 90;
        }

        // Prefer interfaces with "Local Area Connection" or similar
        if (displayName.contains("local area connection")) {
            priority += 80;
        }

        // Prefer private network ranges (but not VirtualBox ranges)
        if (ip.startsWith("192.168.") && !ip.startsWith("192.168.56.")) {
            priority += 50;
        } else if (ip.startsWith("10.") && !ip.startsWith("10.0.2.")) {
            priority += 40;
        } else if (ip.startsWith("172.")) {
            priority += 30;
        }

        // Bonus for interfaces that support multicast (usually real interfaces)
        try {
            if (networkInterface.supportsMulticast()) {
                priority += 20;
            }
        } catch (Exception e) {
            // Ignore if we can't check multicast support
        }

        // Penalty for point-to-point interfaces (often VPNs)
        try {
            if (networkInterface.isPointToPoint()) {
                priority -= 50;
            }
        } catch (Exception e) {
            // Ignore if we can't check point-to-point
        }

        return priority;
    }

    /**
     * Log all network interfaces for debugging
     */
    private void logAllNetworkInterfaces() {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface networkInterface = interfaces.nextElement();
                String interfaceName = networkInterface.getName();
                String displayName = networkInterface.getDisplayName();
                boolean isUp = networkInterface.isUp();
                boolean isLoopback = networkInterface.isLoopback();

                logger.debug("Interface: {} ({}) - Up: {}, Loopback: {}", 
                    interfaceName, displayName, isUp, isLoopback);

                if (isUp && !isLoopback) {
                    Enumeration<InetAddress> addresses = networkInterface.getInetAddresses();
                    while (addresses.hasMoreElements()) {
                        InetAddress address = addresses.nextElement();
                        logger.debug("  Address: {}", address.getHostAddress());
                    }
                }
            }
        } catch (Exception e) {
            logger.error("Error logging network interfaces", e);
        }
    }

    /**
     * Inner class to hold network interface candidates with priority
     */
    private static class NetworkCandidate {
        final String ip;
        final String interfaceName;
        final String displayName;
        final int priority;

        NetworkCandidate(String ip, String interfaceName, String displayName, int priority) {
            this.ip = ip;
            this.interfaceName = interfaceName;
            this.displayName = displayName;
            this.priority = priority;
        }
    }

    // URL helpers for various components
    public String getIcecastUrl() {
        // Check if we're in a production environment (autoidleapp.com or herokuapp.com)
        if (serverIp.contains("autoidleapp.com") || serverIp.contains("herokuapp.com")) {
            return "https://" + serverIp + ":" + icecastPort;
        }
        return "http://" + serverIp + ":" + icecastPort;
    }

    public String getWebSocketUrl() {
        // Check if we're in a production environment (autoidleapp.com or herokuapp.com)
        if (serverIp.contains("autoidleapp.com") || serverIp.contains("herokuapp.com")) {
            return "wss://" + serverIp + ":" + serverPort + "/ws/live";
        }
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

    public boolean isFfmpegReconnectEnabled() {
        return ffmpegReconnectEnabled;
    }

    public int getFfmpegReconnectDelayMax() {
        return ffmpegReconnectDelayMax;
    }

    public int getFfmpegRwTimeout() {
        return ffmpegRwTimeout;
    }

    public int getFfmpegRetryAttempts() {
        return ffmpegRetryAttempts;
    }
} 
