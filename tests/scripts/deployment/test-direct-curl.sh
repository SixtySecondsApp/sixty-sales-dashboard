#!/bin/bash

# Direct Edge Function test - shows errors immediately

echo "Getting user_id..."
USER_ID=$(psql "$DATABASE_URL" -t -c "
SELECT owner_user_id::text
FROM meetings
WHERE id = '72b97f50-a2a9-412e-8ed4-37f0b78ff811';
" | xargs)

echo "User ID: $USER_ID"

echo "Getting service role key..."
SERVICE_ROLE_KEY=$(psql "$DATABASE_URL" -t -c "
SELECT value
FROM system_config
WHERE key = 'service_role_key';
" | xargs)

echo "Service role key length: ${#SERVICE_ROLE_KEY}"
echo ""
echo "Calling Edge Function..."
echo "================================"

curl -v -X POST \
  'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/suggest-next-actions' \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d "{
    \"activityId\": \"72b97f50-a2a9-412e-8ed4-37f0b78ff811\",
    \"activityType\": \"meeting\",
    \"userId\": \"$USER_ID\",
    \"forceRegenerate\": true
  }" 2>&1

echo ""
echo "================================"
echo ""
echo "Checking for suggestions..."
psql "$DATABASE_URL" -c "
SELECT COUNT(*) as suggestion_count
FROM next_action_suggestions
WHERE activity_id = '72b97f50-a2a9-412e-8ed4-37f0b78ff811';
"
