-- ================================================================
-- ULTIMATE FIX: Remap orphaned foreign keys to current auth user IDs
--
-- Problem: Activities/deals/contacts have owner_ids that point to OLD
-- production profile IDs that no longer exist. We need to map them to
-- the CURRENT auth user IDs based on email matching.
--
-- Strategy:
-- 1. Find all orphaned owner_ids
-- 2. Create mapping from OLD IDs → NEW auth user IDs via email
-- 3. Update all foreign keys
-- ================================================================

-- STEP 1: Ensure user_id column exists in activities
ALTER TABLE activities ADD COLUMN IF NOT EXISTS user_id UUID;
UPDATE activities SET user_id = owner_id WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);

-- STEP 2: Get production auth user mappings
-- You need to populate this with your PRODUCTION auth user data
-- Run this query on PRODUCTION first:
-- SELECT email, id FROM auth.users ORDER BY email;

CREATE TEMP TABLE prod_auth_users (
    email TEXT PRIMARY KEY,
    prod_auth_id UUID NOT NULL
);

-- INSERT YOUR PRODUCTION AUTH USER MAPPINGS HERE
-- Format: INSERT INTO prod_auth_users (email, prod_auth_id) VALUES
-- ('[email protected]', 'production-uuid-1'),
-- ('[email protected]', 'production-uuid-2');

-- STEP 3: Create mapping from OLD production IDs → NEW development-v2 auth IDs
CREATE TEMP TABLE id_mapping AS
SELECT DISTINCT
    pau.prod_auth_id as old_id,
    u.id as new_id,
    pau.email
FROM prod_auth_users pau
INNER JOIN auth.users u ON pau.email = u.email;

-- Show what we found
SELECT
    COUNT(*) as total_mappings,
    COUNT(DISTINCT old_id) as unique_old_ids,
    COUNT(DISTINCT new_id) as unique_new_ids
FROM id_mapping;

-- Show sample mappings
SELECT * FROM id_mapping LIMIT 10;

-- STEP 4: Update ALL foreign keys to point to new auth user IDs
DO $$
DECLARE
    total_updates INTEGER := 0;
    table_updates INTEGER;
BEGIN
    RAISE NOTICE '================================================';
    RAISE NOTICE 'REMAPPING ALL IDs FROM PRODUCTION TO DEV-V2...';
    RAISE NOTICE '================================================';

    -- Contacts
    RAISE NOTICE 'Updating contacts.owner_id...';
    UPDATE contacts c SET owner_id = m.new_id FROM id_mapping m WHERE c.owner_id = m.old_id;
    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % contacts', table_updates;

    -- Deals
    RAISE NOTICE 'Updating deals.owner_id...';
    UPDATE deals d SET owner_id = m.new_id FROM id_mapping m WHERE d.owner_id = m.old_id;
    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % deals', table_updates;

    -- Activities (both owner_id AND user_id)
    RAISE NOTICE 'Updating activities.owner_id...';
    UPDATE activities a SET owner_id = m.new_id FROM id_mapping m WHERE a.owner_id = m.old_id;
    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % activities.owner_id', table_updates;

    RAISE NOTICE 'Updating activities.user_id...';
    UPDATE activities a SET user_id = m.new_id FROM id_mapping m WHERE a.user_id = m.old_id;
    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % activities.user_id', table_updates;

    -- Meetings
    RAISE NOTICE 'Updating meetings.owner_user_id...';
    UPDATE meetings m SET owner_user_id = map.new_id FROM id_mapping map WHERE m.owner_user_id = map.old_id;
    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % meetings', table_updates;

    -- Communication Events
    RAISE NOTICE 'Updating communication_events.user_id...';
    UPDATE communication_events ce SET user_id = m.new_id FROM id_mapping m WHERE ce.user_id = m.old_id;
    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % communication_events', table_updates;

    -- Workflow Executions
    RAISE NOTICE 'Updating workflow_executions.user_id...';
    UPDATE workflow_executions we SET user_id = m.new_id FROM id_mapping m WHERE we.user_id = m.old_id;
    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % workflow_executions', table_updates;

    -- Tasks
    RAISE NOTICE 'Updating tasks.assigned_to...';
    UPDATE tasks t SET assigned_to = m.new_id FROM id_mapping m WHERE t.assigned_to = m.old_id;
    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % tasks.assigned_to', table_updates;

    RAISE NOTICE 'Updating tasks.created_by...';
    UPDATE tasks t SET created_by = m.new_id FROM id_mapping m WHERE t.created_by = m.old_id;
    GET DIAGNOSTICS table_updates = ROW_COUNT;
    total_updates := total_updates + table_updates;
    RAISE NOTICE '  ✅ Updated % tasks.created_by', table_updates;

    RAISE NOTICE '================================================';
    RAISE NOTICE 'COMPLETE! Total updates: %', total_updates;
    RAISE NOTICE '================================================';
END $$;

-- STEP 5: Verification
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
DROP TABLE IF EXISTS prod_auth_users;
DROP TABLE IF EXISTS id_mapping;

-- Success!
SELECT '🎉 MAPPING COMPLETE! Check orphaned counts above.' as result;
