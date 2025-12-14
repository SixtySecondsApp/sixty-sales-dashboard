-- Add tags column to leads table for categorizing leads
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'::TEXT[];

-- Create index for tag searches
CREATE INDEX IF NOT EXISTS idx_leads_tags ON leads USING GIN(tags);

COMMENT ON COLUMN leads.tags IS 'Array of tags for categorizing leads (e.g., "Meeting Booked", source name, owner name)';












