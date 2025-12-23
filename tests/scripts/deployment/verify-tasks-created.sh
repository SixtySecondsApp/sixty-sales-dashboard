#!/bin/bash
# Verify tasks are being created and linked

source .env 2>/dev/null || true

echo "🎉 Verifying Task Creation Success!"
echo ""

echo "1️⃣ Tasks from AI suggestions:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/tasks?source=eq.ai_suggestion&select=id,title,task_type,meeting_id,status&limit=10" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'

echo ""
echo "2️⃣ Meeting task counts:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/meetings?select=id,title,next_actions_count&order=next_actions_count.desc&limit=5" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'

echo ""
echo "3️⃣ Task notifications:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/task_notifications?select=id,meeting_id,title,task_count,read&order=created_at.desc&limit=5" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'

echo ""
echo "📊 Summary:"
echo "   Total suggestions: $(curl -s "${VITE_SUPABASE_URL}/rest/v1/next_action_suggestions?select=count" -H "apikey: ${VITE_SUPABASE_ANON_KEY}" -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" -H "Prefer: count=exact" | jq -r '.[0].count')"
echo "   Total tasks: $(curl -s "${VITE_SUPABASE_URL}/rest/v1/tasks?select=count" -H "apikey: ${VITE_SUPABASE_ANON_KEY}" -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" -H "Prefer: count=exact" | jq -r '.[0].count')"
echo "   AI-created tasks: $(curl -s "${VITE_SUPABASE_URL}/rest/v1/tasks?source=eq.ai_suggestion&select=count" -H "apikey: ${VITE_SUPABASE_ANON_KEY}" -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" -H "Prefer: count=exact" | jq -r '.[0].count')"
