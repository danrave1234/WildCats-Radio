package com.wildcastradio.ChatMessage;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.Broadcast.BroadcastRepository;
import com.wildcastradio.ChatMessage.DTO.ChatMessageDTO;
import com.wildcastradio.User.UserEntity;

@Service
public class ChatMessageService {

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Autowired
    private BroadcastRepository broadcastRepository;
    
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

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
        // Validate content length
        if (content == null || content.length() > 1500) {
            throw new IllegalArgumentException("Message content must not be null and must not exceed 1500 characters");
        }

        // Fetch the broadcast entity
        BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
            .orElseThrow(() -> new IllegalArgumentException("Broadcast not found with ID: " + broadcastId));

        // Create the message with the broadcast entity
        ChatMessageEntity message = new ChatMessageEntity(broadcast, sender, content);
        ChatMessageEntity savedMessage = chatMessageRepository.save(message);
        
        // Create DTO for the message
        ChatMessageDTO messageDTO = ChatMessageDTO.fromEntity(savedMessage);
        
        // Notify all clients about the new chat message
        messagingTemplate.convertAndSend(
                "/topic/broadcast/" + broadcastId + "/chat",
                messageDTO
        );
        
        return savedMessage;
    }

    // Analytics methods for data retrieval
    public long getTotalMessageCount() {
        return chatMessageRepository.count();
    }

    public double getAverageMessagesPerBroadcast() {
        long totalMessages = getTotalMessageCount();
        long totalBroadcasts = broadcastRepository.count();
        
        if (totalBroadcasts == 0) {
            return 0.0;
        }
        
        return (double) totalMessages / totalBroadcasts;
    }
}
