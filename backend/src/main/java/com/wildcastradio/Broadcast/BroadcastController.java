package com.wildcastradio.Broadcast;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
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
import org.springframework.web.bind.annotation.RestController;

import com.wildcastradio.Broadcast.DTO.BroadcastDTO;
import com.wildcastradio.Broadcast.DTO.CreateBroadcastRequest;
import com.wildcastradio.Schedule.ScheduleEntity;
import com.wildcastradio.Schedule.ScheduleService;
import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserService;
import com.wildcastradio.util.DateTimeUtil;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/broadcasts")
public class BroadcastController {

    @Autowired
    private BroadcastService broadcastService;

    @Autowired
    private ScheduleService scheduleService;

    @Autowired
    private UserService userService;
    
    @Autowired
    private DateTimeUtil dateTimeUtil;

    @PostMapping
    public ResponseEntity<BroadcastDTO> createBroadcast(
            @Valid @RequestBody CreateBroadcastRequest request,
            Authentication authentication) {

        if (authentication == null) {
            return ResponseEntity.status(401).build();
        }

        UserEntity user = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

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
    public ResponseEntity<BroadcastDTO> updateBroadcast(@PathVariable Long id, 
                                                      @Valid @RequestBody CreateBroadcastRequest request) {
        BroadcastDTO updated = broadcastService.updateBroadcast(id, request);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBroadcast(@PathVariable Long id) {
        broadcastService.deleteBroadcast(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/schedule")
    public ResponseEntity<BroadcastDTO> scheduleBroadcast(
            @Valid @RequestBody CreateBroadcastRequest request,
            Authentication authentication) {

        if (authentication == null) {
            return ResponseEntity.status(401).build();
        }

        UserEntity user = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Create the schedule first
        ScheduleEntity schedule = scheduleService.createSchedule(
            request.getScheduledStart(),
            request.getScheduledEnd(),
            user
        );

        // Create the broadcast with the schedule
        BroadcastEntity broadcast = new BroadcastEntity();
        broadcast.setTitle(request.getTitle());
        broadcast.setDescription(request.getDescription());
        broadcast.setSchedule(schedule);

        BroadcastEntity scheduled = broadcastService.scheduleBroadcast(broadcast, user);
        return ResponseEntity.ok(BroadcastDTO.fromEntity(scheduled));
    }

    @PostMapping("/{id}/start")
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<BroadcastDTO> startBroadcast(
            @PathVariable Long id,
            Authentication authentication) {

        if (authentication == null) {
            return ResponseEntity.status(401).build();
        }

        UserEntity user = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        BroadcastEntity broadcast = broadcastService.startBroadcast(id, user);
        return ResponseEntity.ok(BroadcastDTO.fromEntity(broadcast));
    }

    @PostMapping("/{id}/end")
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<BroadcastDTO> endBroadcast(
            @PathVariable Long id,
            Authentication authentication) {

        if (authentication == null) {
            return ResponseEntity.status(401).build();
        }

        UserEntity user = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        BroadcastEntity broadcast = broadcastService.endBroadcast(id, user);
        return ResponseEntity.ok(BroadcastDTO.fromEntity(broadcast));
    }

    @GetMapping("/upcoming")
    public ResponseEntity<List<BroadcastDTO>> getUpcomingBroadcasts() {
        List<BroadcastEntity> upcomingBroadcasts = broadcastService.getUpcomingBroadcasts();
        List<BroadcastDTO> broadcasts = upcomingBroadcasts.stream()
                .map(BroadcastDTO::fromEntity)
                .collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(broadcasts);
    }

    @GetMapping("/live")
    public ResponseEntity<List<BroadcastDTO>> getLiveBroadcasts() {
        List<BroadcastEntity> liveBroadcasts = broadcastService.getLiveBroadcasts();
        List<BroadcastDTO> broadcasts = liveBroadcasts.stream()
                .map(BroadcastDTO::fromEntity)
                .collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(broadcasts);
    }

    /**
     * Temporary endpoint to start broadcasts in test mode without Icecast integration.
     */
    @PostMapping("/{id}/start-test")
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<BroadcastDTO> startBroadcastTestMode(
            @PathVariable Long id,
            Authentication authentication) {

        if (authentication == null) {
            return ResponseEntity.status(401).build();
        }

        UserEntity user = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        BroadcastEntity broadcast = broadcastService.startBroadcastTestMode(id, user);
        return ResponseEntity.ok(BroadcastDTO.fromEntity(broadcast));
    }

    @GetMapping("/{id}/analytics")
    public ResponseEntity<String> getBroadcastAnalytics(@PathVariable Long id) {
        String analytics = broadcastService.getAnalytics(id);
        return ResponseEntity.ok(analytics);
    }
}
