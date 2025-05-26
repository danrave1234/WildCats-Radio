package com.wildcastradio.Schedule;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.wildcastradio.Schedule.ScheduleEntity.ScheduleStatus;
import com.wildcastradio.User.UserEntity;

@Repository
public interface ScheduleRepository extends JpaRepository<ScheduleEntity, Long> {
    
    List<ScheduleEntity> findByCreatedBy(UserEntity createdBy);
    
    List<ScheduleEntity> findByStatus(ScheduleStatus status);
    
    List<ScheduleEntity> findByCreatedByAndStatus(UserEntity createdBy, ScheduleStatus status);
    
    List<ScheduleEntity> findByScheduledStartAfter(LocalDateTime date);
    
    List<ScheduleEntity> findByScheduledStartBetween(LocalDateTime start, LocalDateTime end);
    
    List<ScheduleEntity> findByStatusAndScheduledStartAfter(ScheduleStatus status, LocalDateTime date);
    
    List<ScheduleEntity> findByStatusAndScheduledStartBetween(ScheduleStatus status, LocalDateTime start, LocalDateTime end);
    
    List<ScheduleEntity> findByScheduledEndBefore(LocalDateTime date);
    
    List<ScheduleEntity> findByStatusAndScheduledEndBefore(ScheduleStatus status, LocalDateTime date);
} 