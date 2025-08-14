package com.wildcastradio.ChatMessage;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ProfanityFilterTest {

    @Test
    void englishWord_simple_shouldBeReplaced() {
        String input = "You are a bitch!";
        String out = ProfanityFilter.sanitizeContent(input);
        assertEquals(ProfanityFilter.getReplacementPhrase(), out);
    }

    @Test
    void englishSpacedLetters_shouldBeReplaced() {
        String input = "f u c k this";
        String out = ProfanityFilter.sanitizeContent(input);
        assertEquals(ProfanityFilter.getReplacementPhrase(), out);
    }

    @Test
    void tagalogCompactPhraseVariants_shouldBeReplaced() {
        String input1 = "putang ina mo"; // spaced variant
        String input2 = "PuTang Ina mo!!!"; // case mix
        assertEquals(ProfanityFilter.getReplacementPhrase(), ProfanityFilter.sanitizeContent(input1));
        assertEquals(ProfanityFilter.getReplacementPhrase(), ProfanityFilter.sanitizeContent(input2));
    }

    @Test
    void bisayaWord_shouldBeReplaced() {
        String input = "yawa jud ka";
        String out = ProfanityFilter.sanitizeContent(input);
        assertEquals(ProfanityFilter.getReplacementPhrase(), out);
    }

    @Test
    void leetspeakNumeric_shouldBeReplaced() {
        String input = "sh1t happens"; // 1 -> i handled by leet normalization
        String out = ProfanityFilter.sanitizeContent(input);
        assertEquals(ProfanityFilter.getReplacementPhrase(), out);
    }

    @Test
    void cleanText_shouldPassThrough() {
        String input = "Good morning everyone";
        String out = ProfanityFilter.sanitizeContent(input);
        assertEquals(input, out);
    }
}
