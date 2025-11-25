package com.wildcastradio.Broadcast;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.wildcastradio.Broadcast.DTO.BroadcastDTO;
import com.wildcastradio.Broadcast.DTO.CreateBroadcastRequest;
import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/broadcasts")
public class BroadcastController {
    private static final Logger logger = LoggerFactory.getLogger(BroadcastController.class);

    @Autowired
    private BroadcastService broadcastService;

    @Autowired
    private UserService userService;

    @Autowired
    private com.wildcastradio.ChatMessage.ChatMessageService chatMessageService;


    @PostMapping
    @PreAuthorize("hasAnyRole('DJ','ADMIN','MODERATOR')") // DJ role can create broadcasts
    public ResponseEntity<BroadcastDTO> createBroadcast(
            @Valid @RequestBody CreateBroadcastRequest request,
            Authentication authentication) {

        if (authentication == null) {
            return ResponseEntity.status(401).build();
        }

        UserEntity user = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        BroadcastDTO broadcast = broadcastService.createBroadcast(request, user);
        return new ResponseEntity<>(broadcast, HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<List<BroadcastDTO>> getAllBroadcasts() {
        List<BroadcastEntity> broadcasts = broadcastService.getAllBroadcasts();
        List<BroadcastDTO> broadcastDTOs = broadcasts.stream()
                .map(BroadcastDTO::fromEntity)
                .collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(broadcastDTOs);
    }

    @GetMapping("/{id}")
    public ResponseEntity<BroadcastDTO> getBroadcastById(@PathVariable Long id) {
        return broadcastService.getBroadcastById(id)
                .map(broadcast -> ResponseEntity.ok(BroadcastDTO.fromEntity(broadcast)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('DJ','ADMIN','MODERATOR')")
    public ResponseEntity<BroadcastDTO> updateBroadcast(@PathVariable Long id, 
                                                      @Valid @RequestBody CreateBroadcastRequest request) {
        BroadcastDTO updated = broadcastService.updateBroadcast(id, request);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('DJ','ADMIN','MODERATOR')")
    public ResponseEntity<Void> deleteBroadcast(@PathVariable Long id) {
        broadcastService.deleteBroadcast(id);
        return ResponseEntity.noContent().build();
    }


    @PostMapping("/{id}/start")
    @PreAuthorize("hasAnyRole('DJ','ADMIN','MODERATOR')") // MODERATOR added - moderators can DJ and start broadcasts
    public ResponseEntity<BroadcastDTO> startBroadcast(
            @PathVariable Long id,
            @org.springframework.web.bind.annotation.RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            Authentication authentication) {

        if (authentication == null) {
            return ResponseEntity.status(401).build();
        }

        UserEntity user = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        BroadcastEntity broadcast = broadcastService.startBroadcast(id, user, idempotencyKey);
        return ResponseEntity.ok(BroadcastDTO.fromEntity(broadcast));
    }

    @PostMapping("/{id}/end")
    @PreAuthorize("hasAnyRole('DJ','ADMIN','MODERATOR')")
    public ResponseEntity<BroadcastDTO> endBroadcast(
            @PathVariable Long id,
            @org.springframework.web.bind.annotation.RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            Authentication authentication) {

        if (authentication == null) {
            return ResponseEntity.status(401).build();
        }

        UserEntity user = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        BroadcastEntity broadcast = broadcastService.endBroadcast(id, user, idempotencyKey);
        return ResponseEntity.ok(BroadcastDTO.fromEntity(broadcast));
    }

    @GetMapping("/upcoming")
    public ResponseEntity<List<com.wildcastradio.Broadcast.DTO.UpcomingBroadcastDTO>> getUpcomingBroadcasts() {
        // Use optimized DTO projection query - eliminates N+1 queries
        // Returns only SCHEDULED broadcasts (excludes COMPLETED, CANCELLED)
        List<com.wildcastradio.Broadcast.DTO.UpcomingBroadcastDTO> broadcasts = broadcastService.getUpcomingBroadcastsDTO();
        return ResponseEntity.ok(broadcasts);
    }

    @GetMapping("/live")
    public ResponseEntity<List<BroadcastDTO>> getLiveBroadcasts() {
        List<BroadcastEntity> liveBroadcasts = broadcastService.getLiveBroadcasts();
        
        // CRITICAL: Filter out broadcasts where Liquidsoap is not actually running
        // This prevents showing "live" broadcasts when the server is stopped
        List<BroadcastDTO> broadcasts = liveBroadcasts.stream()
                .filter(broadcast -> {
                    // For BUTT workflow: Only return broadcasts as "live" if radio server is running
                    // This ensures consistency with ListenerDashboard's isLive computation
                    try {
                        // Check if radio agent is available and server is running
                        boolean serverRunning = broadcastService.isRadioServerRunning();
                        if (!serverRunning) {
                            logger.warn("Broadcast {} is marked LIVE but radio server is not running", broadcast.getId());
                        }
                        return serverRunning;
                    } catch (Exception e) {
                        logger.error("Failed to check radio server status for broadcast {}: {}", broadcast.getId(), e.getMessage());
                        // On error, include the broadcast (graceful degradation)
                        return true;
                    }
                })
                .map(BroadcastDTO::fromEntity)
                .collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(broadcasts);
    }

    // Broadcast-centric history (no Notification dependency)
    @GetMapping("/history")
    @PreAuthorize("hasAnyRole('DJ','ADMIN','MODERATOR')")
    public ResponseEntity<?> getBroadcastHistory(
            @RequestParam(name = "days", defaultValue = "30") int days,
            @RequestParam(name = "page", required = false) Integer page,
            @RequestParam(name = "size", required = false) Integer size) {
        int safeDays = Math.max(1, Math.min(days, 365));
        java.time.LocalDateTime since = java.time.LocalDateTime.now().minusDays(safeDays);
        if (page != null || size != null) {
            int p = page != null ? page : 0;
            int s = size != null ? size : 20;
            Page<BroadcastEntity> ended = broadcastService.getEndedBroadcastsSince(since, p, s);
            Page<BroadcastDTO> dtos = ended.map(BroadcastDTO::fromEntity);
            return ResponseEntity.ok(dtos);
        }
        List<BroadcastEntity> ended = broadcastService.getEndedBroadcastsSince(since);
        List<BroadcastDTO> dtos = ended.stream()
                .map(BroadcastDTO::fromEntity)
                .collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('DJ','ADMIN','MODERATOR')")
    public ResponseEntity<Page<BroadcastDTO>> searchBroadcasts(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<BroadcastEntity> results = broadcastService.searchBroadcasts(query != null ? query : "", status, pageable);
        return ResponseEntity.ok(results.map(BroadcastDTO::fromEntity));
    }
    
    @GetMapping("/live/current")
    public ResponseEntity<BroadcastDTO> getCurrentLiveBroadcast() {
        Optional<BroadcastEntity> currentLive = broadcastService.getCurrentLiveBroadcast();
        return currentLive
                .map(broadcast -> ResponseEntity.ok(BroadcastDTO.fromEntity(broadcast)))
                .orElse(ResponseEntity.notFound().build());
    }

    // Live stream health snapshot for clients (used to display reconnecting state)
    @GetMapping("/live/health")
    public ResponseEntity<Map<String, Object>> getLiveHealth() {
        Map<String, Object> snapshot = broadcastService.getLiveStreamHealthStatus();
        return ResponseEntity.ok(snapshot);
    }

    /**
     * Temporary endpoint to start broadcasts in test mode without Icecast integration.
     */
    @PostMapping("/{id}/start-test")
    @PreAuthorize("hasAnyRole('DJ','ADMIN','MODERATOR')")
    public ResponseEntity<BroadcastDTO> startBroadcastTestMode(
            @PathVariable Long id,
            Authentication authentication) {

        if (authentication == null) {
            return ResponseEntity.status(401).build();
        }

        UserEntity user = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        BroadcastEntity broadcast = broadcastService.startBroadcastTestMode(id, user);
        return ResponseEntity.ok(BroadcastDTO.fromEntity(broadcast));
    }

    @GetMapping("/{id}/analytics")
    public ResponseEntity<String> getBroadcastAnalytics(@PathVariable Long id) {
        String analytics = broadcastService.getAnalytics(id);
        return ResponseEntity.ok(analytics);
    }

    // Direct export endpoint under broadcasts (convenience wrapper around chat export)
    @GetMapping("/{id}/chat/export")
    @PreAuthorize("hasAnyRole('DJ','ADMIN','MODERATOR')")
    public org.springframework.http.ResponseEntity<org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody> exportBroadcastChat(
            @PathVariable Long id) {
        try {
            java.util.Optional<com.wildcastradio.Broadcast.BroadcastEntity> b = broadcastService.getBroadcastById(id);
            String title = b.map(com.wildcastradio.Broadcast.BroadcastEntity::getTitle).orElse("messages");
            String safeTitle = title.replaceAll("[\\/:*?\"<>|]", "_").trim();
            if (safeTitle.isBlank()) safeTitle = "messages";
            java.time.LocalDateTime ts = b.flatMap(x -> java.util.Optional.ofNullable(x.getActualStart()))
                .orElse(java.time.LocalDateTime.now());
            String tsStr = ts.format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd_HHmm"));
            String filename = safeTitle + "_" + tsStr + ".xlsx";
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.setContentType(org.springframework.http.MediaType.APPLICATION_OCTET_STREAM);
            headers.setContentDispositionFormData("attachment", filename);
            headers.add("Access-Control-Expose-Headers", "Content-Disposition");
            org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody body = outputStream -> {
                chatMessageService.streamMessagesToExcel(id, outputStream);
            };
            return org.springframework.http.ResponseEntity.ok().headers(headers).body(body);
        } catch (IllegalArgumentException e) {
            return org.springframework.http.ResponseEntity.notFound().build();
        } catch (Exception e) {
            return org.springframework.http.ResponseEntity.status(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PutMapping("/{id}/slowmode")
    @PreAuthorize("hasAnyRole('DJ','ADMIN','MODERATOR')") // MODERATOR added - moderators can control slow mode
    public ResponseEntity<BroadcastDTO> updateSlowMode(
            @PathVariable Long id,
            @RequestBody SlowModeRequest request) {
        if (request == null) {
            return ResponseEntity.badRequest().build();
        }
        BroadcastDTO dto = broadcastService.updateSlowMode(id, request.getEnabled(), request.getSeconds());
        return ResponseEntity.ok(dto);
    }

    public static class SlowModeRequest {
        private Boolean enabled;
        private Integer seconds;

        public Boolean getEnabled() {
            return enabled;
        }

        public void setEnabled(Boolean enabled) {
            this.enabled = enabled;
        }

        public Integer getSeconds() {
            return seconds;
        }

        public void setSeconds(Integer seconds) {
            this.seconds = seconds;
        }
    }
}
