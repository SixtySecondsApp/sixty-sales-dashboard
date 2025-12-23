#!/bin/bash
SUPABASE_URL=$(grep "VITE_SUPABASE_URL" .env.local | cut -d '=' -f2)
SERVICE_ROLE_KEY=$(grep "VITE_SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d '=' -f2)

echo "Resetting transcript fetch attempts for recording 99690200..."
curl -s -X PATCH "${SUPABASE_URL}/rest/v1/meetings?fathom_recording_id=eq.99690200" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"transcript_fetch_attempts": 0, "last_transcript_fetch_at": null}' | jq '.[] | {title, attempts: .transcript_fetch_attempts}'

echo ""
echo "Triggering sync..."

USER_ID=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/fathom_integrations?select=user_id&is_active=eq.true&limit=1" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq -r '.[0].user_id')

curl -X POST "${SUPABASE_URL}/functions/v1/fathom-sync" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"${USER_ID}\", \"sync_type\": \"single\", \"call_id\": \"99690200\"}"

echo ""
echo ""
echo "Waiting for sync to complete..."
sleep 5

echo "Checking result..."
curl -s -X GET "${SUPABASE_URL}/rest/v1/meetings?select=title,transcript_text,transcript_fetch_attempts&fathom_recording_id=eq.99690200" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.[] | {title, has_transcript: (.transcript_text != null), length: (.transcript_text | length // 0), attempts: .transcript_fetch_attempts}'
