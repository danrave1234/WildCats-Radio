package com.wildcastradio.ChatMessage;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.wildcastradio.ChatMessage.DTO.ChatMessageDTO;
import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserService;

@RestController
@RequestMapping("/api/chats")
public class ChatMessageController {

    @Autowired
    private ChatMessageService chatMessageService;

    @Autowired
    private UserService userService;

    @Autowired
    private ChatMessageCleanupService cleanupService;

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

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            headers.setContentDispositionFormData("attachment", "broadcast_" + broadcastId + "_messages.xlsx");

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
}
