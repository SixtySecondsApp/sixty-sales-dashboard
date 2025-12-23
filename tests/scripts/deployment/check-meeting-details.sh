#!/bin/bash
# Check Meeting Details and Task Creation Status

source .env 2>/dev/null || true

echo "🔍 Checking Meeting Details and Tasks..."
echo ""

echo "1️⃣ Meetings with transcripts:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/meetings?select=id,title,transcript_text,transcript_doc_url,meeting_start&order=meeting_start.desc&limit=10" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.[] | {id, title, has_transcript: (.transcript_text != null), has_url: (.transcript_doc_url != null), date: .meeting_start}'

echo ""
echo "2️⃣ Meeting action items:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/meeting_action_items?select=id,meeting_id,title,ai_generated,completed&order=created_at.desc&limit=10" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'

echo ""
echo "3️⃣ Next action suggestions:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/next_action_suggestions?select=id,activity_id,activity_type,title,status&activity_type=eq.meeting&order=created_at.desc&limit=10" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'

echo ""
echo "4️⃣ Tasks created from meetings:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/tasks?select=id,title,meeting_id,source,created_at&meeting_id=not.is.null&order=created_at.desc&limit=10" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'

echo ""
echo "5️⃣ Task notifications:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/task_notifications?select=id,meeting_id,title,task_count,created_at&order=created_at.desc&limit=10" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'

echo ""
echo "📊 Summary:"
echo "   - Check #1: Do meetings have transcripts?"
echo "   - Check #2: Are there meeting action items?"
echo "   - Check #3: Did AI generate suggestions?"
echo "   - Check #4: Were tasks created?"
echo "   - Check #5: Were notifications sent?"
