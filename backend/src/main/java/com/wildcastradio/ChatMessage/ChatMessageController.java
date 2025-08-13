package com.wildcastradio.ChatMessage;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.wildcastradio.ChatMessage.DTO.ChatMessageDTO;
import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserService;
import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.Broadcast.BroadcastRepository;

@RestController
@RequestMapping("/api/chats")
public class ChatMessageController {

    @Autowired
    public ChatMessageService chatMessageService;

    @Autowired
    private UserService userService;

    @Autowired
    private ChatMessageCleanupService cleanupService;

    @Autowired
    private BroadcastRepository broadcastRepository;

    // In-memory per-user per-broadcast cooldown tracking for slow mode
    private final ConcurrentHashMap<String, Long> lastMessageTimestamps = new ConcurrentHashMap<>();


    @GetMapping("/{broadcastId}")
    public ResponseEntity<List<ChatMessageDTO>> getMessages(@PathVariable Long broadcastId) {
        List<ChatMessageDTO> messages = chatMessageService.getMessagesForBroadcast(broadcastId);
        return ResponseEntity.ok(messages);
    }

    @PostMapping("/{broadcastId}")
    public ResponseEntity<ChatMessageDTO> sendMessage(
            @PathVariable Long broadcastId,
            @RequestBody ChatMessageRequest request,
            Authentication authentication) {

        if (authentication == null) {
            return ResponseEntity.status(401).build();
        }

        UserEntity sender = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Block banned users
        if (userService.isUserCurrentlyBanned(sender)) {
            StringBuilder msg = new StringBuilder("You are banned from chatting");
            if (sender.getBanReason() != null && !sender.getBanReason().isEmpty()) {
                msg.append(": ").append(sender.getBanReason());
            }
            if (sender.getBannedUntil() != null) {
                msg.append(" until ").append(sender.getBannedUntil());
            } else {
                msg.append(" permanently");
            }
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(null);
        }

        // Enforce slow mode for non-DJ/Admin users if enabled on the broadcast
        try {
            BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
                .orElseThrow(() -> new IllegalArgumentException("Broadcast not found with ID: " + broadcastId));

            boolean isPrivileged = sender.getRole() == com.wildcastradio.User.UserEntity.UserRole.DJ
                    || sender.getRole() == com.wildcastradio.User.UserEntity.UserRole.ADMIN;

            Integer slowSeconds = broadcast.getSlowModeSeconds();
            boolean slowEnabled = Boolean.TRUE.equals(broadcast.getSlowModeEnabled()) && slowSeconds != null && slowSeconds > 0;

            if (slowEnabled && !isPrivileged) {
                long now = System.currentTimeMillis();
                String key = broadcastId + ":" + sender.getId();
                Long last = lastMessageTimestamps.get(key);

                // Opportunistic cleanup of very old entries
                if (last != null && last < now - 24L * 60L * 60L * 1000L) {
                    lastMessageTimestamps.remove(key);
                    last = null;
                }

                if (last != null) {
                    long cooldownMillis = slowSeconds * 1000L;
                    long elapsed = now - last;
                    if (elapsed < cooldownMillis) {
                        long remainingMillis = cooldownMillis - elapsed;
                        long remainingSecs = Math.max(1L, (remainingMillis + 999) / 1000); // ceil to seconds
                        HttpHeaders headers = new HttpHeaders();
                        headers.add("Retry-After", String.valueOf(remainingSecs));
                        return new ResponseEntity<>(headers, HttpStatus.TOO_MANY_REQUESTS);
                    }
                }

                // Update timestamp before processing to prevent racey double-send
                lastMessageTimestamps.put(key, now);
            }
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        ChatMessageEntity message = chatMessageService.createMessage(
                broadcastId,
                sender,
                request.getContent()
        );

        return ResponseEntity.ok(ChatMessageDTO.fromEntity(message));
    }

    /**
     * Export messages for a specific broadcast as Excel file
     */
    @GetMapping("/{broadcastId}/export")
    public ResponseEntity<byte[]> exportMessages(@PathVariable Long broadcastId, Authentication authentication) {
        if (authentication == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            byte[] excelData = chatMessageService.exportMessagesToExcel(broadcastId);

            // Determine filename from broadcast title
            BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
                .orElseThrow(() -> new IllegalArgumentException("Broadcast not found with ID: " + broadcastId));
            String filename = sanitizeFilename(broadcast.getTitle()) + ".xlsx";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            headers.setContentDispositionFormData("attachment", filename);

            return ResponseEntity.ok()
                    .headers(headers)
                    .body(excelData);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Get cleanup statistics
     */
    @GetMapping("/cleanup/stats")
    public ResponseEntity<CleanupStatsResponse> getCleanupStats(Authentication authentication) {
        if (authentication == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        long oldMessagesCount = cleanupService.getCleanupStatistics();
        return ResponseEntity.ok(new CleanupStatsResponse(oldMessagesCount));
    }

    /**
     * Perform manual cleanup of old messages (admin only)
     */
    @PostMapping("/cleanup/manual")
    public ResponseEntity<CleanupResponse> performManualCleanup(Authentication authentication) {
        if (authentication == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            int deletedCount = cleanupService.performManualCleanup();
            return ResponseEntity.ok(new CleanupResponse(deletedCount, "Manual cleanup completed successfully"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new CleanupResponse(0, "Cleanup failed: " + e.getMessage()));
        }
    }

    private static String sanitizeFilename(String input) {
        if (input == null || input.isBlank()) {
            return "messages";
        }
        // Replace characters not allowed in filenames on Windows and trim
        String sanitized = input.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        // Avoid empty string after sanitization
        if (sanitized.isBlank()) {
            sanitized = "messages";
        }
        return sanitized;
    }

    // Response classes
    public static class CleanupStatsResponse {
        private long oldMessagesCount;

        public CleanupStatsResponse(long oldMessagesCount) {
            this.oldMessagesCount = oldMessagesCount;
        }

        public long getOldMessagesCount() {
            return oldMessagesCount;
        }

        public void setOldMessagesCount(long oldMessagesCount) {
            this.oldMessagesCount = oldMessagesCount;
        }
    }

    public static class CleanupResponse {
        private int deletedCount;
        private String message;

        public CleanupResponse(int deletedCount, String message) {
            this.deletedCount = deletedCount;
            this.message = message;
        }

        public int getDeletedCount() {
            return deletedCount;
        }

        public void setDeletedCount(int deletedCount) {
            this.deletedCount = deletedCount;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }
    }

    // Inner class for chat message request
    public static class ChatMessageRequest {
        private String content;

        public String getContent() {
            return content;
        }

        public void setContent(String content) {
            this.content = content;
        }
    }

    // no-op
}
