package com.wildcastradio.User;

import java.util.Optional;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.Broadcast.BroadcastRepository;
import com.wildcastradio.DJHandover.DJHandoverEntity;
import com.wildcastradio.DJHandover.DJHandoverRepository;
import com.wildcastradio.DJHandover.DTO.DJHandoverDTO;
import com.wildcastradio.User.DTO.BanRequest;
import com.wildcastradio.User.DTO.ChangePasswordRequest;
import com.wildcastradio.User.DTO.HandoverLoginRequest;
import com.wildcastradio.User.DTO.LoginRequest;
import com.wildcastradio.User.DTO.LoginResponse;
import com.wildcastradio.User.DTO.RegisterRequest;
import com.wildcastradio.User.DTO.UserDTO;
import com.wildcastradio.config.JwtUtil;
import com.wildcastradio.ratelimit.IpUtils;
import com.wildcastradio.ratelimit.LoginAttemptLimiter;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.validation.Valid;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@RestController
@RequestMapping("/api/auth")
public class UserController {

    private static final Logger logger = LoggerFactory.getLogger(UserController.class);

    private final UserService userService;
    private final LoginAttemptLimiter loginAttemptLimiter;

    @Autowired
    private BroadcastRepository broadcastRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private DJHandoverRepository handoverRepository;

    @Value("${app.security.cookie.secure:false}")
    private boolean useSecureCookies;

    @Value("${app.production:false}")
    private boolean isProduction;

    public UserController(UserService userService, LoginAttemptLimiter loginAttemptLimiter) {
        this.userService = userService;
        this.loginAttemptLimiter = loginAttemptLimiter;
    }

    @PostMapping("/register")
    public ResponseEntity<UserDTO> registerUser(@RequestBody RegisterRequest request) {
        UserEntity user = userService.registerUser(request);
        return ResponseEntity.ok(UserDTO.fromEntity(user));
    }

    @PostMapping("/login")
    public ResponseEntity<?> loginUser(@RequestBody LoginRequest request, HttpServletRequest httpRequest, HttpServletResponse response) {
        String username = request.getEmail() != null ? request.getEmail().trim().toLowerCase() : "";
        String clientIp = IpUtils.extractClientIp(httpRequest, true);

        // Block if this username+IP has too many recent failures
        if (loginAttemptLimiter.isBlocked(username, clientIp)) {
            String msg = "Too many failed login attempts. Please wait before trying again.";
            logger.warn("Auth rate limit: {} username='{}' ip='{}'", msg, username, clientIp);
            return ResponseEntity.status(429)
                    .header("Retry-After", String.valueOf(loginAttemptLimiter.retryAfterSeconds()))
                    .body(msg);
        }

        try {
            LoginResponse loginResponse = userService.loginUser(request);

            // Double-check again right before issuing cookies; enforce cooldown even if password correct
            if (loginAttemptLimiter.isBlocked(username, clientIp)) {
                String msg = "Login temporarily locked due to previous failed attempts. Please retry later.";
                logger.warn("Auth rate limit (post-auth): {} username='{}' ip='{}'", msg, username, clientIp);
                return ResponseEntity.status(429)
                        .header("Retry-After", String.valueOf(loginAttemptLimiter.retryAfterSeconds()))
                        .body(msg);
            }

            // Success: keep counters (cooldown enforced by natural refill)
            loginAttemptLimiter.onSuccess(username, clientIp);
            
            // Create secure HttpOnly cookies for token and user information
            Cookie tokenCookie = new Cookie("token", loginResponse.getToken());
            tokenCookie.setHttpOnly(true);
            tokenCookie.setSecure(useSecureCookies); // Env-aware
            tokenCookie.setPath("/");
            tokenCookie.setMaxAge(7 * 24 * 60 * 60); // 7 days
            // Cross-site analytics/API calls from the frontend require SameSite=None when using a separate domain
            tokenCookie.setAttribute("SameSite", useSecureCookies ? "None" : "Lax");
            response.addCookie(tokenCookie);
            
            Cookie userIdCookie = new Cookie("userId", String.valueOf(loginResponse.getUser().getId()));
            userIdCookie.setHttpOnly(true);
            userIdCookie.setSecure(useSecureCookies);
            userIdCookie.setPath("/");
            userIdCookie.setMaxAge(7 * 24 * 60 * 60); // 7 days
            userIdCookie.setAttribute("SameSite", useSecureCookies ? "None" : "Lax");
            response.addCookie(userIdCookie);
            
            Cookie userRoleCookie = new Cookie("userRole", loginResponse.getUser().getRole().toString());
            userRoleCookie.setHttpOnly(true);
            userRoleCookie.setSecure(useSecureCookies);
            userRoleCookie.setPath("/");
            userRoleCookie.setMaxAge(7 * 24 * 60 * 60); // 7 days
            userRoleCookie.setAttribute("SameSite", useSecureCookies ? "None" : "Lax");
            response.addCookie(userRoleCookie);
            
            // Return response without the token (token is now in secure cookie)
            LoginResponse secureResponse = new LoginResponse(null, loginResponse.getUser());
            return ResponseEntity.ok(secureResponse);
        } catch (IllegalArgumentException e) {
            // Failure: count towards limiter
            loginAttemptLimiter.onFailure(username, clientIp);
            String msg = "Invalid email or password.";
            logger.warn("Auth failure: {} username='{}' ip='{}'", msg, username, clientIp);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(msg);
        }
    }

