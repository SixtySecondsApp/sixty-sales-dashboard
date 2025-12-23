#!/bin/bash
SUPABASE_URL=$(grep "VITE_SUPABASE_URL" .env.local | cut -d '=' -f2)
SERVICE_ROLE_KEY=$(grep "VITE_SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d '=' -f2)

echo "🔍 Checking AI-generated summaries for recording 99690200..."
echo ""

curl -s -X GET "${SUPABASE_URL}/rest/v1/meetings?select=title,summary_oneliner,next_steps_oneliner&fathom_recording_id=eq.99690200" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.[]'

echo ""
echo ""
echo "📊 Checking all meetings with summaries..."
echo ""

curl -s -X GET "${SUPABASE_URL}/rest/v1/meetings?select=title,summary_oneliner,next_steps_oneliner&summary_oneliner=not.is.null&limit=5" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.[]'
