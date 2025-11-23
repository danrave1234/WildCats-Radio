-- Safe schema adjustments for users table to match UserEntity
-- Executes before JPA validation. Uses IF NOT EXISTS to be idempotent.

-- Add ban-related columns
ALTER TABLE IF EXISTS users
    ADD COLUMN IF NOT EXISTS banned boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS banned_until timestamp NULL,
    ADD COLUMN IF NOT EXISTS banned_at timestamp NULL,
    ADD COLUMN IF NOT EXISTS ban_reason varchar(500) NULL,
    ADD COLUMN IF NOT EXISTS warning_count integer DEFAULT 0 NOT NULL;

-- Ensure existing rows have defaults applied explicitly
UPDATE users SET banned = COALESCE(banned, false);
UPDATE users SET warning_count = COALESCE(warning_count, 0);

-- Add original_content to chat_messages for storing raw message before censoring
ALTER TABLE IF EXISTS chat_messages
	ADD COLUMN IF NOT EXISTS original_content TEXT;

-- Broadcast entity migration: embed schedule fields
-- Add embedded schedule columns to broadcasts table
ALTER TABLE IF EXISTS broadcasts
    ADD COLUMN IF NOT EXISTS scheduled_start timestamp NULL,
    ADD COLUMN IF NOT EXISTS scheduled_end timestamp NULL;

-- Migrate data from schedule table to broadcasts table (only if schedule table exists and has data)
-- First, migrate scheduled broadcasts
UPDATE broadcasts
SET scheduled_start = s.scheduled_start,
    scheduled_end = s.scheduled_end
FROM schedule s
WHERE broadcasts.schedule_id = s.id AND broadcasts.schedule_id IS NOT NULL;

-- Set default past times for broadcasts that don't have schedule data (immediate broadcasts)
-- For broadcasts that have started, set scheduled_start to 1 minute before actual_start
UPDATE broadcasts
SET scheduled_start = actual_start - INTERVAL '1 minute',
    scheduled_end = COALESCE(actual_end, actual_start + INTERVAL '2 hours')
WHERE scheduled_start IS NULL AND actual_start IS NOT NULL;

-- For broadcasts that haven't started yet, set past times based on created_at
UPDATE broadcasts
SET scheduled_start = created_at - INTERVAL '1 minute',
    scheduled_end = created_at + INTERVAL '2 hours'
WHERE scheduled_start IS NULL;

-- Now safe to drop the foreign key and column
ALTER TABLE broadcasts DROP CONSTRAINT IF EXISTS fk_broadcast_schedule;
ALTER TABLE broadcasts DROP COLUMN IF EXISTS schedule_id;

-- Drop the schedule table if it exists
DROP TABLE IF EXISTS schedule;

-- Database Performance Indexes
-- Critical indexes for frequently queried fields to improve query performance

-- Broadcast indexes (most queried table)
CREATE INDEX IF NOT EXISTS idx_broadcast_status ON broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_broadcast_created_by ON broadcasts(created_by_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_actual_start ON broadcasts(actual_start);
CREATE INDEX IF NOT EXISTS idx_broadcast_scheduled_start ON broadcasts(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_broadcast_created_by_status ON broadcasts(created_by_id, status);
CREATE INDEX IF NOT EXISTS idx_broadcast_status_scheduled ON broadcasts(status, scheduled_start);

-- Chat message indexes (high volume table)
CREATE INDEX IF NOT EXISTS idx_chat_broadcast_id ON chat_messages(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_broadcast_created_at ON chat_messages(broadcast_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_sender_created_at ON chat_messages(sender_id, created_at);

-- Song request indexes
CREATE INDEX IF NOT EXISTS idx_song_request_broadcast ON song_requests(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_song_request_requested_by ON song_requests(requested_by_id);
CREATE INDEX IF NOT EXISTS idx_song_request_status ON song_requests(status);
CREATE INDEX IF NOT EXISTS idx_song_request_broadcast_status ON song_requests(broadcast_id, status);

-- User indexes
CREATE INDEX IF NOT EXISTS idx_user_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_user_banned ON users(banned);

-- Activity log indexes (for analytics)
CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON activity_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON activity_logs(activity_type);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notification_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_read ON notifications(read_status);
CREATE INDEX IF NOT EXISTS idx_notification_created_at ON notifications(created_at);

-- Fix activity_logs table to allow null user_id for system events (health checks, recovery, etc.)
-- This allows logging system-level events that don't have an associated user
-- Note: PostgreSQL doesn't support IF EXISTS with ALTER COLUMN, but this is safe to run multiple times
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'activity_logs' 
               AND column_name = 'user_id' 
               AND is_nullable = 'NO') THEN
        ALTER TABLE activity_logs ALTER COLUMN user_id DROP NOT NULL;
    END IF;
END $$;

-- DJ Handover Feature: Add current_active_dj_id to broadcasts table
ALTER TABLE IF EXISTS broadcasts
    ADD COLUMN IF NOT EXISTS current_active_dj_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_broadcast_current_dj ON broadcasts(current_active_dj_id);

-- Migrate existing data: set current_active_dj_id to started_by_id for LIVE broadcasts
UPDATE broadcasts 
SET current_active_dj_id = started_by_id 
WHERE status = 'LIVE' AND started_by_id IS NOT NULL AND current_active_dj_id IS NULL;

-- For ended broadcasts, set to started_by_id if available
UPDATE broadcasts 
SET current_active_dj_id = started_by_id 
WHERE status = 'ENDED' AND started_by_id IS NOT NULL AND current_active_dj_id IS NULL;

-- Create DJ handovers table
CREATE TABLE IF NOT EXISTS dj_handovers (
    id BIGSERIAL PRIMARY KEY,
    broadcast_id BIGINT NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
    previous_dj_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    new_dj_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    handover_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    initiated_by_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reason VARCHAR(500),
    duration_seconds BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_handover_broadcast ON dj_handovers(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_handover_new_dj ON dj_handovers(new_dj_id);
CREATE INDEX IF NOT EXISTS idx_handover_time ON dj_handovers(handover_time);
CREATE INDEX IF NOT EXISTS idx_handover_broadcast_time ON dj_handovers(broadcast_id, handover_time);

-- DJ Handover Account Switching Feature: Add auth_method column to dj_handovers table
-- This column tracks whether handover used STANDARD (no auth) or ACCOUNT_SWITCH (password auth) method
ALTER TABLE IF EXISTS dj_handovers 
    ADD COLUMN IF NOT EXISTS auth_method VARCHAR(50) DEFAULT 'STANDARD';

CREATE INDEX IF NOT EXISTS idx_handover_auth_method ON dj_handovers(auth_method);

-- Update existing records to have STANDARD auth method (for backward compatibility)
UPDATE dj_handovers 
SET auth_method = 'STANDARD' 
WHERE auth_method IS NULL;

