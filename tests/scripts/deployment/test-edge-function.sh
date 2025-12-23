#!/bin/bash

echo "==================================="
echo "Testing Next-Actions Edge Function"
echo "==================================="
echo ""

# Get a meeting ID with transcript
echo "Step 1: Finding a meeting with transcript..."
MEETING_ID=$(psql "$DATABASE_URL" -t -c "
SELECT id 
FROM meetings 
WHERE transcript_text IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 1;
" | xargs)

if [ -z "$MEETING_ID" ]; then
  echo "❌ No meetings found with transcripts"
  echo "Please sync some Fathom meetings first"
  exit 1
fi

echo "✅ Found meeting: $MEETING_ID"
echo ""

# Test the Edge Function
echo "Step 2: Calling Edge Function..."
echo "Request payload:"
REQUEST_PAYLOAD="{\"activityId\": \"$MEETING_ID\", \"activityType\": \"meeting\"}"
echo "$REQUEST_PAYLOAD"
echo ""

# Call the function
RESPONSE=$(supabase functions invoke suggest-next-actions \
  --body "$REQUEST_PAYLOAD" \
  2>&1)

echo "Response:"
echo "$RESPONSE"
echo ""

# Check if suggestions were created
echo "Step 3: Checking database for suggestions..."
psql "$DATABASE_URL" -c "
SELECT 
  id,
  title,
  urgency,
  status,
  created_at
FROM next_action_suggestions 
WHERE activity_id = '$MEETING_ID'
ORDER BY created_at DESC;
"

echo ""
echo "Step 4: Checking pending count..."
psql "$DATABASE_URL" -c "SELECT get_pending_suggestions_count();"

