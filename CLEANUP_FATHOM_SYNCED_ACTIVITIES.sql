-- Cleanup: Remove activities auto-created by Fathom sync to avoid duplicates
-- Safe criteria:
--  - type = 'meeting'
--  - meeting_id IS NOT NULL (linked to a meeting)
--  - sales_rep looks like a UUID (integration used user_id as sales_rep), OR client_name = 'Fathom Meeting'
--
-- This preserves user-logged activities created via Quick Add (which set sales_rep as a human name).
-- Dependent rows in junction tables (e.g., activity_meetings, company_activities, deal_activities)
-- should cascade via FK ON DELETE CASCADE.

BEGIN;

-- Preview: how many activities will be removed
-- Build candidate sets in temp tables (avoid referencing non-existent tables)

-- 1) Activities linked to meetings that have a Fathom recording
CREATE TEMP TABLE tmp_by_meeting_id (id uuid);
INSERT INTO tmp_by_meeting_id (id)
SELECT a.id
FROM activities a
JOIN meetings m ON m.id = a.meeting_id
WHERE a.type = 'meeting'
  AND a.meeting_id IS NOT NULL
  AND m.fathom_recording_id IS NOT NULL;

-- 2) Activities linked via activity_meetings (only if table exists)
CREATE TEMP TABLE tmp_by_activity_meetings (id uuid);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'activity_meetings'
  ) THEN
    EXECUTE '
      INSERT INTO tmp_by_activity_meetings (id)
      SELECT DISTINCT a.id
      FROM activities a
      JOIN activity_meetings am ON am.activity_id = a.id
      JOIN meetings m ON m.id = am.meeting_id
      WHERE a.type = ''meeting''
        AND m.fathom_recording_id IS NOT NULL
    ';
  END IF;
END $$;

-- 3) Heuristic signature (UUID sales_rep or client_name)
CREATE TEMP TABLE tmp_by_signature (id uuid);
INSERT INTO tmp_by_signature (id)
WITH integ_users AS (
  SELECT DISTINCT user_id FROM fathom_integrations WHERE is_active = true
)
SELECT a.id
FROM activities a
WHERE a.type = 'meeting'
  AND a.user_id IN (SELECT user_id FROM integ_users)
  AND (
    a.sales_rep ~ '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$'
    OR a.client_name = 'Fathom Meeting'
  );

-- Preview counts by reason and total
SELECT 'by_meeting_id' AS reason, COUNT(*) AS count FROM tmp_by_meeting_id
UNION ALL
SELECT 'by_activity_meetings', COUNT(*) FROM tmp_by_activity_meetings
UNION ALL
SELECT 'by_signature', COUNT(*) FROM tmp_by_signature
UNION ALL
SELECT 'TOTAL', (SELECT COUNT(*) FROM (
  SELECT id FROM tmp_by_meeting_id
  UNION
  SELECT id FROM tmp_by_activity_meetings
  UNION
  SELECT id FROM tmp_by_signature
) t);

-- Materialize candidate IDs for deletion
CREATE TEMP TABLE tmp_fathom_activity_ids AS
SELECT DISTINCT id FROM (
  SELECT id FROM tmp_by_meeting_id
  UNION
  SELECT id FROM tmp_by_activity_meetings
  UNION
  SELECT id FROM tmp_by_signature
) t;

-- Delete (cascades to relationship tables if FKs are defined with ON DELETE CASCADE)
DELETE FROM activities
WHERE id IN (SELECT id FROM tmp_fathom_activity_ids);

-- Report rows deleted
SELECT COUNT(*) AS deleted_count FROM tmp_fathom_activity_ids;

COMMIT;

-- Optional: Vacuum/analyze affected tables (uncomment if desired)
-- VACUUM ANALYZE activities;
-- VACUUM ANALYZE activity_meetings;
-- VACUUM ANALYZE company_activities;
-- VACUUM ANALYZE deal_activities;


