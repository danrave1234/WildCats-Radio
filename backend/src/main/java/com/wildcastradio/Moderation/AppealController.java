package com.wildcastradio.Moderation;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserService;

@RestController
@RequestMapping("/api/moderation/appeals")
public class AppealController {

    @Autowired
    private AppealService appealService;

    @Autowired
    private UserService userService;

    // Create appeal (User)
    @PostMapping
    @PreAuthorize("hasRole('LISTENER') or hasRole('DJ')") // Anyone can appeal if banned? Usually banned users can't access much.
    // If authentication works for banned users, this is fine.
    public ResponseEntity<AppealEntity> createAppeal(@RequestBody AppealRequest request, Authentication auth) {
        UserEntity user = userService.getUserByEmail(auth.getName()).orElseThrow();
        AppealEntity appeal = appealService.createAppeal(user.getId(), request.getReason());
        return ResponseEntity.ok(appeal);
    }

    // List pending appeals (Moderator)
    @GetMapping("/pending")
    @PreAuthorize("hasAnyRole('ADMIN','MODERATOR')")
    public ResponseEntity<List<AppealEntity>> getPendingAppeals() {
        return ResponseEntity.ok(appealService.getPendingAppeals());
    }

    // Resolve appeal (Moderator)
    @PutMapping("/{id}/resolve")
    @PreAuthorize("hasAnyRole('ADMIN','MODERATOR')")
    public ResponseEntity<AppealEntity> resolveAppeal(@PathVariable Long id, @RequestBody ResolveRequest request, Authentication auth) {
        UserEntity reviewer = userService.getUserByEmail(auth.getName()).orElseThrow();
        AppealEntity appeal = appealService.resolveAppeal(id, request.getDecision(), reviewer, request.getNotes());
        return ResponseEntity.ok(appeal);
    }
    
    // User view their appeals
    @GetMapping("/my")
    public ResponseEntity<List<AppealEntity>> getMyAppeals(Authentication auth) {
        UserEntity user = userService.getUserByEmail(auth.getName()).orElseThrow();
        return ResponseEntity.ok(appealService.getAppealsForUser(user.getId()));
    }

    public static class AppealRequest {
        private String reason;
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
    }

    public static class ResolveRequest {
        private String decision; // APPROVED, DENIED
        private String notes;
        public String getDecision() { return decision; }
        public void setDecision(String decision) { this.decision = decision; }
        public String getNotes() { return notes; }
        public void setNotes(String notes) { this.notes = notes; }
    }
}

