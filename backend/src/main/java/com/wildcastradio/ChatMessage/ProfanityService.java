package com.wildcastradio.ChatMessage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

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

        if (externalEnabled) {
            if (apiKey == null || apiKey.isBlank()) {
                logger.warn("profanity.external.enabled is true but no Perspective API key provided; external check disabled");
                externalEnabled = false;
            } else {
                perspectiveClient = new GooglePerspectiveClient(apiKey);
            }
        }
    }

    public String sanitizeContent(String input) {
        // Always run local filter first
        String local = ProfanityFilter.sanitizeContent(input);
        if (!safeEquals(input, local)) {
            // Local filter detected profanity
            return ProfanityFilter.getReplacementPhrase();
        }

        // Optionally call external API
        if (externalEnabled && input != null && !input.isBlank()) {
            try {
                Double score = perspectiveClient.analyzeToxicityScore(input, getLanguages());
                if (score != null && score >= threshold) {
                    return ProfanityFilter.getReplacementPhrase();
                }
            } catch (Exception e) {
                logger.warn("External profanity check failed: {}", e.getMessage());
            }
        }
        return input;
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
}
