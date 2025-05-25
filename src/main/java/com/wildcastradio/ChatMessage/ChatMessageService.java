package com.wildcastradio.ChatMessage;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.Broadcast.BroadcastRepository;
import com.wildcastradio.ChatMessage.DTO.ChatMessageDTO;
import com.wildcastradio.User.UserEntity;

@Service
public class ChatMessageService {

    private final ChatMessageRepository chatMessageRepository;
    private final BroadcastRepository broadcastRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public ChatMessageService(
            ChatMessageRepository chatMessageRepository,
            BroadcastRepository broadcastRepository,
            SimpMessagingTemplate messagingTemplate) {
        this.chatMessageRepository = chatMessageRepository;
        this.broadcastRepository = broadcastRepository;
        this.messagingTemplate = messagingTemplate;
    }

    public ChatMessageEntity sendMessage(Long broadcastId, UserEntity sender, String content) {
        BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
                .orElseThrow(() -> new RuntimeException("Broadcast not found"));

        ChatMessageEntity chatMessage = new ChatMessageEntity(content, sender, broadcast);
        ChatMessageEntity savedMessage = chatMessageRepository.save(chatMessage);
        
        // Broadcast the message to all subscribed clients
        messagingTemplate.convertAndSend(
                "/topic/broadcast/" + broadcastId + "/chat",
                ChatMessageDTO.fromEntity(savedMessage)
        );
        
        return savedMessage;
    }

    public List<ChatMessageDTO> getMessagesForBroadcast(Long broadcastId) {
        BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
                .orElseThrow(() -> new RuntimeException("Broadcast not found"));
                
        return chatMessageRepository.findByBroadcastOrderByTimestampAsc(broadcast).stream()
                .map(ChatMessageDTO::fromEntity)
                .collect(Collectors.toList());
    }

    public long countMessagesForBroadcast(Long broadcastId) {
        BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
                .orElseThrow(() -> new RuntimeException("Broadcast not found"));
                
        return chatMessageRepository.countByBroadcast(broadcast);
    }
} 