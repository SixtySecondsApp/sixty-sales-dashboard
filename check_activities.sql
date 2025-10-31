-- Check recent activities and their user mapping
SELECT
  a.id,
  a.type,
  a.client_name,
  a.user_id,
  a.sales_rep,
  a.date,
  a.created_at,
  p1.email as user_email,
  CONCAT(p1.first_name, ' ', p1.last_name) as user_name
FROM activities a
LEFT JOIN profiles p1 ON p1.id = a.user_id
WHERE a.created_at > NOW() - INTERVAL '24 hours'
ORDER BY a.created_at DESC
LIMIT 10;
