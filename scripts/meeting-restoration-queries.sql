-- Meeting Type Restoration Queries
-- Use these queries to help restore original meeting type data

-- 1. View current meeting type distribution
SELECT 
    details as meeting_type,
    COUNT(*) as count,
    MIN(created_at) as earliest_entry,
    MAX(created_at) as latest_entry
FROM activities
WHERE type = 'meeting'
GROUP BY details
ORDER BY count DESC;

-- 2. Find all "Discovery Call" entries (these were potentially changed)
-- Look at the created_at vs updated_at to identify which were modified by the script
SELECT 
    id,
    details,
    client_name,
    created_at,
    updated_at,
    CASE 
        WHEN updated_at > created_at + INTERVAL '1 second' THEN 'Likely Modified'
        ELSE 'Original'
    END as modification_status
FROM activities
WHERE type = 'meeting' 
    AND details = 'Discovery Call'
ORDER BY created_at DESC;

-- 3. If you have audit logs or activity history table, use this to find original values
-- (Replace 'activity_history' with your actual audit table name if different)
/*
SELECT 
    ah.activity_id,
    ah.old_value->>'details' as original_meeting_type,
    ah.new_value->>'details' as changed_to,
    ah.changed_at,
    a.client_name
FROM activity_history ah
JOIN activities a ON a.id = ah.activity_id
WHERE ah.table_name = 'activities'
    AND ah.old_value->>'type' = 'meeting'
    AND ah.new_value->>'details' = 'Discovery Call'
ORDER BY ah.changed_at DESC;
*/

-- 4. Update "Product Demo" to "Demo" (if not already done)
BEGIN TRANSACTION;

UPDATE activities
SET details = 'Demo',
    updated_at = NOW()
WHERE type = 'meeting' 
    AND details = 'Product Demo';

-- Check the number of affected rows before committing
-- If this returns an unexpected number, you can ROLLBACK instead of COMMIT
SELECT 'Updated ' || ROW_COUNT() || ' records from "Product Demo" to "Demo"';

COMMIT;

-- 5. Sample query to restore specific meeting types based on patterns
-- IMPORTANT: Only run these if you have identified clear patterns

-- Example: If you know certain users always used "Discovery" not "Discovery Call"
/*
BEGIN TRANSACTION;

UPDATE activities
SET details = 'Discovery'
WHERE type = 'meeting' 
    AND details = 'Discovery Call'
    AND user_id IN (SELECT id FROM profiles WHERE /* your criteria */);

-- Verify the changes before committing
SELECT 'Updated ' || ROW_COUNT() || ' user-specific records to "Discovery"';

COMMIT;
*/

-- Example: If you know meetings before a certain date used different terminology
/*
BEGIN TRANSACTION;

UPDATE activities
SET details = 'Discovery'
WHERE type = 'meeting' 
    AND details = 'Discovery Call'
    AND created_at < '2024-01-01';

-- Verify the changes before committing
SELECT 'Updated ' || ROW_COUNT() || ' date-based records to "Discovery"';

COMMIT;
*/

-- 6. Add any missing "Proposal" meetings if they were incorrectly categorized
-- This would need manual review to identify which meetings were actually proposals

-- 7. Verification query - check meeting types after any updates
SELECT 
    details as meeting_type,
    COUNT(*) as count
FROM activities
WHERE type = 'meeting'
    AND created_at >= NOW() - INTERVAL '6 months'
GROUP BY details
ORDER BY count DESC;