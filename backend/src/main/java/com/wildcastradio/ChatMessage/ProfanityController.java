package com.wildcastradio.ChatMessage;

import java.io.IOException;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserService;

@RestController
@RequestMapping("/api/profanity")
public class ProfanityController {

    @Autowired
    private ProfanityDictionaryService dictionaryService;

    @Autowired
    private UserService userService;

    @GetMapping("/words")
    public ResponseEntity<List<String>> listWords(Authentication authentication) {
        if (authentication == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(dictionaryService.listEntries());
    }

    @PostMapping("/words")
    public ResponseEntity<AddWordResponse> addWord(@RequestBody AddWordRequest request, Authentication authentication) {
        if (authentication == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        // Only allow DJ, MODERATOR or ADMIN roles to add words
        UserEntity user = userService.getUserByEmail(authentication.getName()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        boolean isPrivileged = user.getRole() == UserEntity.UserRole.DJ
                || user.getRole() == UserEntity.UserRole.ADMIN
                || user.getRole() == UserEntity.UserRole.MODERATOR;
        if (!isPrivileged) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        String word = request != null ? request.getWord() : null;
        if (word == null || word.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(new AddWordResponse(false, "Word must not be empty"));
        }
        try {
            boolean added = dictionaryService.addEntry(word);
            if (added) {
                return ResponseEntity.ok(new AddWordResponse(true, "Word added"));
            } else {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(new AddWordResponse(false, "Word already exists"));
            }
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new AddWordResponse(false, "Failed to persist word: " + e.getMessage()));
        }
    }

    public static class AddWordRequest {
        private String word;
        public String getWord() { return word; }
        public void setWord(String word) { this.word = word; }
    }

    public static class AddWordResponse {
        private boolean success;
        private String message;
        public AddWordResponse() {}
        public AddWordResponse(boolean success, String message) {
            this.success = success; this.message = message;
        }
        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
    }
}
