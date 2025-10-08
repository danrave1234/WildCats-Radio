package com.wildcastradio.User.DTO;

import com.wildcastradio.User.UserEntity;

public class UserDTO {
    private Long id;
    private String firstname;
    private String lastname;
    private String email;
    private String role;
    // Notification preferences
    private Boolean notifyBroadcastStart;
    private Boolean notifyBroadcastReminders;
    private Boolean notifyNewSchedule;
    private Boolean notifySystemUpdates;
    
    // Constructors
    public UserDTO() {
    }
    
    public UserDTO(Long id, String firstname, String lastname, String email, String role,
                   Boolean notifyBroadcastStart, Boolean notifyBroadcastReminders,
                   Boolean notifyNewSchedule, Boolean notifySystemUpdates) {
        this.id = id;
        this.firstname = firstname;
        this.lastname = lastname;
        this.email = email;
        this.role = role;
        this.notifyBroadcastStart = notifyBroadcastStart;
        this.notifyBroadcastReminders = notifyBroadcastReminders;
        this.notifyNewSchedule = notifyNewSchedule;
        this.notifySystemUpdates = notifySystemUpdates;
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
            user.getRole().toString(),
            user.isNotifyBroadcastStart(),
            user.isNotifyBroadcastReminders(),
            user.isNotifyNewSchedule(),
            user.isNotifySystemUpdates()
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

    public Boolean getNotifyBroadcastStart() { return notifyBroadcastStart; }
    public void setNotifyBroadcastStart(Boolean v) { this.notifyBroadcastStart = v; }
    public Boolean getNotifyBroadcastReminders() { return notifyBroadcastReminders; }
    public void setNotifyBroadcastReminders(Boolean v) { this.notifyBroadcastReminders = v; }
    public Boolean getNotifyNewSchedule() { return notifyNewSchedule; }
    public void setNotifyNewSchedule(Boolean v) { this.notifyNewSchedule = v; }
    public Boolean getNotifySystemUpdates() { return notifySystemUpdates; }
    public void setNotifySystemUpdates(Boolean v) { this.notifySystemUpdates = v; }
} 