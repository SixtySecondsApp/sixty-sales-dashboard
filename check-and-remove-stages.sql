-- Check current deal stages and remove unwanted ones
-- First, let's see all current deal stages

SELECT 
  'Current Deal Stages:' as info,
  id,
  name,
  color,
  order_position,
  created_at
FROM deal_stages
ORDER BY order_position, name;

-- Remove the unwanted stages: Lead, Qualified, Closed Won
DELETE FROM deal_stages 
WHERE name IN ('Lead', 'Qualified', 'Closed Won');

-- Show remaining stages after cleanup
SELECT 
  'Remaining Deal Stages After Cleanup:' as info,
  id,
  name,
  color,
  order_position,
  created_at
FROM deal_stages
ORDER BY order_position, name;

-- Show count of remaining stages
SELECT 
  'Total Stages Remaining:' as summary,
  COUNT(*) as stage_count
FROM deal_stages;