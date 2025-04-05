package com.wildcastradio.ShoutCast;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/shoutcast")
public class ShoutcastController {

    @Autowired
    private ShoutcastService shoutCastService;

    /**
     * Check if the ShoutCast server is accessible
     * 
     * @return Status of the ShoutCast server
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getServerStatus() {
        boolean isAccessible = shoutCastService.isServerAccessible();

        Map<String, Object> response = new HashMap<>();
        response.put("accessible", isAccessible);
        response.put("status", isAccessible ? "UP" : "DOWN");

        return ResponseEntity.ok(response);
    }

    /**
     * Test the ShoutCast server by starting a test stream
     * Only accessible to ADMIN or DJ roles
     * 
     * @return Result of the test stream operation
     */
    @PostMapping("/test")
    @PreAuthorize("hasRole('ADMIN') or hasRole('DJ')")
    public ResponseEntity<Map<String, Object>> testStream() {
        try {
            // Create a dummy broadcast for testing
            com.wildcastradio.Broadcast.BroadcastEntity testBroadcast = new com.wildcastradio.Broadcast.BroadcastEntity();
            testBroadcast.setTitle("Test Stream");

            String streamUrl = shoutCastService.startStream(testBroadcast);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("streamUrl", streamUrl);
            response.put("message", "Test stream started successfully");

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("error", e.getMessage());

            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * Stop any active test streams
     * Only accessible to ADMIN or DJ roles
     * 
     * @return Result of the stop stream operation
     */
    @PostMapping("/stop-test")
    @PreAuthorize("hasRole('ADMIN') or hasRole('DJ')")
    public ResponseEntity<Map<String, Object>> stopTestStream() {
        try {
            // Create a dummy broadcast for stopping
            com.wildcastradio.Broadcast.BroadcastEntity testBroadcast = new com.wildcastradio.Broadcast.BroadcastEntity();
            testBroadcast.setTitle("Test Stream");

            shoutCastService.endStream(testBroadcast);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Test stream stopped successfully");

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("error", e.getMessage());

            return ResponseEntity.badRequest().body(response);
        }
    }
}
