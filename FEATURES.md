# WildCats Radio - Key Features

This document summarizes notable product features and how to use or configure them.

## 1. Degraded Broadcast Start (Resilient Start)

Why this exists:
- Prevents hard failures when the Icecast server is temporarily unreachable (network outage, maintenance, local dev with no Icecast).
- Lets a DJ start a scheduled show on time, unblocking chat, schedule activation, and UI workflows even if streaming is temporarily impaired.
- Enables demos and QA in environments that don’t have Icecast.

How it works:
- When starting a broadcast, the backend checks Icecast availability.
- If Icecast is not reachable and degraded mode is allowed, the broadcast still transitions to LIVE and uses a configurable fallback stream URL.
- The fallback URL is tagged with `?degraded=true` so clients can detect and display a warning UI.
- The live stream health monitor continues polling Icecast and will clear the degraded state once the source connects and stream becomes healthy.

Detecting it in clients:
- Call GET /api/broadcasts/live/health and read `degradedMode`.
- Or inspect the broadcast DTO’s `streamUrl` for the `?degraded=true` flag.

Configuration (application.properties or environment):
- `icecast.allowDegradedStart` (default: true)
- `icecast.fallbackStreamUrl` (default: https://icecast.software/live.ogg)

Operational guidance:
- For production environments where strict behavior is required, set `ICECAST_ALLOW_DEGRADED_START=false` to prevent starting when Icecast is down.
- In dev/QA, leave it enabled to simplify testing without Icecast.

## 2. Live Stream Health Monitor
- Periodically checks Icecast reachability, mount status, source, and bitrate.
- Provides a snapshot via GET /api/broadcasts/live/health with: `healthy`, `recovering`, `broadcastLive`, `listenerCount`, `lastCheckedAt`, `autoEndOnUnhealthy`, `healthCheckEnabled`, and `degradedMode`.
- Optionally auto-ends a broadcast after sustained unhealthy checks when `broadcast.healthCheck.autoEnd=true`.

## 3. Listener Status WebSocket
- Real-time updates to connected listeners with `STREAM_STATUS` messages.
- Includes fields: `isLive`, `listenerCount`, `peakListenerCount`, and current `broadcastId`.
- JWT-aware; also tolerates anonymous sessions.

## 4. Chat Slow Mode
- Per-broadcast slow mode to limit message frequency.
- Update via PUT /api/broadcasts/{id}/slowmode with `{ enabled, seconds }`.

## 5. Test Mode Start
- DJ/Admin can start a broadcast in test mode via POST /api/broadcasts/{id}/start-test.
- Skips Icecast checks and tags stream URL with `?test=true`.

For more operational notes, see ROADMAP.md.