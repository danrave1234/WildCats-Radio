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

        // Handle redirect URI based on environment
        String hostname = System.getenv("HOSTNAME");
        if (hostname == null || hostname.isEmpty()) {
            hostname = System.getProperty("server.hostname", "");
        }
        
        // For localhost development
        if (hostname == null || hostname.contains("localhost") || hostname.contains("127.0.0.1") || hostname.isEmpty()) {
            // Use template for localhost - Spring Security resolves this correctly
            builder.redirectUri("{baseUrl}/login/oauth2/code/google");
            logger.info("Using dynamic OAuth redirect URI for local/dev environment");
        } else {
            // For production: Use explicit redirect URI to avoid proxy/load balancer resolution issues
            // This ensures Google always receives the correct redirect URI regardless of internal routing
            String prodRedirectUri = "https://api.wildcat-radio.live/login/oauth2/code/google";
            builder.redirectUri(prodRedirectUri);
            logger.info("Using explicit OAuth redirect URI for production: {}", prodRedirectUri);
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

