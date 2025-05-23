package com.wildcastradio.ServerSchedule;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.wildcastradio.ActivityLog.ActivityLogEntity;
import com.wildcastradio.ActivityLog.ActivityLogService;
import com.wildcastradio.User.UserEntity;

@Service
public class ServerScheduleService {
    private static final Logger logger = LoggerFactory.getLogger(ServerScheduleService.class);

    private final ServerScheduleRepository serverScheduleRepository;
    private final ActivityLogService activityLogService;

    public ServerScheduleService(
            ServerScheduleRepository serverScheduleRepository,
            ActivityLogService activityLogService) {
        this.serverScheduleRepository = serverScheduleRepository;
        this.activityLogService = activityLogService;
    }

    public ServerScheduleEntity scheduleServerRun(ServerScheduleEntity serverSchedule, UserEntity dj) {
        logger.info("Scheduling server run for day: {}, start: {}, end: {}", 
                serverSchedule.getDayOfWeek(), serverSchedule.getScheduledStart(), serverSchedule.getScheduledEnd());

        // Validate required fields
        if (serverSchedule.getDayOfWeek() == null) {
            logger.error("Failed to schedule server run: Day of week is required");
            throw new IllegalArgumentException("Day of week is required");
        }
        if (serverSchedule.getScheduledStart() == null) {
            logger.error("Failed to schedule server run: Scheduled start time is required");
            throw new IllegalArgumentException("Scheduled start time is required");
        }
        if (serverSchedule.getScheduledEnd() == null) {
            logger.error("Failed to schedule server run: Scheduled end time is required");
            throw new IllegalArgumentException("Scheduled end time is required");
        }

        serverSchedule.setCreatedBy(dj);
        serverSchedule.setStatus(ServerScheduleEntity.ServerStatus.SCHEDULED);
        // Ensure all schedules are automatic
        serverSchedule.setAutomatic(true);
        ServerScheduleEntity savedSchedule = serverScheduleRepository.save(serverSchedule);

        logger.info("Server run scheduled successfully with ID: {}", savedSchedule.getId());

        // Log the activity
        activityLogService.logActivity(
                dj,
                ActivityLogEntity.ActivityType.SERVER_START,
                "Scheduled server run on " + serverSchedule.getDayOfWeek() + " from " + 
                serverSchedule.getScheduledStart() + " to " + serverSchedule.getScheduledEnd()
        );

        return savedSchedule;
    }

