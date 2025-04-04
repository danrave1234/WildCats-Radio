package com.wildcastradio.Poll;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.User.UserEntity;

@Repository
public interface PollRepository extends JpaRepository<PollEntity, Long> {
    
    List<PollEntity> findByBroadcast(BroadcastEntity broadcast);
    
    List<PollEntity> findByBroadcastAndActiveTrue(BroadcastEntity broadcast);
    
    List<PollEntity> findByCreatedBy(UserEntity createdBy);
    
    List<PollEntity> findByBroadcastOrderByCreatedAtDesc(BroadcastEntity broadcast);
}