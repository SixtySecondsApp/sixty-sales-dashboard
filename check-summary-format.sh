#!/bin/bash
SUPABASE_URL=$(grep "VITE_SUPABASE_URL" .env.local | cut -d '=' -f2)
SERVICE_ROLE_KEY=$(grep "VITE_SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d '=' -f2)
curl -s -X GET "${SUPABASE_URL}/rest/v1/meetings?select=summary&order=created_at.desc&limit=1" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.[0].summary'
