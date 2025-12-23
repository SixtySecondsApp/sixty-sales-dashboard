#!/bin/bash
# Manually Trigger AI Analysis for Existing Meetings

source .env 2>/dev/null || true

if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
  echo "❌ Error: Environment variables not set"
  exit 1
fi

echo "🤖 Triggering AI Analysis for Meetings..."
echo ""

# Get list of meetings
MEETINGS=$(curl -s "${VITE_SUPABASE_URL}/rest/v1/meetings?select=id,title&limit=10" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}")

echo "📋 Found meetings:"
echo "$MEETINGS" | jq -r '.[] | "\(.id) - \(.title)"'

echo ""
echo "🚀 Triggering AI analysis for each meeting..."
echo ""

# Loop through each meeting and trigger AI analysis
echo "$MEETINGS" | jq -r '.[].id' | while read MEETING_ID; do
  MEETING_TITLE=$(echo "$MEETINGS" | jq -r ".[] | select(.id==\"$MEETING_ID\") | .title")
  echo "📊 Analyzing: $MEETING_TITLE"

  RESPONSE=$(curl -s -w "\n%{http_code}" "${VITE_SUPABASE_URL}/functions/v1/suggest-next-actions" \
    -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"activityId\": \"$MEETING_ID\",
      \"activityType\": \"meeting\"
    }")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "200" ]; then
    TASK_COUNT=$(echo "$BODY" | jq -r '.tasks | length' 2>/dev/null || echo "0")
    echo "   ✅ Created $TASK_COUNT tasks"
  else
    echo "   ❌ Failed (HTTP $HTTP_CODE)"
    echo "   Error: $BODY"
  fi

  # Small delay to avoid rate limiting
  sleep 1
done

echo ""
echo "✅ AI analysis complete!"
echo ""
echo "📊 Check results:"
./check-meeting-details.sh
