# WildCats Radio

Welcome! If you’re looking for “the list” of features, start here.

Quick links
- Feature List (summary): FEATURES.md
- Moderator Guide: MODERATOR_GUIDE.md
- Broadcast History Feature: BROADCAST_HISTORY_README.md
- Analytics Dashboard Feature: ANALYTICS_DASHBOARD_README.md
- Announcements (Moderated System): ANNOUNCEMENTS_FEATURE.md
- Roadmap: ROADMAP.md
- GCP Deployment Notes: DEPLOY_TO_GCP.md and GCP_VM_DIFF_CHECKLIST.md

Highlights from the Feature List
- Broadcast management: create, schedule, start, end; live/health endpoints
- Chat slow mode: per-broadcast setting (PUT /api/broadcasts/{id}/slowmode)
- Live stream health monitor: GET /api/broadcasts/live/health
- Test mode start: POST /api/broadcasts/{id}/start-test
- Broadcast history (DJ/Admin): see BROADCAST_HISTORY_README.md
- Notifications: real-time + persistence
- Moderation: ban/unban, delete chat messages
- Announcements: draft → review → publish/schedule → pin → archive

Where to find things in code (pointers)
- Backend (Spring Boot): backend/src/main/java/com/wildcastradio
- Frontend (React): frontend/src
- Notable classes:
  - BroadcastController: backend/src/main/java/com/wildcastradio/Broadcast/BroadcastController.java
  - Rate limiting: backend/src/main/java/com/wildcastradio/ratelimit/RateLimitingFilter.java
  - Profanity filter: backend/src/main/java/com/wildcastradio/ChatMessage/ProfanityFilter.java
  - Notifications: backend/src/main/java/com/wildcastradio/Notification

WebSocket Architecture
- **Pure STOMP Architecture** - All text messaging via single STOMP connection (`/ws-radio`)
  - Chat messages: `/topic/broadcast/{id}/chat`
  - Polls: `/topic/broadcast/{id}/polls`
  - Song requests: `/topic/broadcast/{id}/song-requests`
  - Broadcast status: `/topic/broadcast/status`
  - Listener status: `/topic/listener-status`
  - Notifications: `/topic/announcements/public`, `/user/queue/notifications`
- **Raw WebSocket** - Only for DJ audio streaming (`/ws/live`) - Binary ArrayBuffer data
- **Connection Count:** 2 WebSocket connections per user (83% reduction from previous 3)
- See `md/WEBSOCKET_REFACTOR_IMPLEMENTATION_PLAN.md` for detailed architecture documentation

Note
- The repo ships with ICECAST integration for live streaming. Audio recording/archiving is not available.

If you need endpoint payloads or a filtered list for a specific timeframe, see FEATURES.md or ask for an API example.



Also see: ALL_FEATURES.md for the complete, consolidated feature catalog in one file.
