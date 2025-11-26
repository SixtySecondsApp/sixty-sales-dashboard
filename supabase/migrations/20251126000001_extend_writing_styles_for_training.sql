-- Extend user_writing_styles table with training metadata for email-based style extraction
-- This migration adds support for AI-analyzed writing styles from Gmail sent emails

-- Add new columns for training metadata
ALTER TABLE user_writing_styles
ADD COLUMN IF NOT EXISTS style_metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS source_email_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS trained_at TIMESTAMPTZ;

-- Add constraint for source type (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_writing_styles_source_check'
  ) THEN
    ALTER TABLE user_writing_styles
    ADD CONSTRAINT user_writing_styles_source_check
    CHECK (source IN ('manual', 'email_training'));
  END IF;
END $$;

-- Create GIN index for JSONB queries on style_metadata
CREATE INDEX IF NOT EXISTS idx_user_writing_styles_metadata
ON user_writing_styles USING GIN (style_metadata);

-- Add comments for documentation
COMMENT ON COLUMN user_writing_styles.style_metadata IS
'Rich metadata extracted from email analysis: tone characteristics, structural patterns, vocabulary profile, greetings/signoffs';

COMMENT ON COLUMN user_writing_styles.source IS
'How this style was created: manual (user-entered) or email_training (extracted from Gmail)';

COMMENT ON COLUMN user_writing_styles.source_email_count IS
'Number of emails analyzed to create this style (only for email_training source)';

COMMENT ON COLUMN user_writing_styles.trained_at IS
'Timestamp when this style was trained from emails (only for email_training source)';
