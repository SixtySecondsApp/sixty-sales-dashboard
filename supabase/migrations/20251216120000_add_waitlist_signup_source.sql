-- Add signup_source column to track which landing variation converted
-- Values: 'landing', 'waitlist', 'join-popup'

ALTER TABLE meetings_waitlist ADD COLUMN IF NOT EXISTS signup_source TEXT;

-- Create index for analytics queries
CREATE INDEX IF NOT EXISTS idx_meetings_waitlist_signup_source
ON meetings_waitlist(signup_source);

-- Add comment for documentation
COMMENT ON COLUMN meetings_waitlist.signup_source IS
'Tracks which landing page variation led to signup: landing, waitlist, join-popup';
