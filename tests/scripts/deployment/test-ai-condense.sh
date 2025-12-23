#!/bin/bash
SUPABASE_URL=$(grep "VITE_SUPABASE_URL" .env.local | cut -d '=' -f2)
SERVICE_ROLE_KEY=$(grep "VITE_SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d '=' -f2)

echo "🧪 Testing AI Summary Condensing Edge Function..."
echo ""

# Get a meeting with a summary
MEETING_DATA=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/meetings?select=id,title,summary&summary=not.is.null&limit=1" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}")

MEETING_ID=$(echo "$MEETING_DATA" | jq -r '.[0].id')
MEETING_TITLE=$(echo "$MEETING_DATA" | jq -r '.[0].title')
SUMMARY=$(echo "$MEETING_DATA" | jq -r '.[0].summary')

echo "Testing with meeting: $MEETING_TITLE"
echo "Summary length: ${#SUMMARY} characters"
echo ""

# Test the Edge Function
curl -s -X POST "${SUPABASE_URL}/functions/v1/condense-meeting-summary" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"summary\": \"$SUMMARY\",
    \"meetingTitle\": \"$MEETING_TITLE\"
  }" | jq '.'
