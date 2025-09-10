# Moderator Guide

This document summarizes the current powers and limitations for the MODERATOR role, and where they are implemented.

## What moderators can do

- Ban/unban users (except admins)
  - API: `POST /api/auth/{id}/ban`, `POST /api/auth/{id}/unban`
  - Guard: `@PreAuthorize("hasAnyRole('ADMIN','MODERATOR','DJ')")` with deeper checks in service
  - Implementation: `backend/src/main/java/com/wildcastradio/User/UserController.java`, `UserService.banUser(...)`, `UserService.unbanUser(...)`

- Delete chat messages (moderation)
  - API: `DELETE /api/chats/messages/{messageId}`
  - Guard: `@PreAuthorize("hasAnyRole('ADMIN','MODERATOR','DJ')")`
  - Implementation: `backend/src/main/java/com/wildcastradio/ChatMessage/ChatMessageController.java`

- View and watch live broadcasts
  - UI: `frontend/src/pages/ModeratorDashboard.jsx` → Live Broadcasts tab → “Watch” opens listener view
  - APIs used: `GET /api/broadcasts/live`

- Access analytics and broadcast history views (read-only)
  - Routes allow `MODERATOR` for `/analytics` and `/broadcast-history`
  - UI routes: `frontend/src/App.jsx`

- Search users by email for moderation purposes
  - API: `GET /api/auth/by-email`
  - Guard: `@PreAuthorize("hasAnyRole('ADMIN','MODERATOR')")`
  - Implementation: `UserController.getUserByEmail(...)`

## What moderators cannot do

- Change user roles or create users (admin-only)
  - API: `PUT /api/auth/{id}/role`, `GET /api/auth/getAll`
  - Guard: `@PreAuthorize('hasRole('ADMIN')')`

- Promote anyone to ADMIN or modify ADMIN users during moderation actions
  - Enforcement in service layer:
    - `UserService.updateUserRoleByActor(...)`
    - `UserService.banUser(...)` / `unbanUser(...)`

- Start/end broadcasts or manage schedules (DJ/Admin only)
  - Guards on broadcast endpoints restrict to DJ/Admin

- Send system-wide notifications (admin-only)
  - `NotificationController` test/broadcast endpoints: `@PreAuthorize('hasRole('ADMIN')')`

## Frontend entry points for moderators

- Moderator Dashboard: `/moderator`
  - File: `frontend/src/pages/ModeratorDashboard.jsx`
  - Tabs:
    - Overview: quick info
    - Live Broadcasts: watch links and stream open
    - Moderation Tools: search user by email; ban/unban

## Where rules are enforced in code

- Controller-level guards
  - `UserController` – ban/unban, by-email
  - `ChatMessageController` – delete message
  - `BroadcastController` – DJ/Admin only controls
  - `PollController`, `SongRequestController`, `AnalyticsController` – mixed read/write guards

- Service-level guardrails (final authority)
  - `backend/src/main/java/com/wildcastradio/User/UserService.java`
    - Prevent moderators from acting on ADMINs
    - Prevent role escalations to ADMIN by moderators

## Notes

- Listener chat slow-mode is bypassed for DJ/Admin only; moderators are subject to slow-mode in chat.
- UI routes in `frontend/src/App.jsx` send MODERATORs to `/moderator`; ADMINs to `/admin`.

If you need changes to moderator powers, update controller guards and corresponding service checks, then reflect the change in this guide.


