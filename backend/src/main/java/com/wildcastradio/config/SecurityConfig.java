package com.wildcastradio.config;

import java.util.Arrays;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.wildcastradio.User.DTO.LoginResponse;
import com.wildcastradio.User.UserService;
import com.wildcastradio.ratelimit.RateLimitingFilter;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private static final Logger logger = LoggerFactory.getLogger(SecurityConfig.class);

    @Autowired
    private JwtRequestFilter jwtRequestFilter;

    @Autowired
    private CorsConfig corsConfig;

    @Autowired
    private SecurityHeadersFilter securityHeadersFilter;

    @Autowired
    private RateLimitingFilter rateLimitingFilter;

    @Autowired
    @org.springframework.context.annotation.Lazy
    private UserService userService;

    @Value("${app.security.cookie.secure:false}")
    private boolean useSecureCookies;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .oauth2Login(oauth2 -> oauth2
                .successHandler((request, response, authentication) -> {
                    try {
                        String frontendDomain = getFrontendDomain(request);
                        
                        if (authentication == null || !(authentication instanceof OAuth2AuthenticationToken)) {
                            response.sendRedirect(frontendDomain + "/login?oauth_error=auth_failed");
                            return;
                        }
                        
                        OAuth2AuthenticationToken token = (OAuth2AuthenticationToken) authentication;
                        String registrationId = token.getAuthorizedClientRegistrationId();
                        
                        if (registrationId == null || registrationId.isEmpty()) {
                            response.sendRedirect(frontendDomain + "/login?oauth_error=auth_failed");
                            return;
                        }
                        
                        OAuth2User oauth2User = token.getPrincipal();
                        if (oauth2User == null) {
                            response.sendRedirect(frontendDomain + "/login?oauth_error=auth_failed");
                            return;
                        }
                        
                        Map<String, Object> attributes = oauth2User.getAttributes();
                        
                        LoginResponse loginResponse;
                        try {
                            loginResponse = userService.oauth2Login(attributes, registrationId);
                        } catch (Exception e) {
                            logger.error("OAuth2 login failed: {}", e.getMessage());
                            response.sendRedirect(frontendDomain + "/login?oauth_error=login_failed");
                            return;
                        }
                        
                        if (loginResponse.getToken() == null || loginResponse.getToken().isEmpty()) {
                            response.sendRedirect(frontendDomain + "/login?oauth_error=token_failed");
                            return;
                        }
                        
                        // Create secure HttpOnly cookies for token and user information
                        Cookie tokenCookie = new Cookie("token", loginResponse.getToken());
                        tokenCookie.setHttpOnly(true);
                        tokenCookie.setSecure(useSecureCookies);
                        setCookieDomain(tokenCookie, request);
                        tokenCookie.setPath("/");
                        tokenCookie.setMaxAge(7 * 24 * 60 * 60); // 7 days
                        tokenCookie.setAttribute("SameSite", useSecureCookies ? "None" : "Lax");
                        response.addCookie(tokenCookie);
                        
                        Cookie userIdCookie = new Cookie("userId", String.valueOf(loginResponse.getUser().getId()));
                        userIdCookie.setHttpOnly(true);
                        userIdCookie.setSecure(useSecureCookies);
                        setCookieDomain(userIdCookie, request);
                        userIdCookie.setPath("/");
                        userIdCookie.setMaxAge(7 * 24 * 60 * 60); // 7 days
                        userIdCookie.setAttribute("SameSite", useSecureCookies ? "None" : "Lax");
                        response.addCookie(userIdCookie);
                        
                        Cookie userRoleCookie = new Cookie("userRole", String.valueOf(loginResponse.getUser().getRole()));
                        userRoleCookie.setHttpOnly(true);
                        userRoleCookie.setSecure(useSecureCookies);
                        setCookieDomain(userRoleCookie, request);
                        userRoleCookie.setPath("/");
                        userRoleCookie.setMaxAge(7 * 24 * 60 * 60); // 7 days
                        userRoleCookie.setAttribute("SameSite", useSecureCookies ? "None" : "Lax");
                        response.addCookie(userRoleCookie);
                        
                        // Redirect to frontend
                        // For localhost: include token in URL since cookies don't work across ports
                        // For production: cookies work, so just redirect with success flag
                        String redirectUrl;
                        if (frontendDomain.contains("localhost")) {
                            redirectUrl = frontendDomain + "/?oauth=success&token=" + 
                                java.net.URLEncoder.encode(loginResponse.getToken(), java.nio.charset.StandardCharsets.UTF_8) +
                                "&userId=" + loginResponse.getUser().getId() +
                                "&userRole=" + loginResponse.getUser().getRole();
                        } else {
                            redirectUrl = frontendDomain + "/?oauth=success";
                        }
                        response.sendRedirect(redirectUrl);
                        
                    } catch (Exception e) {
                        logger.error("OAuth2 success handler error: {}", e.getMessage());
                        String frontendDomain = getFrontendDomain(request);
                        response.sendRedirect(frontendDomain + "/login?oauth_error=handler_error");
                    }
                })
                .failureHandler((request, response, exception) -> {
                    logger.error("OAuth2 login failure: {}", exception.getMessage());
                    String frontendDomain = getFrontendDomain(request);
                    response.sendRedirect(frontendDomain + "/login?oauth_error=login_failed");
                }))
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
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
                // OAuth2 endpoints
                .requestMatchers("/api/auth/oauth2/**").permitAll()
                .requestMatchers("/oauth2/**").permitAll()
                .requestMatchers("/login/oauth2/**").permitAll()
                .requestMatchers("/oauth2/authorization/**").permitAll()
                .requestMatchers("/api/user/register").permitAll()
                .requestMatchers("/api/user/verify").permitAll()
                .requestMatchers("/api/stream/status").permitAll()
                .requestMatchers("/api/stream/config").permitAll()
                .requestMatchers("/api/stream/health").permitAll()
                // Allow all stream-related endpoints
                .requestMatchers("/api/stream/**").permitAll()
                // Radio status endpoint - public for checking radio state
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/radio/status").permitAll()
                // Websocket endpoints
                .requestMatchers("/ws/live").permitAll()
                // /ws/listener removed - listener status now via STOMP /topic/listener-status
                .requestMatchers("/stream").permitAll()
                .requestMatchers("/ws-radio/**").permitAll()
                .requestMatchers("/ws-radio/info/**").permitAll()
                .requestMatchers("/ws-radio/info").permitAll()
                // Public read-only API for listening experience
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/broadcasts/**").permitAll()
                
                // Require authentication for actions that modify broadcasts
                .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/broadcasts/**").authenticated()
                .requestMatchers(org.springframework.http.HttpMethod.PUT, "/api/broadcasts/**").authenticated()
                .requestMatchers(org.springframework.http.HttpMethod.DELETE, "/api/broadcasts/**").authenticated()
                
                // Announcements - public GET, authenticated POST/PUT/DELETE
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/announcements").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/announcements/*").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/announcements/**").authenticated()
                .requestMatchers(org.springframework.http.HttpMethod.PUT, "/api/announcements/**").authenticated()
                .requestMatchers(org.springframework.http.HttpMethod.DELETE, "/api/announcements/**").authenticated()
                
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

        // Add Rate limiting filter before JWT processing
        http.addFilterBefore(rateLimitingFilter, UsernamePasswordAuthenticationFilter.class);
        
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

    /**
     * Auto-detect frontend domain from request headers
     * Tries Origin header first, then maps known backend hosts to frontend URLs
     */
    private String getFrontendDomain(HttpServletRequest request) {
        // 1. Try Origin header first (most reliable for CORS requests)
        String origin = request.getHeader("Origin");
        if (origin != null && !origin.isEmpty()) {
            // Verify origin is one of our allowed domains to be safe
            if (origin.contains("localhost") || origin.contains("wildcat-radio.live")) {
                return origin;
            }
        }
        
        // 2. Determine current backend host
        String host = request.getHeader("Host");
        if (host == null || host.isEmpty()) {
            host = request.getServerName();
            int port = request.getServerPort();
            if (port != 80 && port != 443 && port != -1) {
                host += ":" + port;
            }
        }

        // 3. Map Backend Host -> Frontend URL
        
        // Localhost Development
        if (host.contains("localhost") || host.contains("127.0.0.1")) {
            return "http://localhost:5173";
        }
        
        // Production (api.wildcat-radio.live -> wildcat-radio.live)
        if (host.contains("wildcat-radio.live")) {
            return "https://wildcat-radio.live";
        }

        // 4. Fallback: Referer (ONLY if internal)
        // WE DO NOT want to redirect back to "accounts.google.com"
        String referer = request.getHeader("Referer");
        if (referer != null && !referer.isEmpty()) {
            try {
                java.net.URL url = new java.net.URL(referer);
                String refHost = url.getHost();
                // Only accept referer if it matches our known domains
                if (refHost.contains("localhost") || refHost.contains("wildcat-radio.live")) {
                    String protocol = url.getProtocol();
                    int port = url.getPort();
                    if (port != -1 && port != 80 && port != 443) {
                        return protocol + "://" + refHost + ":" + port;
                    }
                    return protocol + "://" + refHost;
                }
            } catch (Exception e) {
                logger.debug("Could not parse Referer header: {}", e.getMessage());
            }
        }
        
        // Absolute fallback (shouldn't happen in normal flow)
        return "https://wildcat-radio.live";
    }
    
    /**
     * Set cookie domain for cross-subdomain sharing
     * Only sets domain for production (not localhost)
     */
    private void setCookieDomain(Cookie cookie, HttpServletRequest request) {
        String host = request.getHeader("Host");
        if (host == null || host.isEmpty()) {
            host = request.getServerName();
        }
        
        // Remove port if present
        String domain = host.split(":")[0];
        
        // Only set domain for production (not localhost)
        if (domain != null && !domain.contains("localhost") && !domain.contains("127.0.0.1")) {
            String rootDomain = extractRootDomain(domain);
            if (rootDomain != null && !rootDomain.isEmpty()) {
                cookie.setDomain("." + rootDomain);
                logger.debug("Setting cookie domain to: .{}", rootDomain);
            }
        }
    }
    
    /**
     * Extract root domain from a subdomain
     * e.g., api.wildcat-radio.live -> wildcat-radio.live
     * e.g., www.example.com -> example.com
     * e.g., subdomain.example.co.uk -> example.co.uk
     */
    private String extractRootDomain(String domain) {
        if (domain == null || domain.isEmpty()) {
            return null;
        }

        // Common TLDs that have two parts (e.g., .co.uk, .com.au)
        String[] twoPartTlds = {".co.uk", ".com.au", ".co.za", ".co.nz", ".com.br", ".co.jp"};
        
        // Check for two-part TLDs first
        for (String tld : twoPartTlds) {
            if (domain.endsWith(tld)) {
                // Extract domain without subdomain
                String withoutTld = domain.substring(0, domain.length() - tld.length());
                int lastDot = withoutTld.lastIndexOf('.');
                if (lastDot > 0) {
                    return withoutTld.substring(lastDot + 1) + tld;
                }
                return domain; // Already root domain
            }
        }

        // Standard TLD handling (e.g., .com, .org, .live)
        String[] parts = domain.split("\\.");
        if (parts.length >= 2) {
            // Take last two parts for standard TLDs
            return parts[parts.length - 2] + "." + parts[parts.length - 1];
        }

        return domain; // Fallback to original domain
    }
} 
