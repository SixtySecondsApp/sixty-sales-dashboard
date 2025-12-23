#!/bin/bash
# Comprehensive Next-Actions Edge Function Test via Supabase CLI

set -e

echo "========================================="
echo "Next-Actions Edge Function Test"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo "Install: https://supabase.com/docs/guides/cli"
    exit 1
fi

echo -e "${BLUE}📋 Step 1: Checking Edge Function status...${NC}"
supabase functions list | grep suggest-next-actions || {
    echo -e "${RED}❌ Edge Function 'suggest-next-actions' not found${NC}"
    echo "Deploy it: supabase functions deploy suggest-next-actions"
    exit 1
}
echo -e "${GREEN}✅ Edge Function deployed${NC}"
echo ""

echo -e "${BLUE}📋 Step 2: Checking secrets...${NC}"
supabase secrets list | grep -E "ANTHROPIC_API_KEY|SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY" || {
    echo -e "${YELLOW}⚠️  Warning: Some secrets might be missing${NC}"
    echo "Required secrets:"
    echo "  - ANTHROPIC_API_KEY"
    echo "  - SUPABASE_URL"
    echo "  - SUPABASE_SERVICE_ROLE_KEY"
    echo ""
    echo "Set them with:"
    echo "  supabase secrets set ANTHROPIC_API_KEY=your-key"
    echo ""
}
echo ""

echo -e "${BLUE}📋 Step 3: Finding a meeting to test...${NC}"
echo "Run this in Supabase SQL Editor to find a meeting:"
echo ""
echo -e "${YELLOW}SELECT id, title FROM meetings WHERE transcript_text IS NOT NULL LIMIT 5;${NC}"
echo ""

# Try to get meeting ID from user
read -p "Enter a meeting ID to test (or press Enter to use a test ID): " MEETING_ID

if [ -z "$MEETING_ID" ]; then
    # Use a test payload
    echo ""
    echo -e "${YELLOW}⚠️  No meeting ID provided. Using generic test...${NC}"
    echo ""
    echo "To properly test, you need a real meeting ID."
    echo "Run the SQL above to get one, then run this script again."
    echo ""
    exit 0
fi

echo ""
echo -e "${BLUE}📋 Step 4: Invoking Edge Function...${NC}"
echo "Meeting ID: $MEETING_ID"
echo ""

# Create payload
PAYLOAD="{\"activityId\": \"$MEETING_ID\", \"activityType\": \"meeting\", \"forceRegenerate\": true}"

echo "Payload:"
echo "$PAYLOAD"
echo ""

# Invoke function
echo "Calling suggest-next-actions Edge Function..."
echo ""

RESPONSE=$(supabase functions invoke suggest-next-actions \
  --body "$PAYLOAD" \
  2>&1)

echo "Response:"
echo "$RESPONSE"
echo ""

# Check for success
if echo "$RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✅ Function executed successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Check response for errors${NC}"
fi

echo ""
echo -e "${BLUE}📋 Step 5: Checking logs...${NC}"
echo ""
supabase functions logs suggest-next-actions --limit 10

echo ""
echo "========================================="
echo "Test Complete"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Check Supabase Dashboard → next_action_suggestions table"
echo "  2. Run: SELECT * FROM next_action_suggestions WHERE activity_id = '$MEETING_ID';"
echo "  3. Check app UI for badges on meeting cards"
echo ""
