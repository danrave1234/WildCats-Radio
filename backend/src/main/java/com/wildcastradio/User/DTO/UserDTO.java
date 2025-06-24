package com.wildcastradio.User.DTO;

import com.wildcastradio.User.UserEntity;

public class UserDTO {
    private Long id;
    private String firstname;
    private String lastname;
    private String email;
    private String role;
    
    // Constructors
    public UserDTO() {
    }
    
    public UserDTO(Long id, String firstname, String lastname, String email, String role) {
        this.id = id;
        this.firstname = firstname;
        this.lastname = lastname;
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
            user.getFirstname(),
            user.getLastname(),
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
    
    public String getFirstname() {
        return firstname;
    }
    
    public void setFirstname(String firstname) {
        this.firstname = firstname;
    }
    
    public String getLastname() {
        return lastname;
    }
    
    public void setLastname(String lastname) {
        this.lastname = lastname;
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