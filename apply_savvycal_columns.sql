-- Apply meeting_link and private_link columns to savvycal_source_mappings
-- Run this in Supabase SQL Editor if migrations haven't been applied

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
    
    RAISE NOTICE 'Added meeting_link column';
  ELSE
    RAISE NOTICE 'meeting_link column already exists';
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
    
    RAISE NOTICE 'Added private_link column';
  ELSE
    RAISE NOTICE 'private_link column already exists';
  END IF;
END $$;

-- Verify columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'savvycal_source_mappings' 
  AND column_name IN ('meeting_link', 'private_link')
ORDER BY column_name;








