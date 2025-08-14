package com.wildcastradio.ChatMessage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Minimal client for Google Perspective API toxicity analysis.
 * Docs: https://developers.perspectiveapi.com/
 */
final class GooglePerspectiveClient {

    private static final Logger logger = LoggerFactory.getLogger(GooglePerspectiveClient.class);

    private final String apiKey;
    private final RestTemplate restTemplate;

    GooglePerspectiveClient(String apiKey) {
        this.apiKey = apiKey;
        this.restTemplate = new RestTemplate();
    }

    /**
     * Returns toxicity score in range [0,1] or null if request fails.
     */
    Double analyzeToxicityScore(String text, List<String> languages) {
        if (apiKey == null || apiKey.isBlank()) {
            logger.warn("Perspective API key is not provided");
            return null;
        }
        try {
            String url = "https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=" + apiKey;

            Map<String, Object> body = new HashMap<>();
            Map<String, Object> comment = new HashMap<>();
            comment.put("text", text);
            body.put("comment", comment);
            if (languages != null && !languages.isEmpty()) {
                body.put("languages", languages);
            }
            Map<String, Object> requestedAttributes = new HashMap<>();
            requestedAttributes.put("TOXICITY", new HashMap<>());
            body.put("requestedAttributes", requestedAttributes);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                logger.warn("Perspective API non-success response: {}", response.getStatusCode());
                return null;
            }

            Object attributeScores = response.getBody().get("attributeScores");
            if (!(attributeScores instanceof Map)) return null;
            Object toxicity = ((Map<?, ?>) attributeScores).get("TOXICITY");
            if (!(toxicity instanceof Map)) return null;
            Object summaryScore = ((Map<?, ?>) toxicity).get("summaryScore");
            if (!(summaryScore instanceof Map)) return null;
            Object value = ((Map<?, ?>) summaryScore).get("value");
            if (value instanceof Number) {
                return ((Number) value).doubleValue();
            }
            return null;
        } catch (Exception ex) {
            logger.warn("Perspective API call failed: {}", ex.getMessage());
            return null;
        }
    }
}
