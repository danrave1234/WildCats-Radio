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
        UserEntity user = userRepository.findByEmail(email)
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
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already in use");
        }

        UserEntity user = new UserEntity();
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setName(request.getName());
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
        Optional<UserEntity> userOpt = userRepository.findByEmail(request.getEmail());

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
        Optional<UserEntity> userOpt = userRepository.findByEmail(email);

        if (!userOpt.isPresent()) {
            throw new IllegalArgumentException("User not found");
        }

        UserEntity user = userOpt.get();
        String verificationCode = generateVerificationCode();
        user.setVerificationCode(verificationCode);
        userRepository.save(user);

        // TODO: Implement actual email sending logic here
        System.out.println("Verification code for " + email + ": " + verificationCode);

        return verificationCode;
    }

    public boolean verifyCode(String email, String code) {
        Optional<UserEntity> userOpt = userRepository.findByEmail(email);

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

        if (updatedInfo.getName() != null) {
            user.setName(updatedInfo.getName());
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
        return userRepository.existsByEmail(email);
    }

    public Optional<UserEntity> getUserByEmail(String email) {
        return userRepository.findByEmail(email);
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
} 
