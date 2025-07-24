/*
  # Update Pipeline Stages
  
  This migration updates the pipeline stages:
  1. Rename "Closed Won" to "Signed"
  2. Rename "Closed Lost" to "Lost"
  3. Add new "Signed & Paid" stage with confetti
*/

-- Update existing stage names
UPDATE deal_stages 
SET 
  name = 'Signed',
  description = 'Deal signed',
  updated_at = NOW()
WHERE name = 'Closed Won';

UPDATE deal_stages 
SET 
  name = 'Lost',
  description = 'Deal lost',
  updated_at = NOW()
WHERE name = 'Closed Lost';

-- Add new "Signed & Paid" stage (only if it doesn't exist)
INSERT INTO deal_stages (name, description, color, order_position, default_probability)
SELECT 'Signed & Paid', 'Deal signed and payment received', '#10B981', 60, 100
WHERE NOT EXISTS (
  SELECT 1 FROM deal_stages WHERE name = 'Signed & Paid'
);

-- Update order positions to accommodate new stage
UPDATE deal_stages 
SET 
  order_position = 60,
  updated_at = NOW()
WHERE name = 'Signed & Paid';

UPDATE deal_stages 
SET 
  order_position = 70,
  updated_at = NOW()
WHERE name = 'Lost';

-- Ensure proper ordering
-- Typical pipeline now: SQL(20) -> Opportunity(30) -> Verbal(40) -> Signed(50) -> Signed & Paid(60) -> Lost(70) 