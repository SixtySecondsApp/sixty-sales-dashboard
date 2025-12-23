#!/bin/bash
SUPABASE_URL=$(grep "VITE_SUPABASE_URL" .env.local | cut -d '=' -f2)
SERVICE_ROLE_KEY=$(grep "VITE_SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d '=' -f2)

echo "🔍 Checking if auto-create trigger is active..."
echo ""

# Check for the trigger
curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = '\''trigger_auto_create_task_from_action_item'\''"}' 2>/dev/null

# Alternative: Check using information_schema
psql "${SUPABASE_URL/https:\/\//postgresql://postgres:}@db.${SUPABASE_URL#*//}/postgres" << 'SQL'
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_auto_create_task_from_action_item';
SQL
