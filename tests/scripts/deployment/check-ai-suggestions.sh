#!/bin/bash
# Check if AI suggestions already exist

source .env 2>/dev/null || true

echo "🔍 Checking for existing AI suggestions..."
echo ""

echo "1️⃣ Next action suggestions (should be empty for first run):"
curl -s "${VITE_SUPABASE_URL}/rest/v1/next_action_suggestions?select=id,activity_id,title,status,created_at&order=created_at.desc&limit=10" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'

echo ""
echo "2️⃣ Count of suggestions per meeting:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/next_action_suggestions?select=activity_id&activity_type=eq.meeting" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq 'group_by(.activity_id) | map({meeting_id: .[0].activity_id, count: length})'

echo ""
echo "3️⃣ Check ANTHROPIC_API_KEY environment (Edge Function needs this):"
if [ -z "${ANTHROPIC_API_KEY}" ]; then
  echo "❌ ANTHROPIC_API_KEY not set in .env"
else
  echo "✅ ANTHROPIC_API_KEY is set (${#ANTHROPIC_API_KEY} characters)"
fi
