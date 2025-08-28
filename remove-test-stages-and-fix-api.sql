-- ============================================================================
-- Remove Test Deal Stages and Fix API Default Behavior
-- ============================================================================
-- This script removes the unwanted stages created by testing and fixes the API

-- Step 1: Show current deal stages
SELECT 
  '=== CURRENT DEAL STAGES ===' as info,
  id,
  name,
  color,
  order_position,
  created_at
FROM deal_stages
ORDER BY order_position, name;

-- Step 2: Remove the unwanted test stages
DELETE FROM deal_stages 
WHERE name IN ('Lead', 'Qualified', 'Closed Won');

-- Step 3: Show what stages remain after cleanup
SELECT 
  '=== REMAINING STAGES AFTER CLEANUP ===' as info,
  id,
  name,
  color,
  order_position,
  created_at
FROM deal_stages
ORDER BY order_position, name;

-- Step 4: Get the first remaining stage to use as new default
DO $$
DECLARE
    first_stage_id UUID;
    first_stage_name TEXT;
    stage_count INTEGER;
BEGIN
    -- Count remaining stages
    SELECT COUNT(*) INTO stage_count FROM deal_stages;
    
    IF stage_count = 0 THEN
        RAISE NOTICE '⚠️  NO DEAL STAGES REMAINING!';
        RAISE NOTICE '💡 You need to create proper deal stages for your pipeline';
        RAISE NOTICE '📋 Example stages: Discovery, Proposal, Negotiation, Signed, Delivered';
    ELSE
        -- Get the first stage (lowest order_position)
        SELECT id, name INTO first_stage_id, first_stage_name 
        FROM deal_stages 
        ORDER BY order_position 
        LIMIT 1;
        
        RAISE NOTICE '✅ CLEANUP COMPLETE!';
        RAISE NOTICE '📊 Remaining stages: %', stage_count;
        RAISE NOTICE '🎯 New default stage should be: % (ID: %)', first_stage_name, first_stage_id;
        RAISE NOTICE '';
        RAISE NOTICE '⚠️  IMPORTANT: Update API to use "%" instead of "Lead"', first_stage_name;
    END IF;
END $$;

-- Step 5: Show final verification
SELECT 
  '=== FINAL VERIFICATION ===' as summary,
  COUNT(*) as total_stages,
  STRING_AGG(name, ', ' ORDER BY order_position) as stage_names
FROM deal_stages;