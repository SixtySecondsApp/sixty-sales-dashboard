#!/bin/bash
# Force Generate Next-Action Suggestions via Supabase CLI
# This script directly invokes the Edge Function for all meetings with transcripts

set -e

echo "========================================="
echo "Force Generate Next-Actions via CLI"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Get all meeting IDs with transcripts
echo -e "${BLUE}📋 Step 1: Finding meetings with transcripts...${NC}"
echo ""

# Use SQL to get meeting IDs
MEETING_IDS=$(supabase db execute "
SELECT id
FROM meetings
WHERE transcript_text IS NOT NULL
ORDER BY created_at DESC
" --json 2>/dev/null | jq -r '.[].id' 2>/dev/null || echo "")

if [ -z "$MEETING_IDS" ]; then
  echo -e "${RED}❌ No meetings found with transcripts${NC}"
  echo ""
  echo "This could mean:"
  echo "  1. Meetings haven't been synced yet"
  echo "  2. Transcripts haven't been fetched yet (wait 5-10 min after sync)"
  echo "  3. Database connection issue"
  echo ""
  echo "Try running: supabase db execute \"SELECT COUNT(*) FROM meetings\""
  exit 1
fi

# Count meetings
MEETING_COUNT=$(echo "$MEETING_IDS" | wc -l | xargs)
echo -e "${GREEN}✅ Found ${MEETING_COUNT} meetings with transcripts${NC}"
echo ""

# Step 2: Invoke Edge Function for each meeting
echo -e "${BLUE}📋 Step 2: Invoking Edge Function for each meeting...${NC}"
echo ""

SUCCESS_COUNT=0
ERROR_COUNT=0

for MEETING_ID in $MEETING_IDS; do
  echo -e "${YELLOW}Processing: ${MEETING_ID}${NC}"

  # Create payload
  PAYLOAD="{\"activityId\": \"$MEETING_ID\", \"activityType\": \"meeting\", \"forceRegenerate\": true}"

  # Invoke Edge Function
  RESPONSE=$(supabase functions invoke suggest-next-actions \
    --body "$PAYLOAD" \
    2>&1)

  # Check response
  if echo "$RESPONSE" | grep -q '"success":true' || echo "$RESPONSE" | grep -q '"suggestionsCreated":[0-9]'; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    echo -e "${GREEN}✅ Success${NC}"
  else
    ERROR_COUNT=$((ERROR_COUNT + 1))
    echo -e "${RED}❌ Failed${NC}"
    echo "   Response: $RESPONSE"
  fi

  echo ""

  # Small delay to avoid overwhelming the function
  sleep 1
done

# Step 3: Summary
echo ""
echo "========================================="
echo "GENERATION COMPLETE"
echo "========================================="
echo -e "${GREEN}Successfully triggered: ${SUCCESS_COUNT}${NC}"
echo -e "${RED}Errors: ${ERROR_COUNT}${NC}"
echo ""

# Step 4: Check results
echo -e "${BLUE}📋 Step 3: Checking results...${NC}"
echo ""

sleep 5 # Wait for Edge Function to complete

SUGGESTION_COUNT=$(supabase db execute "
SELECT COUNT(*) as count
FROM next_action_suggestions
WHERE activity_type = 'meeting'
" --json 2>/dev/null | jq -r '.[0].count' 2>/dev/null || echo "0")

echo -e "${GREEN}Total suggestions in database: ${SUGGESTION_COUNT}${NC}"
echo ""

# Show recent suggestions
echo "Recent suggestions:"
supabase db execute "
SELECT
  nas.title,
  nas.urgency,
  nas.status,
  m.title as meeting_title,
  nas.created_at
FROM next_action_suggestions nas
JOIN meetings m ON m.id = nas.activity_id
WHERE nas.activity_type = 'meeting'
ORDER BY nas.created_at DESC
LIMIT 5
" --csv 2>/dev/null || echo "Could not fetch suggestions"

echo ""
echo "========================================="
echo "Next Steps:"
echo "========================================="
echo "1. Check Edge Function logs:"
echo "   supabase functions logs suggest-next-actions --limit 50"
echo ""
echo "2. Check all suggestions:"
echo "   supabase db execute \"SELECT * FROM next_action_suggestions WHERE activity_type = 'meeting' ORDER BY created_at DESC LIMIT 10\""
echo ""
echo "3. Open app and view suggestions in UI"
echo ""
