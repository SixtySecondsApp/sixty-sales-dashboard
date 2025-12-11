#!/bin/bash

# Test Encharge Email Sending
# Tests the encharge-send-email Edge Function

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Testing Encharge Email Sending..."
echo ""

# Get Supabase project URL and anon key
if [ -z "$SUPABASE_URL" ]; then
  echo -e "${YELLOW}⚠️  SUPABASE_URL not set. Getting from supabase status...${NC}"
  SUPABASE_URL=$(supabase status | grep "API URL" | awk '{print $3}' 2>/dev/null)
fi

if [ -z "$SUPABASE_ANON_KEY" ]; then
  echo -e "${YELLOW}⚠️  SUPABASE_ANON_KEY not set. Getting from supabase status...${NC}"
  SUPABASE_ANON_KEY=$(supabase status | grep "anon key" | awk '{print $3}' 2>/dev/null)
fi

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo -e "${RED}❌ Could not get Supabase credentials.${NC}"
  echo "Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables, or run:"
  echo "  supabase status"
  exit 1
fi

echo -e "${GREEN}✅ Using Supabase URL: ${SUPABASE_URL}${NC}"
echo ""

# Test email address (use first argument or default)
TEST_EMAIL="${1:-test@example.com}"
TEST_NAME="${2:-Test User}"

echo "📧 Sending test email to: ${TEST_EMAIL}"
echo "👤 Name: ${TEST_NAME}"
echo ""

# Send test email
RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/encharge-send-email" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"template_type\": \"welcome\",
    \"to_email\": \"${TEST_EMAIL}\",
    \"to_name\": \"${TEST_NAME}\",
    \"variables\": {
      \"user_name\": \"${TEST_NAME}\"
    }
  }")

echo "📨 Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if successful
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ Email sent successfully!${NC}"
  echo ""
  echo "Check:"
  echo "  1. Your inbox: ${TEST_EMAIL}"
  echo "  2. AWS SES console for send status"
  echo "  3. Encharge dashboard for event tracking"
else
  echo -e "${RED}❌ Email sending failed${NC}"
  echo ""
  echo "Troubleshooting:"
  echo "  1. Check AWS credentials are set: supabase secrets list"
  echo "  2. Check Edge Function logs: supabase functions logs encharge-send-email"
  echo "  3. Verify template exists: SELECT * FROM encharge_email_templates WHERE template_type = 'welcome';"
fi
