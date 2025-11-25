-- Add last_interaction_date column to contacts table if not exists
-- This column tracks the date of the most recent meeting/interaction with the contact
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS last_interaction_date TIMESTAMPTZ NULL;

-- Add index for efficient sorting by last interaction
CREATE INDEX IF NOT EXISTS idx_contacts_last_interaction_date
ON contacts(last_interaction_date DESC NULLS LAST);
