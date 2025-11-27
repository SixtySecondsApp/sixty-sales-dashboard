-- Migration: Fix fathom_sync_state columns to match edge function expectations
-- Date: 2025-11-28
-- Purpose: Add missing columns that the fathom-sync edge function expects

-- Add last_sync_started_at if it doesn't exist
ALTER TABLE fathom_sync_state
  ADD COLUMN IF NOT EXISTS last_sync_started_at TIMESTAMPTZ;

-- Add last_sync_completed_at if it doesn't exist
ALTER TABLE fathom_sync_state
  ADD COLUMN IF NOT EXISTS last_sync_completed_at TIMESTAMPTZ;

-- Rename error_message to last_sync_error if needed (edge function uses last_sync_error)
-- First check if last_sync_error already exists, if not rename or add
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fathom_sync_state'
    AND column_name = 'last_sync_error'
  ) THEN
    -- Check if error_message exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'fathom_sync_state'
      AND column_name = 'error_message'
    ) THEN
      -- Rename error_message to last_sync_error
      ALTER TABLE fathom_sync_state RENAME COLUMN error_message TO last_sync_error;
    ELSE
      -- Add last_sync_error column
      ALTER TABLE fathom_sync_state ADD COLUMN last_sync_error TEXT;
    END IF;
  END IF;
END $$;

-- Add comment for clarity
COMMENT ON COLUMN fathom_sync_state.last_sync_started_at IS 'Timestamp when the most recent sync started';
COMMENT ON COLUMN fathom_sync_state.last_sync_completed_at IS 'Timestamp when the most recent sync completed';
COMMENT ON COLUMN fathom_sync_state.last_sync_error IS 'Error message from the most recent sync (if any)';
