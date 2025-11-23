package com.wildcastradio.User;

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
            
            // 2. Validate new DJ exists and has DJ role
            UserEntity newDJ = userRepository.findById(request.getNewDJId())
                    .orElseThrow(() -> new IllegalArgumentException("New DJ not found"));
            
            if (newDJ.getRole() != UserEntity.UserRole.DJ) {
                throw new IllegalArgumentException("New DJ must have DJ role");
            }
            
            if (!newDJ.isActive()) {
                throw new IllegalArgumentException("New DJ must be active");
            }
            
            // 3. Authenticate new DJ with password
            if (!passwordEncoder.matches(request.getPassword(), newDJ.getPassword())) {
                logger.warn("Handover-login authentication failed: Invalid password for DJ {}", newDJ.getEmail());
                throw new IllegalArgumentException("Invalid password for selected DJ");
            }
            
            // 4. Validate handover permissions (same as current system)
            UserEntity currentActiveDJ = broadcast.getCurrentActiveDJ();
            boolean hasPermission = false;
            
            if (initiator.getRole() == UserEntity.UserRole.ADMIN || initiator.getRole() == UserEntity.UserRole.MODERATOR) {
                hasPermission = true;
            } else if (initiator.getRole() == UserEntity.UserRole.DJ && currentActiveDJ != null 
                    && currentActiveDJ.getId().equals(initiator.getId())) {
                hasPermission = true;
            }
            
            if (!hasPermission) {
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
            
            DJHandoverEntity savedHandover = handoverRepository.save(handover);
            
            // 7. Update broadcast's current active DJ
            broadcast.setCurrentActiveDJ(newDJ);
            broadcastRepository.save(broadcast);
            
            // 8. Generate new JWT token for new DJ
            UserDetails userDetails = userService.loadUserByUsername(newDJ.getEmail());
            String token = jwtUtil.generateToken(userDetails);
            
            // 9. Set HttpOnly cookies with new token
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
    public ResponseEntity<String> logoutUser(HttpServletResponse response) {
        // Clear all authentication cookies
        Cookie tokenCookie = new Cookie("token", "");
        tokenCookie.setHttpOnly(true);
        tokenCookie.setSecure(useSecureCookies);
        tokenCookie.setPath("/");
        tokenCookie.setMaxAge(0); // Expire immediately
        tokenCookie.setAttribute("SameSite", useSecureCookies ? "None" : "Lax");
        response.addCookie(tokenCookie);
        
        Cookie userIdCookie = new Cookie("userId", "");
        userIdCookie.setHttpOnly(true);
        userIdCookie.setSecure(useSecureCookies);
        userIdCookie.setPath("/");
        userIdCookie.setMaxAge(0); // Expire immediately
        userIdCookie.setAttribute("SameSite", useSecureCookies ? "None" : "Lax");
        response.addCookie(userIdCookie);
        
        Cookie userRoleCookie = new Cookie("userRole", "");
        userRoleCookie.setHttpOnly(true);
        userRoleCookie.setSecure(useSecureCookies);
        userRoleCookie.setPath("/");
        userRoleCookie.setMaxAge(0); // Expire immediately
        userRoleCookie.setAttribute("SameSite", useSecureCookies ? "None" : "Lax");
        response.addCookie(userRoleCookie);
        
        return ResponseEntity.ok("Logged out successfully");
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
            @RequestParam(defaultValue = "15") int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, size));
        Page<UserDTO> dtoPage = userService.findAllUsers(pageable).map(UserDTO::fromEntity);
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

}
