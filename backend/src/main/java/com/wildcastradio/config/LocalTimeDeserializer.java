package com.wildcastradio.config;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import org.springframework.boot.jackson.JsonComponent;

import java.io.IOException;
import java.time.LocalTime;
import java.time.OffsetTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

/**
 * Custom deserializer for LocalTime that can handle time strings with timezone information.
 * This deserializer attempts to parse the time string as an OffsetTime (which includes timezone)
 * and then converts it to LocalTime by discarding the timezone information.
 */
@JsonComponent
public class LocalTimeDeserializer extends JsonDeserializer<LocalTime> {

    @Override
    public LocalTime deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
        String timeString = p.getText().trim();
        
        try {
            // First try to parse as LocalTime (no timezone)
            return LocalTime.parse(timeString);
        } catch (DateTimeParseException e) {
            try {
                // If that fails, try to parse as OffsetTime (with timezone)
                OffsetTime offsetTime = OffsetTime.parse(timeString);
                // Convert to LocalTime by discarding the timezone information
                return offsetTime.toLocalTime();
            } catch (DateTimeParseException ex) {
                // If both parsing attempts fail, log the error and rethrow
                System.err.println("Error parsing time string: " + timeString);
                throw new IOException("Unable to parse time string: " + timeString, ex);
            }
        }
    }
}