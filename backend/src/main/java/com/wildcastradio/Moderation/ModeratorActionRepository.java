package com.wildcastradio.Moderation;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.wildcastradio.User.UserEntity;

@Repository
public interface ModeratorActionRepository extends JpaRepository<ModeratorActionEntity, Long> {
    List<ModeratorActionEntity> findByTargetUser(UserEntity targetUser);
    List<ModeratorActionEntity> findByModerator(UserEntity moderator);
    Page<ModeratorActionEntity> findByActionType(String actionType, Pageable pageable);
    
    // For export
    List<ModeratorActionEntity> findByMessage_Broadcast_Id(Long broadcastId);
}

