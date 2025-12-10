package com.wildcastradio.ChatMessage;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Profanity filter prioritizing English, Tagalog, and Bisaya.
 * Supports tiered moderation.
 */
public final class ProfanityFilter {

    private static final String REPLACEMENT = "CITU TOPS AGAIN!";

    // Maps word/phrase -> Tier Level (1=Soft, 2=Harsh, 3=Slur)
    private static final Map<String, Integer> WORD_TIERS = new ConcurrentHashMap<>();
    private static final Map<String, Integer> PHRASE_TIERS = new ConcurrentHashMap<>();

    static {
        // Initial defaults (Tier 1)
        List<String> defaults = Arrays.asList(
            "fuck", "fucking", "motherfucker", "shit", "bitch", "bastard", "asshole", "dick", "pussy", "cunt",
            "puta", "leche", "ulol", "bobo", "gago", "tanga", "punyeta", "bwisit", "tarantado", "pakyu",
            "yawa", "yati", "piste", "pisti", "buang", "bogo"
        );
        defaults.forEach(w -> WORD_TIERS.put(w, 1));
        
        List<String> phraseDefaults = Arrays.asList(
            "putangina", "puta", "pakyu", "motherfucker", "fuck", "shit", "pistingyawa", "yawa"
        );
        phraseDefaults.forEach(p -> PHRASE_TIERS.put(p, 1));
    }

    private ProfanityFilter() {}

    public static class AnalysisResult {
        public boolean isCensored = false;
        public int maxTier = 0;
        public List<String> matchedWords = new ArrayList<>();
    }

    /**
     * Filter message content. If profanity is detected, returns a fixed
     * replacement. Otherwise, returns original content.
     */
    public static String sanitizeContent(String input) {
        AnalysisResult result = analyze(input);
        return result.isCensored ? REPLACEMENT : input;
    }

    public static AnalysisResult analyze(String input) {
        AnalysisResult result = new AnalysisResult();
        if (input == null || input.isBlank()) {
            return result;
        }

        String lower = input.toLowerCase(Locale.ROOT);
        
        // 1) Token-based check (safer with word boundaries)
        String[] tokens = lower.split("[^a-z]+");
        for (String token : tokens) {
            if (token.isEmpty()) continue;
            Integer tier = WORD_TIERS.get(token);
            if (tier != null) {
                result.isCensored = true;
                result.maxTier = Math.max(result.maxTier, tier);
                if (!result.matchedWords.contains(token)) {
                    result.matchedWords.add(token);
                }
            }
        }

        // 2) Leetspeak + punctuation normalization then compact phrase check
        String normalized = toLeetNormalized(lower);
        String compactLettersOnly = normalized.replaceAll("[^a-z]", "");
        for (Map.Entry<String, Integer> entry : PHRASE_TIERS.entrySet()) {
            if (compactLettersOnly.contains(entry.getKey())) {
                result.isCensored = true;
                result.maxTier = Math.max(result.maxTier, entry.getValue());
                if (!result.matchedWords.contains(entry.getKey())) {
                    result.matchedWords.add(entry.getKey());
                }
            }
        }

        // 3) As a fallback, also check tokens after leet normalization
        // Only if we haven't found a match yet or to find more severe matches?
        // Let's check regardless to catch obfuscated words
        String[] normTokens = normalized.split("[^a-z]+");
        for (String token : normTokens) {
            if (token.isEmpty()) continue;
            Integer tier = WORD_TIERS.get(token);
            if (tier != null) {
                result.isCensored = true;
                result.maxTier = Math.max(result.maxTier, tier);
                if (!result.matchedWords.contains(token)) {
                    result.matchedWords.add(token);
                }
            }
        }

        return result;
    }

    /**
     * Allow adding extra words at runtime (e.g., from properties).
     * Defaults to Tier 1.
     */
    public static synchronized void addWords(Collection<String> words) {
        if (words == null) return;
        for (String w : words) {
            if (w == null) continue;
            String t = w.trim().toLowerCase(Locale.ROOT);
            if (!t.isEmpty()) WORD_TIERS.put(t, 1);
        }
    }

    public static synchronized void addWords(Map<String, Integer> wordsWithTiers) {
        if (wordsWithTiers == null) return;
        wordsWithTiers.forEach((k, v) -> {
            if (k != null && !k.trim().isEmpty()) {
                WORD_TIERS.put(k.trim().toLowerCase(Locale.ROOT), v != null ? v : 1);
            }
        });
    }

    /**
     * Allow adding extra compact phrases at runtime.
     * Defaults to Tier 1.
     */
    public static synchronized void addCompactPhrases(Collection<String> phrases) {
        if (phrases == null) return;
        for (String p : phrases) {
            if (p == null) continue;
            String t = p.trim().toLowerCase(Locale.ROOT);
            if (!t.isEmpty()) PHRASE_TIERS.put(t, 1);
        }
    }
    
    public static synchronized void addCompactPhrases(Map<String, Integer> phrasesWithTiers) {
        if (phrasesWithTiers == null) return;
        phrasesWithTiers.forEach((k, v) -> {
            if (k != null && !k.trim().isEmpty()) {
                PHRASE_TIERS.put(k.trim().toLowerCase(Locale.ROOT), v != null ? v : 1);
            }
        });
    }

    public static String getReplacementPhrase() {
        return REPLACEMENT;
    }

    /**
     * Clear all words and phrases from the filter.
     * Useful for reloading configuration without restarting the application.
     */
    public static synchronized void clear() {
        WORD_TIERS.clear();
        PHRASE_TIERS.clear();
    }

    private static String toLeetNormalized(String s) {
        // Remove accents
        String noAccents = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        // Basic leet replacements
        noAccents = noAccents
                .replace('4', 'a')
                .replace('@', 'a')
                .replace('3', 'e')
                .replace('0', 'o')
                .replace('5', 's')
                .replace('$', 's')
                .replace('7', 't')
                .replace('1', 'i'); // map 1 -> i for common obfuscations
        return noAccents;
    }
}
