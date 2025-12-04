-- Check actual column names for user/owner references in all tables

SELECT
    'contacts' as table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'contacts'
  AND (column_name LIKE '%user%' OR column_name LIKE '%owner%')

UNION ALL

SELECT
    'deals' as table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'deals'
  AND (column_name LIKE '%user%' OR column_name LIKE '%owner%')

UNION ALL

SELECT
    'activities' as table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'activities'
  AND (column_name LIKE '%user%' OR column_name LIKE '%owner%')

UNION ALL

SELECT
    'meetings' as table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'meetings'
  AND (column_name LIKE '%user%' OR column_name LIKE '%owner%')

UNION ALL

SELECT
    'tasks' as table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'tasks'
  AND (column_name LIKE '%user%' OR column_name LIKE '%owner%')

UNION ALL

SELECT
    'communication_events' as table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'communication_events'
  AND (column_name LIKE '%user%' OR column_name LIKE '%owner%')

UNION ALL

SELECT
    'workflow_executions' as table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'workflow_executions'
  AND (column_name LIKE '%user%' OR column_name LIKE '%owner%')

ORDER BY table_name, column_name;
