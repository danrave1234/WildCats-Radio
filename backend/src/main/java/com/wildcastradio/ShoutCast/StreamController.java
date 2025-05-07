package com.wildcastradio.ShoutCast;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * REST controller for stream management operations.
 * Provides endpoints to start, stop, and check stream status.
 */
@RestController
@RequestMapping("/api/stream")
public class StreamController {
    private static final Logger logger = LoggerFactory.getLogger(StreamController.class);
    
    @Autowired
    private ShoutcastService shoutcastService;
    
    /**
     * Authorize a DJ to start streaming. This endpoint is called before
     * establishing the WebSocket connection for audio streaming.
     * 
     * @return OK response if authorized
     */
    @PostMapping("/start")
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> start() {
        logger.info("DJ authorized to start streaming");
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Authorized to start streaming");
        
        // Connection parameters that client might need
        response.put("wsEndpoint", "/stream");
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * Notify the server that streaming has stopped.
     * 
     * @return OK response
     */
    @PostMapping("/stop")
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> stop() {
        logger.info("DJ stopped streaming");
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Stream stopped successfully");
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * Get the current status of the stream.
     * This endpoint is publicly accessible without authentication.
     * 
     * @return Stream status information
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        boolean isServerAccessible = shoutcastService.isServerAccessible();
        boolean isInTestMode = shoutcastService.isInTestMode();
        
        Map<String, Object> status = new HashMap<>();
        status.put("live", isServerAccessible);
        status.put("testMode", isInTestMode);
        status.put("serverUrl", shoutcastService.getStreamingUrl());
        
        logger.debug("Stream status: live={}, testMode={}", isServerAccessible, isInTestMode);
        
        return ResponseEntity.ok(status);
    }
} 