package com.wildcastradio.ChatMessage;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Service that maintains a local text file containing profanity entries
 * provided by DJs and moderators. Each non-empty line is treated as an entry.
 * On startup, all entries are loaded into ProfanityFilter. New entries are
 * appended to the file and immediately applied to the in-memory filter.
 */
@Service
public class ProfanityDictionaryService {
    private static final Logger logger = LoggerFactory.getLogger(ProfanityDictionaryService.class);

    @Value("${profanity.dictionary.file:./data/profanity-words.txt}")
    private String dictionaryFilePath;

    private Path dictPath;

    // Cache to avoid duplicate appends; populated from file at startup
    private final Set<String> cachedEntries = new HashSet<>();

    @PostConstruct
    public synchronized void init() {
        this.dictPath = Path.of(dictionaryFilePath).toAbsolutePath().normalize();
        try {
            ensureFileExists();
            List<String> entries = readAll();
            if (!entries.isEmpty()) {
                ProfanityFilter.addWords(entries);      // token-based
                ProfanityFilter.addCompactPhrases(entries); // compact/concatenated
            }
            logger.info("Profanity dictionary loaded: {} entries from {}", cachedEntries.size(), dictPath);
        } catch (IOException e) {
            logger.warn("Failed to initialize profanity dictionary at {}: {}", dictionaryFilePath, e.getMessage());
        }
    }

    public synchronized List<String> listEntries() {
        return new ArrayList<>(cachedEntries);
    }

    public synchronized boolean addEntry(String entry) throws IOException {
        if (entry == null) return false;
        String trimmed = entry.trim().toLowerCase(Locale.ROOT);
        if (trimmed.isEmpty()) return false;
        if (cachedEntries.contains(trimmed)) {
            return false; // already present
        }
        // Append to file atomically (append mode) and update caches + filter
        try (BufferedWriter bw = Files.newBufferedWriter(dictPath,
                StandardCharsets.UTF_8,
                StandardOpenOption.APPEND)) {
            bw.write(trimmed);
            bw.newLine();
        }
        cachedEntries.add(trimmed);
        // Apply to in-memory filter immediately
        List<String> one = List.of(trimmed);
        ProfanityFilter.addWords(one);
        ProfanityFilter.addCompactPhrases(one);
        return true;
    }

    private void ensureFileExists() throws IOException {
        Path parent = dictPath.getParent();
        if (parent != null && !Files.exists(parent)) {
            Files.createDirectories(parent);
        }
        if (!Files.exists(dictPath)) {
            Files.createFile(dictPath);
        }
    }

    private List<String> readAll() throws IOException {
        List<String> lines = new ArrayList<>();
        if (!Files.exists(dictPath)) {
            ensureFileExists();
        }
        for (String line : Files.readAllLines(dictPath, StandardCharsets.UTF_8)) {
            if (line == null) continue;
            String t = line.trim().toLowerCase(Locale.ROOT);
            if (!t.isEmpty()) {
                lines.add(t);
                cachedEntries.add(t);
            }
        }
        return lines;
    }
}
