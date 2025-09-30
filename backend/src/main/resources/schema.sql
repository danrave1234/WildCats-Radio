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

