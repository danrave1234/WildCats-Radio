package com.wildcastradio.ChatMessage;

import java.util.List;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Service;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.Broadcast.BroadcastRepository;
import com.wildcastradio.User.UserEntity;

@Service
public class ChatMessageService {
    private static final Logger logger = LoggerFactory.getLogger(ChatMessageService.class);

    private final ChatMessageRepository chatMessageRepository;
    private final BroadcastRepository broadcastRepository;
    private final SimpMessageSendingOperations messagingTemplate;

    @Autowired
    public ChatMessageService(
            ChatMessageRepository chatMessageRepository,
            BroadcastRepository broadcastRepository,
            SimpMessageSendingOperations messagingTemplate) {
        this.chatMessageRepository = chatMessageRepository;
        this.broadcastRepository = broadcastRepository;
        this.messagingTemplate = messagingTemplate;
    }

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
        ChatMessageEntity savedMessage = chatMessageRepository.save(message);
        
        // Broadcast the message via WebSocket
        try {
            String destination = "/topic/broadcast/" + broadcastId + "/chat";
            logger.debug("Sending chat message to topic: {}", destination);
            
            messagingTemplate.convertAndSend(
                    destination,
                    ChatMessageDTO.fromEntity(savedMessage)
            );
        } catch (Exception e) {
            // Log the error but don't prevent message creation
            logger.warn("Failed to broadcast chat message via WebSocket: {}", e.getMessage());
            
            if (logger.isDebugEnabled()) {
                logger.debug("Full exception details:", e);
            }
        }
        
        return savedMessage;
    }
}
