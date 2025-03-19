package com.wildcastradio.ServerSchedule;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.wildcastradio.ActivityLog.ActivityLogEntity;
import com.wildcastradio.ActivityLog.ActivityLogService;
import com.wildcastradio.User.UserEntity;

@Service
public class ServerScheduleService {

    private final ServerScheduleRepository serverScheduleRepository;
    private final ActivityLogService activityLogService;

    public ServerScheduleService(
            ServerScheduleRepository serverScheduleRepository,
            ActivityLogService activityLogService) {
        this.serverScheduleRepository = serverScheduleRepository;
        this.activityLogService = activityLogService;
    }

    public ServerScheduleEntity scheduleServerRun(ServerScheduleEntity serverSchedule, UserEntity dj) {
        serverSchedule.setCreatedBy(dj);
        serverSchedule.setStatus(ServerScheduleEntity.ServerStatus.SCHEDULED);
        ServerScheduleEntity savedSchedule = serverScheduleRepository.save(serverSchedule);
        
        // Log the activity
        activityLogService.logActivity(
                dj,
                ActivityLogEntity.ActivityType.SERVER_START,
                "Scheduled server run from " + serverSchedule.getScheduledStart() + " to " + serverSchedule.getScheduledEnd()
        );
        
        return savedSchedule;
    }

    public ServerScheduleEntity startServer(Long scheduleId) {
        ServerScheduleEntity schedule = serverScheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new RuntimeException("Schedule not found"));
        
        schedule.setStatus(ServerScheduleEntity.ServerStatus.RUNNING);
        
        if (schedule.isRedundantEnabled()) {
            schedule.setRedundantStatus(ServerScheduleEntity.ServerStatus.RUNNING);
        }
        
        ServerScheduleEntity updatedSchedule = serverScheduleRepository.save(schedule);
        
        // Log the activity
        if (schedule.getCreatedBy() != null) {
            activityLogService.logActivity(
                    schedule.getCreatedBy(),
                    ActivityLogEntity.ActivityType.SERVER_START,
                    "Started server according to schedule ID: " + scheduleId
            );
        }
        
        return updatedSchedule;
    }

    public ServerScheduleEntity stopServer(Long scheduleId) {
        ServerScheduleEntity schedule = serverScheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new RuntimeException("Schedule not found"));
        
        schedule.setStatus(ServerScheduleEntity.ServerStatus.OFF);
        schedule.setRedundantStatus(ServerScheduleEntity.ServerStatus.OFF);
        
        ServerScheduleEntity updatedSchedule = serverScheduleRepository.save(schedule);
        
        // Log the activity
        if (schedule.getCreatedBy() != null) {
            activityLogService.logActivity(
                    schedule.getCreatedBy(),
                    ActivityLogEntity.ActivityType.SERVER_STOP,
                    "Stopped server according to schedule ID: " + scheduleId
            );
        }
        
        return updatedSchedule;
    }

    public ServerScheduleEntity manualStartServer(UserEntity user) {
        // Create an ad-hoc schedule for manual start
        ServerScheduleEntity schedule = new ServerScheduleEntity();
        schedule.setStatus(ServerScheduleEntity.ServerStatus.RUNNING);
        schedule.setAutomatic(false);
        schedule.setCreatedBy(user);
        
        ServerScheduleEntity savedSchedule = serverScheduleRepository.save(schedule);
        
        // Log the activity
        activityLogService.logActivity(
                user,
                ActivityLogEntity.ActivityType.SERVER_START,
                "Manually started server"
        );
        
        return savedSchedule;
    }

    public ServerScheduleEntity manualStopServer(UserEntity user) {
        // Find all currently running schedules and stop them
        List<ServerScheduleEntity> runningSchedules = serverScheduleRepository.findByStatus(ServerScheduleEntity.ServerStatus.RUNNING);
        
        for (ServerScheduleEntity schedule : runningSchedules) {
            schedule.setStatus(ServerScheduleEntity.ServerStatus.OFF);
            schedule.setRedundantStatus(ServerScheduleEntity.ServerStatus.OFF);
            serverScheduleRepository.save(schedule);
        }
        
        // Create a record of manual stop
        ServerScheduleEntity manualStop = new ServerScheduleEntity();
        manualStop.setStatus(ServerScheduleEntity.ServerStatus.OFF);
        manualStop.setAutomatic(false);
        manualStop.setCreatedBy(user);
        ServerScheduleEntity savedStop = serverScheduleRepository.save(manualStop);
        
        // Log the activity
        activityLogService.logActivity(
                user,
                ActivityLogEntity.ActivityType.SERVER_STOP,
                "Manually stopped server"
        );
        
        return savedStop;
    }

    public boolean isServerRunning() {
        List<ServerScheduleEntity> runningSchedules = serverScheduleRepository.findByStatus(ServerScheduleEntity.ServerStatus.RUNNING);
        return !runningSchedules.isEmpty();
    }

    @Scheduled(fixedRate = 60000) // Run every minute
    public void checkSchedules() {
        LocalDateTime now = LocalDateTime.now();
        
        // Find schedules that should be started
        List<ServerScheduleEntity> schedulesToStart = serverScheduleRepository.findByStatusAndAutomaticIsTrue(ServerScheduleEntity.ServerStatus.SCHEDULED);
        for (ServerScheduleEntity schedule : schedulesToStart) {
            if (schedule.getScheduledStart() != null && 
                    schedule.getScheduledStart().isBefore(now)) {
                startServer(schedule.getId());
            }
        }
        
        // Find schedules that should be stopped
        List<ServerScheduleEntity> schedulesToStop = serverScheduleRepository.findByStatus(ServerScheduleEntity.ServerStatus.RUNNING);
        for (ServerScheduleEntity schedule : schedulesToStop) {
            if (schedule.getScheduledEnd() != null && 
                    schedule.getScheduledEnd().isBefore(now) && 
                    schedule.isAutomatic()) {
                stopServer(schedule.getId());
            }
        }
    }

    @Scheduled(fixedRate = 30000) // Run health check every 30 seconds
    public void failoverCheck() {
        List<ServerScheduleEntity> runningSchedules = serverScheduleRepository.findByStatus(ServerScheduleEntity.ServerStatus.RUNNING);
        
        for (ServerScheduleEntity schedule : runningSchedules) {
            if (schedule.isRedundantEnabled() && schedule.getRedundantStatus() == ServerScheduleEntity.ServerStatus.OFF) {
                // In a real implementation, check the health of the main server
                boolean isMainServerHealthy = checkMainServerHealth();
                
                if (!isMainServerHealthy) {
                    // Activate redundant server
                    schedule.setRedundantStatus(ServerScheduleEntity.ServerStatus.RUNNING);
                    serverScheduleRepository.save(schedule);
                    
                    // Log the failover
                    if (schedule.getCreatedBy() != null) {
                        activityLogService.logActivity(
                                schedule.getCreatedBy(),
                                ActivityLogEntity.ActivityType.SERVER_START,
                                "Failover to redundant server for schedule ID: " + schedule.getId()
                        );
                    }
                }
            }
        }
    }

    // Simulate health check - in a real application, this would actually check server health
    private boolean checkMainServerHealth() {
        // For this implementation, we'll simulate a healthy server most of the time
        return Math.random() > 0.05; // 5% chance of "unhealthy" result
    }

    public List<ServerScheduleEntity> getAllSchedules() {
        return serverScheduleRepository.findAll();
    }

    public Optional<ServerScheduleEntity> getScheduleById(Long id) {
        return serverScheduleRepository.findById(id);
    }
} 