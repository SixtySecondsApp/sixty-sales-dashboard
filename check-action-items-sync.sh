#!/bin/bash
SUPABASE_URL=$(grep "VITE_SUPABASE_URL" .env.local | cut -d '=' -f2)
SERVICE_ROLE_KEY=$(grep "VITE_SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d '=' -f2)

echo "📋 Checking meeting action items and their sync status..."
echo ""

# Get meeting action items and check if they have linked tasks
curl -s -X GET "${SUPABASE_URL}/rest/v1/meeting_action_items?select=id,title,task_id,synced_to_task,sync_status&order=created_at.desc&limit=10" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.[] | {
    action_item_id: .id,
    title: .title,
    has_task_id: (.task_id != null),
    synced_to_task: .synced_to_task,
    sync_status: .sync_status
  }'

echo ""
echo "🔍 Checking if any tasks were auto-created from action items..."
echo ""

# Count tasks that were created from meeting action items
curl -s -X GET "${SUPABASE_URL}/rest/v1/tasks?select=id,title,meeting_action_item_id&meeting_action_item_id=not.is.null&order=created_at.desc&limit=5" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.[] | {
    task_id: .id,
    task_title: .title,
    from_action_item: .meeting_action_item_id
  }'
