package com.wildcastradio.Poll;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.wildcastradio.User.UserEntity;

@Repository
public interface PollVoteRepository extends JpaRepository<PollVoteEntity, Long> {
    
    List<PollVoteEntity> findByPoll(PollEntity poll);
    
    List<PollVoteEntity> findByOption(PollOptionEntity option);
    
    List<PollVoteEntity> findByUser(UserEntity user);
    
    Optional<PollVoteEntity> findByUserAndPoll(UserEntity user, PollEntity poll);
    
    boolean existsByUserAndPoll(UserEntity user, PollEntity poll);
    
    long countByOption(PollOptionEntity option);
    
    long countByPoll(PollEntity poll);
}