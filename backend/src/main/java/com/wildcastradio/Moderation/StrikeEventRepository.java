package com.wildcastradio.Moderation;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.wildcastradio.User.UserEntity;

@Repository
public interface StrikeEventRepository extends JpaRepository<StrikeEventEntity, Long> {
    List<StrikeEventEntity> findByUser(UserEntity user);
    List<StrikeEventEntity> findByUserOrderByCreatedAtDesc(UserEntity user);
    Page<StrikeEventEntity> findByBroadcast_Id(Long broadcastId, Pageable pageable);
    List<StrikeEventEntity> findByBroadcast_Id(Long broadcastId);
}

