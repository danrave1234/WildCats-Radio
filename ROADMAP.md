# Project Roadmap

This document outlines the steps and structure for building an audio radio website designed for a school channel. The project will use Spring Boot for the backend, ReactJS for the frontend, and integrate several key technologies such as NEON for storage, JWT for security, and Shoutcast for streaming. Below is a detailed roadmap covering the entities, development phases, directory structure, and deployment considerations.

---

## 1. Project Overview

- **Purpose:** Build an audio radio website for a school with a single channel.
- **Key Roles:** 
  - **DJ/Admin:** Can schedule and manage broadcasts, control server start/stop.
  - **Listener:** Can comment, request songs, and answer polls when logged in.
  - **Guest:** Can listen and view comments/schedules.
- **Core Features:**
  - User management (registration, login, profile updates)
  - Live broadcast scheduling and management
  - Real-time chat during broadcasts
  - Song requests handling
  - Notification and activity logging
  - Server scheduling (automatic/manual start/stop) with redundancy
  - Integration with Shoutcast for streaming audio
  - Responsive UI for both web (ReactJS) and mobile

---

## 2. Technology Stack

- **Backend:** Spring Boot with Spring Web, Spring Data JPA, Spring Security, and JavaMail (for email verification)
- **Database & Storage:** NEON using the provided JDBC URL  
  `jdbc:postgresql://ep-still-darkness-a126282w-pooler.ap-southeast-1.aws.neon.tech/wildcatradiodb?user=wildcatradiodb_owner&password=npg_p8dU2CbBkIgl&sslmode=require`
- **Frontend:** ReactJS (with mobile support via responsive design or React Native/Flutter)
- **Streaming:** Shoutcast server software integrated on Google Cloud
- **Security:** JWT for authentication and password hashing

---

## 3. Directory Structure & Entity Organization

Each business entity will have its own dedicated directory containing all CRUD components. For example:

/User ├── UserEntity.java ├── UserRepository.java ├── UserService.java ├── UserController.java └── DTO ├── UserDTO.java └── OtherUserDTOs.java



Similarly, create directories for:
- **Broadcast**
- **ChatMessage**
- **SongRequest**
- **Notification**
- **ActivityLog**
- **StreamingConfig**
- **ServerSchedule**

Each directory will include:
- **Entity class:** (e.g., `BroadcastEntity.java`)
- **Repository interface:** (e.g., `BroadcastRepository.java`)
- **Service class:** (e.g., `BroadcastService.java`)
- **Controller:** (e.g., `BroadcastController.java`)
- **DTO Folder:** Contains all data transfer objects for that entity

---

## 4. Entity Specifications & Relationships

### 4.1 User
- **Attributes:** `id`, `name`, `email`, `password`, `role` (ADMIN, DJ, LISTENER)
- **Relationships:** One-to-Many with Broadcasts, ChatMessages, SongRequests, Notifications, ActivityLogs (and optionally ServerSchedules for DJs)
- **Key Functions:** 
  - `registerUser(email, password, name)`
  - `loginUser(email, password)`
  - `sendVerificationCode(email)`
  - `verifyCode(email, code)`
  - `updateProfile(user, updatedInfo)`

### 4.2 Broadcast
- **Attributes:** `id`, `title`, `description`, scheduling details, `status` (SCHEDULED, LIVE, ENDED, TESTING), `streamUrl`
- **Relationships:** Many-to-One with User (DJ), One-to-Many with ChatMessages and SongRequests
- **Key Functions:**
  - `scheduleBroadcast(broadcastDetails, dj)`
  - `startBroadcast(broadcastId, dj)`
  - `endBroadcast(broadcastId, dj)`
  - `testBroadcast(broadcastId, dj)`
  - `getAnalytics(broadcastId)`

