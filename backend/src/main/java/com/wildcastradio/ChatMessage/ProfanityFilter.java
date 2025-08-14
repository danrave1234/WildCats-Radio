package com.wildcastradio.ChatMessage;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Simple profanity filter prioritizing English, Tagalog, and Bisaya.
 * Behavior: If any profanity is detected in the input, the entire message
 * is replaced with the fixed phrase: "CITU TOPS AGAIN!".
 */
public final class ProfanityFilter {

    private static final String REPLACEMENT = "CITU TOPS AGAIN!";

    // Single-word profanities to match as tokens (case-insensitive)
    private static final Set<String> WORD_LIST = new HashSet<>(Arrays.asList(
            // English
            "fuck", "fucking", "motherfucker", "shit", "bitch", "bastard", "asshole", "dick", "pussy", "cunt",
            // Tagalog
            "puta", "leche", "ulol", "bobo", "gago", "tanga", "punyeta", "bwisit", "tarantado", "pakyu",
            // Bisaya / Cebuano commons
            "yawa", "yati", "piste", "pisti", "buang", "bogo"
    ));

    // Multi-word or concatenated profanities detected after aggressive normalization
    private static final Set<String> PHRASE_LIST_COMPACT = new HashSet<>(Arrays.asList(
            // Tagalog
            "putangina", // covers "puta ng ina", "putang ina", obfuscated variants after normalization
            "puta",
            "pakyu",
            // English
            "motherfucker", // duplicated on purpose to catch compact check
            "fuck",
            "shit",
            // Cebuano/Tagalog combos that appear concatenated
            "pistingyawa",
            "yawa"
    ));

    private ProfanityFilter() {}

    /**
     * Filter message content. If profanity is detected, returns a fixed
     * replacement. Otherwise, returns original content.
     */
    public static String sanitizeContent(String input) {
        if (input == null || input.isBlank()) {
            return input;
        }
        // Quick checks using different normalizations
        String lower = input.toLowerCase(Locale.ROOT);

        // 1) Token-based check (safer with word boundaries)
        String[] tokens = lower.split("[^a-z]+");
        for (String token : tokens) {
            if (token.isEmpty()) continue;
            if (WORD_LIST.contains(token)) {
                return REPLACEMENT;
            }
        }

        // 2) Leetspeak + punctuation normalization then compact phrase check
        String normalized = toLeetNormalized(lower);
        String compactLettersOnly = normalized.replaceAll("[^a-z]", "");
        for (String phrase : PHRASE_LIST_COMPACT) {
            if (compactLettersOnly.contains(phrase)) {
                return REPLACEMENT;
            }
        }

        // 3) As a fallback, also check tokens after leet normalization
        String[] normTokens = normalized.split("[^a-z]+");
        for (String token : normTokens) {
            if (token.isEmpty()) continue;
            if (WORD_LIST.contains(token)) {
                return REPLACEMENT;
            }
        }

        return input;
    }

    /**
     * Allow adding extra words at runtime (e.g., from properties).
     */
    public static synchronized void addWords(Collection<String> words) {
        if (words == null) return;
        for (String w : words) {
            if (w == null) continue;
            String t = w.trim().toLowerCase(Locale.ROOT);
            if (!t.isEmpty()) WORD_LIST.add(t);
        }
    }

    /**
     * Allow adding extra compact phrases at runtime.
     */
    public static synchronized void addCompactPhrases(Collection<String> phrases) {
        if (phrases == null) return;
        for (String p : phrases) {
            if (p == null) continue;
            String t = p.trim().toLowerCase(Locale.ROOT);
            if (!t.isEmpty()) PHRASE_LIST_COMPACT.add(t);
        }
    }

    public static String getReplacementPhrase() {
        return REPLACEMENT;
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
