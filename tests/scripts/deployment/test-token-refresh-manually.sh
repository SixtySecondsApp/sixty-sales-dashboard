#!/bin/bash

# Manual Token Refresh Test
# This will trigger fathom-sync and show if token refresh works

SUPABASE_URL="https://ewtuefzeogytgmsnkpmb.supabase.co"

# Get your service role key from: Settings > API > service_role
echo "Enter your Supabase service_role key:"
read -s SERVICE_ROLE_KEY

# Get a user_id from the fathom_integrations table
echo ""
echo "Enter a user_id to test (from fathom_integrations):"
read USER_ID

echo ""
echo "Testing token refresh for user: $USER_ID"
echo "Calling fathom-sync with incremental sync..."
echo ""

curl -X POST "${SUPABASE_URL}/functions/v1/fathom-sync" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"sync_type\": \"incremental\",
    \"user_id\": \"${USER_ID}\"
  }" \
  -w "\n\nHTTP Status: %{http_code}\n" \
  | jq '.' 2>/dev/null || cat

echo ""
echo "Check Edge Function logs at:"
echo "${SUPABASE_URL}/dashboard/project/ewtuefzeogytgmsnkpmb/functions/fathom-sync"
