package com.wildcastradio.config;

import java.util.Arrays;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Autowired
    private JwtRequestFilter jwtRequestFilter;

    @Autowired
    private CorsConfig corsConfig;

    @Autowired
    private SecurityHeadersFilter securityHeadersFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                // Allow OPTIONS requests for CORS preflight
                .requestMatchers(org.springframework.http.HttpMethod.OPTIONS, "/**").permitAll()
                // Allow frontend root and static assets so SPA can load without auth
                .requestMatchers(
                    "/", 
                    "/index.html",
                    "/assets/**",
                    "/static/**",
                    "/favicon.ico",
                    "/manifest.json",
                    "/robots.txt",
                    "/*.css",
                    "/*.js"
                ).permitAll()
                // Public endpoints that don't require authentication
                .requestMatchers("/api/auth/login").permitAll()
                .requestMatchers("/api/auth/register").permitAll()
                .requestMatchers("/api/auth/verify").permitAll()
                .requestMatchers("/api/auth/send-code").permitAll()
                .requestMatchers("/api/user/register").permitAll()
                .requestMatchers("/api/user/verify").permitAll()
                .requestMatchers("/api/stream/status").permitAll()
                .requestMatchers("/api/stream/config").permitAll()
                .requestMatchers("/api/stream/health").permitAll()
                // Allow all stream-related endpoints
                .requestMatchers("/api/stream/**").permitAll()
                // Websocket endpoints
                .requestMatchers("/ws/live").permitAll()
                .requestMatchers("/ws/listener").permitAll()
                .requestMatchers("/stream").permitAll()
                .requestMatchers("/ws-radio/**").permitAll()
                .requestMatchers("/ws-radio/info/**").permitAll()
                .requestMatchers("/ws-radio/info").permitAll()
                // Public read-only API for listening experience
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/broadcasts/**").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/chats/*").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/polls/broadcast/**").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/polls/*/results").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/polls/*").permitAll()
                // Swagger UI endpoints if you use it
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
                // Health check endpoints
                .requestMatchers("/actuator/**").permitAll()
                // Require authentication for all other endpoints
                .anyRequest().authenticated())
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        // Add security headers filter first to ensure headers are set on all responses
        http.addFilterBefore(securityHeadersFilter, UsernamePasswordAuthenticationFilter.class);
        
        // Add JWT filter before processing requests
        http.addFilterBefore(jwtRequestFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        // Use dynamic CORS configuration
        configuration.setAllowedOrigins(corsConfig.getAllowedOrigins());

        // Allow all methods required for REST and WebSocket/SockJS
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH", "CONNECT"));

        // Allow all headers including those needed for SockJS
        configuration.setAllowedHeaders(Arrays.asList(
            "*"
        ));

        // Expose headers needed for authentication and SockJS
        configuration.setExposedHeaders(Arrays.asList(
            "x-auth-token", 
            "Authorization", 
            "Content-Type", 
            "Content-Length",
            "Access-Control-Allow-Origin",
            "Access-Control-Allow-Credentials",
            "X-SockJS-Transport"
        ));

        configuration.setAllowCredentials(true); // Enable credentials for JWT tokens
        configuration.setMaxAge(3600L); // Cache preflight for 1 hour

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);

        // Create specific enhanced configuration for SockJS endpoints
        CorsConfiguration sockJsConfig = new CorsConfiguration();
        sockJsConfig.setAllowedOrigins(corsConfig.getAllowedOrigins());
        sockJsConfig.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"));
        sockJsConfig.setAllowedHeaders(Arrays.asList("*"));
        sockJsConfig.setExposedHeaders(Arrays.asList(
            "Content-Type", 
            "Content-Length",
            "X-SockJS-Transport",
            "Access-Control-Allow-Origin",
            "Access-Control-Allow-Credentials"
        ));
        sockJsConfig.setAllowCredentials(true);
        sockJsConfig.setMaxAge(3600L);
        
        // Register specific configurations for SockJS endpoints
        source.registerCorsConfiguration("/ws-radio/**", sockJsConfig);
        source.registerCorsConfiguration("/ws-radio/info/**", sockJsConfig);
        source.registerCorsConfiguration("/ws-radio/info", sockJsConfig);
        source.registerCorsConfiguration("/ws/**", sockJsConfig);

        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }
} 
