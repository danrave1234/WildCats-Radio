package com.wildcastradio.Moderation;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.wildcastradio.ChatMessage.ChatMessageEntity;
import com.wildcastradio.User.UserEntity;

@Service
public class ModeratorActionService {

    @Autowired
    private ModeratorActionRepository moderatorActionRepository;

    @Transactional
    public void logAction(UserEntity moderator, String actionType, UserEntity targetUser, ChatMessageEntity message, String details) {
        ModeratorActionEntity action = new ModeratorActionEntity(moderator, actionType, targetUser, message, details);
        moderatorActionRepository.save(action);
    }

    public Page<ModeratorActionEntity> getActions(Pageable pageable) {
        return moderatorActionRepository.findAll(pageable);
    }
    
    public List<ModeratorActionEntity> getActionsForBroadcast(Long broadcastId) {
        return moderatorActionRepository.findByMessage_Broadcast_Id(broadcastId);
    }
}

