#!/bin/bash
# Test Claude API directly to see what's happening

source .env 2>/dev/null || true

echo "🔍 Testing Claude API Response Directly"
echo "========================================"
echo ""

# Get a meeting with transcript
MEETING=$(curl -s "${VITE_SUPABASE_URL}/rest/v1/meetings?select=id,title,transcript_text&limit=1" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.[0]')

MEETING_ID=$(echo "$MEETING" | jq -r '.id')
MEETING_TITLE=$(echo "$MEETING" | jq -r '.title')
TRANSCRIPT=$(echo "$MEETING" | jq -r '.transcript_text')

echo "📊 Meeting: $MEETING_TITLE"
echo "   ID: $MEETING_ID"
echo "   Transcript length: ${#TRANSCRIPT} characters"
echo ""

echo "🚀 Calling Edge Function with detailed logging..."
echo ""

# Call the function and capture full response
FULL_RESPONSE=$(curl -s -X POST \
  "${VITE_SUPABASE_URL}/functions/v1/suggest-next-actions" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"activityId\": \"$MEETING_ID\",
    \"activityType\": \"meeting\",
    \"forceRegenerate\": true
  }")

echo "📄 Full Response:"
echo "$FULL_RESPONSE" | jq '.'

echo ""
echo "🔍 Checking for error messages:"
ERROR_MSG=$(echo "$FULL_RESPONSE" | jq -r '.error // empty')
DETAILS=$(echo "$FULL_RESPONSE" | jq -r '.details // empty')

if [ -n "$ERROR_MSG" ]; then
  echo "❌ Error found: $ERROR_MSG"
  if [ -n "$DETAILS" ]; then
    echo "   Details: $DETAILS"
  fi
else
  echo "✅ No error message in response"
fi

echo ""
echo "📊 Response Analysis:"
SUGGESTIONS=$(echo "$FULL_RESPONSE" | jq -r '.suggestions // []')
COUNT=$(echo "$FULL_RESPONSE" | jq -r '.count // 0')
MESSAGE=$(echo "$FULL_RESPONSE" | jq -r '.message // empty')

echo "   Suggestions: $SUGGESTIONS"
echo "   Count: $COUNT"
if [ -n "$MESSAGE" ]; then
  echo "   Message: $MESSAGE"
fi

echo ""
echo "💡 Next Step:"
echo "   Check Supabase Edge Function logs to see Claude's actual response"
echo "   Dashboard → Edge Functions → suggest-next-actions → Logs"
echo "   Look for: '[generateSuggestionsWithClaude] AI response length:'"