### 4.3 ChatMessage
- **Attributes:** `id`, `content`, `timestamp`
- **Relationships:** Many-to-One with User and Broadcast
- **Key Functions:**
  - `sendMessage(broadcastId, user, content)`
  - `getMessagesForBroadcast(broadcastId)`

### 4.4 SongRequest
- **Attributes:** `id`, `songTitle`, `artist`, `timestamp`
- **Relationships:** Many-to-One with User and Broadcast
- **Key Functions:**
  - `createSongRequest(broadcastId, user, songTitle, artist)`
  - `getSongRequests(broadcastId)`

### 4.5 Notification
- **Attributes:** `id`, `message`, `type` (REMINDER, ALERT, INFO), `timestamp`
- **Relationships:** Many-to-One with User (recipient)
- **Key Functions:**
  - `sendNotification(recipient, message, type)`
  - `getNotificationsForUser(userId)`

### 4.6 ActivityLog
- **Attributes:** `id`, `activityType` (LOGIN, BROADCAST_START, etc.), `description`, `timestamp`
- **Relationships:** Many-to-One with User
- **Key Functions:**
  - `logActivity(user, activityType, description)`
  - `getActivityLogsForUser(userId)`

### 4.7 StreamingConfig
- **Attributes:** `id`, `serverUrl`, `port`, `mountPoint`, `password`, `protocol`
- **Key Functions:**
  - `getConfig()`
  - `updateConfig(newConfig)`

### 4.8 ServerSchedule
- **Attributes:** `id`, `scheduledStart`, `scheduledEnd`, `status` (SCHEDULED, RUNNING, OFF), `redundantStatus` (RUNNING, OFF), `automatic`, `redundantEnabled`
- **Relationships:** Optionally linked to User (DJ/admin)
- **Key Functions:**
  - `scheduleServerRun(serverSchedule, dj)`
  - `startServer(serverSchedule)`
  - `stopServer(serverSchedule)`
  - `manualStartServer()`
  - `manualStopServer()`
  - `isServerRunning()`
  - `failoverCheck()`

---

## 5. Backend Development (Spring Boot)

### 5.1 Project Setup
- Create a Spring Boot project via Spring Initializr.
- Include dependencies: Spring Web, Spring Data JPA, Spring Security, JavaMail.
- Configure the NEON PostgreSQL database using the provided JDBC URL in `application.properties`.

### 5.2 Entity Classes & Repositories
- Define JPA entity classes for each entity.
- Create repository interfaces (extending `JpaRepository`) for each entity.

### 5.3 Service Layer Implementation
- Implement service classes for business logic.
- **Example (BroadcastService):**
  - Schedule, start, end, and test broadcast functions.
  - Integrate with Shoutcast for streaming operations.
  - Call ServerScheduleService to verify server status.

### 5.4 Security & Authentication
- Implement JWT-based authentication and password hashing.
- Configure Spring Security for role-based access control.
- Set up email verification via JavaMailSender or OAuth (e.g., Google SSO).

### 5.5 REST Controllers & DTOs
- Create REST controllers for each entity to expose endpoints.
- Use DTOs (organized within a `DTO` subdirectory) for data transfer.

### 5.6 WebSocket Integration
- Set up Spring WebSocket for real-time chat functionality.

### 5.7 Server Scheduling & Management
- Implement `ServerScheduleService` with methods for automatic and manual server start/stop.
- Use `@Scheduled` tasks to handle automatic scheduling.
- Ensure redundancy handling with backup server logic.

### 5.8 Analytics & Logging
- Use the ActivityLog entity to record key events.
- Expose endpoints for retrieving analytics (e.g., viewer count, chat activity).

---

## 6. Frontend Development (ReactJS)

### 6.1 Website Pages
- **Login/Register Page:**
  - Login via institutional email (or OAuth).
  - Email verification and/or OAuth flow integration.
- **Listener Dashboard:**
  - “Listen Live” button active when server and broadcast are live.
  - Volume controls and live broadcast indicator.
