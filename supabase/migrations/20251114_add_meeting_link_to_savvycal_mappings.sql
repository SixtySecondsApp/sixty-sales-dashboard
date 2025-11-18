-- Add meeting_link column to savvycal_source_mappings table
-- This stores the SavvyCal link slug (e.g., /bookdemo, /demo, /chatwithus)

DO $$
BEGIN
  -- Add meeting_link column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'savvycal_source_mappings' 
    AND column_name = 'meeting_link'
  ) THEN
    ALTER TABLE savvycal_source_mappings 
    ADD COLUMN meeting_link TEXT;
    
    CREATE INDEX IF NOT EXISTS idx_savvycal_source_mappings_meeting_link 
    ON savvycal_source_mappings(meeting_link) WHERE meeting_link IS NOT NULL;
    
    COMMENT ON COLUMN savvycal_source_mappings.meeting_link IS 'SavvyCal meeting link slug (e.g., /bookdemo, /demo, /chatwithus)';
  END IF;
END $$;






