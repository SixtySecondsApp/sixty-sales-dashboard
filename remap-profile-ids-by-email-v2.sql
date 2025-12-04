-- ================================================================
-- REMAP PROFILE IDS USING EMAIL AS THE MATCHING KEY
-- This updates all foreign keys to point to the new profile IDs
-- ================================================================

-- First, create a temporary mapping table
CREATE TEMP TABLE profile_id_mapping AS
SELECT
    old_p.id as old_id,
    new_p.id as new_id,
    new_p.email
FROM profiles old_p
INNER JOIN profiles new_p ON old_p.email = new_p.email
WHERE old_p.id != new_p.id;

-- Show the mapping
SELECT
    COUNT(*) as mappings_found,
    COUNT(DISTINCT old_id) as old_profiles,
    COUNT(DISTINCT new_id) as new_profiles
FROM profile_id_mapping;

DO $$
DECLARE
    total_updates INTEGER := 0;
    table_updates INTEGER;
BEGIN
    RAISE NOTICE '================================================';
    RAISE NOTICE 'REMAPPING PROFILE IDs USING EMAIL...';
    RAISE NOTICE '================================================';

    -- Step 1: Update contacts table (owner_id, not user_id!)
    RAISE NOTICE 'Updating contacts.owner_id...';
    UPDATE contacts c
    SET owner_id = m.new_id
    FROM profile_id_mapping m
    WHERE c.owner_id = m.old_id;

    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % contacts', table_updates;

    -- Step 2: Update deals table
    RAISE NOTICE 'Updating deals.user_id...';
    UPDATE deals d
    SET user_id = m.new_id
    FROM profile_id_mapping m
    WHERE d.user_id = m.old_id;

    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % deals', table_updates;

    -- Step 3: Update activities table
    RAISE NOTICE 'Updating activities.user_id...';
    UPDATE activities a
    SET user_id = m.new_id
    FROM profile_id_mapping m
    WHERE a.user_id = m.old_id;

    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % activities', table_updates;

    -- Step 4: Update meetings table (owner_user_id)
    RAISE NOTICE 'Updating meetings.owner_user_id...';
    UPDATE meetings m
    SET owner_user_id = map.new_id
    FROM profile_id_mapping map
    WHERE m.owner_user_id = map.old_id;

    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % meetings', table_updates;

    -- Step 5: Update tasks table
    RAISE NOTICE 'Updating tasks.user_id...';
    UPDATE tasks t
    SET user_id = m.new_id
    FROM profile_id_mapping m
    WHERE t.user_id = m.old_id;

    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % tasks', table_updates;

    -- Step 6: Update communication_events table
    RAISE NOTICE 'Updating communication_events.user_id...';
    UPDATE communication_events ce
    SET user_id = m.new_id
    FROM profile_id_mapping m
    WHERE ce.user_id = m.old_id;

    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % communication_events', table_updates;

    -- Step 7: Update workflow_executions table
    RAISE NOTICE 'Updating workflow_executions.user_id...';
    UPDATE workflow_executions we
    SET user_id = m.new_id
    FROM profile_id_mapping m
    WHERE we.user_id = m.old_id;

    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % workflow_executions', table_updates;

    RAISE NOTICE '================================================';
    RAISE NOTICE 'COMPLETE! Total updates: %', total_updates;
    RAISE NOTICE '================================================';

END $$;

-- Verification: Check if all data is now linked to current profiles
SELECT 'Verification Results:' as status;

SELECT
    'contacts' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT c.owner_id) as unique_users,
    SUM(CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END) as linked_to_current_profiles,
    SUM(CASE WHEN p.id IS NULL THEN 1 ELSE 0 END) as orphaned_records
FROM contacts c
LEFT JOIN profiles p ON c.owner_id = p.id

UNION ALL

SELECT
    'deals' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT d.user_id) as unique_users,
    SUM(CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END) as linked_to_current_profiles,
    SUM(CASE WHEN p.id IS NULL THEN 1 ELSE 0 END) as orphaned_records
FROM deals d
LEFT JOIN profiles p ON d.user_id = p.id

UNION ALL

SELECT
    'activities' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT a.user_id) as unique_users,
    SUM(CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END) as linked_to_current_profiles,
    SUM(CASE WHEN p.id IS NULL THEN 1 ELSE 0 END) as orphaned_records
FROM activities a
LEFT JOIN profiles p ON a.user_id = p.id

UNION ALL

SELECT
    'meetings' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT m.owner_user_id) as unique_users,
    SUM(CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END) as linked_to_current_profiles,
    SUM(CASE WHEN p.id IS NULL THEN 1 ELSE 0 END) as orphaned_records
FROM meetings m
LEFT JOIN profiles p ON m.owner_user_id = p.id;

-- Clean up temp table
DROP TABLE IF EXISTS profile_id_mapping;

-- Final success message
SELECT '🎉 All data remapped! You can now log in with email and password: TempPassword123!' as result;
