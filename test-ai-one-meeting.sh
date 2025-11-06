#!/bin/bash
# Test AI analysis on ONE meeting with verbose output

source .env 2>/dev/null || true

echo "🤖 Testing AI Analysis on One Meeting..."
echo ""

# Get one meeting
MEETING=$(curl -s "${VITE_SUPABASE_URL}/rest/v1/meetings?select=id,title&limit=1" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.[0]')

MEETING_ID=$(echo "$MEETING" | jq -r '.id')
MEETING_TITLE=$(echo "$MEETING" | jq -r '.title')

echo "📊 Testing meeting: $MEETING_TITLE"
echo "   ID: $MEETING_ID"
echo ""

echo "🚀 Calling suggest-next-actions Edge Function..."
echo ""

# Call with verbose output
RESPONSE=$(curl -s -w "\n%{http_code}" "${VITE_SUPABASE_URL}/functions/v1/suggest-next-actions" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"activityId\": \"$MEETING_ID\",
    \"activityType\": \"meeting\",
    \"forceRegenerate\": true
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "📊 HTTP Status: $HTTP_CODE"
echo ""
echo "📄 Response Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"

echo ""
echo "🔍 Checking what was created..."
echo ""

# Check suggestions
echo "Next Action Suggestions:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/next_action_suggestions?activity_id=eq.$MEETING_ID&select=id,title,action_type,status" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'

echo ""
echo "Tasks:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/tasks?meeting_id=eq.$MEETING_ID&select=id,title,task_type,status" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'
