-- Add meeting_link and private_link columns to savvycal_source_mappings table
-- This migration combines both columns to ensure they're added together

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

  -- Add private_link column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'savvycal_source_mappings' 
    AND column_name = 'private_link'
  ) THEN
    ALTER TABLE savvycal_source_mappings 
    ADD COLUMN private_link TEXT;
    
    CREATE INDEX IF NOT EXISTS idx_savvycal_source_mappings_private_link 
    ON savvycal_source_mappings(private_link) WHERE private_link IS NOT NULL;
    
    COMMENT ON COLUMN savvycal_source_mappings.private_link IS 'SavvyCal private link name (often contains source information)';
  END IF;
END $$;






