package com.wildcastradio.ChatMessage;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.Broadcast.BroadcastRepository;
import com.wildcastradio.User.UserEntity;

@Service
public class ChatMessageService {

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Autowired
    private BroadcastRepository broadcastRepository;

    /**
     * Get all messages for a specific broadcast
     * 
     * @param broadcastId The ID of the broadcast
     * @return List of chat message DTOs
     */
    public List<ChatMessageDTO> getMessagesForBroadcast(Long broadcastId) {
        List<ChatMessageEntity> messages = chatMessageRepository.findByBroadcastIdOrderByCreatedAtAsc(broadcastId);
        return messages.stream()
                .map(ChatMessageDTO::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Create a new chat message
     * 
     * @param broadcastId The ID of the broadcast
     * @param sender The user sending the message
     * @param content The content of the message
     * @return The created chat message entity
     * @throws IllegalArgumentException if the broadcast with the given ID doesn't exist
     */
    public ChatMessageEntity createMessage(Long broadcastId, UserEntity sender, String content) {
        // Fetch the broadcast entity
        BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
            .orElseThrow(() -> new IllegalArgumentException("Broadcast not found with ID: " + broadcastId));

        // Create the message with the broadcast entity
        ChatMessageEntity message = new ChatMessageEntity(broadcast, sender, content);
        return chatMessageRepository.save(message);
    }
}
