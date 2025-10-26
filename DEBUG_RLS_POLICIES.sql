-- Check the actual policy definitions to see if any reference auth.users
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual::text as using_clause,
  with_check::text as with_check_clause
FROM pg_policies
WHERE tablename IN ('meetings', 'companies', 'meeting_action_items')
ORDER BY tablename, policyname;

-- Test the exact query that the frontend is using
SELECT
  m.*,
  c.name as company_name,
  c.domain as company_domain
FROM meetings m
LEFT JOIN companies c ON c.id = m.company_id
WHERE m.owner_user_id = auth.uid()
ORDER BY m.meeting_start DESC
LIMIT 5;

-- Check if there are any triggers or functions on meetings that might access users
SELECT
  event_object_table,
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('meetings', 'companies', 'meeting_action_items')
ORDER BY event_object_table, trigger_name;
