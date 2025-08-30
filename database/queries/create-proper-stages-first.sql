-- ============================================================================
-- Create Proper Deal Stages First (Run if you have no good stages)
-- ============================================================================
-- This script creates a proper sales pipeline before removing test stages

-- Step 1: Check current stages
SELECT 
  '=== CURRENT STAGES ===' as info,
  name,
  order_position,
  COUNT(deals.id) as deals_using
FROM deal_stages
LEFT JOIN deals ON deal_stages.id = deals.stage_id
GROUP BY deal_stages.id, name, order_position
ORDER BY order_position;

-- Step 2: Create proper sales pipeline stages (only if they don't exist)
INSERT INTO deal_stages (name, color, order_position)
SELECT 'Discovery', '#3B82F6', 1
WHERE NOT EXISTS (SELECT 1 FROM deal_stages WHERE name = 'Discovery')

UNION ALL

SELECT 'Proposal', '#F59E0B', 2
WHERE NOT EXISTS (SELECT 1 FROM deal_stages WHERE name = 'Proposal')

UNION ALL

SELECT 'Negotiation', '#EF4444', 3
WHERE NOT EXISTS (SELECT 1 FROM deal_stages WHERE name = 'Negotiation')

UNION ALL

SELECT 'Signed', '#10B981', 4
WHERE NOT EXISTS (SELECT 1 FROM deal_stages WHERE name = 'Signed')

UNION ALL

SELECT 'Delivered', '#6366F1', 5
WHERE NOT EXISTS (SELECT 1 FROM deal_stages WHERE name = 'Delivered');

-- Step 3: Show the created stages
SELECT 
  '=== CREATED PROPER STAGES ===' as info,
  name,
  color,
  order_position
FROM deal_stages
WHERE name IN ('Discovery', 'Proposal', 'Negotiation', 'Signed', 'Delivered')
ORDER BY order_position;

SELECT '✅ Proper stages created! Now run the safe-remove-test-stages.sql script.' as next_step;