package com.wildcastradio.ChatMessage;

import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
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
