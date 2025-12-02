-- ============================================================================
-- INCREMENTAL MIGRATION: Add Missing Columns to meetings_waitlist
-- ============================================================================
-- Run this in Supabase SQL Editor to add missing columns without data loss
-- This fixes the "Could not find column" errors
-- ============================================================================

-- Add missing tool "other" columns if they don't exist
DO $$
BEGIN
  -- Add dialer_other column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings_waitlist' AND column_name = 'dialer_other'
  ) THEN
    ALTER TABLE meetings_waitlist ADD COLUMN dialer_other TEXT;
    RAISE NOTICE 'Added column: dialer_other';
  ELSE
    RAISE NOTICE 'Column dialer_other already exists';
  END IF;

  -- Add meeting_recorder_other column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings_waitlist' AND column_name = 'meeting_recorder_other'
  ) THEN
    ALTER TABLE meetings_waitlist ADD COLUMN meeting_recorder_other TEXT;
    RAISE NOTICE 'Added column: meeting_recorder_other';
  ELSE
    RAISE NOTICE 'Column meeting_recorder_other already exists';
  END IF;

  -- Add crm_other column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings_waitlist' AND column_name = 'crm_other'
  ) THEN
    ALTER TABLE meetings_waitlist ADD COLUMN crm_other TEXT;
    RAISE NOTICE 'Added column: crm_other';
  ELSE
    RAISE NOTICE 'Column crm_other already exists';
  END IF;

END $$;

-- ============================================================================
-- Verify the columns were added
-- ============================================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'meetings_waitlist'
AND column_name IN ('dialer_other', 'meeting_recorder_other', 'crm_other')
ORDER BY column_name;

-- ============================================================================
-- MIGRATION COMPLETE!
-- ============================================================================
-- The missing columns have been added. You can now use the waitlist form.
-- ============================================================================
