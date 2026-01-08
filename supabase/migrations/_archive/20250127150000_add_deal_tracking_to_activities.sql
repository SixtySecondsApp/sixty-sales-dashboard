/*
  # Add Deal Tracking to Activities Table
  
  1. Add columns for deal tracking and contact information
  2. Add indexes for better performance
  3. Maintain existing RLS policies
  
  This enables activities logged in deal modals to be properly tracked and linked.
*/

-- Add new columns to activities table
ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES deals(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS contact_identifier text,
ADD COLUMN IF NOT EXISTS contact_identifier_type text CHECK (contact_identifier_type IN ('email', 'phone', 'name')),
ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1;

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS activities_deal_id_idx ON activities(deal_id);
CREATE INDEX IF NOT EXISTS activities_contact_identifier_idx ON activities(contact_identifier);

-- Add comment for documentation
COMMENT ON COLUMN activities.deal_id IS 'Links activity to a specific deal';
COMMENT ON COLUMN activities.contact_identifier IS 'Contact email, phone, or name associated with the activity';
COMMENT ON COLUMN activities.contact_identifier_type IS 'Type of contact identifier (email, phone, name)';
COMMENT ON COLUMN activities.quantity IS 'Number of activities performed (default 1)'; 