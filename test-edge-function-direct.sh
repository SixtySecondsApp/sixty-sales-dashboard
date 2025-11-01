#!/bin/bash

# Test Edge Function directly to see actual errors
# This bypasses pg_net and shows us what's happening

# First, get the user_id for the meeting
echo "Getting user_id for meeting..."
USER_ID=$(psql "$DATABASE_URL" -t -c "
SELECT owner_user_id
FROM meetings
WHERE id = '72b97f50-a2a9-412e-8ed4-37f0b78ff811';
" | xargs)

echo "User ID: $USER_ID"

# Get service role key from system_config
echo "Getting service role key..."
SERVICE_ROLE_KEY=$(psql "$DATABASE_URL" -t -c "
SELECT value
FROM system_config
WHERE key = 'service_role_key';
" | xargs)

echo "Service role key retrieved (length: ${#SERVICE_ROLE_KEY})"

# Invoke Edge Function directly
echo ""
echo "Invoking Edge Function..."
curl -v -X POST \
  'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/suggest-next-actions' \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d "{
    \"activityId\": \"72b97f50-a2a9-412e-8ed4-37f0b78ff811\",
    \"activityType\": \"meeting\",
    \"userId\": \"$USER_ID\",
    \"forceRegenerate\": true
  }"

echo ""
echo ""
echo "Checking for created suggestions..."
psql "$DATABASE_URL" -c "
SELECT
  count(*) as total_suggestions,
  count(DISTINCT meeting_id) as meetings_with_suggestions
FROM next_action_suggestions
WHERE created_at > NOW() - INTERVAL '5 minutes';
"
