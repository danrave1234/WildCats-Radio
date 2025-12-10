package com.wildcastradio.Moderation;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.wildcastradio.User.UserEntity;

@Repository
public interface AppealRepository extends JpaRepository<AppealEntity, Long> {
    List<AppealEntity> findByUser(UserEntity user);
    Page<AppealEntity> findByStatus(String status, Pageable pageable);
    List<AppealEntity> findByUserAndStatus(UserEntity user, String status);
}

