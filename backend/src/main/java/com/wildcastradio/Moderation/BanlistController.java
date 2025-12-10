package com.wildcastradio.Moderation;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
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
import org.springframework.web.bind.annotation.RestController;

import com.wildcastradio.ChatMessage.ProfanityService;
import com.wildcastradio.Moderation.DTO.BanlistWordDTO;
import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserService;

@RestController
@RequestMapping("/api/moderation/keywords")
public class BanlistController {

    @Autowired
    private BanlistService banlistService;
    
    @Autowired
    private ProfanityService profanityService;

    @Autowired
    private UserService userService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','MODERATOR','DJ')")
    public ResponseEntity<List<BanlistWordDTO>> getKeywords() {
        return ResponseEntity.ok(banlistService.getActiveWords());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BanlistWordDTO> addKeyword(@RequestBody BanlistWordRequest request, Authentication auth) {
        UserEntity user = userService.getUserByEmail(auth.getName()).orElseThrow();
        BanlistWordEntity added = banlistService.addWord(request.getWord(), request.getTier(), user);
        profanityService.refreshWords(); // Sync in-memory filter
        return ResponseEntity.ok(new BanlistWordDTO(added));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BanlistWordDTO> updateKeyword(@PathVariable Long id, @RequestBody BanlistWordRequest request, Authentication auth) {
        UserEntity user = userService.getUserByEmail(auth.getName()).orElseThrow();
        BanlistWordEntity updated = banlistService.updateTier(id, request.getTier(), user);
        profanityService.refreshWords(); // Sync in-memory filter
        return ResponseEntity.ok(new BanlistWordDTO(updated));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteKeyword(@PathVariable Long id, Authentication auth) {
        UserEntity user = userService.getUserByEmail(auth.getName()).orElseThrow();
        banlistService.deleteWord(id, user);
        profanityService.refreshWords(); // Sync in-memory filter
        return ResponseEntity.noContent().build();
    }

    // DTO for request
    public static class BanlistWordRequest {
        private String word;
        private Integer tier;

        public String getWord() { return word; }
        public void setWord(String word) { this.word = word; }
        public Integer getTier() { return tier; }
        public void setTier(Integer tier) { this.tier = tier; }
    }
}
