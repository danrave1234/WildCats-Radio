package com.wildcastradio.config;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.client.InMemoryOAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistration.Builder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;

@Configuration
public class OAuth2ClientConfig {

    private static final Logger logger = LoggerFactory.getLogger(OAuth2ClientConfig.class);

    @Value("${app.oauth.google.client-id:}")
    private String googleClientId;

    @Value("${app.oauth.google.client-secret:}")
    private String googleClientSecret;

    @Value("${app.oauth.google.scopes:}")
    private String googleScopes;

    @Bean
    public ClientRegistrationRepository clientRegistrationRepository() {
        List<ClientRegistration> registrations = new ArrayList<>();

        ClientRegistration googleRegistration = buildGoogleRegistration();
        if (googleRegistration != null) {
            registrations.add(googleRegistration);
        }

        if (registrations.isEmpty()) {
            logger.warn("Google OAuth2 is disabled. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable.");
            return registrationId -> null;
        } else {
            logger.info("Configured OAuth2 providers: {}", registrations.stream()
                    .map(ClientRegistration::getRegistrationId)
                    .collect(Collectors.joining(", ")));
        }

        return new InMemoryClientRegistrationRepository(registrations);
    }

    @Bean
    public OAuth2AuthorizedClientService authorizedClientService(
            ClientRegistrationRepository clientRegistrationRepository) {
        return new InMemoryOAuth2AuthorizedClientService(clientRegistrationRepository);
    }

    private ClientRegistration buildGoogleRegistration() {
        if (googleClientId == null || googleClientId.isBlank() ||
            googleClientSecret == null || googleClientSecret.isBlank()) {
            return null;
        }

        Builder builder = ClientRegistration.withRegistrationId("google")
                .clientId(googleClientId.trim())
                .clientSecret(googleClientSecret.trim())
                .clientName("Google")
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
                .tokenUri("https://oauth2.googleapis.com/token")
                .userInfoUri("https://www.googleapis.com/oauth2/v2/userinfo")
                .userNameAttributeName("email")
                .scope(resolveScopes(googleScopes,
                        "profile", "email",
                        "https://www.googleapis.com/auth/user.birthday.read",
                        "https://www.googleapis.com/auth/user.gender.read"));

        // Environment Detection Logic
        // We need to distinguish between Local (Windows/localhost) and Production (Linux VM)
        
        String osName = System.getProperty("os.name").toLowerCase();
        String hostname = System.getenv("HOSTNAME");
        
        boolean isLocalEnv = false;
        
        // 1. Check OS: Windows is almost certainly local development for this project
        if (osName.contains("win")) {
            isLocalEnv = true;
        }
        // 2. Check Hostname: If explicitly localhost
        else if (hostname == null || hostname.isEmpty() || hostname.contains("localhost") || hostname.contains("127.0.0.1")) {
            isLocalEnv = true;
        }
        
        if (isLocalEnv) {
            // LOCALHOST: Hardcode to port 8080 to match Google Console exactly.
            // Using {baseUrl} is risky because it might resolve to 127.0.0.1 or [::1] which causes mismatch.
            String localRedirectUri = "http://localhost:8080/login/oauth2/code/google";
            builder.redirectUri(localRedirectUri);
            logger.info("Detected Local Environment. Using redirect URI: {}", localRedirectUri);
        } else {
            // PRODUCTION: Explicitly use the API domain
            String prodRedirectUri = "https://api.wildcat-radio.live/login/oauth2/code/google";
            builder.redirectUri(prodRedirectUri);
            logger.info("Detected Production Environment. Using redirect URI: {}", prodRedirectUri);
        }
        
        return builder.build();
    }

    private List<String> resolveScopes(String configuredScopes, String... defaults) {
        if (configuredScopes != null && !configuredScopes.isBlank()) {
            return Arrays.stream(configuredScopes.split(","))
                    .map(String::trim)
                    .filter(scope -> !scope.isBlank())
                    .collect(Collectors.toList());
        }
        return Arrays.asList(defaults);
    }
}

