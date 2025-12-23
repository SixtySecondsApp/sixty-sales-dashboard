#!/bin/bash
# Manually create a notification for testing

source .env 2>/dev/null || true

echo "🔔 Manually Creating Test Notification"
echo ""

# Get a real meeting with tasks
echo "1️⃣ Finding meeting with tasks..."
MEETING_DATA=$(curl -s "${VITE_SUPABASE_URL}/rest/v1/meetings?select=id,title,owner_user_id,next_actions_count&next_actions_count=gt.0&limit=1" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}")

echo "$MEETING_DATA" | jq '.'

MEETING_ID=$(echo "$MEETING_DATA" | jq -r '.[0].id')
MEETING_TITLE=$(echo "$MEETING_DATA" | jq -r '.[0].title')
USER_ID=$(echo "$MEETING_DATA" | jq -r '.[0].owner_user_id')
TASK_COUNT=$(echo "$MEETING_DATA" | jq -r '.[0].next_actions_count')

echo ""
echo "2️⃣ Getting task IDs for this meeting..."
TASK_IDS=$(curl -s "${VITE_SUPABASE_URL}/rest/v1/tasks?meeting_id=eq.${MEETING_ID}&select=id&source=eq.ai_suggestion" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq -r 'map(.id)')

echo "Task IDs: $TASK_IDS"

echo ""
echo "3️⃣ Creating notification via RPC..."
curl -s "${VITE_SUPABASE_URL}/rest/v1/rpc/create_task_creation_notification" \
  -X POST \
  -H "apikey: ${VITE_SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"p_user_id\": \"${USER_ID}\",
    \"p_meeting_id\": \"${MEETING_ID}\",
    \"p_meeting_title\": \"${MEETING_TITLE}\",
    \"p_task_count\": ${TASK_COUNT},
    \"p_task_ids\": ${TASK_IDS}
  }" | jq '.'

echo ""
echo "4️⃣ Verifying notification created..."
curl -s "${VITE_SUPABASE_URL}/rest/v1/task_notifications?select=*&order=created_at.desc&limit=1" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'

echo ""
echo "5️⃣ Total notification count:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/task_notifications?select=count" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -H "Prefer: count=exact" | jq '.'
