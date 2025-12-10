package com.wildcastradio.ChatMessage;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.wildcastradio.Moderation.BanlistService;
import com.wildcastradio.Moderation.StrikeService;
import com.wildcastradio.Moderation.DTO.BanlistWordDTO;
import com.wildcastradio.User.UserEntity;

import jakarta.annotation.PostConstruct;

@Service
public class ProfanityService {

    private static final Logger logger = LoggerFactory.getLogger(ProfanityService.class);

    @Value("${profanity.external.enabled:false}")
    private boolean externalEnabled;

    @Value("${profanity.perspective.apiKey:}")
    private String apiKey;

    @Value("${profanity.perspective.threshold:0.85}")
    private double threshold;

    @Value("${profanity.perspective.languages:en,tl,ceb}")
    private String languagesCsv;

    @Value("${profanity.extra.words:}")
    private String extraWords;

    @Value("${profanity.extra.compact.phrases:}")
    private String extraCompactPhrases;

    private GooglePerspectiveClient perspectiveClient;
    
    @Autowired
    private BanlistService banlistService;
    
    @Autowired
    private StrikeService strikeService;

    @PostConstruct
    public void init() {
        // Load extra words and phrases into the static filter lists
        List<String> words = parseCsv(extraWords);
        if (!words.isEmpty()) {
            ProfanityFilter.addWords(words);
            logger.info("Loaded {} extra profanity words from configuration", words.size());
        }
        List<String> phrases = parseCsv(extraCompactPhrases);
        if (!phrases.isEmpty()) {
            ProfanityFilter.addCompactPhrases(phrases);
            logger.info("Loaded {} extra profanity phrases from configuration", phrases.size());
        }
        
        refreshWords(); // Load DB words

        if (externalEnabled) {
            if (apiKey == null || apiKey.isBlank()) {
                logger.warn("profanity.external.enabled is true but no Perspective API key provided; external check disabled");
                externalEnabled = false;
            } else {
                perspectiveClient = new GooglePerspectiveClient(apiKey);
            }
        }
    }
    
    /**
     * Process content: Sanitize AND Apply Strikes/Logs.
     */
    public String processContent(String input, UserEntity sender, Long broadcastId) {
        if (input == null || input.isBlank()) return input;

        // 1. Local Analysis
        ProfanityFilter.AnalysisResult result = ProfanityFilter.analyze(input);
        
        if (result.isCensored) {
            String matched = String.join(", ", result.matchedWords);
            String reason = "Profanity usage (Tier " + result.maxTier + "): " + matched;
            
            // Log for all tiers (Tier 1 is Level 0 log, Tier 2+ triggers strikes)
            try {
                strikeService.processTierViolation(sender, broadcastId, result.maxTier, reason);
            } catch (Exception e) {
                logger.error("Failed to process moderation event for user {}: {}", sender != null ? sender.getId() : "null", e.getMessage());
            }
            
            return ProfanityFilter.getReplacementPhrase();
        }

        // 2. External Analysis (if enabled)
        if (externalEnabled) {
            try {
                Double score = perspectiveClient.analyzeToxicityScore(input, getLanguages());
                if (score != null && score >= threshold) {
                    // Log external detection as Tier 1
                    try {
                        strikeService.processTierViolation(sender, broadcastId, 1, "AI detected toxicity (score " + score + ")");
                    } catch (Exception e) {
                        logger.error("Failed to process AI moderation event: {}", e.getMessage());
                    }
                    return ProfanityFilter.getReplacementPhrase();
                }
            } catch (Exception e) {
                logger.warn("External profanity check failed: {}", e.getMessage());
            }
        }
        
        return input;
    }

    public String sanitizeContent(String input) {
        return processContent(input, null, null);
    }

    private List<String> getLanguages() {
        List<String> langs = parseCsv(languagesCsv);
        if (langs.isEmpty()) {
            return Arrays.asList("en", "tl", "ceb");
        }
        // Normalize to lowercase language codes
        return langs.stream().map(s -> s.toLowerCase(Locale.ROOT)).collect(Collectors.toList());
    }

    private static List<String> parseCsv(String csv) {
        List<String> list = new ArrayList<>();
        if (csv == null || csv.isBlank()) return list;
        for (String part : csv.split(",")) {
            if (part == null) continue;
            String t = part.trim();
            if (!t.isEmpty()) list.add(t);
        }
        return list;
    }

    private static boolean safeEquals(String a, String b) {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        return a.equals(b);
    }
    
    // Refresh words from DB (called by BanlistService or Scheduler)
    public void refreshWords() {
        // We can't clear config words easily without reloading context, 
        // so we just re-add everything on top or clear then re-init.
        // For safety, let's just add DB words (additive). 
        // If we want to support removals, we'd need to clear + re-add config + re-add DB.
        
        // Let's try to clear and reload config + DB
        ProfanityFilter.clear();
        
        // Reload config words
        List<String> words = parseCsv(extraWords);
        if (!words.isEmpty()) ProfanityFilter.addWords(words);
        List<String> phrases = parseCsv(extraCompactPhrases);
        if (!phrases.isEmpty()) ProfanityFilter.addCompactPhrases(phrases);
        
        // Reload DB words
        try {
            List<BanlistWordDTO> dbWords = banlistService.getActiveWords();
            java.util.Map<String, Integer> wordMap = new java.util.HashMap<>();
            for (BanlistWordDTO dto : dbWords) {
                wordMap.put(dto.getWord(), dto.getTier());
            }
            if (!wordMap.isEmpty()) {
                ProfanityFilter.addWords(wordMap);
                logger.info("Loaded {} profanity words from database", wordMap.size());
            }
        } catch (Exception e) {
            logger.warn("Failed to load banlist from DB: {}", e.getMessage());
        }
    }
}
