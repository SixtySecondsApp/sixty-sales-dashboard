#!/bin/bash
SUPABASE_URL=$(grep "VITE_SUPABASE_URL" .env.local | cut -d '=' -f2)
SERVICE_ROLE_KEY=$(grep "VITE_SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d '=' -f2)

echo "🔍 Checking foreign key relationships between tasks and meeting_action_items..."
echo ""

# Check the schema for foreign keys
psql "${DATABASE_URL:-$(grep 'DATABASE_URL' .env.local | cut -d '=' -f2)}" -c "
SELECT 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND (tc.table_name = 'meeting_action_items' OR tc.table_name = 'tasks')
  AND (ccu.table_name = 'meeting_action_items' OR ccu.table_name = 'tasks')
ORDER BY tc.table_name, kcu.column_name;
" 2>/dev/null || echo "Unable to connect to database directly"

echo ""
echo "📊 Checking sample tasks with extreme due dates..."
curl -s -X GET "${SUPABASE_URL}/rest/v1/tasks?select=id,title,due_date,status,created_at&status=eq.pending&order=due_date.asc&limit=5" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.[] | {id, title, due_date, status, days_old: ((now - (.created_at | fromdateiso8601)) / 86400 | floor)}'
