package com.wildcastradio.Schedule;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.wildcastradio.ActivityLog.ActivityLogEntity;
import com.wildcastradio.ActivityLog.ActivityLogService;
import com.wildcastradio.Schedule.ScheduleEntity.ScheduleStatus;
import com.wildcastradio.User.UserEntity;

@Service
public class ScheduleService {
    private static final Logger logger = LoggerFactory.getLogger(ScheduleService.class);

    @Autowired
    private ScheduleRepository scheduleRepository;

    @Autowired
    private ActivityLogService activityLogService;

    public ScheduleEntity createSchedule(LocalDateTime scheduledStart, LocalDateTime scheduledEnd, UserEntity createdBy) {
        logger.info("Creating schedule from {} to {} for user {}", scheduledStart, scheduledEnd, createdBy.getEmail());

        // Validate schedule times
        if (scheduledStart.isAfter(scheduledEnd)) {
            throw new IllegalArgumentException("Scheduled start time must be before end time");
        }

        // Allow a 30-second grace period for immediate broadcasts to account for network latency
        LocalDateTime minAllowedTime = LocalDateTime.now().minusSeconds(30);
        if (scheduledStart.isBefore(minAllowedTime)) {
            throw new IllegalArgumentException("Scheduled start time cannot be in the past");
        }

        ScheduleEntity schedule = new ScheduleEntity(scheduledStart, scheduledEnd, createdBy);
        ScheduleEntity savedSchedule = scheduleRepository.save(schedule);

        // Log the activity
        activityLogService.logActivity(
            createdBy,
            ActivityLogEntity.ActivityType.SCHEDULE_CREATE,
            "Schedule created from " + scheduledStart + " to " + scheduledEnd
        );

        logger.info("Schedule created with ID: {}", savedSchedule.getId());
        return savedSchedule;
    }

    public ScheduleEntity updateSchedule(Long scheduleId, LocalDateTime scheduledStart, LocalDateTime scheduledEnd, UserEntity user) {
        logger.info("Updating schedule {} with new times {} to {}", scheduleId, scheduledStart, scheduledEnd);

        ScheduleEntity schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new RuntimeException("Schedule not found"));

        // Validate that only the creator can update the schedule
        if (!schedule.getCreatedBy().getId().equals(user.getId())) {
            throw new RuntimeException("Only the schedule creator can update this schedule");
        }

        // Validate new times
        if (scheduledStart.isAfter(scheduledEnd)) {
            throw new IllegalArgumentException("Scheduled start time must be before end time");
        }

        // Only allow updates if schedule hasn't started yet
        if (schedule.getStatus() == ScheduleStatus.ACTIVE || schedule.getStatus() == ScheduleStatus.COMPLETED) {
            throw new IllegalStateException("Cannot update an active or completed schedule");
        }

        schedule.setScheduledStart(scheduledStart);
        schedule.setScheduledEnd(scheduledEnd);
        
        ScheduleEntity updatedSchedule = scheduleRepository.save(schedule);

        // Log the activity
        activityLogService.logActivity(
            user,
            ActivityLogEntity.ActivityType.SCHEDULE_CREATE,
            "Schedule updated: " + scheduleId + " new time from " + scheduledStart + " to " + scheduledEnd
        );

        return updatedSchedule;
    }

    public ScheduleEntity activateSchedule(Long scheduleId) {
        logger.info("Activating schedule {}", scheduleId);

        ScheduleEntity schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new RuntimeException("Schedule not found"));

        schedule.setStatus(ScheduleStatus.ACTIVE);
        return scheduleRepository.save(schedule);
    }

    public ScheduleEntity completeSchedule(Long scheduleId) {
        logger.info("Completing schedule {}", scheduleId);

        ScheduleEntity schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new RuntimeException("Schedule not found"));

        schedule.setStatus(ScheduleStatus.COMPLETED);
        return scheduleRepository.save(schedule);
    }

    public ScheduleEntity cancelSchedule(Long scheduleId, UserEntity user) {
        logger.info("Cancelling schedule {}", scheduleId);

        ScheduleEntity schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new RuntimeException("Schedule not found"));

        // Only allow cancellation by creator or if schedule hasn't started
        if (!schedule.getCreatedBy().getId().equals(user.getId()) && 
            schedule.getStatus() != ScheduleStatus.SCHEDULED) {
            throw new RuntimeException("Only the schedule creator can cancel this schedule");
        }

        schedule.setStatus(ScheduleStatus.CANCELLED);
        ScheduleEntity cancelledSchedule = scheduleRepository.save(schedule);

        // Log the activity
        activityLogService.logActivity(
            user,
            ActivityLogEntity.ActivityType.SCHEDULE_CREATE,
            "Schedule cancelled: " + scheduleId
        );

        return cancelledSchedule;
    }

    public Optional<ScheduleEntity> getScheduleById(Long id) {
        return scheduleRepository.findById(id);
    }

    public List<ScheduleEntity> getAllSchedules() {
        return scheduleRepository.findAll();
    }

    public List<ScheduleEntity> getSchedulesByUser(UserEntity user) {
        return scheduleRepository.findByCreatedBy(user);
    }

    public List<ScheduleEntity> getUpcomingSchedules() {
        return scheduleRepository.findByStatusAndScheduledStartAfter(
            ScheduleStatus.SCHEDULED, 
            LocalDateTime.now()
        );
    }

    public List<ScheduleEntity> getActiveSchedules() {
        return scheduleRepository.findByStatus(ScheduleStatus.ACTIVE);
    }

    public List<ScheduleEntity> getSchedulesInRange(LocalDateTime start, LocalDateTime end) {
        return scheduleRepository.findByScheduledStartBetween(start, end);
    }

    public List<ScheduleEntity> getUpcomingSchedulesInNext15Minutes() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime fifteenMinutesFromNow = now.plusMinutes(15);
        
        return scheduleRepository.findByStatusAndScheduledStartBetween(
            ScheduleStatus.SCHEDULED,
            now,
            fifteenMinutesFromNow
        );
    }

    public void deleteSchedule(Long scheduleId) {
        logger.info("Deleting schedule {}", scheduleId);

        ScheduleEntity schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new RuntimeException("Schedule not found"));

        // Only allow deletion if schedule hasn't started
        if (schedule.getStatus() == ScheduleStatus.ACTIVE) {
            throw new IllegalStateException("Cannot delete an active schedule");
        }

        scheduleRepository.deleteById(scheduleId);
        logger.info("Schedule {} deleted successfully", scheduleId);
    }
} 