-- ============================================================================
-- SAFE Remove Test Deal Stages - Handles Foreign Key Constraints
-- ============================================================================
-- This script safely removes unwanted stages by first moving deals to proper stages

-- Step 1: Show current deal stages and their usage
SELECT 
  '=== CURRENT DEAL STAGES & USAGE ===' as info,
  ds.id,
  ds.name,
  ds.color,
  ds.order_position,
  ds.created_at,
  COUNT(d.id) as deals_using_stage
FROM deal_stages ds
LEFT JOIN deals d ON ds.id = d.stage_id
GROUP BY ds.id, ds.name, ds.color, ds.order_position, ds.created_at
ORDER BY ds.order_position, ds.name;

-- Step 2: Identify good stages (not test stages)
CREATE TEMP TABLE good_stages AS
SELECT id, name, order_position
FROM deal_stages
WHERE name NOT IN ('Lead', 'Qualified', 'Closed Won')
ORDER BY order_position
LIMIT 1;

-- Step 3: Show what we'll use as the replacement stage
SELECT 
  '=== REPLACEMENT STAGE ===' as info,
  id as replacement_stage_id,
  name as replacement_stage_name
FROM good_stages;

-- Step 4: Check if we have a good stage to move deals to
DO $$
DECLARE
    replacement_stage_id UUID;
    replacement_stage_name TEXT;
    deals_to_move INTEGER;
BEGIN
    -- Get the replacement stage
    SELECT id, name INTO replacement_stage_id, replacement_stage_name 
    FROM good_stages;
    
    IF replacement_stage_id IS NULL THEN
        RAISE NOTICE '⚠️  NO GOOD STAGES FOUND!';
        RAISE NOTICE '💡 You need to create proper deal stages before removing test stages';
        RAISE NOTICE '📋 Example: INSERT INTO deal_stages (name, color, order_position) VALUES (''Discovery'', ''#3B82F6'', 1);';
        RAISE EXCEPTION 'Cannot proceed without proper deal stages';
    END IF;
    
    -- Count deals that need to be moved
    SELECT COUNT(*) INTO deals_to_move
    FROM deals d
    JOIN deal_stages ds ON d.stage_id = ds.id
    WHERE ds.name IN ('Lead', 'Qualified', 'Closed Won');
    
    RAISE NOTICE '✅ Found replacement stage: % (ID: %)', replacement_stage_name, replacement_stage_id;
    RAISE NOTICE '📊 Deals to move: %', deals_to_move;
    
    -- Move deals from test stages to the first good stage
    IF deals_to_move > 0 THEN
        UPDATE deals 
        SET stage_id = replacement_stage_id,
            stage_changed_at = NOW()
        WHERE stage_id IN (
            SELECT id FROM deal_stages 
            WHERE name IN ('Lead', 'Qualified', 'Closed Won')
        );
        
        RAISE NOTICE '✅ Moved % deals to stage: %', deals_to_move, replacement_stage_name;
    END IF;
END $$;

-- Step 5: Now safely delete the unwanted test stages
DELETE FROM deal_stages 
WHERE name IN ('Lead', 'Qualified', 'Closed Won');

-- Step 6: Show final results
SELECT 
  '=== FINAL DEAL STAGES ===' as info,
  ds.id,
  ds.name,
  ds.color,
  ds.order_position,
  COUNT(d.id) as deals_count
FROM deal_stages ds
LEFT JOIN deals d ON ds.id = d.stage_id
GROUP BY ds.id, ds.name, ds.color, ds.order_position
ORDER BY ds.order_position, ds.name;

-- Step 7: Summary
SELECT 
  '=== CLEANUP SUMMARY ===' as summary,
  COUNT(*) as remaining_stages,
  STRING_AGG(name, ', ' ORDER BY order_position) as stage_names
FROM deal_stages;

-- Clean up temp table
DROP TABLE good_stages;

SELECT '🎉 Test stages removed successfully! API will now use proper stages.' as result;