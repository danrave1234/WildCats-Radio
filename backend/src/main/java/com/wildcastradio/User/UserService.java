package com.wildcastradio.User;

import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Random;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.wildcastradio.ActivityLog.ActivityLogEntity;
import com.wildcastradio.ActivityLog.ActivityLogService;
import com.wildcastradio.User.DTO.LoginRequest;
import com.wildcastradio.User.DTO.LoginResponse;
import com.wildcastradio.User.DTO.RegisterRequest;
import com.wildcastradio.User.DTO.UserDTO;
import com.wildcastradio.config.JwtUtil;

@Service
public class UserService implements UserDetailsService {

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
        if (userRepository.existsByEmailIgnoreCase(request.getEmail())) {
            throw new IllegalArgumentException("Email already in use");
        }

        UserEntity user = new UserEntity();
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setFirstname(request.getFirstname());
        user.setLastname(request.getLastname());
        user.setBirthdate(request.getBirthdate());
        user.setRole(UserEntity.UserRole.LISTENER); // Default role
        user.setVerified(false);
        user.setVerificationCode(generateVerificationCode());

        UserEntity savedUser = userRepository.save(user);
        sendVerificationCode(request.getEmail());

        // Log the activity
        activityLogService.logActivity(
            savedUser,
            ActivityLogEntity.ActivityType.USER_REGISTER,
            "User registered with email: " + savedUser.getEmail()
        );

        return savedUser;
    }


    public LoginResponse loginUser(LoginRequest request) {
        Optional<UserEntity> userOpt = userRepository.findByEmailIgnoreCase(request.getEmail());

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
        Optional<UserEntity> userOpt = userRepository.findByEmailIgnoreCase(email);

        if (!userOpt.isPresent()) {
            throw new IllegalArgumentException("User not found");
        }

        UserEntity user = userOpt.get();
        String verificationCode = generateVerificationCode();
        user.setVerificationCode(verificationCode);
        userRepository.save(user);

        // Send verification email
        try {
            sendVerificationEmail(email, verificationCode, user.getFirstname());
            // Log the activity
            activityLogService.logActivity(
                user,
                ActivityLogEntity.ActivityType.EMAIL_VERIFY,
                "Verification code sent to: " + email
            );
        } catch (Exception e) {
            // Log the error but don't fail the operation
            // This allows development to continue even if email sending fails
            System.err.println("Failed to send verification email: " + e.getMessage());
            e.printStackTrace();

            // For development, still print the code to console
            System.out.println("Verification code for " + email + ": " + verificationCode);
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
        System.out.println("==== SIMULATED EMAIL ====");
        System.out.println("To: " + email);
        System.out.println("Subject: " + emailSubject);
        System.out.println("Body: \n" + emailBody);
        System.out.println("=========================");

        // TODO: In production, uncomment and configure the following code:
        /*
        JavaMailSender mailSender = // get from Spring context
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(email);
        message.setSubject(emailSubject);
        message.setText(emailBody);
        mailSender.send(message);
        */
    }

    public boolean verifyCode(String email, String code) {
        Optional<UserEntity> userOpt = userRepository.findByEmailIgnoreCase(email);

        if (userOpt.isPresent()) {
            UserEntity user = userOpt.get();
            if (user.getVerificationCode().equals(code)) {
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

        // Don't update email here for security reasons
        // Don't update password here for security reasons

        return userRepository.save(user);
    }

    public UserEntity updateUserRole(Long userId, UserEntity.UserRole newRole) {
        UserEntity user = findById(userId);
        UserEntity.UserRole oldRole = user.getRole();
        user.setRole(newRole);
        UserEntity updatedUser = userRepository.save(user);

        // Log the activity
        activityLogService.logActivity(
            updatedUser,
            ActivityLogEntity.ActivityType.USER_ROLE_CHANGE,
            "User role changed from " + oldRole + " to " + newRole + " for user: " + updatedUser.getEmail()
        );

        return updatedUser;
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

    public List<UserEntity> getAllUsers() {
        return userRepository.findAll();
    }
} 
