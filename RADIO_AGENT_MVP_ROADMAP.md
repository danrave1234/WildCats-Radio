# HTTP Agent MVP — Liquidsoap Start/Stop Integration Roadmap

This roadmap implements the HTTP-agent approach to control Liquidsoap (start/stop) from the backend and surfaces Start Server / End Broadcast controls in the DJ dashboard. It builds on the VM and firewall changes you already applied.

## Scope and assumptions

- VM hosts Icecast + Liquidsoap. A minimal HTTP agent is running (Flask or equivalent), bound to a restricted port, protected by a Bearer token, with sudoers allowing only `systemctl {start|stop|status} liquidsoap-radio`.
- Backend is Spring Boot (3.x). Frontend is React (Vite) in `frontend/`.
- Avoids browser-based audio capture for DJs; DJs use BUTT to connect to Icecast. The web app only starts/stops the Liquidsoap service and shows status.

---

## Backend plan (Spring Boot)

### 1) Configuration properties

Add the following to `backend/src/main/resources/application.properties` (these match your proposal and support env overrides):

```
radio.agent.baseUrl=${RADIO_AGENT_BASEURL:http://34.150.12.40:5000}
radio.agent.token=${RADIO_AGENT_TOKEN:hackme}
radio.agent.timeoutMs=${RADIO_AGENT_TIMEOUT_MS:5000}
```

### 2) Create a typed configuration bean

File: `backend/src/main/java/com/wildcastradio/radio/RadioAgentProperties.java`

- Holds `baseUrl`, `token`, `timeoutMs`.
- Annotate with `@ConfigurationProperties("radio.agent")` + `@Component`.

### 3) Create a small client service for the agent

File: `backend/src/main/java/com/wildcastradio/radio/RadioAgentClient.java`

- Use a dedicated `RestTemplate` or `WebClient` with connect/read timeouts from `timeoutMs`.
- Always set `Authorization: Bearer <token>`.
- Methods: `start()`, `stop()`, `status()` → all return a simple `Map<String,Object>` or a tiny DTO with `state`, `detail`, `at`.
- Map errors:
  - Connect/timeout → throw a custom `AgentUnavailableException` (later mapped to 504/502).
  - 401/403 from agent → map to 502 with safe message (backend creds misconfigured).

### 4) Controller (proxy endpoints)

File: `backend/src/main/java/com/wildcastradio/radio/RadioControlController.java`

- Mapping: `@RestController` `@RequestMapping("/api/radio")`.
- Endpoints and guards:
  - `POST /start` → `@PreAuthorize("hasAnyRole('DJ','ADMIN','MODERATOR')")`
  - `POST /stop`  → `@PreAuthorize("hasAnyRole('DJ','ADMIN','MODERATOR')")`
  - `GET /status` → `@PreAuthorize("hasAnyRole('DJ','ADMIN','MODERATOR','LISTENER')")` (or open if you prefer)
- Behavior:
  - Call `RadioAgentClient` and return body/status transparently.
  - Handle exceptions: timeout/unavailable → 504/502 with `{ "state":"unknown", "detail":"agent timeout" }`.
- Logging (optional but recommended):
  - Use `ActivityLogService` to log start/stop attempts with the authenticated user. If you prefer a typed enum, add new `ActivityType` values (e.g., `SERVER_START`, `SERVER_STOP`). If not adding new enums, reuse `PROFILE_UPDATE` with a precise description like "Radio server start requested by <email>".

### 5) Security, rate limiting, CORS

- Method security is already enabled in `SecurityConfig` via `@EnableMethodSecurity`.
- Your `RateLimitingFilter` already protects API paths; ensure `/api/radio/*` follows the same policy.
- CORS: these calls originate from your frontend → backend only, so default CORS is fine.

### 6) Optional: enrich status with Icecast health

- In `GET /api/radio/status`, you can also include:
  - `streamLive`: from `IcecastService.isStreamLive(false)`
  - `currentListeners`: from `ListenerTrackingService.getCurrentListenerCount()`
- UI can show a confident "Live" badge when both `state==running` and `streamLive==true`.

---

## Frontend plan (React)

### 1) Service module

File: `frontend/src/services/radio.js`

```js
const API_BASE = "/api/radio";

export async function startRadio() {
  const res = await fetch(`${API_BASE}/start`, { method: "POST", credentials: "include" });
  if (!res.ok) throw new Error(`start failed (${res.status})`);
  return res.json().catch(() => ({}));
}

export async function stopRadio() {
  const res = await fetch(`${API_BASE}/stop`, { method: "POST", credentials: "include" });
  if (!res.ok) throw new Error(`stop failed (${res.status})`);
  return res.json().catch(() => ({}));
}

export async function getRadioStatus() {
  const res = await fetch(`${API_BASE}/status`, { credentials: "include" });
  if (!res.ok) throw new Error(`status failed (${res.status})`);
  return res.json();
}
```

Export from your existing service index if applicable.

