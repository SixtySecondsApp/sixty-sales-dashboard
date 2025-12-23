#!/bin/bash
# Test notification creation workflow

source .env 2>/dev/null || true

echo "🧪 Testing Notification Creation Workflow"
echo ""

echo "1️⃣ Check if function exists in database:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/rpc/create_task_creation_notification" \
  -X POST \
  -H "apikey: ${VITE_SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "p_user_id": "00000000-0000-0000-0000-000000000000",
    "p_meeting_id": "00000000-0000-0000-0000-000000000000",
    "p_meeting_title": "Test Meeting",
    "p_task_count": 1,
    "p_task_ids": ["00000000-0000-0000-0000-000000000000"]
  }' 2>&1 | head -20

echo ""
echo ""
echo "2️⃣ Current notification count:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/task_notifications?select=count" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -H "Prefer: count=exact" | jq '.'

echo ""
echo "3️⃣ Sample meeting with tasks:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/meetings?select=id,title,owner_user_id,next_actions_count&next_actions_count=gt.0&limit=1" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'

echo ""
echo "4️⃣ Tasks for that meeting:"
MEETING_ID=$(curl -s "${VITE_SUPABASE_URL}/rest/v1/meetings?select=id&next_actions_count=gt.0&limit=1" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq -r '.[0].id')

if [ -n "$MEETING_ID" ] && [ "$MEETING_ID" != "null" ]; then
  curl -s "${VITE_SUPABASE_URL}/rest/v1/tasks?meeting_id=eq.${MEETING_ID}&select=id,title,source" \
    -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'
else
  echo "No meeting found with tasks"
fi
