-- Add tracking fields for Fathom meeting contacts
-- Track when contact was first seen via Fathom
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ;

-- Track last interaction (meeting, call, email, etc.)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ;

-- Track total number of meetings with this contact
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS total_meetings_count INTEGER DEFAULT 0;

-- Add source if not exists (should already exist from previous migrations)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Create index for faster queries on last interaction
CREATE INDEX IF NOT EXISTS idx_contacts_last_interaction ON contacts(last_interaction_at DESC);

-- Create index for sorting by meeting count
CREATE INDEX IF NOT EXISTS idx_contacts_meetings_count ON contacts(total_meetings_count DESC);

-- Add comments for documentation
COMMENT ON COLUMN contacts.first_seen_at IS 'Timestamp when contact was first discovered (e.g., via Fathom sync)';
COMMENT ON COLUMN contacts.last_interaction_at IS 'Timestamp of most recent interaction (meeting, activity, etc.)';
COMMENT ON COLUMN contacts.total_meetings_count IS 'Total number of meetings attended by this contact';
