package com.wildcastradio.util;

import java.util.regex.Pattern;

/**
 * Utility class for common validation operations
 */
public class ValidationUtils {

    // Email validation pattern
    private static final Pattern EMAIL_PATTERN = Pattern.compile(
        "^[A-Za-z0-9+_.-]+@([A-Za-z0-9.-]+\\.[A-Za-z]{2,})$"
    );

    // Password validation pattern (at least 8 characters, contains letter and number)
    private static final Pattern PASSWORD_PATTERN = Pattern.compile(
        "^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d@$!%*#?&]{8,}$"
    );

    /**
     * Validate email address format
     * @param email Email address to validate
     * @return true if email is valid, false otherwise
     */
    public static boolean isValidEmail(String email) {
        if (email == null || email.trim().isEmpty()) {
            return false;
        }
        return EMAIL_PATTERN.matcher(email.trim()).matches();
    }

    /**
     * Validate password strength
     * @param password Password to validate
     * @return true if password meets requirements, false otherwise
     */
    public static boolean isValidPassword(String password) {
        if (password == null) {
            return false;
        }
        return PASSWORD_PATTERN.matcher(password).matches();
    }

    /**
     * Validate broadcast title
     * @param title Broadcast title to validate
     * @return true if title is valid, false otherwise
     */
    public static boolean isValidBroadcastTitle(String title) {
        if (title == null) {
            return false;
        }
        String trimmed = title.trim();
        return trimmed.length() >= 3 && trimmed.length() <= 100;
    }

    /**
     * Validate broadcast description
     * @param description Broadcast description to validate
     * @return true if description is valid, false otherwise
     */
    public static boolean isValidBroadcastDescription(String description) {
        if (description == null) {
            return true; // Description is optional
        }
        return description.trim().length() <= 500;
    }

    /**
     * Validate user first name
     * @param firstName First name to validate
     * @return true if first name is valid, false otherwise
     */
    public static boolean isValidFirstName(String firstName) {
        if (firstName == null) {
            return false;
        }
        String trimmed = firstName.trim();
        return trimmed.length() >= 1 && trimmed.length() <= 50 && 
               trimmed.matches("^[A-Za-z\\s'-]+$");
    }

    /**
     * Validate user last name
     * @param lastName Last name to validate
     * @return true if last name is valid, false otherwise
     */
    public static boolean isValidLastName(String lastName) {
        if (lastName == null) {
            return false;
        }
        String trimmed = lastName.trim();
        return trimmed.length() >= 1 && trimmed.length() <= 50 && 
               trimmed.matches("^[A-Za-z\\s'-]+$");
    }


    /**
     * Validate URL format
     * @param url URL to validate
     * @return true if URL is valid, false otherwise
     */
    public static boolean isValidUrl(String url) {
        if (url == null || url.trim().isEmpty()) {
            return true; // URL is optional in most cases
        }
        String trimmed = url.trim();
        return trimmed.matches("^https?://[\\w\\-]+(\\.[\\w\\-]+)+([\\w\\-\\.,@?^=%&:/~\\+#]*[\\w\\-\\@?^=%&/~\\+#])?$");
    }

    /**
     * Validate chat message content
     * @param content Message content to validate
     * @return true if content is valid, false otherwise
     */
    public static boolean isValidChatMessage(String content) {
        if (content == null) {
            return false;
        }
        String trimmed = content.trim();
        return trimmed.length() >= 1 && trimmed.length() <= 500;
    }

    /**
     * Validate song title
     * @param songTitle Song title to validate
     * @return true if song title is valid, false otherwise
     */
    public static boolean isValidSongTitle(String songTitle) {
        if (songTitle == null) {
            return false;
        }
        String trimmed = songTitle.trim();
        return trimmed.length() >= 1 && trimmed.length() <= 200;
    }

    /**
     * Validate artist name
     * @param artist Artist name to validate
     * @return true if artist name is valid, false otherwise
     */
    public static boolean isValidArtist(String artist) {
        if (artist == null || artist.trim().isEmpty()) {
            return true; // Artist is optional
        }
        String trimmed = artist.trim();
        return trimmed.length() >= 1 && trimmed.length() <= 200;
    }


    /**
     * Validate positive integer
     * @param value Integer value to validate
     * @return true if value is positive, false otherwise
     */
    public static boolean isPositiveInteger(Integer value) {
        return value != null && value > 0;
    }

    /**
     * Validate non-negative integer
     * @param value Integer value to validate
     * @return true if value is non-negative, false otherwise
     */
    public static boolean isNonNegativeInteger(Integer value) {
        return value != null && value >= 0;
    }

    /**
     * Check if string is null or empty
     * @param str String to check
     * @return true if string is null or empty, false otherwise
     */
    public static boolean isNullOrEmpty(String str) {
        return str == null || str.trim().isEmpty();
    }

    /**
     * Check if string has content (not null and not empty after trimming)
     * @param str String to check
     * @return true if string has content, false otherwise
     */
    public static boolean hasContent(String str) {
        return str != null && !str.trim().isEmpty();
    }
}
