#!/bin/bash
# Check a Sample Transcript

source .env 2>/dev/null || true

echo "📝 Checking Sample Transcript..."
echo ""

# Get one meeting with transcript
MEETING=$(curl -s "${VITE_SUPABASE_URL}/rest/v1/meetings?select=id,title,transcript_text&limit=1" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.[0]')

MEETING_ID=$(echo "$MEETING" | jq -r '.id')
MEETING_TITLE=$(echo "$MEETING" | jq -r '.title')
TRANSCRIPT_LENGTH=$(echo "$MEETING" | jq -r '.transcript_text | length')

echo "Meeting: $MEETING_TITLE"
echo "ID: $MEETING_ID"
echo "Transcript length: $TRANSCRIPT_LENGTH characters"
echo ""

if [ "$TRANSCRIPT_LENGTH" = "null" ] || [ "$TRANSCRIPT_LENGTH" = "0" ]; then
  echo "❌ No transcript found!"
else
  echo "✅ Transcript exists"
  echo ""
  echo "First 500 characters:"
  echo "$MEETING" | jq -r '.transcript_text' | head -c 500
  echo "..."
  echo ""
  echo "Last 500 characters:"
  echo "$MEETING" | jq -r '.transcript_text' | tail -c 500
fi
