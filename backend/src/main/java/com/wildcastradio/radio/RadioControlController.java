package com.wildcastradio.radio;

import java.util.HashMap;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.wildcastradio.ActivityLog.ActivityLogEntity.ActivityType;
import com.wildcastradio.ActivityLog.ActivityLogService;
import com.wildcastradio.User.UserService;

@RestController
@RequestMapping("/api/radio")
public class RadioControlController {
    private final RadioAgentClient client;
    private final ActivityLogService activityLogService;
    private final UserService userService;

    public RadioControlController(RadioAgentClient client, ActivityLogService activityLogService, UserService userService) {
        this.client = client;
        this.activityLogService = activityLogService;
        this.userService = userService;
    }

    @PostMapping("/start")
    @PreAuthorize("hasAnyRole('DJ','ADMIN','MODERATOR')")
    public ResponseEntity<?> start(Authentication auth) {
        try {
            Map<String, Object> body = client.start();
            try {
                if (auth != null) {
                    userService.getUserByEmail(auth.getName()).ifPresent(u ->
                        activityLogService.logActivity(u, ActivityType.SERVER_START, "Radio server start requested")
                    );
                }
            } catch (Exception ignored) {}
            return ResponseEntity.ok(body);
        } catch (RadioAgentUnavailableException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("state", "unknown");
            err.put("detail", "agent timeout/unreachable");
            return ResponseEntity.status(504).body(err);
        } catch (RadioAgentProxyException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("state", "unknown");
            err.put("detail", "agent error: " + e.getStatusCode());
            return ResponseEntity.status(502).body(err);
        }
    }

    @PostMapping("/stop")
    @PreAuthorize("hasAnyRole('DJ','ADMIN','MODERATOR')")
    public ResponseEntity<?> stop(Authentication auth) {
        try {
            Map<String, Object> body = client.stop();
            try {
                if (auth != null) {
                    userService.getUserByEmail(auth.getName()).ifPresent(u ->
                        activityLogService.logActivity(u, ActivityType.SERVER_STOP, "Radio server stop requested")
                    );
                }
            } catch (Exception ignored) {}
            return ResponseEntity.ok(body);
        } catch (RadioAgentUnavailableException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("state", "unknown");
            err.put("detail", "agent timeout/unreachable");
            return ResponseEntity.status(504).body(err);
        } catch (RadioAgentProxyException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("state", "unknown");
            err.put("detail", "agent error: " + e.getStatusCode());
            return ResponseEntity.status(502).body(err);
        }
    }

    @GetMapping("/status")
    public ResponseEntity<?> status() {
        try {
            Map<String, Object> body = client.status();
            return ResponseEntity.ok(body);
        } catch (RadioAgentUnavailableException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("state", "unknown");
            err.put("detail", "agent timeout/unreachable");
            return ResponseEntity.status(504).body(err);
        } catch (RadioAgentProxyException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("state", "unknown");
            err.put("detail", "agent error: " + e.getStatusCode());
            return ResponseEntity.status(502).body(err);
        }
    }
}