    @PostMapping("/handover-login")
    @PreAuthorize("hasAnyRole('DJ','ADMIN','MODERATOR')")
    @Transactional
    public ResponseEntity<?> handoverLogin(
            @Valid @RequestBody HandoverLoginRequest request,
            Authentication authentication,
            HttpServletResponse response) {
        
        try {
            // 1. Validate handover permissions
            UserEntity initiator = userService.getUserByEmail(authentication.getName())
                    .orElseThrow(() -> new IllegalArgumentException("Initiator not found"));
            
            BroadcastEntity broadcast = broadcastRepository.findById(request.getBroadcastId())
                    .orElseThrow(() -> new IllegalArgumentException("Broadcast not found"));
            
            if (broadcast.getStatus() != BroadcastEntity.BroadcastStatus.LIVE) {
                throw new IllegalArgumentException("Broadcast must be LIVE");
            }
            
            // 2. Validate new DJ exists and has DJ or MODERATOR role
            UserEntity newDJ = userRepository.findById(request.getNewDJId())
                    .orElseThrow(() -> new IllegalArgumentException("New DJ not found"));
            
            if (newDJ.getRole() != UserEntity.UserRole.DJ && newDJ.getRole() != UserEntity.UserRole.MODERATOR) {
                throw new IllegalArgumentException("New DJ must have DJ or MODERATOR role");
            }
            
            if (!newDJ.isActive()) {
                throw new IllegalArgumentException("New DJ must be active");
            }
            
            // 3. Authenticate new DJ with password
            if (!passwordEncoder.matches(request.getPassword(), newDJ.getPassword())) {
                logger.warn("Handover-login authentication failed: Invalid password for DJ {}", newDJ.getEmail());
                throw new IllegalArgumentException("Invalid password for selected DJ");
            }
            
            // 4. Validate handover permissions (enhanced for long broadcast scenarios)
            UserEntity currentActiveDJ = broadcast.getCurrentActiveDJ();
            boolean hasPermission = validateHandoverPermission(initiator, broadcast);

            if (!hasPermission) {
                logger.warn("Handover permission denied - Broadcast: {} ({}h old), Initiator: {} (role: {}), CurrentDJ: {}",
                    request.getBroadcastId(),
                    broadcast.getActualStart() != null ?
                        Duration.between(broadcast.getActualStart(), LocalDateTime.now()).toHours() : 0,
                    initiator.getEmail(),
                    initiator.getRole(),
                    currentActiveDJ != null ? currentActiveDJ.getEmail() : "none");
                throw new IllegalArgumentException("You do not have permission to initiate handover");
            }
            
            // 5. Check if new DJ is same as current active DJ
            if (currentActiveDJ != null && currentActiveDJ.getId().equals(newDJ.getId())) {
                throw new IllegalArgumentException("New DJ cannot be the same as current active DJ");
            }
            
            // 6. Create handover record with ACCOUNT_SWITCH auth method
            DJHandoverEntity handover = new DJHandoverEntity();
            handover.setBroadcast(broadcast);
            handover.setPreviousDJ(currentActiveDJ);
            handover.setNewDJ(newDJ);
            handover.setHandoverTime(LocalDateTime.now());
            handover.setInitiatedBy(initiator);
            handover.setReason(request.getReason());
            handover.setAuthMethod(DJHandoverEntity.AuthMethod.ACCOUNT_SWITCH);
            
            // Calculate duration of previous DJ's session
            if (currentActiveDJ != null && broadcast.getActualStart() != null) {
                List<DJHandoverEntity> previousHandovers = handoverRepository
                        .findByBroadcast_IdOrderByHandoverTimeAsc(request.getBroadcastId());
                
                LocalDateTime periodStart = broadcast.getActualStart();
                for (DJHandoverEntity prevHandover : previousHandovers) {
                    if (prevHandover.getNewDJ().getId().equals(currentActiveDJ.getId())) {
                        periodStart = prevHandover.getHandoverTime();
                        break;
                    }
                }
                
                Duration duration = Duration.between(periodStart, LocalDateTime.now());
                handover.setDurationSeconds(duration.getSeconds());
            }
            
            // Save handover record
            DJHandoverEntity savedHandover = handoverRepository.save(handover);
            handoverRepository.flush(); // Force immediate write to database
            
            logger.info("Handover record saved: ID={}, Broadcast={}, From DJ={}, To DJ={}", 
                savedHandover.getId(), 
                request.getBroadcastId(),
                currentActiveDJ != null ? currentActiveDJ.getId() : "none",
                newDJ.getId());
            
            // 7. Update broadcast's current active DJ and set active session ID
            String activeSessionId = UUID.randomUUID().toString();
            broadcast.setCurrentActiveDJ(newDJ);
            broadcast.setActiveSessionId(activeSessionId);
            BroadcastEntity savedBroadcast = broadcastRepository.save(broadcast);
            broadcastRepository.flush(); // Force immediate write to database
            
            logger.info("Broadcast updated: Broadcast={}, New DJ ID={}, ActiveSessionId={}", 
                request.getBroadcastId(), 
                savedBroadcast.getCurrentActiveDJ() != null ? savedBroadcast.getCurrentActiveDJ().getId() : "null",
                activeSessionId);
            
            // 8. Generate new JWT token for new DJ
            UserDetails userDetails = userService.loadUserByUsername(newDJ.getEmail());
            String token = jwtUtil.generateToken(userDetails);
            
            // 9. Set HttpOnly cookies with new token (for shared PC account switching)
            Cookie tokenCookie = new Cookie("token", token);
            tokenCookie.setHttpOnly(true);
            tokenCookie.setSecure(useSecureCookies);
            tokenCookie.setPath("/");
            tokenCookie.setMaxAge(7 * 24 * 60 * 60); // 7 days
            tokenCookie.setAttribute("SameSite", useSecureCookies ? "None" : "Lax");
            response.addCookie(tokenCookie);
            
            Cookie userIdCookie = new Cookie("userId", String.valueOf(newDJ.getId()));
            userIdCookie.setHttpOnly(true);
            userIdCookie.setSecure(useSecureCookies);
            userIdCookie.setPath("/");
            userIdCookie.setMaxAge(7 * 24 * 60 * 60); // 7 days
            userIdCookie.setAttribute("SameSite", useSecureCookies ? "None" : "Lax");
            response.addCookie(userIdCookie);
            
            Cookie userRoleCookie = new Cookie("userRole", newDJ.getRole().toString());
            userRoleCookie.setHttpOnly(true);
            userRoleCookie.setSecure(useSecureCookies);
            userRoleCookie.setPath("/");
            userRoleCookie.setMaxAge(7 * 24 * 60 * 60); // 7 days
            userRoleCookie.setAttribute("SameSite", useSecureCookies ? "None" : "Lax");
            response.addCookie(userRoleCookie);
            
            // 10. Send WebSocket notifications
            Map<String, Object> handoverMessage = new HashMap<>();
            handoverMessage.put("type", "DJ_HANDOVER");
            handoverMessage.put("broadcastId", request.getBroadcastId());
            handoverMessage.put("handover", DJHandoverDTO.fromEntity(savedHandover));
            messagingTemplate.convertAndSend("/topic/broadcast/" + request.getBroadcastId() + "/handover", handoverMessage);
            
            Map<String, Object> currentDJMessage = new HashMap<>();
            currentDJMessage.put("type", "CURRENT_DJ_UPDATE");
            currentDJMessage.put("broadcastId", request.getBroadcastId());
            currentDJMessage.put("currentDJ", UserDTO.fromEntity(newDJ));
            currentDJMessage.put("activeSessionId", activeSessionId);
            messagingTemplate.convertAndSend("/topic/broadcast/" + request.getBroadcastId() + "/current-dj", currentDJMessage);
            
            // 11. Log authentication event
            logger.info("DJ handover with account switch: Broadcast {} from DJ {} to DJ {}", 
                    request.getBroadcastId(),
                    currentActiveDJ != null ? currentActiveDJ.getEmail() : "none",
                    newDJ.getEmail());
            
            // 12. Return response
            Map<String, Object> responseBody = new HashMap<>();
            responseBody.put("success", true);
            responseBody.put("user", UserDTO.fromEntity(newDJ));
            responseBody.put("handover", DJHandoverDTO.fromEntity(savedHandover));
            responseBody.put("activeSessionId", activeSessionId);
            responseBody.put("isBroadcastingSession", true);
            
            return ResponseEntity.ok(responseBody);
            
        } catch (IllegalArgumentException e) {
            logger.warn("Handover-login failed: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", e.getMessage());
            errorResponse.put("code", "HANDOVER_FAILED");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
        } catch (Exception e) {
            logger.error("Unexpected error during handover-login", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "An unexpected error occurred");
            errorResponse.put("code", "INTERNAL_ERROR");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logoutUser(Authentication authentication, HttpServletRequest request, HttpServletResponse response) {
        try {
            // Always attempt to clear auth cookies, even if the backend does not currently
            // see the user as authenticated. This keeps logout idempotent and fixes cases
            // where Google OAuth cookies exist in the browser but the JWT filter rejected
            // the token for this particular request.
            clearAuthCookies(request, response);

            // If there's no authenticated user, we still consider this a successful logout
            // from the client perspective.
            if (authentication == null) {
                logger.warn("Logout attempt without authentication - cookies cleared");
                Map<String, Object> responseBody = new HashMap<>();
                responseBody.put("success", true);
                responseBody.put("message", "Logged out (no active session)");
                return ResponseEntity.ok(responseBody);
            }

            UserEntity user = userService.getUserByEmail(authentication.getName())
                    .orElse(null);
            
            if (user == null) {
                logger.warn("Logout attempt for non-existent user: {}", authentication.getName());
                Map<String, Object> responseBody = new HashMap<>();
                responseBody.put("success", true);
                responseBody.put("message", "Logged out (user not found)");
                return ResponseEntity.ok(responseBody);
            }

            // Check if user is active DJ of LIVE broadcast
            Optional<BroadcastEntity> activeBroadcast = broadcastRepository
                .findByCurrentActiveDJAndStatus(user, BroadcastEntity.BroadcastStatus.LIVE);
            
            if (activeBroadcast.isPresent()) {
                BroadcastEntity broadcast = activeBroadcast.get();
                logger.warn("Logout blocked: User {} (ID: {}) attempted to logout while actively broadcasting broadcast {} (ID: {})", 
                    user.getEmail(), user.getId(), broadcast.getTitle(), broadcast.getId());
                
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("success", false);
                errorResponse.put("error", "Cannot logout while actively broadcasting. Please hand over the broadcast first.");
                errorResponse.put("code", "LOGOUT_FORBIDDEN_ACTIVE_DJ");
                errorResponse.put("broadcastId", broadcast.getId());
                errorResponse.put("broadcastTitle", broadcast.getTitle());
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(errorResponse);
            }

            logger.info("User {} (ID: {}) logged out successfully", user.getEmail(), user.getId());
            
            Map<String, Object> successResponse = new HashMap<>();
            successResponse.put("success", true);
            successResponse.put("message", "Logged out successfully");
            return ResponseEntity.ok(successResponse);
            
        } catch (Exception e) {
            logger.error("Unexpected error during logout", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "An unexpected error occurred during logout");
            errorResponse.put("code", "LOGOUT_ERROR");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    /**
     * Clear authentication cookies for both standard login and Google OAuth flows.
     *
     * This mirrors the cookie attributes used when issuing cookies in SecurityConfig's
     * OAuth2 success handler (domain, Secure, SameSite) and also clears legacy host-only
     * cookies that may have been created without an explicit domain.
     */
    private void clearAuthCookies(HttpServletRequest request, HttpServletResponse response) {
        // Derive root domain similarly to SecurityConfig#setCookieDomain/extractRootDomain
        String host = request.getHeader("Host");
        if (host == null || host.isEmpty()) {
            host = request.getServerName();
        }

        String domain = host != null ? host.split(":")[0] : null;
        String rootDomain = null;

        boolean isLocalhost = (domain == null) || domain.contains("localhost") || domain.contains("127.0.0.1");

        if (!isLocalhost) {
            // Handle common two-part TLDs first (e.g., example.co.uk)
            String[] twoPartTlds = {".co.uk", ".com.au", ".co.za", ".co.nz", ".com.br", ".co.jp"};
            boolean matchedTwoPart = false;
            for (String tld : twoPartTlds) {
                if (domain.endsWith(tld)) {
                    String withoutTld = domain.substring(0, domain.length() - tld.length());
                    int lastDot = withoutTld.lastIndexOf('.');
                    if (lastDot > 0) {
                        rootDomain = withoutTld.substring(lastDot + 1) + tld;
                    } else {
                        rootDomain = domain;
                    }
                    matchedTwoPart = true;
                    break;
                }
            }

            if (!matchedTwoPart) {
                String[] parts = domain.split("\\.");
                if (parts.length >= 2) {
                    rootDomain = parts[parts.length - 2] + "." + parts[parts.length - 1];
                } else {
                    rootDomain = domain;
                }
            }
        }

        // For cookie deletion, be strict: on any non-localhost domain, always use
        // Secure + SameSite=None so that we successfully overwrite OAuth cookies
        // that were issued with those attributes.
        boolean shouldUseSecureCookies = !isLocalhost;

        // Small debug header to help diagnose production cookie issues if needed
        try {
            response.addHeader("X-Logout-Debug", String.format("domain=%s;root=%s;secure=%s", domain, rootDomain, shouldUseSecureCookies));
        } catch (Exception ignored) {
            // avoid breaking logout if headers are already committed
        }

        // Helper to add both root-domain and host-only deletion cookies
        addDeletionCookie("token", shouldUseSecureCookies, rootDomain, response);
        addDeletionCookie("userId", shouldUseSecureCookies, rootDomain, response);
        addDeletionCookie("userRole", shouldUseSecureCookies, rootDomain, response);
    }

    private void addDeletionCookie(String name, boolean shouldUseSecureCookies, String rootDomain, HttpServletResponse response) {
        // Root-domain deletion cookie (matches OAuth2 cookies)
        if (rootDomain != null && !rootDomain.isEmpty()) {
            Cookie cookie = new Cookie(name, "");
            cookie.setHttpOnly(true);
            cookie.setSecure(shouldUseSecureCookies);
            cookie.setPath("/");
            cookie.setMaxAge(0);
            cookie.setAttribute("SameSite", shouldUseSecureCookies ? "None" : "Lax");
            cookie.setDomain(rootDomain);
            response.addCookie(cookie);
        }

        // Host-only deletion cookie for legacy sessions (no explicit domain)
        Cookie hostOnlyCookie = new Cookie(name, "");
        hostOnlyCookie.setHttpOnly(true);
        hostOnlyCookie.setSecure(shouldUseSecureCookies);
        hostOnlyCookie.setPath("/");
        hostOnlyCookie.setMaxAge(0);
        hostOnlyCookie.setAttribute("SameSite", shouldUseSecureCookies ? "None" : "Lax");
        response.addCookie(hostOnlyCookie);
    }

    @PostMapping("/verify")
    public ResponseEntity<String> verifyEmail(@RequestParam String email, @RequestParam String code) {
        boolean verified = userService.verifyCode(email, code);
        if (verified) {
            return ResponseEntity.ok("Email verified successfully");
        } else {
            return ResponseEntity.badRequest().body("Invalid verification code");
        }
    }

    @PostMapping("/send-code")
    public ResponseEntity<String> sendVerificationCode(@RequestParam String email) {
        userService.sendVerificationCode(email);
        return ResponseEntity.ok("Verification code sent to " + email);
    }

    @PostMapping("/{id}/change-password")
    public ResponseEntity<String> changePassword(
            @PathVariable Long id,
            @RequestBody ChangePasswordRequest request,
            Authentication authentication) {
        // Get the email of the currently authenticated user
        String currentUserEmail = authentication.getName();

        // Check if the user is attempting to change their own password
        UserEntity user = userService.findById(id);
        if (!user.getEmail().equals(currentUserEmail)) {
            return ResponseEntity.status(403).body("You are not authorized to change this user's password");
        }

        boolean success = userService.changePassword(id, request.getCurrentPassword(), request.getNewPassword());
        if (success) {
            return ResponseEntity.ok("Password changed successfully");
        } else {
            return ResponseEntity.badRequest().body("Current password is incorrect");
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserDTO> updateProfile(
            @PathVariable Long id,
            @RequestBody UserDTO updatedInfo) {
        UserEntity updated = userService.updateProfile(id, updatedInfo);
        return ResponseEntity.ok(UserDTO.fromEntity(updated));
    }

    @PutMapping("/{id}/role")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserDTO> updateUserRole(
            @PathVariable Long id,
            @RequestParam UserEntity.UserRole newRole) {
        UserEntity updated = userService.updateUserRole(id, newRole);
        return ResponseEntity.ok(UserDTO.fromEntity(updated));
    }

    @PutMapping("/{id}/role/by-actor")
    @PreAuthorize("hasAnyRole('ADMIN','MODERATOR')")
    public ResponseEntity<UserDTO> updateUserRoleByActor(
            @PathVariable Long id,
            @RequestParam UserEntity.UserRole newRole,
            Authentication authentication) {
        String actorEmail = authentication.getName();
        UserEntity actor = userService.getUserByEmail(actorEmail).orElse(null);
        try {
            UserEntity updated = userService.updateUserRoleByActor(id, newRole, actor);
            return ResponseEntity.ok(UserDTO.fromEntity(updated));
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserDTO> getUserById(@PathVariable Long id) {
        return userService.getUserById(id)
                .map(user -> ResponseEntity.ok(UserDTO.fromEntity(user)))
                .orElse(ResponseEntity.notFound().build());
    }

    

    @GetMapping("/paged")
    @PreAuthorize("hasAnyRole('ADMIN','MODERATOR')")
    public ResponseEntity<Page<UserDTO>> getUsersPaged(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String roleFilter) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, size));
        Page<UserDTO> dtoPage = userService.findAllUsers(query, roleFilter, pageable).map(UserDTO::fromEntity);
        return ResponseEntity.ok(dtoPage);
    }

    @GetMapping("/by-role/{role}")
    @PreAuthorize("hasAnyRole('DJ','ADMIN','MODERATOR')")
    public ResponseEntity<List<UserDTO>> getUsersByRole(@PathVariable UserEntity.UserRole role) {
        List<UserDTO> users = userService.findUsersByRole(role).stream()
                .map(UserDTO::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(users);
    }

    @GetMapping("/by-email")
    @PreAuthorize("hasAnyRole('ADMIN','MODERATOR')")
    public ResponseEntity<UserDTO> getUserByEmail(@RequestParam String email) {
        return userService.getUserByEmail(email)
                .map(user -> ResponseEntity.ok(UserDTO.fromEntity(user)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/exists")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Boolean> checkEmailExists(@RequestParam String email) {
        boolean exists = userService.existsByEmail(email);
        return ResponseEntity.ok(exists);
    }

    @GetMapping("/me")
    public ResponseEntity<UserDTO> getCurrentUser(Authentication authentication) {
        if (authentication == null) {
            return ResponseEntity.status(401).build();
        }
        String email = authentication.getName();
        return userService.getUserByEmail(email)
                .map(user -> ResponseEntity.ok(UserDTO.fromEntity(user)))
                .orElse(ResponseEntity.notFound().build());
    }

    // Partial update for current user's notification preferences
    @PutMapping("/me/preferences")
    public ResponseEntity<UserDTO> updateMyPreferences(
            Authentication authentication,
            @RequestBody UserDTO prefs) {
        if (authentication == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        String email = authentication.getName();
        UserEntity user = userService.getUserByEmail(email).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        // Reuse updateProfile to apply provided preference fields
        UserDTO patch = new UserDTO();
        patch.setNotifyBroadcastStart(prefs.getNotifyBroadcastStart());
        patch.setNotifyBroadcastReminders(prefs.getNotifyBroadcastReminders());
        patch.setNotifyNewSchedule(prefs.getNotifyNewSchedule());
        patch.setNotifySystemUpdates(prefs.getNotifySystemUpdates());
        UserEntity updated = userService.updateProfile(user.getId(), patch);
        return ResponseEntity.ok(UserDTO.fromEntity(updated));
    }

    @PostMapping("/{id}/ban")
    @PreAuthorize("hasAnyRole('ADMIN','MODERATOR','DJ')")
    public ResponseEntity<UserDTO> banUser(
            @PathVariable Long id,
            @RequestBody BanRequest request,
            Authentication authentication) {
        String actorEmail = authentication.getName();
        UserEntity actor = userService.getUserByEmail(actorEmail).orElse(null);
        try {
            UserEntity updated = userService.banUser(id, request, actor);
            return ResponseEntity.ok(UserDTO.fromEntity(updated));
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/{id}/unban")
    @PreAuthorize("hasAnyRole('ADMIN','MODERATOR','DJ')")
    public ResponseEntity<UserDTO> unbanUser(
            @PathVariable Long id,
            Authentication authentication) {
        String actorEmail = authentication.getName();
        UserEntity actor = userService.getUserByEmail(actorEmail).orElse(null);
        try {
            UserEntity updated = userService.unbanUser(id, actor);
            return ResponseEntity.ok(UserDTO.fromEntity(updated));
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Enhanced handover permission validation for long broadcast scenarios
     */
    private boolean validateHandoverPermission(UserEntity initiator, BroadcastEntity broadcast) {
        // Admin/Mod override always allowed
        if (initiator.getRole() == UserEntity.UserRole.ADMIN ||
            initiator.getRole() == UserEntity.UserRole.MODERATOR) {
            return true;
        }

        // For DJs, multiple validation paths
        if (initiator.getRole() == UserEntity.UserRole.DJ) {
            UserEntity currentActiveDJ = broadcast.getCurrentActiveDJ();

            // Path 1: Standard check (current active DJ)
            if (currentActiveDJ != null && currentActiveDJ.getId().equals(initiator.getId())) {
                return true;
            }

            // Path 2: Long broadcast persistent auth scenario
            if (isValidPersistentAuthScenario(initiator, broadcast)) {
                return true;
            }

            // Path 3: Recent activity fallback (check last 24 hours)
            if (wasRecentlyActiveInBroadcast(initiator, broadcast)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if this is a long broadcast scenario where persistent auth should be allowed
     */
    private boolean isValidPersistentAuthScenario(UserEntity initiator, BroadcastEntity broadcast) {
        if (broadcast.getActualStart() == null) return false;

        Duration duration = Duration.between(broadcast.getActualStart(), LocalDateTime.now());
        boolean isLongBroadcast = duration.toHours() >= 4; // 4+ hour threshold

        // For long broadcasts, allow handover if initiator is active DJ
        // The persistent auth system ensures only authorized DJs remain logged in
        return isLongBroadcast && initiator.getRole() == UserEntity.UserRole.DJ && initiator.isActive();
    }

    /**
     * Check if initiator was recently active in this broadcast (fallback for edge cases)
     */
    private boolean wasRecentlyActiveInBroadcast(UserEntity initiator, BroadcastEntity broadcast) {
        try {
            List<DJHandoverEntity> recentActivity = handoverRepository
                .findByBroadcast_IdAndInitiatedBy_IdAndHandoverTimeAfter(
                    broadcast.getId(),
                    initiator.getId(),
                    LocalDateTime.now().minusHours(24)
                );
            return !recentActivity.isEmpty();
        } catch (Exception e) {
            logger.warn("Error checking recent activity for handover permission", e);
            return false;
        }
    }

}
