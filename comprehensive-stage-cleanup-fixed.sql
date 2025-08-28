-- ============================================================================
-- COMPREHENSIVE Stage Cleanup - Remove Test Stages Safely (FIXED)
-- ============================================================================
-- This script removes Lead, Qualified, Closed Won and keeps: SQL, Opportunity, Verbal, Signed, Lost

-- Step 1: Show current situation
SELECT 
  '=== CURRENT DEAL STAGES & USAGE ===' as info,
  ds.id,
  ds.name,
  ds.color,
  ds.order_position,
  COUNT(DISTINCT d.id) as deals_count,
  COUNT(DISTINCT dsh.id) as history_entries
FROM deal_stages ds
LEFT JOIN deals d ON ds.id = d.stage_id
LEFT JOIN deal_stage_history dsh ON ds.id = dsh.stage_id
GROUP BY ds.id, ds.name, ds.color, ds.order_position
ORDER BY ds.order_position, ds.name;

-- Step 2: Identify the stages we want to keep and remove
SELECT 
  '=== STAGES TO KEEP ===' as info,
  deal_stages.id,
  deal_stages.name,
  deal_stages.order_position
FROM deal_stages
WHERE deal_stages.name IN ('SQL', 'Opportunity', 'Verbal', 'Signed', 'Lost')
ORDER BY deal_stages.order_position;

SELECT 
  '=== STAGES TO REMOVE ===' as info,
  ds.id,
  ds.name,
  COUNT(d.id) as deals_using,
  (SELECT COUNT(*) FROM deal_stage_history WHERE stage_id = ds.id) as history_entries
FROM deal_stages ds
LEFT JOIN deals d ON ds.id = d.stage_id
WHERE ds.name IN ('Lead', 'Qualified', 'Closed Won')
GROUP BY ds.id, ds.name;

-- Step 3: Get the default replacement stage (first good stage by order)
DO $$
DECLARE
    replacement_stage_id UUID;
    replacement_stage_name TEXT;
    deals_to_move INTEGER;
    history_to_move INTEGER;
    stages_to_keep INTEGER;
BEGIN
    -- Count stages we want to keep
    SELECT COUNT(*) INTO stages_to_keep
    FROM deal_stages
    WHERE name IN ('SQL', 'Opportunity', 'Verbal', 'Signed', 'Lost');
    
    IF stages_to_keep = 0 THEN
        RAISE NOTICE '❌ NO GOOD STAGES FOUND!';
        RAISE NOTICE '💡 Your pipeline should have: SQL, Opportunity, Verbal, Signed, Lost';
        RAISE NOTICE '📋 Create them first before running this cleanup';
        RAISE EXCEPTION 'Cannot proceed without proper deal stages';
    END IF;
    
    -- Get the first good stage as replacement (lowest order_position)
    SELECT id, name INTO replacement_stage_id, replacement_stage_name 
    FROM deal_stages 
    WHERE name IN ('SQL', 'Opportunity', 'Verbal', 'Signed', 'Lost')
    ORDER BY order_position 
    LIMIT 1;
    
    -- Count what needs to be moved
    SELECT COUNT(*) INTO deals_to_move
    FROM deals d
    JOIN deal_stages ds ON d.stage_id = ds.id
    WHERE ds.name IN ('Lead', 'Qualified', 'Closed Won');
    
    SELECT COUNT(*) INTO history_to_move
    FROM deal_stage_history dsh
    JOIN deal_stages ds ON dsh.stage_id = ds.id
    WHERE ds.name IN ('Lead', 'Qualified', 'Closed Won');
    
    RAISE NOTICE '✅ Replacement stage: % (ID: %)', replacement_stage_name, replacement_stage_id;
    RAISE NOTICE '📊 Deals to move: %', deals_to_move;
    RAISE NOTICE '📈 History entries to move: %', history_to_move;
    
    -- Step 4: Move deals from test stages to replacement stage
    IF deals_to_move > 0 THEN
        UPDATE deals 
        SET stage_id = replacement_stage_id,
            stage_changed_at = NOW()
        WHERE stage_id IN (
            SELECT id FROM deal_stages 
            WHERE name IN ('Lead', 'Qualified', 'Closed Won')
        );
        
        RAISE NOTICE '✅ Moved % deals to: %', deals_to_move, replacement_stage_name;
    END IF;
    
    -- Step 5: Move deal stage history entries
    IF history_to_move > 0 THEN
        UPDATE deal_stage_history 
        SET stage_id = replacement_stage_id
        WHERE stage_id IN (
            SELECT id FROM deal_stages 
            WHERE name IN ('Lead', 'Qualified', 'Closed Won')
        );
        
        RAISE NOTICE '✅ Moved % history entries to: %', history_to_move, replacement_stage_name;
    END IF;
END $$;

-- Step 6: Now safely delete the test stages
DELETE FROM deal_stages 
WHERE name IN ('Lead', 'Qualified', 'Closed Won');

-- Step 7: Show final pipeline
SELECT 
  '=== FINAL DEAL PIPELINE ===' as info,
  ds.id,
  ds.name,
  ds.color,
  ds.order_position,
  COUNT(DISTINCT d.id) as active_deals,
  COUNT(DISTINCT dsh.id) as history_entries
FROM deal_stages ds
LEFT JOIN deals d ON ds.id = d.stage_id
LEFT JOIN deal_stage_history dsh ON ds.id = dsh.stage_id
GROUP BY ds.id, ds.name, ds.color, ds.order_position
ORDER BY ds.order_position;

-- Step 8: Final verification
SELECT 
  '=== CLEANUP SUMMARY ===' as summary,
  COUNT(*) as total_stages,
  STRING_AGG(name, ', ' ORDER BY order_position) as remaining_stages
FROM deal_stages;

SELECT '🎉 Test stages removed! Your pipeline now has: SQL, Opportunity, Verbal, Signed, Lost' as result;