#!/bin/bash
SUPABASE_URL=$(grep "VITE_SUPABASE_URL" .env.local | cut -d '=' -f2)
SERVICE_ROLE_KEY=$(grep "VITE_SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d '=' -f2)

echo "🔍 Getting meeting summary for Viewpoint/SixtySeconds..."

# Get meeting data
MEETING=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/meetings?select=id,title,summary&fathom_recording_id=eq.99690200" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}")

MEETING_ID=$(echo "$MEETING" | jq -r '.[0].id')
SUMMARY=$(echo "$MEETING" | jq -r '.[0].summary')

echo "Meeting ID: $MEETING_ID"
echo "Summary length: ${#SUMMARY} characters"
echo ""

# Manually call condense function
echo "📝 Calling condense function..."
RESULT=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/condense-meeting-summary" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"summary\": $(echo "$SUMMARY" | jq -Rs .),
    \"meetingTitle\": \"Viewpoint/SixtySeconds\"
  }")

echo "$RESULT" | jq '.'

# If successful, update the database
if [ "$(echo "$RESULT" | jq -r '.success')" = "true" ]; then
  echo ""
  echo "✅ Condense successful, updating database..."
  
  MEETING_ABOUT=$(echo "$RESULT" | jq -r '.meeting_about')
  NEXT_STEPS=$(echo "$RESULT" | jq -r '.next_steps')
  
  curl -s -X PATCH "${SUPABASE_URL}/rest/v1/meetings?id=eq.${MEETING_ID}" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "{
      \"summary_oneliner\": $(echo "$MEETING_ABOUT" | jq -Rs .),
      \"next_steps_oneliner\": $(echo "$NEXT_STEPS" | jq -Rs .)
    }" | jq '.[] | {title, summary_oneliner, next_steps_oneliner}'
else
  echo ""
  echo "❌ Condense failed"
fi
