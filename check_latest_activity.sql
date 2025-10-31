-- Check the most recent activity that has UUID issue
SELECT
  a.id,
  a.client_name,
  a.user_id,
  a.sales_rep,
  a.date,
  a.created_at,
  a.meeting_id,
  p1.email as user_email,
  CONCAT(p1.first_name, ' ', p1.last_name) as user_name,
  m.owner_email as meeting_owner_email,
  m.owner_user_id as meeting_owner_id
FROM activities a
LEFT JOIN profiles p1 ON p1.id = a.user_id
LEFT JOIN meetings m ON m.id = a.meeting_id
WHERE a.type = 'meeting'
  AND a.created_at > NOW() - INTERVAL '1 hour'
ORDER BY a.created_at DESC
LIMIT 5;

-- Check if the user_id matches a valid profile
SELECT
  'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'::uuid as search_id,
  p.id,
  p.email,
  p.first_name,
  p.last_name
FROM profiles p
WHERE p.id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'::uuid;
