-- Verify and add registration_url column if it doesn't exist
-- Run this in Supabase SQL Editor to ensure the column exists

-- Check if column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'meetings_waitlist' 
    AND column_name = 'registration_url'
  ) THEN
    -- Add the column if it doesn't exist
    ALTER TABLE meetings_waitlist
    ADD COLUMN registration_url TEXT;
    
    -- Add index
    CREATE INDEX IF NOT EXISTS idx_waitlist_registration_url ON meetings_waitlist(registration_url);
    
    -- Add comment
    COMMENT ON COLUMN meetings_waitlist.registration_url IS 'Full URL (path + query params) where the user registered from. Tracks access links like /waitlist, /introduction, /intro, /signup';
    
    RAISE NOTICE 'registration_url column added successfully';
  ELSE
    RAISE NOTICE 'registration_url column already exists';
  END IF;
END $$;

-- Verify the column exists and show sample data
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'meetings_waitlist'
AND column_name = 'registration_url';

-- Show a few recent entries to see registration_url values
SELECT 
  id,
  email,
  registration_url,
  created_at
FROM meetings_waitlist
ORDER BY created_at DESC
LIMIT 5;


