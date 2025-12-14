-- Add 'cancelled' status to leads table for tracking meeting cancellations
-- This allows leads to be marked as cancelled when webhook events indicate cancellation

-- Drop the existing CHECK constraint if it exists
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;

-- Add the new CHECK constraint with 'cancelled' status
ALTER TABLE leads 
ADD CONSTRAINT leads_status_check 
CHECK (status IN ('new', 'prepping', 'ready', 'converted', 'archived', 'cancelled'));

-- Update the column comment
COMMENT ON COLUMN leads.status IS 'Lead status: new, prepping, ready, converted, archived, or cancelled (for meeting cancellations)';

