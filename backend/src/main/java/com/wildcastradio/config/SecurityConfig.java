package com.wildcastradio.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Autowired
    private JwtRequestFilter jwtRequestFilter;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authenticationConfiguration) throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        // Disable CSRF for API calls and configure stateless session management
        http.csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configure(http))
                .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/login", "/api/auth/register", "/api/auth/verify", "/api/auth/send-code").permitAll()
                .requestMatchers("/api/auth/{id}").permitAll() // Allow public access to user profiles
                .requestMatchers("/api/auth/me").authenticated() // Require authentication for current user endpoint
                .requestMatchers("/api/broadcasts/live").permitAll() // Allow public access to check live broadcasts
                .requestMatchers("/api/broadcasts/upcoming").permitAll() // Allow public access to upcoming schedule
                .requestMatchers("/api/stream/status").permitAll() // Allow public access to stream status
                .requestMatchers("/ws-radio/**").permitAll() // Allow public access to WebSocket STOMP endpoints
                .requestMatchers("/stream").permitAll() // Allow access to audio streaming WebSocket endpoint
                .requestMatchers("/api/chats/**").authenticated() // Require authentication for chat endpoints
                .requestMatchers("/api/broadcasts/{broadcastId}/song-requests/**").authenticated() // Require authentication for song request endpoints
                .requestMatchers("/error").permitAll() // Allow public access to error pages
                .anyRequest().authenticated()
            )
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        // Add JWT filter before the standard authentication filter
        http.addFilterBefore(jwtRequestFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
} 