- **Schedule Page:**
  - Display upcoming broadcasts with title, date, time, and description.
- **Profile & Notification Settings Page:**
  - Update profile details, change password, adjust notification settings.
- **DJ Dashboard (Desktop):**
  - Broadcast management panel with schedule details.
  - Manual broadcast controls (start/end/test).
  - Server scheduling controls with analytics.

### 6.2 Mobile Pages
- Responsive login/register and listener dashboard.
- Schedule display in a scrollable card or list view.
- Profile/settings management.
- Optional DJ test broadcast (audio preview only).

---

## 7. Deployment & Integration

### 7.1 Shoutcast Integration
- Integrate Shoutcast server software to manage audio streaming.
- Connect to Shoutcast via the backend (e.g., `ShoutcastService`) to initiate and terminate streams.

### 7.2 Google Cloud Deployment
- Deploy the Shoutcast server on Google Cloud.
- Configure backend and frontend deployments for scalability and reliability.

### 7.3 Database & Storage
- Use NEON for storage with the provided PostgreSQL connection.
- Ensure secure connection parameters and SSL configuration.

---

## 8. Final Summary

- **Backend:** 
  - Organized by entity directories containing Entity, Repository, Service, Controller, and DTO subdirectories.
  - Implements all required functionalities (user management, broadcasting, chat, song requests, notifications, logging, streaming configuration, and server scheduling).
  - Secured using JWT, role-based access, and integrated with email verification/OAuth.
- **Frontend:** 
  - Developed using ReactJS for a responsive website and mobile-friendly design.
  - Provides distinct dashboards for listeners and DJs with comprehensive scheduling and control features.
- **Streaming & Deployment:**
  - Utilizes Shoutcast for audio streaming integrated on Google Cloud.
  - Uses NEON as the database storage backend.

This roadmap provides a comprehensive guide for both the development and deployment phases of the project. Follow the steps outlined above to build a robust, scalable, and secure audio radio website tailored for your school channel.





For reference(Optional to follow)
1. Updated Entities, Descriptions, Relationships, and Functions
1.1 User
Description:
Represents any person interacting with the system—whether a DJ, an administrator, or a general listener. This entity stores essential authentication credentials, profile data, and role information.
Attributes:
id: Long – Unique identifier.
name: String – Full name of the user.
email: String – Institution email for login and notifications.
password: String – Hashed password for secure authentication.
role: Enum (ADMIN, DJ, LISTENER) – Determines access rights.
Relationships:
Broadcasts (One-to-Many): A DJ can create many broadcasts.
ChatMessages (One-to-Many): A user posts many chat messages during broadcasts.
SongRequests (One-to-Many): A user can make multiple song requests.
Notifications (One-to-Many): A user receives several notifications.
ActivityLogs (One-to-Many): Records of user actions for auditing.
(Optionally, a DJ may also create ServerSchedules.)
Key Functions (Service Methods):
registerUser(email, password, name)
Registers a new user after sending a verification code (or via OAuth).
loginUser(email, password)
Authenticates the user and returns a secure session/token.
sendVerificationCode(email)
Sends a unique code for email verification.
verifyCode(email, code)
Validates the code and activates the account.
updateProfile(user, updatedInfo)
Updates the user's profile settings.

