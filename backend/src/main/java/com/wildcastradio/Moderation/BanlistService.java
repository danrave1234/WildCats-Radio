package com.wildcastradio.Moderation;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.wildcastradio.Moderation.DTO.BanlistWordDTO;
import com.wildcastradio.User.UserEntity;

@Service
public class BanlistService {

    @Autowired
    private BanlistWordRepository banlistWordRepository;

    public List<BanlistWordDTO> getAllWords() {
        return banlistWordRepository.findAll().stream()
            .map(BanlistWordDTO::new)
            .collect(Collectors.toList());
    }

    public List<BanlistWordDTO> getActiveWords() {
        return banlistWordRepository.findByIsActiveTrue().stream()
            .map(BanlistWordDTO::new)
            .collect(Collectors.toList());
    }

    @Transactional
    public BanlistWordEntity addWord(String word, Integer tier, UserEntity addedBy) {
        String normalized = word.trim().toLowerCase();
        if (banlistWordRepository.existsByWord(normalized)) {
            BanlistWordEntity existing = banlistWordRepository.findByWord(normalized).get();
            if (!existing.getIsActive()) {
                existing.setIsActive(true);
                existing.setTier(tier);
                existing.setVersion(existing.getVersion() + 1);
                return banlistWordRepository.save(existing);
            }
            throw new IllegalArgumentException("Word already exists in banlist");
        }

        BanlistWordEntity entity = new BanlistWordEntity(normalized, tier, addedBy, 1L);
        return banlistWordRepository.save(entity);
    }

    @Transactional
    public void deleteWord(Long id, UserEntity removedBy) {
        // Soft delete
        banlistWordRepository.findById(id).ifPresent(word -> {
            word.setIsActive(false);
            word.setVersion(word.getVersion() + 1);
            banlistWordRepository.save(word);
        });
    }

    @Transactional
    public BanlistWordEntity updateTier(Long id, Integer tier, UserEntity modifiedBy) {
        BanlistWordEntity word = banlistWordRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Word not found"));
        
        word.setTier(tier);
        word.setVersion(word.getVersion() + 1);
        return banlistWordRepository.save(word);
    }
}