### 2) DJ dashboard UX changes (BUTT workflow)

File: `frontend/src/pages/DJDashboard.jsx`

- Remove/disable the Audio Source selection screens (no browser audio capture for the MVP):
  - Hide `AudioSourceSelector` and any streaming-context audio-start flows in Create/Ready steps.
  - Do not call `useStreaming().startBroadcast()`; DJs stream via BUTT.
- Add Start/Stop controls:
  - After creating a broadcast (READY_TO_STREAM), show "Start Radio Server" → calls `startRadio()`.
  - When the broadcast/day ends and the DJ disconnects from BUTT, show "Stop Radio Server" → calls `stopRadio()`.
- Status polling:
  - Poll `getRadioStatus()` every ~10s; show badge: Offline (stopped) / Live (running; optionally enriched by Icecast live) / Unknown (errors).
  - Disable Start if state is `running`; disable Stop if `stopped`; both are idempotent.
- Optional: when stopping, also call your backend broadcast end endpoint so the broadcast is marked ENDED in analytics/history.

#### New BUTT-first broadcast flow (web)

1) DJ creates a broadcast (content-only: title/description/times). No audio-source UI.
2) Immediately present "Start Radio Server" (idempotent). Clicking calls `/api/radio/start`.
3) DJ connects via BUTT to Icecast; web dashboard shows status, chat, polls, requests.
4) Additional broadcasts can be created while the server stays up (same day). Start is still idempotent.
5) At end of show/day (e.g., ~5 PM), click "Stop Radio Server" (idempotent).

UI state tips:
- Treat `{ state: "running" }` as server up. If also `streamLive==true`, display "Live"; otherwise "Starting".
- Treat `{ state: "stopped" }` as Offline.

---

## Step-by-step implementation checklist

1) Properties
   - Add `radio.agent.*` properties (as above).

2) Backend code
   - Add `RadioAgentProperties` (config bean).
   - Add `RadioAgentClient` (start/stop/status with timeouts and bearer token).
   - Add `RadioControlController` with `@PreAuthorize` guards and error mapping.
   - (Optional) Add `SERVER_START` / `SERVER_STOP` to `ActivityLogEntity.ActivityType` and log via `ActivityLogService`.

3) Frontend code
   - Add `frontend/src/services/radio.js` and export from your API index if needed.
   - Update `DJDashboard.jsx`:
     - Remove Audio Source UI and streaming-context audio-start calls (no browser streaming).
     - Add Start/Stop buttons wired to radio service.
     - Add 10s polling to `/api/radio/status` and show state badge (Offline/Live/Unknown with idempotent buttons).

4) Testing (manual)
   - Agent down → `/api/radio/status` returns 502/504; UI shows error and leaves last known state.
   - `POST /api/radio/start` → agent returns `{ state:"running" }`; Icecast mount becomes available; BUTT connects successfully.
   - `POST /api/radio/stop` → `{ state:"stopped" }`; mount disappears; idempotent if already stopped.
   - Repeat start/stop; verify idempotency and UI disable states.

5) Security checks
   - Ensure agent firewall allows only backend egress IP/VPC access.
   - Ensure `RADIO_AGENT_TOKEN` is strong and not committed.
   - Confirm `@PreAuthorize` is in place for `/api/radio/*`.
   - Confirm rate limiter behavior for `/api/radio/*` is acceptable.

---

## Example requests

```bash
# Status
curl -sfSL -H "Authorization: Bearer $RADIO_AGENT_TOKEN" \
  "$RADIO_AGENT_BASEURL/status" | jq .

# Start via backend proxy (requires auth cookie/JWT to backend)
curl -X POST -H "Cookie: <session>" https://<backend>/api/radio/start

# Stop via backend proxy
curl -X POST -H "Cookie: <session>" https://<backend>/api/radio/stop
```

---

## Acceptance criteria

- Backend:
  - `/api/radio/start`, `/api/radio/stop`, `/api/radio/status` work and are role-protected.
  - Timeouts and agent errors are handled cleanly (no backend crash, clear 5xx JSON).
  - Activity log (optional) records who initiated start/stop.
- Frontend:
  - Audio Source UI removed from DJ flow (BUTT-first).
  - Start/Stop buttons work; status badge updates every ~10s.
  - Idempotent UX (no duplicate operations; proper disabled states).
  - Create→Start Server→BUTT Connect→Stop Server is seamless and resilient to repeated clicks.

---

## Risks and mitigations

- Agent exposure: ensure firewall restricts port 5000. Token must be strong and rotated if leaked.
- Partial failure: show error toast and keep last known state; allow retry.
- Drift between Liquidsoap and Icecast: use Icecast health in status endpoint to display more accurate state.

---

## Future migration (Pub/Sub or SSH-less control)

- Replace HTTP agent with Pub/Sub-triggered Cloud Function or an internal control plane.
- Preserve frontend API shape so UI stays unchanged; only backend `RadioAgentClient` swaps implementation.