1.2 Broadcast
Description:
Represents a live audio session initiated by a DJ. This entity holds both scheduling details (if needed as a reference) and live session data (status, stream URL). Note that the actual server availability is managed separately via the ServerSchedule entity.
Attributes:
id: Long – Unique broadcast identifier.
title: String – Title of the broadcast session.
description: String – Brief details about the session.
scheduledStart: LocalDateTime – (Optional) When the session is expected to occur.
scheduledEnd: LocalDateTime – (Optional) When the session is expected to end.
actualStart: LocalDateTime – Time when the broadcast is started (set by the DJ).
actualEnd: LocalDateTime – Time when the broadcast ends.
status: Enum (SCHEDULED, LIVE, ENDED, TESTING) – Current state of the broadcast.
streamUrl: String – URL provided by the Shoutcast service when live.
Relationships:
CreatedBy (Many-to-One): The DJ (User) who created or is responsible for the broadcast.
ChatMessages (One-to-Many): Chat messages posted during the broadcast.
SongRequests (One-to-Many): Song requests submitted during the session.
Key Functions (Service Methods):
scheduleBroadcast(broadcastDetails, dj)
Stores broadcast details; note that this schedule is informational and may help users see upcoming shows.
startBroadcast(broadcastId, dj)
Verifies that the DJ is the creator, confirms that the server is running, then sets status to LIVE, calls the Shoutcast service to initiate the stream, and records the actual start time.
endBroadcast(broadcastId, dj)
Ends the broadcast by updating status to ENDED, recording the actual end time, and calling the service to shut down the stream.
testBroadcast(broadcastId, dj)
Starts a “test mode” broadcast so the DJ can preview the audio without going live.
getAnalytics(broadcastId)
Retrieves engagement data (viewer count, chat activity, etc.) for a broadcast.

1.3 ChatMessage
Description:
Captures real-time text communication during a live broadcast. It logs the content, the sender, and the time it was sent.
Attributes:
id: Long – Unique identifier.
content: String – The message text.
timestamp: LocalDateTime – Time when the message was sent.
Relationships:
Sender (Many-to-One): The user who sent the message.
Broadcast (Many-to-One): The broadcast session during which the message was posted.
Key Functions (Service Methods):
sendMessage(broadcastId, user, content)
Saves the chat message and pushes it via WebSocket to connected clients.
getMessagesForBroadcast(broadcastId)
Retrieves all chat messages for the specified broadcast.

1.4 SongRequest
Description:
Stores details of a song request made by a listener during a live broadcast.
Attributes:
id: Long – Unique identifier.
songTitle: String – Title of the requested song.
artist: String – Optional artist name.
timestamp: LocalDateTime – Time when the request was made.
Relationships:
RequestedBy (Many-to-One): The user who submitted the request.
Broadcast (Many-to-One): The broadcast session in which the request was made.
Key Functions (Service Methods):
createSongRequest(broadcastId, user, songTitle, artist)
Creates and saves a new song request for the active broadcast.
getSongRequests(broadcastId)
Lists all song requests for the given broadcast.

1.5 Notification
Description:
Handles alerts and reminders sent to users regarding broadcasts, scheduling updates, or system messages.
Attributes:
id: Long – Unique identifier.
message: String – Notification content.
type: Enum (REMINDER, ALERT, INFO) – Classification of notification.
timestamp: LocalDateTime – Time when the notification was generated.
Relationships:
Recipient (Many-to-One): The user who receives the notification.
Key Functions (Service Methods):
sendNotification(recipient, message, type)
Creates and dispatches a new notification to the specified user.
getNotificationsForUser(userId)
Retrieves notifications for a particular user.

1.6 ActivityLog
Description:
Records significant user actions and system events for auditing and analysis.
Attributes:
id: Long – Unique identifier.
activityType: Enum (LOGIN, BROADCAST_START, BROADCAST_END, etc.) – Type of action logged.
description: String – Detailed description of the activity.
timestamp: LocalDateTime – When the activity occurred.
Relationships:
User (Many-to-One): The user responsible for the logged activity.
Key Functions (Service Methods):
logActivity(user, activityType, description)
Creates and persists a new log entry.
getActivityLogsForUser(userId)
Retrieves activity logs for a given user.

