#!/bin/bash
# Manually trigger a sync for one specific meeting to see detailed logs

SUPABASE_URL=$(grep "VITE_SUPABASE_URL" .env.local | cut -d '=' -f2)
SERVICE_ROLE_KEY=$(grep "VITE_SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d '=' -f2)

# Get user ID
USER_ID=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/fathom_integrations?select=user_id&is_active=eq.true&limit=1" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq -r '.[0].user_id')

echo "Triggering manual sync for user: $USER_ID"
echo "Recording ID: 99690200 (Viewpoint/SixtySeconds)"
echo ""

# Call the edge function
curl -X POST "${SUPABASE_URL}/functions/v1/fathom-sync" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"${USER_ID}\",
    \"sync_type\": \"single\",
    \"call_id\": \"99690200\"
  }"

echo ""
echo ""
echo "Check meeting status..."
sleep 3

curl -s -X GET "${SUPABASE_URL}/rest/v1/meetings?select=title,transcript_text,transcript_fetch_attempts&fathom_recording_id=eq.99690200" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.'
