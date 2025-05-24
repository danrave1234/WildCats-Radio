package com.wildcastradio.icecast;

import com.wildcastradio.config.NetworkConfig;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * REST controller for Icecast streaming operations.
 * Provides endpoints for stream status, configuration, and control.
 */
@RestController
@RequestMapping("/api/icecast")
public class IcecastStreamController {

    private final IcecastService icecastService;
    private final NetworkConfig networkConfig;

    @Autowired
    public IcecastStreamController(IcecastService icecastService, NetworkConfig networkConfig) {
        this.icecastService = icecastService;
        this.networkConfig = networkConfig;
    }

    /**
     * Get stream status information
     * @return JSON with stream status
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStreamStatus() {
        return ResponseEntity.ok(icecastService.getStreamStatus());
    }

    /**
     * Get stream configuration information
     * @return JSON with configuration data
     */
    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getStreamConfig() {
        return ResponseEntity.ok(icecastService.getStreamConfig());
    }

    /**
     * Start a broadcast
     * @param broadcastData The broadcast data
     * @return Success message
     */
    @PostMapping("/start")
    public ResponseEntity<Map<String, Object>> startBroadcast(@RequestBody(required = false) Map<String, Object> broadcastData) {
        // Here you would typically authorize the request and create a broadcast record
        // This can integrate with your existing BroadcastService if available
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Broadcast authorized");
        response.put("webSocketUrl", networkConfig.getWebSocketUrl());
        response.put("streamUrl", networkConfig.getStreamUrl());
        
        return ResponseEntity.ok(response);
    }

    /**
     * Stop a broadcast
     * @return Success message
     */
    @PostMapping("/stop")
    public ResponseEntity<Map<String, Object>> stopBroadcast() {
        // Here you would typically end the broadcast in your database
        // This can integrate with your existing BroadcastService if available
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Broadcast ended");
        
        return ResponseEntity.ok(response);
    }
} 