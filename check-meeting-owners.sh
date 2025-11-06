#!/bin/bash
# Check Meeting Owners

source .env 2>/dev/null || true

echo "🔍 Checking meeting owner_user_id values..."
echo ""

curl -s "${VITE_SUPABASE_URL}/rest/v1/meetings?select=id,title,owner_user_id&limit=5" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.[] | {title, owner_user_id}'
