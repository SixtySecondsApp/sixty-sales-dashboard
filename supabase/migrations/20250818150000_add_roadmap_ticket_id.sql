-- Add ticket_id field for simple roadmap ticket sharing
-- This will be a simple incremental ID for sharing purposes like /roadmap/ticket/3

-- Add the ticket_id column
ALTER TABLE roadmap_suggestions 
ADD COLUMN IF NOT EXISTS ticket_id SERIAL UNIQUE;

-- Create index for ticket_id lookups
CREATE INDEX IF NOT EXISTS roadmap_suggestions_ticket_id_idx ON roadmap_suggestions(ticket_id);

-- Update existing records to have sequential ticket IDs based on creation order
UPDATE roadmap_suggestions 
SET ticket_id = row_number() OVER (ORDER BY created_at)
WHERE ticket_id IS NULL;

-- Ensure ticket_id is not null for future records (it should auto-increment)
ALTER TABLE roadmap_suggestions 
ALTER COLUMN ticket_id SET NOT NULL;