1.7 StreamingConfig
Description:
Stores configuration settings for the Shoutcast streaming service. This entity centralizes all parameters needed for live audio streaming integration.
Attributes:
id: Long – Unique identifier.
serverUrl: String – URL address of the Shoutcast server.
port: Integer – Network port number.
mountPoint: String – Designated mount point (if applicable).
password: String – Authentication credential for the Shoutcast server.
protocol: String – Streaming protocol (e.g., “SHOUTCAST”).
Relationships:
Standalone: Used by the streaming service and does not directly relate to other business entities.
Key Functions (Service Methods):
getConfig()
Returns the current streaming configuration.
updateConfig(newConfig)
Updates the streaming configuration (secured for admin use).

1.8 ServerSchedule
Description:
Manages the scheduled run times for the server itself. This entity lets a DJ or admin set automatic start/stop times so that the server is up and ready (saving power when not needed) before a live broadcast. In addition to scheduled operations, it supports manual start/stop functionality, enabling DJs to immediately start or stop the server regardless of the schedule. It also incorporates redundancy by managing a redundant (backup) server that can run in parallel with the main server or take over if the main server fails.
Attributes:
id: Long – Unique identifier for the schedule entry.
scheduledStart: LocalDateTime – The time when the server should automatically start.
scheduledEnd: LocalDateTime – The time when the server should automatically shut down.
status: Enum (SCHEDULED, RUNNING, OFF) – Current state of the main server.
redundantStatus: Enum (RUNNING, OFF) – Current state of the redundant server.
automatic: Boolean – Indicates if auto-run is enabled for this schedule.
redundantEnabled: Boolean – Indicates whether the redundant server should run in parallel.
Relationships:
CreatedBy (Many-to-One, Optional):
The DJ or admin who set up the schedule.
Key Functions (Service Methods):
scheduleServerRun(ServerSchedule serverSchedule, User dj)
Creates and saves a new server run schedule based on the DJ's preferences (for automatic start/stop).
startServer(ServerSchedule serverSchedule)
Starts the main server at the scheduled start time (or on-demand) and updates the status to RUNNING. If redundantEnabled is true, it also starts the redundant server concurrently (setting its status to RUNNING).
stopServer(ServerSchedule serverSchedule)
Stops the main server at the scheduled end time (or on-demand) and updates the status to OFF. It also stops the redundant server if it is running.
manualStartServer()
Allows the DJ or admin to manually start the main server immediately—bypassing the scheduled start time—and, if redundancy is enabled, starts the redundant server as well, updating both statuses to RUNNING.
manualStopServer()
Allows the DJ or admin to manually stop the main server immediately (regardless of any schedule) and stops the redundant server if active, updating both statuses to OFF.
isServerRunning()
Utility function to check whether the main server is currently active (optionally also verifying the redundant server’s status).
failoverCheck()
Monitors the main server’s health and automatically switches over to the redundant server if a failure is detected.
Example Pseudo-Code Implementation:
java
@Service
public class ServerScheduleService {
    
    @Autowired
    private ServerScheduleRepository serverScheduleRepo;
    
    // Schedules a new server run (automatic mode)
    public ServerSchedule scheduleServerRun(ServerSchedule schedule, User dj) {
        schedule.setCreatedBy(dj);
        schedule.setStatus(ServerStatus.SCHEDULED);
        // Initially set redundantStatus to OFF
        schedule.setRedundantStatus(ServerStatus.OFF);
        return serverScheduleRepo.save(schedule);
    }
    
    // Automatically starts the main server (and redundant server if enabled)
    public ServerSchedule startServer(ServerSchedule schedule) {
        schedule.setStatus(ServerStatus.RUNNING);
        // Code to start the main server automatically (e.g., via an external API)
        if (schedule.isRedundantEnabled()) {
            startRedundantServer(schedule);
        }
        return serverScheduleRepo.save(schedule);
    }
    
    // Starts the redundant server
    private void startRedundantServer(ServerSchedule schedule) {
        // Code to start the redundant server
        schedule.setRedundantStatus(ServerStatus.RUNNING);
    }
    
