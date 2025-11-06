-- Check RLS performance impact

-- 1. Count policies per table
SELECT
  tablename,
  COUNT(*) as policy_count,
  STRING_AGG(policyname, ', ' ORDER BY policyname) as policies
FROM pg_policies
WHERE tablename IN ('tasks', 'next_action_suggestions', 'meetings')
GROUP BY tablename
ORDER BY policy_count DESC;

-- 2. Check for missing indexes on frequently queried columns
SELECT
  schemaname,
  tablename,
  attname as column_name,
  n_distinct,
  correlation
FROM pg_stats
WHERE tablename IN ('tasks', 'next_action_suggestions', 'meetings')
  AND attname IN ('user_id', 'assigned_to', 'created_by', 'meeting_id', 'company_id')
ORDER BY tablename, attname;

-- 3. Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE tablename IN ('tasks', 'next_action_suggestions', 'meetings', 'companies', 'contacts', 'profiles')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 4. List indexes on tasks table
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'tasks'
ORDER BY indexname;
