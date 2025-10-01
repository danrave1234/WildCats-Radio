# Announcements Feature - Moderated Workflow System

A professional moderated announcement system for WildCats Radio with draft-publish workflow, scheduled posting, pinning, and auto-archiving.

## ✨ Core Features

### 1. Moderated Content Workflow
- **DJs** create announcements as **DRAFT**
- **Moderators/Admins** review and approve
- Options: Publish now, schedule for later, reject with feedback (non-destructive), or archive/unarchive
 - DJs can only edit/delete their own DRAFTS (backend-enforced)

### 2. Scheduled Publishing
- Set future publication date/time
- Auto-publishes when scheduled time arrives (every 1 min cron job)
- Optional expiry date for auto-archiving (leave empty for permanent posts)

### 3. Pinned Announcements
- Highlight important announcements at top of feed
- Maximum 2 pinned at any time
- Automatically unpinned when archived

### 4. Auto-Archiving & Rejections
- Set expiry dates on announcements
- Auto-archives when expired (every 5 min cron job)
- Keeps historical records without cluttering public feed
- Archive events record metadata: who archived and when
- Archived announcements can be restored by Moderators/Admins (unarchive to PUBLISHED)
- Rejections are tracked (non-destructive): who rejected, when, and the rejection reason
- DJs can edit and resubmit rejected announcements (moves back to DRAFT)

## 🗄️ Database Schema

```sql
announcements
├── id (BIGINT, PK)
├── title (VARCHAR 500)
├── content (VARCHAR 2000)
├── image_url (VARCHAR 1000, nullable)
├── status (ENUM: DRAFT, REJECTED, SCHEDULED, PUBLISHED, ARCHIVED)
├── scheduled_for (TIMESTAMP, nullable)
├── expires_at (TIMESTAMP, nullable)
├── pinned (BOOLEAN, default false)
├── pinned_at (TIMESTAMP, nullable)
├── created_at (TIMESTAMP)
├── updated_at (TIMESTAMP, nullable)
├── published_at (TIMESTAMP, nullable)
├── created_by_id (BIGINT, FK → users)
├── approved_by_id (BIGINT, FK → users, nullable)
├── archived_by_id (BIGINT, FK → users, nullable)
├── archived_at (TIMESTAMP, nullable)
├── rejected_by_id (BIGINT, FK → users, nullable)
├── rejected_at (TIMESTAMP, nullable)
└── rejection_reason (VARCHAR 500, nullable)

Indexes: created_at, created_by_id, status, scheduled_for, pinned
```

## 🔐 Role Permissions

| Action | DJ | Moderator | Admin |
|--------|----|-----------| ------|
| View published | ✅ | ✅ | ✅ |
| Create draft | ✅ | ❌* | ❌* |
| Edit own draft | ✅ | ✅ | ✅ |
| Delete own draft | ✅ | ✅ | ✅ |
| Publish draft | ❌ | ✅ | ✅ |
| Schedule | ❌ | ✅ | ✅ |
| Pin/Unpin | ❌ | ✅ | ✅ |
| Archive | ❌ | ✅ | ✅ |
| Unarchive | ❌ | ✅ | ✅ |
| View all drafts | ❌ | ✅ | ✅ |
| Edit any | ❌ | ✅ | ✅ |
| Delete any | ❌ | ✅ | ✅ |

*Moderators/Admins create announcements as PUBLISHED (immediate)

## 📡 API Endpoints

### Public (No Auth)
- `GET /api/announcements` - Published only (paginated, pinned first)
- `GET /api/announcements/{id}` - Single announcement

### DJ
- `POST /api/announcements` - Create draft
- `PUT /api/announcements/{id}` - Update own draft
- `DELETE /api/announcements/{id}` - Delete own draft
- `GET /api/announcements/my-announcements` - Own drafts
 - `POST /api/announcements/{id}/resubmit` - Resubmit a REJECTED announcement (returns to DRAFT)

### Moderator/Admin
- All DJ endpoints +
- `GET /api/announcements/by-status/{status}` - Filter by DRAFT, SCHEDULED, PUBLISHED, ARCHIVED
- `POST /api/announcements/{id}/publish` - Publish draft
- `POST /api/announcements/{id}/schedule` - Schedule (body: scheduledFor, expiresAt)
- `POST /api/announcements/{id}/pin` - Pin (max 2)
- `POST /api/announcements/{id}/unpin` - Unpin
- `POST /api/announcements/{id}/archive` - Archive
- `POST /api/announcements/{id}/unarchive` - Restore archived → PUBLISHED
 - `POST /api/announcements/{id}/reject` - Reject with feedback (body: rejectionReason)
- `PUT /api/announcements/{id}` - Edit any
- `DELETE /api/announcements/{id}` - Delete any

## 🔄 Recent Changes (API & Behavior)

### API
- Added status: `REJECTED`
- Added endpoints:
  - `POST /api/announcements/{id}/reject`
    - Purpose: Non-destructive rejection with feedback
    - Body:
      ```json
      { "rejectionReason": "Please include event location." }
      ```
  - `POST /api/announcements/{id}/resubmit`
    - Purpose: DJ resubmits a REJECTED announcement → returns to DRAFT
    - Body: none
  - `POST /api/announcements/{id}/unarchive`
    - Purpose: Restore an ARCHIVED announcement to PUBLISHED
    - Body: none

- DTO/Entity changes:
  - Added `rejectedById`, `rejectedByName`, `rejectedAt`, `rejectionReason`
  - Added `archivedById`, `archivedByName`, `archivedAt`

