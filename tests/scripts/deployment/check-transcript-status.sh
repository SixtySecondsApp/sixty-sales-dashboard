#!/bin/bash
SUPABASE_URL=$(grep "VITE_SUPABASE_URL" .env.local | cut -d '=' -f2)
SERVICE_ROLE_KEY=$(grep "VITE_SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d '=' -f2)

echo "Checking transcript status after sync..."
echo ""
curl -s -X GET "${SUPABASE_URL}/rest/v1/meetings?select=id,title,fathom_recording_id,transcript_text,transcript_fetch_attempts,last_transcript_fetch_at&order=meeting_start.desc&limit=10" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq -r '.[] | "📅 \(.title)\n   Has transcript: \(if .transcript_text then "✅ YES (\(.transcript_text | length) chars)" else "❌ NO" end)\n   Attempts: \(.transcript_fetch_attempts // 0)\n   Recording ID: \(.fathom_recording_id)\n   Last attempt: \(.last_transcript_fetch_at // "Never")\n"'
