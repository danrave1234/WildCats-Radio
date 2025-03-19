package com.wildcastradio.ChatMessage;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.User.UserEntity;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessageEntity, Long> {
    List<ChatMessageEntity> findByBroadcast(BroadcastEntity broadcast);
    List<ChatMessageEntity> findByBroadcastOrderByTimestampAsc(BroadcastEntity broadcast);
    List<ChatMessageEntity> findBySender(UserEntity sender);
    long countByBroadcast(BroadcastEntity broadcast);
} 