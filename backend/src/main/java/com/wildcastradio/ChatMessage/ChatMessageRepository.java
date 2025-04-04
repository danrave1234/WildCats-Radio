package com.wildcastradio.ChatMessage;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessageEntity, Long> {
    
    // Find all messages for a specific broadcast, ordered by creation time
    List<ChatMessageEntity> findByBroadcastIdOrderByCreatedAtAsc(Long broadcastId);
}