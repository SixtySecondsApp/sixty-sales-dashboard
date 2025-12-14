-- Add LinkedIn boost tracking columns to meetings_waitlist table
-- This migration adds support for one-time 50-position boost on first LinkedIn share

DO $$
BEGIN
  -- Add linkedin_share_claimed column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings_waitlist'
    AND column_name = 'linkedin_share_claimed'
  ) THEN
    ALTER TABLE meetings_waitlist
    ADD COLUMN linkedin_share_claimed BOOLEAN DEFAULT FALSE;

    RAISE NOTICE 'Added linkedin_share_claimed column';
  ELSE
    RAISE NOTICE 'linkedin_share_claimed column already exists';
  END IF;

  -- Add linkedin_first_share_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings_waitlist'
    AND column_name = 'linkedin_first_share_at'
  ) THEN
    ALTER TABLE meetings_waitlist
    ADD COLUMN linkedin_first_share_at TIMESTAMPTZ;

    RAISE NOTICE 'Added linkedin_first_share_at column';
  ELSE
    RAISE NOTICE 'linkedin_first_share_at column already exists';
  END IF;
END $$;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'meetings_waitlist'
AND column_name IN ('linkedin_share_claimed', 'linkedin_first_share_at')
ORDER BY column_name;
