#!/bin/bash
SUPABASE_URL=$(grep "VITE_SUPABASE_URL" .env.local | cut -d '=' -f2)
SERVICE_ROLE_KEY=$(grep "VITE_SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d '=' -f2)

echo "Checking the 2 meetings that still don't have transcripts..."
echo ""
curl -s -X GET "${SUPABASE_URL}/rest/v1/meetings?select=title,meeting_start,fathom_recording_id,owner_user_id&fathom_recording_id=in.(99062305,99032084)" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.'