    // Automatically stops the main server (and redundant server if active)
    public ServerSchedule stopServer(ServerSchedule schedule) {
        schedule.setStatus(ServerStatus.OFF);
        if (schedule.getRedundantStatus() == ServerStatus.RUNNING) {
            stopRedundantServer(schedule);
        }
        return serverScheduleRepo.save(schedule);
    }
    
    // Stops the redundant server
    private void stopRedundantServer(ServerSchedule schedule) {
        // Code to stop the redundant server
        schedule.setRedundantStatus(ServerStatus.OFF);
    }
    
    // Manually starts the main server immediately
    public void manualStartServer() {
        // Code to manually start the main server
        // Also, start the redundant server if redundantEnabled is true
    }
    
    // Manually stops the main server immediately
    public void manualStopServer() {
        // Code to manually stop the main server
        // Also, stop the redundant server if it is running
    }
    
    // Utility method to check if the main server is running
    public boolean isServerRunning() {
        // For example, return true if the current schedule status is RUNNING
        return serverScheduleRepo.findCurrentSchedule()
                .map(schedule -> schedule.getStatus() == ServerStatus.RUNNING)
                .orElse(false);
    }
    
    // Checks the health of the main server and performs failover if necessary
    public void failoverCheck() {
        if (!isServerRunning() && isRedundantAvailable()) {
            // Trigger a failover to the redundant server if it is available
            manualStartServer(); // Or call a dedicated failover method
        }
    }
    
    private boolean isRedundantAvailable() {
        // Check if the redundant server is up or can be started quickly
        return true; // Placeholder logic
    }
}


2. Implementation Instructions (Spring Boot)
Backend Development Steps:
Project Setup:
Create a Spring Boot project (via Spring Initializr) with dependencies for Spring Web, Spring Data JPA, Spring Security, and JavaMail (for email verification).
Configure your chosen database (PostgreSQL/MySQL) in application.properties.
Entity Classes & Repositories:
Define JPA entity classes for User, Broadcast, ChatMessage, SongRequest, Notification, ActivityLog, StreamingConfig, and ServerSchedule.
Create corresponding repository interfaces (e.g., UserRepository, BroadcastRepository, ServerScheduleRepository) that extend JpaRepository.
Service Layer:
Implement a service class for each entity containing the functions listed above.
Example (BroadcastService):
java
@Service
public class BroadcastService {
    @Autowired
    private BroadcastRepository broadcastRepo;
    @Autowired
    private ShoutcastService shoutcastService; // Handles Shoutcast operations
    @Autowired
    private ServerScheduleService serverScheduleService;


    public Broadcast scheduleBroadcast(Broadcast broadcast, User dj) {
        broadcast.setCreatedBy(dj);
        broadcast.setStatus(BroadcastStatus.SCHEDULED);
        return broadcastRepo.save(broadcast);
    }


    public Broadcast startBroadcast(Long broadcastId, User dj) {
        Broadcast broadcast = broadcastRepo.findById(broadcastId)
                .orElseThrow(() -> new RuntimeException("Broadcast not found"));
        if (!broadcast.getCreatedBy().getId().equals(dj.getId())) {
            throw new AccessDeniedException("Only the creator DJ can start this broadcast");
        }
        if (!serverScheduleService.isServerRunning()) {
            throw new IllegalStateException("Server is not running. Please ensure the server schedule is active.");
        }
        String streamUrl = shoutcastService.startStream(broadcast);
        broadcast.setStreamUrl(streamUrl);
        broadcast.setActualStart(LocalDateTime.now());
        broadcast.setStatus(BroadcastStatus.LIVE);
        return broadcastRepo.save(broadcast);
    }


