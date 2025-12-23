#!/bin/bash
# Check if suggestions exist in database

source .env 2>/dev/null || true

echo "🔍 Checking Suggestions in Database..."
echo ""

MEETING_ID="7baadf93-d836-4bbd-a50b-4df04bb52f9c"

echo "1️⃣ Suggestions for meeting $MEETING_ID:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/next_action_suggestions?activity_id=eq.$MEETING_ID&select=id,title,status,created_at" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'

echo ""
echo "2️⃣ Tasks for meeting $MEETING_ID:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/tasks?meeting_id=eq.$MEETING_ID&select=id,title,status,source,created_at" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'

echo ""
echo "3️⃣ All suggestions count:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/next_action_suggestions?select=count" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -H "Prefer: count=exact" | jq '.'

echo ""
echo "4️⃣ All tasks count:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/tasks?select=count" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -H "Prefer: count=exact" | jq '.'
