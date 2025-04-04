package com.wildcastradio.ServerSchedule;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.wildcastradio.User.UserEntity;

@Repository
public interface ServerScheduleRepository extends JpaRepository<ServerScheduleEntity, Long> {
    List<ServerScheduleEntity> findByCreatedBy(UserEntity createdBy);
    List<ServerScheduleEntity> findByStatus(ServerScheduleEntity.ServerStatus status);
    List<ServerScheduleEntity> findByDayOfWeek(DayOfWeek dayOfWeek);
    List<ServerScheduleEntity> findByDayOfWeekAndScheduledStartBefore(DayOfWeek dayOfWeek, LocalTime time);
    List<ServerScheduleEntity> findByDayOfWeekAndScheduledEndBefore(DayOfWeek dayOfWeek, LocalTime time);
    List<ServerScheduleEntity> findByDayOfWeekAndScheduledStartBetween(DayOfWeek dayOfWeek, LocalTime start, LocalTime end);
    List<ServerScheduleEntity> findByStatusAndAutomaticIsTrue(ServerScheduleEntity.ServerStatus status);
}
