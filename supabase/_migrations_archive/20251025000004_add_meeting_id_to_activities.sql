-- Add meeting_id to activities table for Fathom meeting integration
-- This allows linking activities to Fathom meeting records

ALTER TABLE activities ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_activities_meeting_id ON activities(meeting_id);

-- Add comment for documentation
COMMENT ON COLUMN activities.meeting_id IS 'Foreign key to meetings table for Fathom meeting integration';

-- Add activity type for Fathom meetings if not exists
-- First, check if activity_type enum exists and add fathom_meeting if needed
DO $$
BEGIN
  -- Try to add fathom_meeting to activity_type enum if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = 'activity_type'::regtype
    AND enumlabel = 'fathom_meeting'
  ) THEN
    ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'fathom_meeting';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- If activity_type is not an enum, activities.type might be TEXT
    -- In which case, no action needed
    NULL;
END $$;
