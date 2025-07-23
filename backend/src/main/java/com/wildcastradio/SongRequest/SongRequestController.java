package com.wildcastradio.SongRequest;

import java.util.List;

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

import com.wildcastradio.SongRequest.DTO.SongRequestDTO;
import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserService;

@RestController
@RequestMapping("/api/broadcasts/{broadcastId}/song-requests")
public class SongRequestController {

    private final SongRequestService songRequestService;
    private final UserService userService;

    public SongRequestController(SongRequestService songRequestService, UserService userService) {
        this.songRequestService = songRequestService;
        this.userService = userService;
    }

    @PostMapping
    public ResponseEntity<SongRequestDTO> createSongRequest(
            @PathVariable Long broadcastId,
            @RequestBody SongRequestCreateRequest request,
            Authentication authentication) {
        UserEntity requestedBy = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        SongRequestEntity songRequest = songRequestService.createSongRequest(
                broadcastId,
                requestedBy,
                request.getSongTitle(),
                request.getArtist()
        );

        return ResponseEntity.ok(SongRequestDTO.fromEntity(songRequest));
    }

    @GetMapping
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<List<SongRequestDTO>> getSongRequests(@PathVariable Long broadcastId) {
        List<SongRequestDTO> songRequests = songRequestService.getSongRequestsForBroadcast(broadcastId);
        return ResponseEntity.ok(songRequests);
    }

    @DeleteMapping("/{requestId}")
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<Void> deleteSongRequest(
            @PathVariable Long broadcastId,
            @PathVariable Long requestId,
            Authentication authentication) {
        UserEntity user = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        songRequestService.deleteSongRequest(broadcastId, requestId, user);
        return ResponseEntity.ok().build();
    }

    // Inner class for song request creation payload
    public static class SongRequestCreateRequest {
        private String songTitle;
        private String artist;

        // Getters and Setters
        public String getSongTitle() {
            return songTitle;
        }

        public void setSongTitle(String songTitle) {
            this.songTitle = songTitle;
        }

        public String getArtist() {
            return artist;
        }

        public void setArtist(String artist) {
            this.artist = artist;
        }
    }
} 
