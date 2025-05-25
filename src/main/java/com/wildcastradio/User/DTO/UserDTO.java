package com.wildcastradio.User.DTO;

import com.wildcastradio.User.UserEntity;

public class UserDTO {
    private Long id;
    private String name;
    private String email;
    private String role;
    
    // Constructors
    public UserDTO() {
    }
    
    public UserDTO(Long id, String name, String email, String role) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.role = role;
    }
    
    // Convert from Entity to DTO
    public static UserDTO fromEntity(UserEntity user) {
        if (user == null) {
            return null;
        }
        
        return new UserDTO(
            user.getId(),
            user.getName(),
            user.getEmail(),
            user.getRole().toString()
        );
    }
    
    // Getters and Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public String getName() {
        return name;
    }
    
    public void setName(String name) {
        this.name = name;
    }
    
    public String getEmail() {
        return email;
    }
    
    public void setEmail(String email) {
        this.email = email;
    }
    
    public String getRole() {
        return role;
    }
    
    public void setRole(String role) {
        this.role = role;
    }
} 