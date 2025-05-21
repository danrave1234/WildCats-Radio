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

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                // Public endpoints that don't require authentication
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/user/register").permitAll()
                .requestMatchers("/api/user/verify").permitAll()
                .requestMatchers("/api/stream/status").permitAll()
                // Allow all stream-related endpoints
                .requestMatchers("/api/stream/**").permitAll()
                .requestMatchers("/api/shoutcast/**").permitAll()
                // Websocket endpoints
                .requestMatchers("/stream").permitAll()
                .requestMatchers("/ws-radio/**").permitAll()
                // Swagger UI endpoints if you use it
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
                // Health check endpoints
                .requestMatchers("/actuator/**").permitAll()
                // Require authentication for all other endpoints
                .anyRequest().authenticated())
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        // Add JWT filter before processing requests
        http.addFilterBefore(jwtRequestFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        // Define allowed origins
        String[] allowedOrigins = {
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:3000",
            "https://wildcat-radio-f05d362144e6.herokuapp.com",
            "https://wildcat-radio.vercel.app"
        };
        
        // Create the default CORS configuration
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList(allowedOrigins));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("authorization", "content-type", "x-auth-token", "accept", "origin"));
        configuration.setExposedHeaders(Arrays.asList("x-auth-token", "content-disposition"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L); // Cache preflight response for 1 hour
        
        // Register the configuration for all paths
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        
        // Special configuration for stream-related endpoints with more permissive settings
        CorsConfiguration streamConfig = new CorsConfiguration();
        streamConfig.setAllowedOrigins(Arrays.asList(allowedOrigins)); // Use the same origins - don't use "*"
        streamConfig.setAllowedMethods(Arrays.asList("GET", "OPTIONS"));
        streamConfig.setAllowedHeaders(Arrays.asList("authorization", "content-type", "x-auth-token", "accept", "origin"));
        streamConfig.setAllowCredentials(true);
        streamConfig.setMaxAge(3600L);
        
        // Register the stream configuration for stream-specific endpoints
        source.registerCorsConfiguration("/api/stream/proxy", streamConfig);
        source.registerCorsConfiguration("/stream", streamConfig);
        
        // WebSocket specific configuration
        CorsConfiguration wsConfig = new CorsConfiguration();
        wsConfig.setAllowedOrigins(Arrays.asList(allowedOrigins)); // Use the same origins
        wsConfig.setAllowedMethods(Arrays.asList("GET", "OPTIONS"));
        wsConfig.setAllowedHeaders(Arrays.asList("authorization", "content-type", "x-auth-token", "accept", "origin"));
        wsConfig.setAllowCredentials(true);
        wsConfig.setMaxAge(3600L);
        
        // Register the websocket configuration
        source.registerCorsConfiguration("/ws-radio/**", wsConfig);
        
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
