#!/bin/bash
# Debug why tasks aren't showing in UI

source .env 2>/dev/null || true

echo "🔍 Debugging Task Query Issue"
echo ""

# Get a meeting with tasks
MEETING_ID="66a9e65f-464d-4a95-9144-ef4f8f794495"
USER_ID="ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459"

echo "1️⃣ Tasks for meeting (no user filter):"
curl -s "${VITE_SUPABASE_URL}/rest/v1/tasks?meeting_id=eq.${MEETING_ID}&select=id,title,assigned_to,created_by,source" \
  -H "apikey: ${VITE_SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_SERVICE_ROLE_KEY}" | jq '.'

echo ""
echo "2️⃣ Tasks for meeting + user filter (what UI does):"
curl -s "${VITE_SUPABASE_URL}/rest/v1/tasks?meeting_id=eq.${MEETING_ID}&assigned_to=eq.${USER_ID}&select=id,title,assigned_to,source" \
  -H "apikey: ${VITE_SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_SERVICE_ROLE_KEY}" | jq '.'

echo ""
echo "3️⃣ Check if RLS is blocking:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/tasks?meeting_id=eq.${MEETING_ID}&select=id,title" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'

echo ""
echo "4️⃣ Try the complex query with joins (what UI actually does):"
curl -s "${VITE_SUPABASE_URL}/rest/v1/tasks?meeting_id=eq.${MEETING_ID}&select=*,assignee:profiles!assigned_to(id,first_name),suggestion:next_action_suggestions!tasks_suggestion_id_fkey(id)" \
  -H "apikey: ${VITE_SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_SERVICE_ROLE_KEY}" 2>&1 | head -30
