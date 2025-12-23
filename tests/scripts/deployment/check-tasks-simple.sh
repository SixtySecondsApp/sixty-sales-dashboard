#!/bin/bash
SUPABASE_URL=$(grep "VITE_SUPABASE_URL" .env.local | cut -d '=' -f2)
SERVICE_ROLE_KEY=$(grep "VITE_SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d '=' -f2)

echo "📊 Checking overdue tasks..."
echo ""

curl -s -X GET "${SUPABASE_URL}/rest/v1/tasks?select=id,title,due_date,status,created_at&status=eq.pending&order=due_date.asc&limit=10" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.[]'

echo ""
echo "📋 Checking meeting_action_items foreign keys..."
echo ""

curl -s -X GET "${SUPABASE_URL}/rest/v1/meeting_action_items?select=id,task_id,linked_task_id&limit=5" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.'
