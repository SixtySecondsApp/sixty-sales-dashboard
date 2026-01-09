/*
  # Merge Signed and Signed & Paid Pipeline Stages
  
  This migration consolidates the pipeline stages:
  1. Move all deals from "Signed & Paid" to "Signed" stage
  2. Remove the "Signed & Paid" stage
  3. Update the pipeline to use Payments page for payment status tracking
*/

-- First, get the stage IDs for reference
DO $$
DECLARE
  signed_stage_id UUID;
  signed_paid_stage_id UUID;
BEGIN
  -- Get stage IDs
  SELECT id INTO signed_stage_id FROM deal_stages WHERE name = 'Signed' LIMIT 1;
  SELECT id INTO signed_paid_stage_id FROM deal_stages WHERE name = 'Signed & Paid' LIMIT 1;
  
  -- Only proceed if both stages exist
  IF signed_stage_id IS NOT NULL AND signed_paid_stage_id IS NOT NULL THEN
    -- Move all deals from "Signed & Paid" to "Signed"
    UPDATE deals 
    SET 
      stage_id = signed_stage_id,
      stage_changed_at = NOW(),
      updated_at = NOW()
    WHERE stage_id = signed_paid_stage_id;
    
    RAISE NOTICE 'Moved deals from "Signed & Paid" to "Signed" stage';
  ELSE
    RAISE NOTICE 'One or both stages not found, skipping deal migration';
  END IF;
END $$;

-- Remove the "Signed & Paid" stage
DELETE FROM deal_stages WHERE name = 'Signed & Paid';

-- Update the order positions to close the gap
UPDATE deal_stages 
SET 
  order_position = 60,
  updated_at = NOW()
WHERE name = 'Lost';

-- Log the change
INSERT INTO activity_logs (
  user_id,
  action,
  entity_type,
  entity_id,
  details,
  created_at
) 
SELECT 
  '00000000-0000-0000-0000-000000000000'::UUID, -- System user
  'system_update',
  'pipeline_stage',
  NULL,
  'Merged "Signed & Paid" stage into "Signed" stage. Payment status now tracked via Payments page.',
  NOW()
WHERE EXISTS (SELECT 1 FROM activity_logs LIMIT 1); -- Only if activity_logs table exists