    public Broadcast endBroadcast(Long broadcastId, User dj) {
        Broadcast broadcast = broadcastRepo.findById(broadcastId)
                .orElseThrow(() -> new RuntimeException("Broadcast not found"));
        if (!broadcast.getCreatedBy().getId().equals(dj.getId())) {
            throw new AccessDeniedException("Only the creator DJ can end this broadcast");
        }
        shoutcastService.endStream(broadcast);
        broadcast.setActualEnd(LocalDateTime.now());
        broadcast.setStatus(BroadcastStatus.ENDED);
        return broadcastRepo.save(broadcast);
    }


    public Broadcast testBroadcast(Long broadcastId, User dj) {
        Broadcast broadcast = broadcastRepo.findById(broadcastId)
                .orElseThrow(() -> new RuntimeException("Broadcast not found"));
        if (!broadcast.getCreatedBy().getId().equals(dj.getId())) {
            throw new AccessDeniedException("Only the creator DJ can start a test broadcast");
        }
        broadcast.setStatus(BroadcastStatus.TESTING);
        return broadcastRepo.save(broadcast);
    }
    
    // Additional functions such as getAnalytics()...
}


Similarly, implement service classes for User, ServerSchedule, ChatMessage, etc.
Security & Authentication:
Use Spring Security with role-based access control to secure endpoints.
Implement email verification using JavaMailSender or integrate OAuth (e.g., Google SSO) for institutional authentication.
REST Controllers:
Create controllers (e.g., UserController, BroadcastController, ServerScheduleController) to expose the endpoints.
Map endpoints (e.g., /api/broadcast/start/{id}) to the appropriate service methods.
WebSocket Integration:
Configure Spring WebSocket to handle real-time chat functionality in the ChatMessage service.
Scheduling & Server Management:
Implement the ServerScheduleService with scheduled tasks (using @Scheduled) to auto-start or stop the server based on the ServerSchedule entity.
Expose a utility method isServerRunning() to check the server’s current status.
Analytics & Logging:
Use the ActivityLog entity to record important events.
Provide endpoints for DJs/admins to fetch analytics data.

3. Application Pages (Website and Mobile)
Website Pages:
Login/Register Page:
Functionality:
Login via institutional email (or OAuth). Use Microsoft account only
Registration with email verification (or use an OAuth flow).
UI Elements:
Email and password fields, “Send Verification Code” button.
Listener Dashboard:
Functionality:
Central button to “Listen Live” if the server is running and a broadcast is active.
Volume controls (mute/unmute, slider) and an indicator showing if no broadcast is live (with upcoming schedule info).
UI Elements:
Live broadcast indicator and media control buttons.
Schedule Page (Broadcast Info):
Functionality:
Display upcoming broadcast details (title, date, time, description).
Note: This is informational; the actual scheduling of server run times is handled separately.
UI Elements:
Calendar view or list view with broadcast cards.
Profile & Notification Settings Page:
Functionality:
Update personal details, change password, adjust notification preferences.
UI Elements:
Form fields, toggle switches, and save buttons.
DJ Dashboard (Desktop Only):
Broadcast Controls:
Ability to schedule broadcast details (informational), then manually start/end broadcasts.
Test broadcast functionality to check audio input.
Live analytics view (viewer count, chat messages, song requests).
Server Schedule Management:
Section to schedule the server run times (set scheduledStart and scheduledEnd).
Option to manually start/stop the server.
UI Elements:
Broadcast management panels, server schedule form, and analytics charts.

4. Final Summary
Backend:
Define the entities and relationships as described above.
Use Spring Boot with dedicated service layers for broadcast management, server scheduling (including redundancy and manual override), and user management.
Secure endpoints with Spring Security and implement email verification or OAuth for registration/login.
Integrate with Shoutcast for live streaming and Spring WebSocket for real-time chat.
Frontend:
For the website, use frameworks such as React to build a responsive, intuitive interface.
For mobile, consider React Native or Flutter for a cross-platform experience.
Ensure the DJ dashboard (desktop) includes both broadcast controls and server schedule management so that the server (and its redundant instance) is automatically up and ready when needed, with manual overrides available.


