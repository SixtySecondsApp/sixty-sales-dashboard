#!/bin/bash
# Check suggestions with proper user filter

source .env 2>/dev/null || true

echo "🔍 Checking Suggestions with User Filter..."
echo ""

MEETING_ID="7baadf93-d836-4bbd-a50b-4df04bb52f9c"
USER_ID="ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459"

echo "1️⃣ Suggestions for user $USER_ID:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/next_action_suggestions?user_id=eq.$USER_ID&select=id,title,status,activity_id" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'

echo ""
echo "2️⃣ Tasks for user $USER_ID:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/tasks?created_by=eq.$USER_ID&select=id,title,status,source,meeting_id" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'
