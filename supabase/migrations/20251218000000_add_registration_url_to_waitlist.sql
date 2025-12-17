-- Add registration_url column to track which access link users registered from
-- This helps track signups from different landing pages like /waitlist, /introduction, /intro, /signup

ALTER TABLE meetings_waitlist
ADD COLUMN IF NOT EXISTS registration_url TEXT;

-- Add index for querying by registration URL
CREATE INDEX IF NOT EXISTS idx_waitlist_registration_url ON meetings_waitlist(registration_url);

-- Add comment
COMMENT ON COLUMN meetings_waitlist.registration_url IS 'Full URL (path + query params) where the user registered from. Tracks access links like /waitlist, /introduction, /intro, /signup';


