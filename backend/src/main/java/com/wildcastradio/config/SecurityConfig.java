package com.wildcastradio.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
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
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.security.web.util.matcher.OrRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.wildcastradio.config.JwtRequestFilter;

import java.util.Arrays;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@Order(2) // Lower priority than WebSocketSecurityConfig which has HIGHEST_PRECEDENCE + 99
public class SecurityConfig {

    @Autowired
    private JwtRequestFilter jwtRequestFilter;
    
    // Create a matcher for all WebSocket/SockJS related endpoints that require CSRF to be disabled
    private RequestMatcher createWebSocketRequestMatcher() {
        return new OrRequestMatcher(
            new AntPathRequestMatcher("/ws/live/**"),
            new AntPathRequestMatcher("/ws/listener/**"),
            new AntPathRequestMatcher("/ws-radio/**"),
            new AntPathRequestMatcher("/stream/**")
        );
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        // Create the websocket request matcher
        RequestMatcher websocketMatcher = createWebSocketRequestMatcher();
        
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf
                // Disable CSRF for WebSocket endpoints to allow SockJS fallback mechanisms
                .ignoringRequestMatchers(websocketMatcher))
            .authorizeHttpRequests(auth -> auth
                // Public endpoints that don't require authentication
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/user/register").permitAll()
                .requestMatchers("/api/user/verify").permitAll()
                .requestMatchers("/api/stream/status").permitAll()
                .requestMatchers("/api/stream/simple-status").permitAll()
                .requestMatchers("/api/stream/config").permitAll()
                .requestMatchers("/api/stream/health").permitAll()
                // Allow all stream-related endpoints
                .requestMatchers("/api/stream/**").permitAll()
                // Websocket endpoints - ensure SockJS sub-paths are permitted
                .requestMatchers("/ws/live/**").permitAll()       
                .requestMatchers("/ws/listener/**").permitAll() 
                .requestMatchers("/stream/**").permitAll()        
                .requestMatchers("/ws-radio/**").permitAll()   
                // SockJS specific endpoints
                .requestMatchers("/**/websocket/**").permitAll()
                .requestMatchers("/**/sockjs-info").permitAll()
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
        CorsConfiguration configuration = new CorsConfiguration();
        
        // Allow specific origins instead of wildcard to support credentials
        configuration.addAllowedOriginPattern("*");
        
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList(
            "Authorization", 
            "Content-Type", 
            "x-auth-token", 
            "x-requested-with",
            "x-socket-transport",
            "sec-websocket-version",
            "sec-websocket-extensions",
            "sec-websocket-key",
            "sec-websocket-protocol"
        ));
        configuration.setExposedHeaders(Arrays.asList("x-auth-token"));
        
        // Allow credentials (cookies, auth headers) with specific origins
        configuration.setAllowCredentials(true);
        
        // Cache preflight for 24 hours to reduce OPTIONS requests
        configuration.setMaxAge(86400L);
        
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
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
