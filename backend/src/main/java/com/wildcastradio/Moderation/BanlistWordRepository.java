package com.wildcastradio.Moderation;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface BanlistWordRepository extends JpaRepository<BanlistWordEntity, Long> {
    Optional<BanlistWordEntity> findByWord(String word);
    List<BanlistWordEntity> findByIsActiveTrue();
    List<BanlistWordEntity> findByTier(Integer tier);
    boolean existsByWord(String word);
}

