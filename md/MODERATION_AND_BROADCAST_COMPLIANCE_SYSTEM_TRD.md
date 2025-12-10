# Moderation & Broadcast Compliance TRD (WildCats Radio, Finalized)

Updated: 2025-12-10  
Scope: Full implementation of moderation controls for WildCats Radio (Spring Boot backend, React web frontend).

## 1. System Overview
- **Purpose**: Automate and standardize chat/broadcast moderation for WildCats Radio.
- **Components**: Strike System, Tiered Keyword Filter, Banlist Management (DB), Appeals Process, Audit Logs, Enhanced Export.

## 2. Functional Requirements

### 2.1 Three-Strike Automated Discipline
- **Structure**:
  - **Strike 1 (Warning)**: Notification sent to user. No functional restriction.
  - **Strike 2 (24h Ban)**: User banned from chat for 24 hours.
  - **Strike 3 (7-Day Ban)**: User banned for 7 days. Can appeal.
- **Logic**: 
  - Strikes expire/decay after 30 days for calculation purposes.
  - Consecutive violations escalate the strike level.

### 2.2 Tiered Keyword Moderation
- **Tier 1 (Soft)**: Auto-replace message (Censor). No strike. Logged as Tier 1 event.
- **Tier 2 (Harsh)**: Auto-replace + Strike 1 (Warning).
- **Tier 3 (Slur/Hate)**: Auto-replace + Strike 2 (Immediate 24h Ban) or Strike 3 if repeat.
- **External AI**: Perspective API scores >= 0.85 treated as Tier 1 (Censor).

### 2.3 Banlist Dictionary
- **Storage**: Database (`banlist_words`) with versioning.
- **Management**: 
  - Admins can CRUD words and assign tiers (1, 2, 3).
  - Moderators/DJs can view list.
- **Sync**: Backend refreshes in-memory filter on changes.

### 2.4 Manual Moderator Actions
- **Delete**: Moderator deletes message -> Logged to `moderator_actions`.
- **Ban/Warn**: Manual actions via Dashboard -> Logged.
- **Censor**: Manual censor tool (delete) available.

### 2.5 Appeals
- **Flow**: Banned user creates appeal -> Status PENDING -> Moderator reviews -> Status APPROVED/DENIED.
- **Outcome**: Approval auto-unbans user.

## 3. Data Requirements
- `strike_events`: Logs every strike (user, level, reason).
- `moderator_actions`: Audit log for manual interventions.
- `banlist_words`: Tiered words.
- `appeals`: User appeals.

## 4. Broadcast Export Requirements
- **Format**: Excel (`.xlsx`)
- **Sheets**:
  1.  **Chat Messages**: Full log with yellow highlight for censored.
  2.  **Broadcast Info**: Metadata + Stats.
  3.  **Analytics**: Sender stats, demographics.
  4.  **Strikes**: List of strike events during broadcast.
  5.  **Moderator Actions**: Log of manual actions.

## 5. API Endpoints
- `POST /api/chats/{broadcastId}`: Send message (runs moderation).
- `GET /api/chats/{broadcastId}/export`: Enhanced export.
- `DELETE /api/chats/messages/{id}`: Manual delete (logs action).
- `GET /api/moderation/keywords`: List banlist.
- `POST/PUT/DELETE /api/moderation/keywords`: Admin management.
- `POST /api/moderation/appeals`: Create appeal.
- `GET /api/moderation/appeals/pending`: List appeals.
- `PUT /api/moderation/appeals/{id}/resolve`: Resolve appeal.

## 6. UI/UX
- **Moderator Dashboard**:
  - Live Broadcasts list.
  - User management (Role assignment).
  - Profanity Dictionary (View/Edit for Admin).
  - (Future) Appeals handling UI.
- **Chat Interface**:
  - Shows "Message censored" if replaced.
  - Shows Strike/Ban notifications via WebSocket/Toast.