### Behavior
- DJs can edit their own `DRAFT` or `REJECTED` announcements
- Moderators/Admins can reject with feedback (non-destructive)
- Resubmission flow: `REJECTED` → (DJ edits & resubmits) → `DRAFT`
- Public delete removed for `PUBLISHED`; hard delete is only available for `ARCHIVED` with confirmation
- Tabs:
  - DJ: `Published`, `My Drafts` (only DRAFT), `My Published` (PUBLISHED + ARCHIVED), `Rejected`
  - Mod/Admin: `Published`, `Pending Drafts`, `Scheduled`, `Archived`
- UI:
  - Added confirmation modals for Publish, Reject, and Delete (archived only)
  - Rejection modal widened for comfortable feedback entry
  - Post images now respect natural aspect ratios (square, vertical, horizontal) without cropping

## 🤖 Automated Tasks

### Auto-Publish (Every 1 minute)
Finds `status = SCHEDULED` AND `scheduled_for <= now()`  
→ Changes to `PUBLISHED`, sets `published_at`

### Auto-Archive (Every 5 minutes)
Finds `status = PUBLISHED` AND `expires_at <= now()`  
→ Changes to `ARCHIVED`, removes pin

## 📊 Status Flow

```
DRAFT → (Moderator publishes) → PUBLISHED
       ↓ (Moderator schedules)
   SCHEDULED → (Auto-publish) → PUBLISHED
                                   ↓ (Expires or manual archive)
                               ARCHIVED
       ↑                           ↑
       └─ (Moderator rejects)  REJECTED
            (DJ edits & resubmits) ─→ DRAFT
```

## 🎨 Frontend UI (Current Status)

### ✅ Implemented (Full Moderation UI)
- Public announcement wall (published only, pinned first)
- Role-based tabs:
  - DJ: Published, My Drafts, Rejected
  - Moderator/Admin: Published, Pending Drafts, Scheduled, Archived
- Actions (role-aware):
  - DJ: Edit/Delete own DRAFTS only; Edit/Resubmit REJECTED
  - Moderator/Admin: Publish, Schedule (with optional expiry), Reject with feedback, Pin/Unpin (max 2), Archive/Unarchive, Edit/Delete any
- Status badges: DRAFT, REJECTED, SCHEDULED, PUBLISHED, ARCHIVED
- Scheduling modal with date/time pickers (Publish At required, Auto-Archive optional)
- Pin indicator on published announcements
- Pagination, image display, and navigation integration
- Clear error messages for permission violations

### 🧾 Moderation Metadata (Admins/Moderators View Only)
- Published announcements display: "Approved by <Name>" and approval time
- Archived announcements display: "Archived by <Name>" and archive time
- Expiration info shown when set (non-archived)
 - Rejected announcements display: "Rejected by <Name>", rejection time, and rejection reason

### 🧹 Streamlined Actions
- DJs see Edit/Delete only on their own DRAFTS
- Moderators/Admins see Approve, Schedule, Reject (with confirmation modal) on DRAFTS (no duplicate delete buttons)
- Archived posts show Unarchive and Delete Permanently (for Moderators/Admins)
 - DJs can Edit & Resubmit REJECTED announcements (returns to DRAFT)

### 📝 Dedicated Create/Edit Page
- `/announcements/create` – Create announcements
- `/announcements/edit/:id` – Edit existing announcements (role-enforced)
- **Enhanced UI**: Modern card-based design with maroon theme, character counters, and image preview
- **DJ Flow**: Simplified draft-only submission with clear approval messaging
- **Moderator/Admin Flow**: 
  - Radio button selector for publishing mode (Draft / Publish Now / Schedule)
  - Schedule option expands to show date/time pickers with visual feedback
  - Optional auto-archive date for time-limited announcements
- **Auth Fix**: Now uses HttpOnly cookie authentication instead of token headers

### ✨ Visual Enhancements (Theme-aligned)
- Gradient backgrounds, rounded cards (`rounded-xl`), and subtle shadows for depth
- Improved tabs with active gradients and scale transitions
- Action buttons with clear icons and consistent colors for intent
- Refined empty states and headers to add character without breaking theme

## 💡 Usage Examples

### Example 1: DJ Creates Announcement
```
1. DJ creates: "Rock Hour Tonight at 8PM!"
   → Status: DRAFT
2. Moderator reviews → Approves
   → Status: PUBLISHED (appears on public wall)
3. Moderator pins it
   → Appears at top of announcements
4. Auto-archives tomorrow (if expires_at set)
   → Status: ARCHIVED (hidden from public)
```

### Example 2: Pre-Scheduled Event
```
1. DJ creates: "Campus Festival Next Week"
   → Status: DRAFT
2. Moderator schedules for Oct 10, 2025 8:00 AM
   → Status: SCHEDULED (hidden from public)
3. On Oct 10 at 8:00 AM (auto-publish runs)
   → Status: PUBLISHED (appears on public wall)
4. Moderator set expires_at = Oct 12, 2025
5. On Oct 12 (auto-archive runs)
   → Status: ARCHIVED
```

## 🚀 Deployment

**Backend (Spring Boot → Cloud Run)**
- All files created, no linting errors ✅
- Database table auto-created by Hibernate
- Cron jobs enabled

**Frontend (React → Vercel)**
- Public wall and full moderation UI implemented ✅

## 📚 Documentation

1. `ANNOUNCEMENT_PERMISSIONS_MATRIX.md` - Complete role/permission matrix
2. `ANNOUNCEMENT_SYSTEM_IMPLEMENTATION_COMPLETE.md` - Implementation details
3. `ANNOUNCEMENTS_FEATURE.md` (this file) - Feature overview

---

**Status**: Backend ✅ Complete | Frontend ✅ Complete
