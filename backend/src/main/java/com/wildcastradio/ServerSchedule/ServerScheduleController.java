package com.wildcastradio.ServerSchedule;

import java.util.List;
import java.util.stream.Collectors;

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

import com.wildcastradio.ServerSchedule.DTO.ServerScheduleDTO;
import com.wildcastradio.ServerSchedule.DTO.ServerScheduleInputDTO;
import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserService;

@RestController
@RequestMapping("/api/server-schedules")
public class ServerScheduleController {

    private final ServerScheduleService serverScheduleService;
    private final UserService userService;

    public ServerScheduleController(ServerScheduleService serverScheduleService, UserService userService) {
        this.serverScheduleService = serverScheduleService;
        this.userService = userService;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('DJ')")
    public ResponseEntity<List<ServerScheduleDTO>> getAllSchedules() {
        List<ServerScheduleDTO> schedules = serverScheduleService.getAllSchedules().stream()
                .map(ServerScheduleDTO::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(schedules);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('DJ')")
    public ResponseEntity<ServerScheduleDTO> getScheduleById(@PathVariable Long id) {
        return serverScheduleService.getScheduleById(id)
                .map(ServerScheduleDTO::fromEntity)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('DJ')")
    public ResponseEntity<?> createSchedule(
            @RequestBody ServerScheduleInputDTO inputDTO,
            Authentication authentication) {
        try {
            UserEntity user = userService.getUserByEmail(authentication.getName())
                    .orElseThrow(() -> new RuntimeException("User not found"));

            ServerScheduleEntity schedule = inputDTO.toEntity();
            ServerScheduleEntity savedSchedule = serverScheduleService.scheduleServerRun(schedule, user);
            return ResponseEntity.ok(ServerScheduleDTO.fromEntity(savedSchedule));
        } catch (IllegalArgumentException e) {
            // Return a bad request response with the error message
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            // Log the error and return a generic error message
            System.err.println("Error creating schedule: " + e.getMessage());
            return ResponseEntity.status(500).body("An error occurred while saving the schedule. Please try again.");
        }
    }

    @PutMapping("/{id}/start")
    @PreAuthorize("hasRole('ADMIN') or hasRole('DJ')")
    public ResponseEntity<ServerScheduleDTO> startServer(@PathVariable Long id) {
        ServerScheduleEntity schedule = serverScheduleService.startServer(id);
        return ResponseEntity.ok(ServerScheduleDTO.fromEntity(schedule));
    }

    @PutMapping("/{id}/stop")
    @PreAuthorize("hasRole('ADMIN') or hasRole('DJ')")
    public ResponseEntity<ServerScheduleDTO> stopServer(@PathVariable Long id) {
        ServerScheduleEntity schedule = serverScheduleService.stopServer(id);
        return ResponseEntity.ok(ServerScheduleDTO.fromEntity(schedule));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('DJ')")
    public ResponseEntity<?> updateSchedule(
            @PathVariable Long id,
            @RequestBody ServerScheduleInputDTO inputDTO,
            Authentication authentication) {
        try {
            UserEntity user = userService.getUserByEmail(authentication.getName())
                    .orElseThrow(() -> new RuntimeException("User not found"));
                
            ServerScheduleEntity schedule = inputDTO.toEntity();
            schedule.setId(id); // Ensure correct ID
            
            ServerScheduleEntity updatedSchedule = serverScheduleService.updateSchedule(id, schedule, user);
            return ResponseEntity.ok(ServerScheduleDTO.fromEntity(updatedSchedule));
        } catch (IllegalArgumentException e) {
            // Return a bad request response with the error message
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            // Log the error and return a generic error message
            System.err.println("Error updating schedule: " + e.getMessage());
            return ResponseEntity.status(500).body("An error occurred while updating the schedule. Please try again.");
        }
    }

    @PostMapping("/manual-start")
    @PreAuthorize("hasRole('ADMIN') or hasRole('DJ')")
    public ResponseEntity<?> manualStartServer(Authentication authentication) {
        try {
            UserEntity user = userService.getUserByEmail(authentication.getName())
                    .orElseThrow(() -> new RuntimeException("User not found"));

            ServerScheduleEntity schedule = serverScheduleService.manualStartServer(user);
            return ResponseEntity.ok(ServerScheduleDTO.fromEntity(schedule));
        } catch (Exception e) {
            // Log the error and return a generic error message
            System.err.println("Error starting server manually: " + e.getMessage());
            return ResponseEntity.status(500).body("An error occurred while starting the server. Please try again.");
        }
    }

    @PostMapping("/manual-stop")
    @PreAuthorize("hasRole('ADMIN') or hasRole('DJ')")
    public ResponseEntity<?> manualStopServer(Authentication authentication) {
        try {
            UserEntity user = userService.getUserByEmail(authentication.getName())
                    .orElseThrow(() -> new RuntimeException("User not found"));

            ServerScheduleEntity schedule = serverScheduleService.manualStopServer(user);
            return ResponseEntity.ok(ServerScheduleDTO.fromEntity(schedule));
        } catch (Exception e) {
            // Log the error and return a generic error message
            System.err.println("Error stopping server manually: " + e.getMessage());
            return ResponseEntity.status(500).body("An error occurred while stopping the server. Please try again.");
        }
    }

    @GetMapping("/status")
    public ResponseEntity<Boolean> isServerRunning() {
        boolean running = serverScheduleService.isServerRunning();
        return ResponseEntity.ok(running);
    }
} 
