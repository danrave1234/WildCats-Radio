package com.wildcastradio.Moderation;

import java.time.LocalDateTime;

import com.wildcastradio.User.UserEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "banlist_words", indexes = {
    @Index(name = "idx_banlist_word", columnList = "word"),
    @Index(name = "idx_banlist_tier", columnList = "tier")
})
public class BanlistWordEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String word;

    @Column(nullable = false)
    private Integer tier = 1; // 1=Soft(Censor), 2=Harsh(Strike 1), 3=Slur(Strike 2/3)

    @ManyToOne
    @JoinColumn(name = "added_by_id")
    private UserEntity addedBy;

    @Column(name = "date_added", nullable = false)
    private LocalDateTime dateAdded;

    @Column(nullable = false)
    private Long version = 1L;

    @Column(name = "is_active")
    private Boolean isActive = true;

    public BanlistWordEntity() {
        this.dateAdded = LocalDateTime.now();
    }

    public BanlistWordEntity(String word, Integer tier, UserEntity addedBy, Long version) {
        this.word = word;
        this.tier = tier;
        this.addedBy = addedBy;
        this.version = version;
        this.dateAdded = LocalDateTime.now();
        this.isActive = true;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getWord() { return word; }
    public void setWord(String word) { this.word = word; }
    public Integer getTier() { return tier; }
    public void setTier(Integer tier) { this.tier = tier; }
    public UserEntity getAddedBy() { return addedBy; }
    public void setAddedBy(UserEntity addedBy) { this.addedBy = addedBy; }
    public LocalDateTime getDateAdded() { return dateAdded; }
    public void setDateAdded(LocalDateTime dateAdded) { this.dateAdded = dateAdded; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
}

