package com.wildcastradio.Schedule;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.wildcastradio.Schedule.DTO.ScheduleDTO;
import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserService;

@RestController
@RequestMapping("/api/schedules")
public class ScheduleController {

    @Autowired
    private ScheduleService scheduleService;

    @Autowired
    private UserService userService;

    @GetMapping
    public ResponseEntity<List<ScheduleDTO>> getAllSchedules() {
        List<ScheduleEntity> schedules = scheduleService.getAllSchedules();
        List<ScheduleDTO> scheduleDTOs = schedules.stream()
                .map(ScheduleDTO::fromEntity)
                .collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(scheduleDTOs);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ScheduleDTO> getScheduleById(@PathVariable Long id) {
        return scheduleService.getScheduleById(id)
                .map(schedule -> ResponseEntity.ok(ScheduleDTO.fromEntity(schedule)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/upcoming")
    public ResponseEntity<List<ScheduleDTO>> getUpcomingSchedules() {
        List<ScheduleEntity> upcomingSchedules = scheduleService.getUpcomingSchedules();
        List<ScheduleDTO> schedules = upcomingSchedules.stream()
                .map(ScheduleDTO::fromEntity)
                .collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(schedules);
    }

    @GetMapping("/active")
    public ResponseEntity<List<ScheduleDTO>> getActiveSchedules() {
        List<ScheduleEntity> activeSchedules = scheduleService.getActiveSchedules();
        List<ScheduleDTO> schedules = activeSchedules.stream()
                .map(ScheduleDTO::fromEntity)
                .collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(schedules);
    }

    @GetMapping("/my")
    public ResponseEntity<List<ScheduleDTO>> getMySchedules(Authentication authentication) {
        if (authentication == null) {
            return ResponseEntity.status(401).build();
        }

        UserEntity user = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<ScheduleEntity> userSchedules = scheduleService.getSchedulesByUser(user);
        List<ScheduleDTO> schedules = userSchedules.stream()
                .map(ScheduleDTO::fromEntity)
                .collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(schedules);
    }
} 