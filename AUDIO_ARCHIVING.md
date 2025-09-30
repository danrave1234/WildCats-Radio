# Broadcast Audio Archiving — Current Status and Options

Last updated: 2025-09-20

## Short answer
- We do NOT currently store or archive broadcast audio on the server by default. The platform streams live via Icecast, but no automatic recording is enabled.
- If you need recordings, see the options below to enable archiving with minimal changes.

## Why there is no recording by default
- Storage cost and legal/policy considerations (student privacy, music licensing) vary by deployment.
- Simpler operations: fewer moving parts and no background file management.

## Options to enable archiving (pick one)

### Option A: Server‑side archiving via Icecast + FFmpeg (recommended)
- Record from the Icecast mountpoint to a file while a broadcast is LIVE.
- Pros: Server‑controlled, consistent format (e.g., MP3), independent of the DJ browser.
- Cons: Requires FFmpeg and a background process.

Implementation outline:
1) Ensure FFmpeg is installed (already present in backend Dockerfile).
2) Add a small Spring Boot service to start/stop recording tied to broadcast lifecycle:
   - On broadcast start: spawn FFmpeg to pull from Icecast and write to `uploads/archives/{broadcastId}-{timestamp}.mp3`
   - On broadcast end: stop the process, finalize file, and store a DB record (path, size, duration, createdAt)
3) Expose read endpoints (role restricted to DJ/Admin):
   - GET `/api/broadcasts/{id}/recording` → returns metadata or 404 if not recorded
   - GET `/api/broadcasts/{id}/recording/download` → streams the MP3 file
4) Add retention policy (e.g., delete files older than 30 days via a scheduled task).

Example FFmpeg command:
```
ffmpeg -y -i http://localhost:8000/live -c copy -f mp3 uploads/archives/{broadcastId}-{YYYYMMDD-HHmmss}.mp3
```
Adjust the Icecast stream URL, mountpoint, and auth as required.

### Option B: Client‑side capture via MediaRecorder (fallback)
- Capture audio in the DJ’s browser with MediaRecorder and upload chunks to the server.
- Pros: No server pull; flexible.
- Cons: Browser‑dependent, network interruptions can cause gaps.

Implementation outline:
- Use existing MediaRecorder hooks in `frontend/src/context/StreamingContext.jsx` to capture audio while LIVE
- POST chunks to a new backend endpoint that assembles and stores as WebM/Opus or transcodes to MP3
- Same endpoints and retention policy as Option A

## Minimal schema addition (when you decide to enable)
```
RecordingEntity: id, broadcast_id (FK), path, size_bytes, duration_seconds, format, created_at, expires_at, status
```

## Security & Governance
- Restrict downloads to DJ/Admin (Moderator read-only if desired)
- Consider watermarking, access logs, and per-file signed URLs if exposed publicly
- Confirm licensing for recorded content

## Current repository status
- Live streaming via Icecast is implemented.
- No RecordingEntity/Controller exists and no archive files are created automatically.
- A top-level `uploads/` directory exists and can be used for storing archives once enabled.

If you want us to implement Option A or B now, say which you prefer and your desired retention window (e.g., 30/60/90 days).