    public ServerScheduleEntity startServer(Long scheduleId) {
        logger.info("Starting server for schedule ID: {}", scheduleId);

        ServerScheduleEntity schedule = serverScheduleRepository.findById(scheduleId)
                .orElseThrow(() -> {
                    logger.error("Failed to start server: Schedule not found with ID: {}", scheduleId);
                    return new RuntimeException("Schedule not found");
                });

        schedule.setStatus(ServerScheduleEntity.ServerStatus.RUNNING);
        logger.info("Setting server status to RUNNING for schedule ID: {}", scheduleId);

        if (schedule.isRedundantEnabled()) {
            schedule.setRedundantStatus(ServerScheduleEntity.ServerStatus.RUNNING);
            logger.info("Redundant server is enabled, setting redundant status to RUNNING");
        }

        ServerScheduleEntity updatedSchedule = serverScheduleRepository.save(schedule);
        logger.info("Server started successfully for schedule ID: {}", scheduleId);

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
        logger.info("Stopping server for schedule ID: {}", scheduleId);

        ServerScheduleEntity schedule = serverScheduleRepository.findById(scheduleId)
                .orElseThrow(() -> {
                    logger.error("Failed to stop server: Schedule not found with ID: {}", scheduleId);
                    return new RuntimeException("Schedule not found");
                });

        schedule.setStatus(ServerScheduleEntity.ServerStatus.OFF);
        schedule.setRedundantStatus(ServerScheduleEntity.ServerStatus.OFF);
        logger.info("Setting server status and redundant status to OFF for schedule ID: {}", scheduleId);

        ServerScheduleEntity updatedSchedule = serverScheduleRepository.save(schedule);
        logger.info("Server stopped successfully for schedule ID: {}", scheduleId);

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

    public ServerScheduleEntity startServerNow(UserEntity user) {
        // Create an ad-hoc schedule for start
        LocalDateTime now = LocalDateTime.now();
        ServerScheduleEntity schedule = new ServerScheduleEntity();
        schedule.setDayOfWeek(now.getDayOfWeek());
        schedule.setScheduledStart(now);
        schedule.setScheduledEnd(now.plusHours(1)); // Default to 1 hour duration
        schedule.setStatus(ServerScheduleEntity.ServerStatus.RUNNING);
        schedule.setAutomatic(true); // Set to automatic instead of manual
        schedule.setCreatedBy(user);

        ServerScheduleEntity savedSchedule = serverScheduleRepository.save(schedule);

        // Log the activity
        activityLogService.logActivity(
                user,
                ActivityLogEntity.ActivityType.SERVER_START,
                "Started server on " + schedule.getDayOfWeek() + " at " + schedule.getScheduledStart()
        );

        return savedSchedule;
    }

    public ServerScheduleEntity stopServerNow(UserEntity user) {
        // Find all currently running schedules and stop them
        List<ServerScheduleEntity> runningSchedules = serverScheduleRepository.findByStatus(ServerScheduleEntity.ServerStatus.RUNNING);

        for (ServerScheduleEntity schedule : runningSchedules) {
            schedule.setStatus(ServerScheduleEntity.ServerStatus.OFF);
            schedule.setRedundantStatus(ServerScheduleEntity.ServerStatus.OFF);
            serverScheduleRepository.save(schedule);
        }

        // Create a record of stop
        LocalDateTime now = LocalDateTime.now();
        ServerScheduleEntity stopRecord = new ServerScheduleEntity();
        stopRecord.setDayOfWeek(now.getDayOfWeek());
        stopRecord.setScheduledStart(now);
        stopRecord.setScheduledEnd(now);
        stopRecord.setStatus(ServerScheduleEntity.ServerStatus.OFF);
        stopRecord.setAutomatic(true); // Set to automatic instead of manual
        stopRecord.setCreatedBy(user);
        ServerScheduleEntity savedStop = serverScheduleRepository.save(stopRecord);

        // Log the activity
        activityLogService.logActivity(
                user,
                ActivityLogEntity.ActivityType.SERVER_STOP,
                "Stopped server"
        );

        return savedStop;
    }

    public boolean isServerRunning() {
        List<ServerScheduleEntity> runningSchedules = serverScheduleRepository.findByStatus(ServerScheduleEntity.ServerStatus.RUNNING);
        boolean isRunning = !runningSchedules.isEmpty();
        logger.info("Checking if server is running: {}", isRunning);
        return isRunning;
    }

    @Scheduled(fixedRate = 60000) // Run every minute
    public void checkSchedules() {
        logger.debug("Running scheduled check for server schedules");
        LocalDateTime now = LocalDateTime.now();
        DayOfWeek today = now.getDayOfWeek();

        // Find schedules for today that should be started
        List<ServerScheduleEntity> schedulesToStart = serverScheduleRepository.findByDayOfWeek(today);
        logger.debug("Found {} schedules for today ({})", schedulesToStart.size(), today);

        for (ServerScheduleEntity schedule : schedulesToStart) {
            if (schedule.getStatus() == ServerScheduleEntity.ServerStatus.SCHEDULED &&
                schedule.isAutomatic() &&
                schedule.getScheduledStart() != null && 
                schedule.getScheduledStart().isBefore(now)) {
                logger.info("Auto-starting scheduled server with ID: {}", schedule.getId());
                startServer(schedule.getId());
            }
        }

        // Find schedules for today that should be stopped
        List<ServerScheduleEntity> schedulesToStop = serverScheduleRepository.findByStatus(ServerScheduleEntity.ServerStatus.RUNNING);
        logger.debug("Found {} running schedules to check for auto-stop", schedulesToStop.size());

        for (ServerScheduleEntity schedule : schedulesToStop) {
            if (schedule.getDayOfWeek() == today &&
                schedule.getScheduledEnd() != null && 
                schedule.getScheduledEnd().isBefore(now) && 
                schedule.isAutomatic()) {
                logger.info("Auto-stopping scheduled server with ID: {}", schedule.getId());
                stopServer(schedule.getId());
            }
        }

        logger.debug("Completed scheduled check for server schedules");
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

    public ServerScheduleEntity updateSchedule(Long id, ServerScheduleEntity updatedSchedule, UserEntity user) {
        // Validate required fields
        if (updatedSchedule.getDayOfWeek() == null) {
            throw new IllegalArgumentException("Day of week is required");
        }
        if (updatedSchedule.getScheduledStart() == null) {
            throw new IllegalArgumentException("Scheduled start time is required");
        }
        if (updatedSchedule.getScheduledEnd() == null) {
            throw new IllegalArgumentException("Scheduled end time is required");
        }

        // Find the existing schedule
        ServerScheduleEntity existingSchedule = serverScheduleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Schedule not found with id: " + id));

        // Update the fields
        existingSchedule.setDayOfWeek(updatedSchedule.getDayOfWeek());
        existingSchedule.setScheduledStart(updatedSchedule.getScheduledStart());
        existingSchedule.setScheduledEnd(updatedSchedule.getScheduledEnd());
        // Ensure all schedules are automatic
        existingSchedule.setAutomatic(true);
        existingSchedule.setCreatedBy(user);

        // Save and return the updated schedule
        return serverScheduleRepository.save(existingSchedule);
    }

    public void deleteSchedule(Long id, UserEntity user) {
        logger.info("Deleting server schedule with ID: {}", id);
        
        // Find the existing schedule
        ServerScheduleEntity schedule = serverScheduleRepository.findById(id)
                .orElseThrow(() -> {
                    logger.error("Failed to delete schedule: Schedule not found with ID: {}", id);
                    return new RuntimeException("Schedule not found with id: " + id);
                });
        
        // Check if schedule is currently running and stop it if needed
        if (schedule.getStatus() == ServerScheduleEntity.ServerStatus.RUNNING) {
            logger.info("Schedule is currently running, stopping it before deletion");
            stopServer(id);
        }
        
        // Delete the schedule
        serverScheduleRepository.delete(schedule);
        logger.info("Schedule with ID: {} deleted successfully", id);
        
        // Log the activity
        activityLogService.logActivity(
                user,
                ActivityLogEntity.ActivityType.SERVER_STOP,
                "Deleted server schedule for " + schedule.getDayOfWeek() + " " + 
                schedule.getScheduledStart() + " - " + schedule.getScheduledEnd()
        );
    }
} 
