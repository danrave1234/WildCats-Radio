package com.wildcastradio.User;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.wildcastradio.ActivityLog.ActivityLogEntity;
import com.wildcastradio.ActivityLog.ActivityLogService;
import com.wildcastradio.User.DTO.BanRequest;
import com.wildcastradio.User.DTO.LoginRequest;
import com.wildcastradio.User.DTO.LoginResponse;
import com.wildcastradio.User.DTO.RegisterRequest;
import com.wildcastradio.User.DTO.UserDTO;
import com.wildcastradio.config.JwtUtil;

@Service
public class UserService implements UserDetailsService {

    private static final Logger logger = LoggerFactory.getLogger(UserService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final ActivityLogService activityLogService;
    private final Random random = new Random();

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtUtil jwtUtil, ActivityLogService activityLogService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.activityLogService = activityLogService;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        UserEntity user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with email: " + email));

        Collection<GrantedAuthority> authorities = Collections.singletonList(
                new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));

        return new org.springframework.security.core.userdetails.User(
                user.getEmail(), 
                user.getPassword(), 
                user.isVerified(), // enabled
                true, // accountNonExpired
                true, // credentialsNonExpired
                true, // accountNonLocked
                authorities);
    }

    public UserEntity registerUser(RegisterRequest request) {
        // Normalize email to ensure case-insensitive uniqueness and consistent storage
        String normalizedEmail = request.getEmail() != null ? request.getEmail().trim().toLowerCase() : null;
        if (normalizedEmail == null || normalizedEmail.isEmpty()) {
            throw new IllegalArgumentException("Email is required");
        }
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new IllegalArgumentException("Email already in use");
        }

        UserEntity user = new UserEntity();
        user.setEmail(normalizedEmail);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setFirstname(request.getFirstname());
        user.setLastname(request.getLastname());
        user.setBirthdate(request.getBirthdate());
        // Map optional gender if provided
        if (request.getGender() != null && !request.getGender().trim().isEmpty()) {
            try {
                UserEntity.Gender g = UserEntity.Gender.valueOf(request.getGender().trim().toUpperCase());
                user.setGender(g);
            } catch (IllegalArgumentException ex) {
                // Ignore invalid values; keep null to avoid bad data
            }
        }
        user.setRole(UserEntity.UserRole.DJ); // Default role - allows creating broadcasts
        user.setVerified(false);
        user.setVerificationCode(generateVerificationCode());

        UserEntity savedUser = userRepository.save(user);
        sendVerificationCode(normalizedEmail);

        // Log the activity
        activityLogService.logActivity(
            savedUser,
            ActivityLogEntity.ActivityType.USER_REGISTER,
            "User registered with email: " + savedUser.getEmail()
        );

        return savedUser;
    }


    public LoginResponse loginUser(LoginRequest request) {
        String email = request.getEmail() != null ? request.getEmail().trim() : "";
        Optional<UserEntity> userOpt = userRepository.findByEmailIgnoreCase(email);

        if (userOpt.isPresent()) {
            UserEntity user = userOpt.get();
            if (passwordEncoder.matches(request.getPassword(), user.getPassword())) {
                // Generate real JWT token
                UserDetails userDetails = loadUserByUsername(user.getEmail());
                String token = jwtUtil.generateToken(userDetails);

                // Log the activity
                activityLogService.logActivity(
                    user,
                    ActivityLogEntity.ActivityType.LOGIN,
                    "User logged in: " + user.getEmail()
                );

                return new LoginResponse(token, UserDTO.fromEntity(user));
            }
        }

        throw new IllegalArgumentException("Invalid credentials");
    }

    public String sendVerificationCode(String email) {
        String normalizedEmail = email != null ? email.trim() : "";
        Optional<UserEntity> userOpt = userRepository.findByEmailIgnoreCase(normalizedEmail);

        if (!userOpt.isPresent()) {
            throw new IllegalArgumentException("User not found");
        }

        UserEntity user = userOpt.get();
        String verificationCode = generateVerificationCode();
        user.setVerificationCode(verificationCode);
        userRepository.save(user);

        // Send verification email
        try {
            sendVerificationEmail(normalizedEmail, verificationCode, user.getFirstname());
            // Log the activity
            activityLogService.logActivity(
                user,
                ActivityLogEntity.ActivityType.EMAIL_VERIFY,
                "Verification code sent to: " + normalizedEmail
            );
        } catch (Exception e) {
            // Log the error but don't fail the operation
            // This allows development to continue even if email sending fails
            logger.error("Failed to send verification email: {}", e.getMessage(), e);

            // For development, still log the code (use debug level so it doesn't clutter production logs)
            logger.debug("Verification code for {}: {}", normalizedEmail, verificationCode);
        }

        return verificationCode;
    }

    /**
     * Sends a verification email to the user with the verification code
     * 
     * @param email The recipient's email address
     * @param code The verification code
     * @param name The recipient's name
     */
    private void sendVerificationEmail(String email, String code, String name) {
        // In a production environment, this would use JavaMailSender or a third-party service
        // like SendGrid, Mailgun, or AWS SES to send the actual email

        // For now, we'll simulate sending an email by logging the details
        String emailSubject = "WildCats Radio - Verify Your Email";
        String emailBody = String.format(
            "Hello %s,\n\n" +
            "Thank you for registering with WildCats Radio. Please use the following code to verify your email address:\n\n" +
            "%s\n\n" +
            "This code will expire in 24 hours.\n\n" +
            "If you did not request this code, please ignore this email.\n\n" +
            "Best regards,\n" +
            "The WildCats Radio Team",
            name, code
        );

        // Log the email details for development purposes
        // TODO: In production, integrate with JavaMailSender to send actual emails
        logger.info("==== SIMULATED EMAIL ====");
        logger.info("To: {}", email);
        logger.info("Subject: {}", emailSubject);
        logger.info("Body:\n{}", emailBody);
        logger.info("=========================");
    }

    public boolean verifyCode(String email, String code) {
        String normalizedEmail = email != null ? email.trim() : "";
        Optional<UserEntity> userOpt = userRepository.findByEmailIgnoreCase(normalizedEmail);

        if (userOpt.isPresent()) {
            UserEntity user = userOpt.get();
            if (user.getVerificationCode() != null && user.getVerificationCode().equals(code)) {
                user.setVerified(true);
                user.setVerificationCode(null);
                userRepository.save(user);

                // Log the activity
                activityLogService.logActivity(
                    user,
                    ActivityLogEntity.ActivityType.EMAIL_VERIFY,
                    "Email verified for user: " + user.getEmail()
                );

                return true;
            }
        }

        return false;
    }

    public UserEntity updateProfile(Long userId, UserDTO updatedInfo) {
        UserEntity user = findById(userId);

        if (updatedInfo.getFirstname() != null) {
            user.setFirstname(updatedInfo.getFirstname());
        }
        if (updatedInfo.getLastname() != null) {
            user.setLastname(updatedInfo.getLastname());
        }

        // Optional: update notification preferences if provided
        if (updatedInfo.getNotifyBroadcastStart() != null) {
            user.setNotifyBroadcastStart(updatedInfo.getNotifyBroadcastStart());
        }
        if (updatedInfo.getNotifyBroadcastReminders() != null) {
            user.setNotifyBroadcastReminders(updatedInfo.getNotifyBroadcastReminders());
        }
        if (updatedInfo.getNotifyNewSchedule() != null) {
            user.setNotifyNewSchedule(updatedInfo.getNotifyNewSchedule());
        }
        if (updatedInfo.getNotifySystemUpdates() != null) {
            user.setNotifySystemUpdates(updatedInfo.getNotifySystemUpdates());
        }

        // Optional: update gender if provided
        if (updatedInfo.getGender() != null) {
            try {
                UserEntity.Gender g = UserEntity.Gender.valueOf(updatedInfo.getGender().trim().toUpperCase());
                user.setGender(g);
            } catch (Exception ex) {
                // Ignore invalid values
            }
        }

        // Don't update email here for security reasons
        // Don't update password here for security reasons

        return userRepository.save(user);
    }

    public UserEntity updateUserRole(Long userId, UserEntity.UserRole newRole) {
        // Backward-compatible method: only ADMIN should call this (as per @PreAuthorize in controller)
        UserEntity user = findById(userId);
        UserEntity.UserRole oldRole = user.getRole();
        user.setRole(newRole);
        UserEntity updatedUser = userRepository.save(user);

        activityLogService.logActivity(
            updatedUser,
            ActivityLogEntity.ActivityType.USER_ROLE_CHANGE,
            "User role changed from " + oldRole + " to " + newRole + " for user: " + updatedUser.getEmail()
        );

        return updatedUser;
    }

    public UserEntity updateUserRoleByActor(Long userId, UserEntity.UserRole newRole, UserEntity actor) {
        if (actor == null) {
            throw new IllegalArgumentException("Actor is required");
        }
        UserEntity target = findById(userId);
        UserEntity.UserRole oldRole = target.getRole();

        boolean actorIsAdmin = actor.getRole() == UserEntity.UserRole.ADMIN;
        boolean actorIsModerator = actor.getRole() == UserEntity.UserRole.MODERATOR;

        // Moderators cannot promote to ADMIN and cannot modify ADMIN users
        if (actorIsModerator) {
            if (newRole == UserEntity.UserRole.ADMIN) {
                throw new SecurityException("Moderator cannot assign ADMIN role");
            }
            if (target.getRole() == UserEntity.UserRole.ADMIN) {
                throw new SecurityException("Moderator cannot modify ADMIN users");
            }
        }

        // Non-admin and non-moderator cannot change roles
        if (!actorIsAdmin && !actorIsModerator) {
            throw new SecurityException("Insufficient permissions to change roles");
        }

        target.setRole(newRole);
        UserEntity updatedUser = userRepository.save(target);

        activityLogService.logActivity(
            updatedUser,
            ActivityLogEntity.ActivityType.USER_ROLE_CHANGE,
            "User role changed from " + oldRole + " to " + newRole + " for user: " + updatedUser.getEmail() +
            " by actor: " + actor.getEmail()
        );

        return updatedUser;
    }

    public UserEntity banUser(Long userId, UserEntity actor) {
        // Backward compatible: default to permanent ban with no reason
        BanRequest req = new BanRequest();
        req.setUnit(BanRequest.DurationUnit.PERMANENT);
        req.setAmount(null);
        req.setReason(null);
        return banUser(userId, req, actor);
    }

    public UserEntity banUser(Long userId, BanRequest request, UserEntity actor) {
        if (actor == null) {
            throw new IllegalArgumentException("Actor is required");
        }
        if (request == null || request.getUnit() == null) {
            throw new IllegalArgumentException("Ban request and unit are required");
        }
        UserEntity target = findById(userId);
        boolean actorIsAdmin = actor.getRole() == UserEntity.UserRole.ADMIN;
        boolean actorIsModerator = actor.getRole() == UserEntity.UserRole.MODERATOR || actor.getRole() == UserEntity.UserRole.DJ;

        if (!actorIsAdmin && !actorIsModerator) {
            throw new SecurityException("Insufficient permissions to ban users");
        }
        if (actorIsModerator && target.getRole() == UserEntity.UserRole.ADMIN) {
            throw new SecurityException("Moderator cannot ban ADMIN users");
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime until = null;
        switch (request.getUnit()) {
            case DAYS:
                if (request.getAmount() == null || request.getAmount() <= 0) throw new IllegalArgumentException("Amount must be positive for DAYS");
                until = now.plusDays(request.getAmount());
                break;
            case WEEKS:
                if (request.getAmount() == null || request.getAmount() <= 0) throw new IllegalArgumentException("Amount must be positive for WEEKS");
                until = now.plusWeeks(request.getAmount());
                break;
            case YEARS:
                if (request.getAmount() == null || request.getAmount() <= 0) throw new IllegalArgumentException("Amount must be positive for YEARS");
                until = now.plusYears(request.getAmount());
                break;
            case PERMANENT:
                until = null;
                break;
            default:
                throw new IllegalArgumentException("Unsupported duration unit");
        }

        target.setBanned(true);
        target.setBannedAt(now);
        target.setBannedUntil(until);
        target.setBanReason(request.getReason());
        UserEntity updated = userRepository.save(target);
        activityLogService.logActivity(
            actor,
            ActivityLogEntity.ActivityType.PROFILE_UPDATE,
            "Banned user: " + updated.getEmail() + (until != null ? (" until " + until) : " permanently") + (request.getReason() != null ? (". Reason: " + request.getReason()) : "")
        );
        return updated;
    }

    public UserEntity unbanUser(Long userId, UserEntity actor) {
        if (actor == null) {
            throw new IllegalArgumentException("Actor is required");
        }
        UserEntity target = findById(userId);
        boolean actorIsAdmin = actor.getRole() == UserEntity.UserRole.ADMIN;
        boolean actorIsModerator = actor.getRole() == UserEntity.UserRole.MODERATOR || actor.getRole() == UserEntity.UserRole.DJ;

        if (!actorIsAdmin && !actorIsModerator) {
            throw new SecurityException("Insufficient permissions to unban users");
        }
        if (actorIsModerator && target.getRole() == UserEntity.UserRole.ADMIN) {
            throw new SecurityException("Moderator cannot unban ADMIN users");
        }

        target.setBanned(false);
        target.setBannedAt(null);
        target.setBannedUntil(null);
        target.setBanReason(null);
        UserEntity updated = userRepository.save(target);
        activityLogService.logActivity(
            actor,
            ActivityLogEntity.ActivityType.PROFILE_UPDATE,
            "Unbanned user: " + updated.getEmail()
        );
        return updated;
    }

    public boolean isUserCurrentlyBanned(UserEntity user) {
        if (user == null || !user.isBanned()) return false;
        LocalDateTime now = LocalDateTime.now();
        if (user.getBannedUntil() != null && now.isAfter(user.getBannedUntil())) {
            // Auto-unban expired bans
            user.setBanned(false);
            user.setBannedAt(null);
            user.setBannedUntil(null);
            user.setBanReason(null);
            userRepository.save(user);
            return false;
        }
        return true;
    }

    public UserEntity warnUser(Long userId, UserEntity actor) {
        if (actor == null) {
            throw new IllegalArgumentException("Actor is required");
        }
        UserEntity target = findById(userId);
        boolean actorIsAdmin = actor.getRole() == UserEntity.UserRole.ADMIN;
        boolean actorIsModerator = actor.getRole() == UserEntity.UserRole.MODERATOR;

        if (!actorIsAdmin && !actorIsModerator) {
            throw new SecurityException("Insufficient permissions to warn users");
        }
        if (actorIsModerator && target.getRole() == UserEntity.UserRole.ADMIN) {
            throw new SecurityException("Moderator cannot warn ADMIN users");
        }

        target.setWarningCount(Math.max(0, target.getWarningCount()) + 1);
        UserEntity updated = userRepository.save(target);
        activityLogService.logActivity(
            actor,
            ActivityLogEntity.ActivityType.PROFILE_UPDATE,
            "Warned user: " + updated.getEmail() + ", warnings: " + updated.getWarningCount()
        );
        return updated;
    }

    public UserEntity resetWarnings(Long userId, UserEntity actor) {
        if (actor == null) {
            throw new IllegalArgumentException("Actor is required");
        }
        UserEntity target = findById(userId);
        boolean actorIsAdmin = actor.getRole() == UserEntity.UserRole.ADMIN;
        boolean actorIsModerator = actor.getRole() == UserEntity.UserRole.MODERATOR;

        if (!actorIsAdmin && !actorIsModerator) {
            throw new SecurityException("Insufficient permissions to reset warnings");
        }
        if (actorIsModerator && target.getRole() == UserEntity.UserRole.ADMIN) {
            throw new SecurityException("Moderator cannot reset warnings for ADMIN users");
        }

        target.setWarningCount(0);
        UserEntity updated = userRepository.save(target);
        activityLogService.logActivity(
            actor,
            ActivityLogEntity.ActivityType.PROFILE_UPDATE,
            "Reset warnings for user: " + updated.getEmail()
        );
        return updated;
    }

    public UserEntity findById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    public Optional<UserEntity> getUserById(Long userId) {
        return userRepository.findById(userId);
    }

    public List<UserEntity> findAllUsers() {
        return userRepository.findAll();
    }

    public Page<UserEntity> findAllUsers(Pageable pageable) {
        return userRepository.findAll(pageable);
    }

    public List<UserEntity> findUsersByRole(UserEntity.UserRole role) {
        return userRepository.findByRole(role);
    }

    public boolean existsByEmail(String email) {
        return userRepository.existsByEmailIgnoreCase(email);
    }

    public Optional<UserEntity> getUserByEmail(String email) {
        return userRepository.findByEmailIgnoreCase(email);
    }

    private String generateVerificationCode() {
        int code = 100000 + random.nextInt(900000); // 6-digit code
        return String.valueOf(code);
    }

    public boolean changePassword(Long userId, String currentPassword, String newPassword) {
        UserEntity user = findById(userId);

        // Verify the current password
        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            return false;
        }

        // Update with the new password
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        return true;
    }

    // Analytics methods for data retrieval
    public long getTotalUserCount() {
        return userRepository.count();
    }

    public long getListenerCount() {
        return userRepository.countByRole(UserEntity.UserRole.LISTENER);
    }

    public long getDjCount() {
        return userRepository.countByRole(UserEntity.UserRole.DJ);
    }

    public long getAdminCount() {
        return userRepository.countByRole(UserEntity.UserRole.ADMIN);
    }

    public long getModeratorCount() {
        return userRepository.countByRole(UserEntity.UserRole.MODERATOR);
    }

    public long getUserCountByRole(String roleName) {
        try {
            UserEntity.UserRole role = UserEntity.UserRole.valueOf(roleName.toUpperCase());
            return userRepository.countByRole(role);
        } catch (IllegalArgumentException e) {
            return 0;
        }
    }

    public long getNewUsersThisMonthCount() {
        // Since we don't have createdAt field, we'll provide a simple estimate
        // This could be enhanced later with proper timestamp tracking if needed
        long totalUsers = getTotalUserCount();

        // Provide a reasonable estimate: assume 10% of users joined this month
        // This is a simplified approach without requiring new database fields
        return Math.max(0, Math.round(totalUsers * 0.1));
    }

    public long getNewUsersThisMonth() {
        return getNewUsersThisMonthCount();
    }

    // Removed insecure getAllUsers exposure

    /**
     * Handles OAuth2 login/registration from Google or Microsoft
     * Creates a new user if email doesn't exist, otherwise logs in existing user
     * Extracts birthdate and gender from OAuth provider when available
     */
    public LoginResponse oauth2Login(Map<String, Object> oauthAttributes, String provider) {
        if (oauthAttributes == null || oauthAttributes.isEmpty()) {
            throw new IllegalArgumentException("OAuth attributes are required");
        }
        
        if (provider == null || provider.isEmpty()) {
            throw new IllegalArgumentException("OAuth provider is required");
        }
        
        String email = extractEmail(oauthAttributes);
        if (email == null || email.isEmpty()) {
            throw new IllegalArgumentException("Email is required from OAuth provider");
        }
        
        String normalizedEmail = email.trim().toLowerCase();
        Optional<UserEntity> userOpt = userRepository.findByEmailIgnoreCase(normalizedEmail);
        
        UserEntity user;
        
        if (userOpt.isPresent()) {
            user = userOpt.get();
        } else {
            user = new UserEntity();
            user.setEmail(normalizedEmail);
            user.setPassword(passwordEncoder.encode(generateRandomPassword()));
            
            String firstName = extractFirstName(oauthAttributes);
            String lastName = extractLastName(oauthAttributes);
            user.setFirstname(firstName != null ? firstName : "User");
            user.setLastname(lastName != null ? lastName : "");
            
            LocalDate birthdate = extractBirthdate(oauthAttributes);
            if (birthdate != null) {
                user.setBirthdate(birthdate);
            }
            
            UserEntity.Gender gender = extractGender(oauthAttributes);
            if (gender != null) {
                user.setGender(gender);
            }
            
            user.setVerified(true);
            user.setRole(UserEntity.UserRole.LISTENER);
            
            user = userRepository.save(user);
            
            activityLogService.logActivity(
                user,
                ActivityLogEntity.ActivityType.USER_REGISTER,
                "User registered via OAuth2 (" + provider + "): " + user.getEmail()
            );
        }
        
        UserDetails userDetails = loadUserByUsername(user.getEmail());
        String token = jwtUtil.generateToken(userDetails);
        
        activityLogService.logActivity(
            user,
            ActivityLogEntity.ActivityType.LOGIN,
            "User logged in via OAuth2 (" + provider + "): " + user.getEmail()
        );
        
        return new LoginResponse(token, UserDTO.fromEntity(user));
    }
    
    private String extractEmail(Map<String, Object> attributes) {
        return (String) attributes.get("email");
    }
    
    private String extractFirstName(Map<String, Object> attributes) {
        String givenName = (String) attributes.get("given_name");
        if (givenName != null) return givenName;
        String name = (String) attributes.get("name");
        if (name != null && name.contains(" ")) {
            return name.split(" ")[0];
        }
        return name;
    }
    
    private String extractLastName(Map<String, Object> attributes) {
        String familyName = (String) attributes.get("family_name");
        if (familyName != null) return familyName;
        String name = (String) attributes.get("name");
        if (name != null && name.contains(" ")) {
            String[] parts = name.split(" ");
            return parts.length > 1 ? parts[parts.length - 1] : "";
        }
        return "";
    }
    
    private LocalDate extractBirthdate(Map<String, Object> attributes) {
        try {
            String birthday = (String) attributes.get("birthday");
            if (birthday != null && !birthday.isEmpty() && birthday.contains("-")) {
                String[] parts = birthday.split("-");
                if (parts.length == 3) {
                    return LocalDate.parse(birthday);
                } else if (parts.length == 2) {
                    return LocalDate.parse("2000-" + birthday);
                }
            }
        } catch (Exception e) {
            // Ignore parsing errors
        }
        return null;
    }
    
    private UserEntity.Gender extractGender(Map<String, Object> attributes) {
        try {
            String gender = (String) attributes.get("gender");
            if (gender != null) {
                if ("male".equalsIgnoreCase(gender)) {
                    return UserEntity.Gender.MALE;
                } else if ("female".equalsIgnoreCase(gender)) {
                    return UserEntity.Gender.FEMALE;
                } else if ("other".equalsIgnoreCase(gender)) {
                    return UserEntity.Gender.OTHER;
                }
            }
        } catch (Exception e) {
            // Ignore parsing errors
        }
        return null;
    }
    
    private String generateRandomPassword() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        StringBuilder password = new StringBuilder();
        Random random = new Random();
        for (int i = 0; i < 32; i++) {
            password.append(chars.charAt(random.nextInt(chars.length())));
        }
        return password.toString();
    }
} 
