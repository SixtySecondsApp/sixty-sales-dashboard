/*
  # Add first billing date to deals table
  
  This migration adds a first_billing_date field to track when
  billing should start for closed deals.
*/

-- Add first_billing_date column to deals table
ALTER TABLE deals 
ADD COLUMN first_billing_date DATE;

-- Add comment to document the purpose
COMMENT ON COLUMN deals.first_billing_date IS 'The date when billing/invoicing should begin for this closed deal'; 