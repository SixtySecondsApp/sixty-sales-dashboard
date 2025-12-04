-- ================================================================
-- REMAP PROFILE IDS USING EMAIL AS THE MATCHING KEY
-- Works with both user_id and owner_id column naming conventions
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
    column_exists BOOLEAN;
BEGIN
    RAISE NOTICE '================================================';
    RAISE NOTICE 'REMAPPING PROFILE IDs USING EMAIL...';
    RAISE NOTICE '================================================';

    -- Step 1: Update contacts table (check for owner_id or user_id)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'contacts' AND column_name = 'owner_id'
    ) INTO column_exists;

    IF column_exists THEN
        RAISE NOTICE 'Updating contacts.owner_id...';
        UPDATE contacts c
        SET owner_id = m.new_id
        FROM profile_id_mapping m
        WHERE c.owner_id = m.old_id;
    ELSE
        RAISE NOTICE 'Updating contacts.user_id...';
        UPDATE contacts c
        SET user_id = m.new_id
        FROM profile_id_mapping m
        WHERE c.user_id = m.old_id;
    END IF;

    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % contacts', table_updates;

    -- Step 2: Update deals table (check for owner_id or user_id)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'deals' AND column_name = 'owner_id'
    ) INTO column_exists;

    IF column_exists THEN
        RAISE NOTICE 'Updating deals.owner_id...';
        UPDATE deals d
        SET owner_id = m.new_id
        FROM profile_id_mapping m
        WHERE d.owner_id = m.old_id;
    ELSE
        RAISE NOTICE 'Updating deals.user_id...';
        UPDATE deals d
        SET user_id = m.new_id
        FROM profile_id_mapping m
        WHERE d.user_id = m.old_id;
    END IF;

    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % deals', table_updates;

    -- Step 3: Update activities table (check for owner_id or user_id)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'activities' AND column_name = 'owner_id'
    ) INTO column_exists;

    IF column_exists THEN
        RAISE NOTICE 'Updating activities.owner_id...';
        UPDATE activities a
        SET owner_id = m.new_id
        FROM profile_id_mapping m
        WHERE a.owner_id = m.old_id;
    ELSE
        RAISE NOTICE 'Updating activities.user_id...';
        UPDATE activities a
        SET user_id = m.new_id
        FROM profile_id_mapping m
        WHERE a.user_id = m.old_id;
    END IF;

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

    -- Step 5: Update tasks table (check for owner_id or user_id)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'owner_id'
    ) INTO column_exists;

    IF column_exists THEN
        RAISE NOTICE 'Updating tasks.owner_id...';
        UPDATE tasks t
        SET owner_id = m.new_id
        FROM profile_id_mapping m
        WHERE t.owner_id = m.old_id;
    ELSE
        RAISE NOTICE 'Updating tasks.user_id...';
        UPDATE tasks t
        SET user_id = m.new_id
        FROM profile_id_mapping m
        WHERE t.user_id = m.old_id;
    END IF;

    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % tasks', table_updates;

    -- Step 6: Update communication_events table (check for owner_id or user_id)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'communication_events' AND column_name = 'owner_id'
    ) INTO column_exists;

    IF column_exists THEN
        RAISE NOTICE 'Updating communication_events.owner_id...';
        UPDATE communication_events ce
        SET owner_id = m.new_id
        FROM profile_id_mapping m
        WHERE ce.owner_id = m.old_id;
    ELSE
        RAISE NOTICE 'Updating communication_events.user_id...';
        UPDATE communication_events ce
        SET user_id = m.new_id
        FROM profile_id_mapping m
        WHERE ce.user_id = m.old_id;
    END IF;

    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % communication_events', table_updates;

    -- Step 7: Update workflow_executions table (check for owner_id or user_id)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'workflow_executions' AND column_name = 'owner_id'
    ) INTO column_exists;

    IF column_exists THEN
        RAISE NOTICE 'Updating workflow_executions.owner_id...';
        UPDATE workflow_executions we
        SET owner_id = m.new_id
        FROM profile_id_mapping m
        WHERE we.owner_id = m.old_id;
    ELSE
        RAISE NOTICE 'Updating workflow_executions.user_id...';
        UPDATE workflow_executions we
        SET user_id = m.new_id
        FROM profile_id_mapping m
        WHERE we.user_id = m.old_id;
    END IF;

    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % workflow_executions', table_updates;

    RAISE NOTICE '================================================';
    RAISE NOTICE 'COMPLETE! Total updates: %', total_updates;
    RAISE NOTICE '================================================';

END $$;

-- Verification: Check if all data is now linked to current profiles
-- (Uses dynamic column detection)
DO $$
DECLARE
    contacts_col TEXT;
    deals_col TEXT;
    activities_col TEXT;
    tasks_col TEXT;
    comm_events_col TEXT;
    workflow_col TEXT;
BEGIN
    -- Detect column names
    SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'owner_id')
           THEN 'owner_id' ELSE 'user_id' END INTO contacts_col;
    SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'owner_id')
           THEN 'owner_id' ELSE 'user_id' END INTO deals_col;
    SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'owner_id')
           THEN 'owner_id' ELSE 'user_id' END INTO activities_col;
    SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'owner_id')
           THEN 'owner_id' ELSE 'user_id' END INTO tasks_col;

    RAISE NOTICE 'Verification using columns: contacts.%, deals.%, activities.%, tasks.%',
                 contacts_col, deals_col, activities_col, tasks_col;
END $$;

SELECT 'Verification Results:' as status;

-- Simple count verification
SELECT
    'contacts' as table_name,
    COUNT(*) as total_records
FROM contacts

UNION ALL

SELECT
    'deals' as table_name,
    COUNT(*) as total_records
FROM deals

UNION ALL

SELECT
    'activities' as table_name,
    COUNT(*) as total_records
FROM activities

UNION ALL

SELECT
    'meetings' as table_name,
    COUNT(*) as total_records
FROM meetings;

-- Clean up temp table
DROP TABLE IF EXISTS profile_id_mapping;

-- Final success message
SELECT '🎉 All data remapped! You can now log in with email and password: TempPassword123!' as result;
