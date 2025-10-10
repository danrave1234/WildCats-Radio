# WildCats Radio — Full Feature Catalog

Last updated: 2025-10-03 18:56 local time

Purpose
- This single file lists all notable features in one place so you can quickly review and decide which ones to keep or remove.
- For deeper docs, each section links to the relevant files or endpoints.

Contents
- Broadcast & Streaming
- Chat & Engagement
- Listener Presence & Realtime
- Notifications
- Moderation & User Management
- Announcements (Moderated System)
- Analytics
- Platform Security & Resilience
- Frontend UX Highlights

---

Broadcast & Streaming
- Create/Schedule/Manage Broadcasts
  - Create: POST /api/broadcasts
  - Update/Delete: PUT/DELETE /api/broadcasts/{id}
  - Schedule: POST /api/broadcasts/schedule (creates a Schedule + Broadcast)
  - List all: GET /api/broadcasts
  - Get by id: GET /api/broadcasts/{id}
- Start/End Broadcast
  - Start: POST /api/broadcasts/{id}/start
  - End: POST /api/broadcasts/{id}/end
- Live/Upcoming/Current
  - Upcoming: GET /api/broadcasts/upcoming
  - Live list: GET /api/broadcasts/live
  - Current live: GET /api/broadcasts/live/current
- Degraded Broadcast Start (Resilient Start)
  - Starts a show even if Icecast is temporarily unreachable by using a fallback stream URL tagged with ?degraded=true.
  - Config (application.properties or env):
    - icecast.allowDegradedStart (default true)
    - icecast.fallbackStreamUrl (default https://icecast.software/live.ogg)
  - Docs: FEATURES.md → “Degraded Broadcast Start”
- Live Stream Health Monitor
  - Snapshot with health flags, listenerCount, degradedMode, etc.
  - Endpoint: GET /api/broadcasts/live/health
  - Docs: FEATURES.md → “Live Stream Health Monitor”
- Test Mode Start
  - Start without Icecast checks; stream URL tagged ?test=true
  - Endpoint: POST /api/broadcasts/{id}/start-test
  - Docs: FEATURES.md → “Test Mode Start”
- Broadcast History
  - Dedicated feature to review broadcast events (scheduled/starting soon/started/ended/new broadcast posted)
  - Frontend page with search, filters, and stats (DJ/Admin only)
  - Backend convenience endpoint: GET /api/broadcasts/history
  - Docs: BROADCAST_HISTORY_README.md
- Chat Export per Broadcast (Excel)
  - Download chat messages for a broadcast as .xlsx
  - Endpoint: GET /api/broadcasts/{id}/chat/export (DJ/Admin/Moderator)

Chat & Engagement
- Chat Slow Mode
  - Per-broadcast setting to limit message frequency
  - Endpoint: PUT /api/broadcasts/{id}/slowmode with body { enabled, seconds }
  - Bypass: DJ/Admin bypass slow-mode; Moderators are subject to it
  - Docs: FEATURES.md → “Chat Slow Mode”
- Profanity Filter (English/Tagalog/Bisaya + basic leetspeak)
  - Sanitizes messages containing listed profanities; if triggered, entire message becomes: “CITU TOPS AGAIN!”
  - Implementation: backend/src/main/java/com/wildcastradio/ChatMessage/ProfanityFilter.java
- Chat Moderation (Delete Message)
  - Endpoint: DELETE /api/chats/messages/{messageId} (Admin/Moderator/DJ)
- Song Requests (with simple analytics)
  - Controllers exist: SongRequestController and SongRequestAnalyticsController

Listener Presence & Realtime
- Listener Status WebSocket
  - Sends realtime STREAM_STATUS messages to connected clients with isLive, listenerCount, peakListenerCount, broadcastId
  - Docs: FEATURES.md → “Listener Status WebSocket”

Notifications
- Real-time, per-user notifications via WebSocket + persistence
  - Server push: convertAndSendToUser(..., "/queue/notifications", NotificationDTO)
  - APIs include: list user notifications, unread only, mark read, mark all read, paginate, filter by type, recent since timestamp
  - Transient (deduplicated) notifications for ephemeral events (e.g., “starting soon”) using a per-key in-memory set
  - Implementation: backend/src/main/java/com/wildcastradio/Notification/* (see NotificationService)

Moderation & User Management
- Ban/Unban Users
  - POST /api/auth/{id}/ban, POST /api/auth/{id}/unban
- Search User by Email (for moderation tooling)
  - GET /api/auth/by-email (Admin/Moderator)
- Role Management (Admin-only)
  - PUT /api/auth/{id}/role, GET /api/auth/getAll
- Moderator Dashboard & Capabilities
  - Frontend page with tabs, tools (watch live, ban/unban, delete messages)
  - Docs: MODERATOR_GUIDE.md

Announcements (Moderated System)
- Draft → Review → Publish/Schedule → Pin → Archive Workflow
  - DJs create drafts; Moderators/Admins approve/publish/schedule; rejections keep history; unarchive supported
  - Pinned announcements (max 2); auto-archiving via scheduled jobs
  - Public endpoints for published announcements; role-restricted management endpoints
  - Docs: ANNOUNCEMENTS_FEATURE.md (includes endpoints, schema, cron behavior)

Analytics
- Analytics Dashboard (DJ/Admin only)
  - Summary cards (Users, Broadcasts, Engagement, Activity)
  - Popular broadcasts list with status and counts
  - Recent activity log with timeframe filters
  - Admin-only system metrics (health, response time, error rates, peak traffic)
  - Frontend implementation: ANALYTICS_DASHBOARD_README.md

Platform Security & Resilience
- API Rate Limiting (Bucket4j)
  - Per-IP for /api/** and per-IP + per-username for /api/auth/login|register|verify
  - 429 responses with Retry-After; X-Forwarded-For support; static/health endpoints skipped
  - Implementation: backend/src/main/java/com/wildcastradio/ratelimit/RateLimitingFilter.java
- Access Control throughout controllers via @PreAuthorize and service-level guardrails
  - Moderator restrictions around ADMIN accounts; role-based routes across the app


Frontend UX Highlights
- Role-aware Sidebar and protected routes
  - Broadcast History page (DJ/Admin only)
  - Analytics Dashboard (DJ/Admin only)
  - Moderator Dashboard
- Listener Dashboard screen (frontend/src/pages/ListenerDashboard.jsx)

Notes
- If you want a list limited to “recently added” versus “all available,” tell us the timeframe and we’ll filter down to those changes here.
- We can also pull out the exact request/response payloads for any endpoint you plan to call.
