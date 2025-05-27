package com.wildcastradio.SongRequest;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.wildcastradio.SongRequest.DTO.SongRequestDTO;
import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserService;

@RestController
@RequestMapping("/api/song-requests")
public class SongRequestAnalyticsController {

    private final SongRequestService songRequestService;
    private final UserService userService;

    public SongRequestAnalyticsController(SongRequestService songRequestService, UserService userService) {
        this.songRequestService = songRequestService;
        this.userService = userService;
    }

    /**
     * Get all song requests for analytics (requires DJ or ADMIN role)
     */
    @GetMapping
    public ResponseEntity<List<SongRequestDTO>> getAllSongRequests(Authentication authentication) {
        if (authentication == null) {
            return ResponseEntity.status(401).build();
        }

        UserEntity currentUser = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Only DJ and ADMIN users can see all song requests
        if (!"DJ".equals(currentUser.getRole().toString()) && !"ADMIN".equals(currentUser.getRole().toString())) {
            return ResponseEntity.status(403).build();
        }

        List<SongRequestDTO> allSongRequests = songRequestService.getAllSongRequests();
        return ResponseEntity.ok(allSongRequests);
    }

    /**
     * Get song request statistics for analytics dashboard
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getSongRequestStats(Authentication authentication) {
        if (authentication == null) {
            return ResponseEntity.status(401).build();
        }

        UserEntity currentUser = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Only DJ and ADMIN users can see song request stats
        if (!"DJ".equals(currentUser.getRole().toString()) && !"ADMIN".equals(currentUser.getRole().toString())) {
            return ResponseEntity.status(403).build();
        }

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalSongRequests", songRequestService.getTotalSongRequestCount());
        
        List<SongRequestDTO> allRequests = songRequestService.getAllSongRequests();
        stats.put("allRequests", allRequests);
        
        return ResponseEntity.ok(stats);
    }
} 