-- ================================================================
-- COMPLETE FIX: Add user_id column + Remap all IDs
-- This single script fixes everything
-- ================================================================

-- STEP 1: Add user_id column to activities
ALTER TABLE activities ADD COLUMN IF NOT EXISTS user_id UUID;
UPDATE activities SET user_id = owner_id WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);

-- STEP 2: Create mapping table (old profile IDs → new auth user IDs)
CREATE TEMP TABLE profile_id_mapping AS
SELECT
    old_p.id as old_id,
    new_p.id as new_id,
    new_p.email
FROM profiles old_p
INNER JOIN profiles new_p ON old_p.email = new_p.email
WHERE old_p.id != new_p.id;

-- Show the mapping count
SELECT
    COUNT(*) as mappings_found,
    COUNT(DISTINCT old_id) as old_profiles,
    COUNT(DISTINCT new_id) as new_profiles
FROM profile_id_mapping;

-- STEP 3: Update ALL foreign keys to point to new auth user IDs
DO $$
DECLARE
    total_updates INTEGER := 0;
    table_updates INTEGER;
BEGIN
    RAISE NOTICE '================================================';
    RAISE NOTICE 'REMAPPING ALL PROFILE IDs...';
    RAISE NOTICE '================================================';

    -- Contacts
    RAISE NOTICE 'Updating contacts.owner_id...';
    UPDATE contacts c SET owner_id = m.new_id FROM profile_id_mapping m WHERE c.owner_id = m.old_id;
    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % contacts', table_updates;

    -- Deals
    RAISE NOTICE 'Updating deals.owner_id...';
    UPDATE deals d SET owner_id = m.new_id FROM profile_id_mapping m WHERE d.owner_id = m.old_id;
    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % deals', table_updates;

    -- Activities (both owner_id AND user_id)
    RAISE NOTICE 'Updating activities.owner_id...';
    UPDATE activities a SET owner_id = m.new_id FROM profile_id_mapping m WHERE a.owner_id = m.old_id;
    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % activities.owner_id', table_updates;

    RAISE NOTICE 'Updating activities.user_id...';
    UPDATE activities a SET user_id = m.new_id FROM profile_id_mapping m WHERE a.user_id = m.old_id;
    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % activities.user_id', table_updates;

    -- Meetings
    RAISE NOTICE 'Updating meetings.owner_user_id...';
    UPDATE meetings m SET owner_user_id = map.new_id FROM profile_id_mapping map WHERE m.owner_user_id = map.old_id;
    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % meetings', table_updates;

    -- Communication Events
    RAISE NOTICE 'Updating communication_events.user_id...';
    UPDATE communication_events ce SET user_id = m.new_id FROM profile_id_mapping m WHERE ce.user_id = m.old_id;
    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % communication_events', table_updates;

    -- Workflow Executions
    RAISE NOTICE 'Updating workflow_executions.user_id...';
    UPDATE workflow_executions we SET user_id = m.new_id FROM profile_id_mapping m WHERE we.user_id = m.old_id;
    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % workflow_executions', table_updates;

    -- Tasks
    RAISE NOTICE 'Updating tasks.assigned_to...';
    UPDATE tasks t SET assigned_to = m.new_id FROM profile_id_mapping m WHERE t.assigned_to = m.old_id;
    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % tasks.assigned_to', table_updates;

    RAISE NOTICE 'Updating tasks.created_by...';
    UPDATE tasks t SET created_by = m.new_id FROM profile_id_mapping m WHERE t.created_by = m.old_id;
    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % tasks.created_by', table_updates;

    RAISE NOTICE '================================================';
    RAISE NOTICE 'COMPLETE! Total updates: %', total_updates;
    RAISE NOTICE '================================================';
END $$;

-- STEP 4: Verification
SELECT 'Orphaned records check:' as status;

SELECT
    'activities' as table_name,
    COUNT(*) as total,
    SUM(CASE WHEN p.id IS NULL THEN 1 ELSE 0 END) as orphaned
FROM activities a
LEFT JOIN profiles p ON a.user_id = p.id
UNION ALL
SELECT 'deals', COUNT(*), SUM(CASE WHEN p.id IS NULL THEN 1 ELSE 0 END)
FROM deals d LEFT JOIN profiles p ON d.owner_id = p.id
UNION ALL
SELECT 'contacts', COUNT(*), SUM(CASE WHEN p.id IS NULL THEN 1 ELSE 0 END)
FROM contacts c LEFT JOIN profiles p ON c.owner_id = p.id;

-- Clean up
DROP TABLE IF EXISTS profile_id_mapping;

-- Success!
SELECT '🎉 ALL FIXED! Refresh your browser and log in!' as result;
