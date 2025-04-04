package com.wildcastradio.Poll;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PollOptionRepository extends JpaRepository<PollOptionEntity, Long> {
    
    List<PollOptionEntity> findByPoll(PollEntity poll);
    
    List<PollOptionEntity> findByPollOrderByIdAsc(PollEntity poll);
}