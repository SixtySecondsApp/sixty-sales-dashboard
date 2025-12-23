#!/bin/bash
echo "⏳ Waiting 10 seconds for background AI summarization to complete..."
sleep 10
echo ""
echo "🔍 Checking for AI-generated summaries..."
echo ""

SUPABASE_URL=$(grep "VITE_SUPABASE_URL" .env.local | cut -d '=' -f2)
SERVICE_ROLE_KEY=$(grep "VITE_SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d '=' -f2)

curl -s -X GET "${SUPABASE_URL}/rest/v1/meetings?select=title,summary_oneliner,next_steps_oneliner&summary_oneliner=not.is.null&limit=3&order=created_at.desc" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.[]'
