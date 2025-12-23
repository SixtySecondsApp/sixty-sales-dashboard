#!/bin/bash
# Test Next-Actions Edge Function via Supabase CLI

set -e

echo "========================================="
echo "Next-Actions Edge Function CLI Test"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in a Supabase project
if [ ! -f "supabase/config.toml" ]; then
  echo -e "${RED}❌ Error: Not in a Supabase project directory${NC}"
  echo "Please run this from your project root"
  exit 1
fi

echo "Step 1: Finding a recent meeting with transcript..."
echo ""

# You'll need to replace this with an actual meeting ID from your database
# For now, let's use a placeholder
echo -e "${YELLOW}⚠️  You need to provide a meeting ID${NC}"
echo ""
echo "Run this SQL in Supabase Dashboard to find one:"
echo "  SELECT id, title FROM meetings WHERE transcript_text IS NOT NULL LIMIT 1;"
echo ""
read -p "Enter meeting ID: " MEETING_ID

if [ -z "$MEETING_ID" ]; then
  echo -e "${RED}❌ No meeting ID provided${NC}"
  exit 1
fi

echo ""
echo "Step 2: Testing Edge Function with meeting: $MEETING_ID"
echo ""

# Create JSON payload
PAYLOAD="{\"activityId\": \"$MEETING_ID\", \"activityType\": \"meeting\"}"

echo "Request payload:"
echo "$PAYLOAD"
echo ""

# Invoke the Edge Function
echo "Calling suggest-next-actions..."
echo ""

supabase functions invoke suggest-next-actions \
  --body "$PAYLOAD" \
  --no-verify-jwt

echo ""
echo -e "${GREEN}✅ Function call completed${NC}"
echo ""
echo "Step 3: Check the results in Supabase Dashboard:"
echo "  SELECT * FROM next_action_suggestions WHERE activity_id = '$MEETING_ID';"
echo ""
echo "Or check logs:"
echo "  supabase functions logs suggest-next-actions --limit 20"
