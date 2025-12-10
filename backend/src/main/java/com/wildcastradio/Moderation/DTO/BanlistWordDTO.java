package com.wildcastradio.Moderation.DTO;

import java.time.LocalDateTime;

import com.wildcastradio.Moderation.BanlistWordEntity;

public class BanlistWordDTO {
    private Long id;
    private String word;
    private Integer tier;
    private String addedBy;
    private LocalDateTime dateAdded;
    private Boolean isActive;

    public BanlistWordDTO() {}

    public BanlistWordDTO(BanlistWordEntity entity) {
        this.id = entity.getId();
        this.word = entity.getWord();
        this.tier = entity.getTier();
        this.addedBy = entity.getAddedBy() != null ? entity.getAddedBy().getEmail() : "SYSTEM";
        this.dateAdded = entity.getDateAdded();
        this.isActive = entity.getIsActive();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getWord() { return word; }
    public void setWord(String word) { this.word = word; }
    public Integer getTier() { return tier; }
    public void setTier(Integer tier) { this.tier = tier; }
    public String getAddedBy() { return addedBy; }
    public void setAddedBy(String addedBy) { this.addedBy = addedBy; }
    public LocalDateTime getDateAdded() { return dateAdded; }
    public void setDateAdded(LocalDateTime dateAdded) { this.dateAdded = dateAdded; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
}

