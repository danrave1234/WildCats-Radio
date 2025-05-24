package com.wildcastradio.controller;

import com.wildcastradio.config.NetworkConfig;
import com.wildcastradio.icecast.IcecastService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/stream")
public class StreamController {

    private final NetworkConfig networkConfig;
    private final IcecastService icecastService;

    @Autowired
    public StreamController(NetworkConfig networkConfig, IcecastService icecastService) {
        this.networkConfig = networkConfig;
        this.icecastService = icecastService;
    }

    /**
     * Get stream configuration for frontend
     * This provides all the URLs and network information needed by the frontend
     */
    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getConfig() {
        return ResponseEntity.ok(icecastService.getStreamConfig());
    }

    /**
     * Get current stream status
     * Checks if Icecast has an active stream
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        return ResponseEntity.ok(icecastService.getStreamStatus());
    }

    /**
     * Manual start streaming endpoint (optional)
     * This is mainly for compatibility - actual streaming starts when DJ connects WebSocket
     */
    @PostMapping("/start")
    public ResponseEntity<Map<String, String>> startStream() {
        Map<String, String> response = new HashMap<>();
        response.put("message", "Stream ready to accept connections");
        response.put("webSocketUrl", networkConfig.getWebSocketUrl());
        response.put("streamUrl", networkConfig.getStreamUrl());
        return ResponseEntity.ok(response);
    }

    /**
     * Manual stop streaming endpoint (optional)
     * Actual streaming stops when DJ disconnects WebSocket
     */
    @PostMapping("/stop")
    public ResponseEntity<Map<String, String>> stopStream() {
        Map<String, String> response = new HashMap<>();
        response.put("message", "Stream stopped");
        return ResponseEntity.ok(response);
    }
} 