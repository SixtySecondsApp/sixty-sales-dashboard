#!/bin/bash

# Fathom Webhook Configuration Checker
# This script helps you verify your Fathom webhook is configured correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Fathom Webhook Configuration Checker                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Load environment variables
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

WEBHOOK_URL="https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-webhook"

echo -e "${YELLOW}📡 Webhook Endpoint:${NC}"
echo "   $WEBHOOK_URL"
echo ""

# Step 1: Check if user has Fathom integration
echo -e "${BLUE}[1/5] Checking Fathom Integration...${NC}"

# Prompt for user email
echo -e "${YELLOW}Please enter your email address:${NC}"
read -p "Email: " USER_EMAIL

if [ -z "$USER_EMAIL" ]; then
    echo -e "${RED}❌ Email is required${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}[2/5] Verifying Integration in Database...${NC}"

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  psql not found. Skipping database check.${NC}"
    echo -e "${YELLOW}   You can manually check in Supabase Dashboard → Database → fathom_integrations${NC}"
else
    # Database check would go here if we had direct DB access
    echo -e "${YELLOW}ℹ️  Manual verification required:${NC}"
    echo -e "   1. Go to https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/editor"
    echo -e "   2. Run this query:"
    echo ""
    echo -e "${GREEN}   SELECT user_id, fathom_user_email, is_active, created_at${NC}"
    echo -e "${GREEN}   FROM fathom_integrations${NC}"
    echo -e "${GREEN}   WHERE fathom_user_email = '$USER_EMAIL';${NC}"
    echo ""
    echo -e "   Expected: 1 row with is_active = true"
fi

echo ""
echo -e "${BLUE}[3/5] Testing Webhook Endpoint...${NC}"

# Create test payload
TEST_PAYLOAD=$(cat <<EOF
{
  "recording_id": "test-$(date +%s)",
  "title": "Webhook Configuration Test - $(date +%Y-%m-%d)",
  "meeting_title": "Configuration Verification",
  "recording_start_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "recording_end_time": "$(date -u -v+1H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%SZ)",
  "recorded_by": {
    "email": "$USER_EMAIL",
    "name": "Test User",
    "team": "Sales"
  },
  "calendar_invitees": [
    {
      "name": "$USER_EMAIL",
      "email": "$USER_EMAIL",
      "is_external": false,
      "email_domain": "$(echo $USER_EMAIL | cut -d'@' -f2)"
    }
  ],
  "default_summary": {
    "template_name": "general",
    "markdown_formatted": "## Configuration Test\nThis is an automated test to verify webhook configuration."
  }
}
EOF
)

echo -e "${YELLOW}Sending test webhook...${NC}"

# Send test request
HTTP_STATUS=$(curl -s -o /tmp/webhook_response.json -w "%{http_code}" \
    -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "$TEST_PAYLOAD")

echo ""

if [ "$HTTP_STATUS" -eq 200 ]; then
    echo -e "${GREEN}✅ Webhook responded successfully (HTTP $HTTP_STATUS)${NC}"
    echo ""
    echo -e "${YELLOW}Response:${NC}"
    cat /tmp/webhook_response.json | jq '.' 2>/dev/null || cat /tmp/webhook_response.json
    echo ""
elif [ "$HTTP_STATUS" -eq 401 ]; then
    echo -e "${RED}❌ Authentication error (HTTP $HTTP_STATUS)${NC}"
    echo -e "${YELLOW}Response:${NC}"
    cat /tmp/webhook_response.json
    echo ""
    echo -e "${YELLOW}This might be expected if testing from external source.${NC}"
    echo -e "${YELLOW}The webhook will work when called by Fathom.${NC}"
elif [ "$HTTP_STATUS" -eq 400 ]; then
    echo -e "${RED}❌ Bad request (HTTP $HTTP_STATUS)${NC}"
    echo -e "${YELLOW}Response:${NC}"
    cat /tmp/webhook_response.json | jq '.' 2>/dev/null || cat /tmp/webhook_response.json
    echo ""
    echo -e "${YELLOW}This usually means:${NC}"
    echo -e "   - User email not found in fathom_integrations table${NC}"
    echo -e "   - Integration is not active${NC}"
else
    echo -e "${RED}❌ Unexpected response (HTTP $HTTP_STATUS)${NC}"
    echo -e "${YELLOW}Response:${NC}"
    cat /tmp/webhook_response.json
    echo ""
fi

echo ""
echo -e "${BLUE}[4/5] Checking Recent Webhook Logs...${NC}"
echo -e "${YELLOW}ℹ️  View detailed logs:${NC}"
echo "   https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/logs/edge-functions?s=fathom-webhook"
echo ""

echo -e "${BLUE}[5/5] Fathom Configuration Steps${NC}"
echo ""
echo -e "${YELLOW}To complete webhook setup in Fathom:${NC}"
echo ""
echo "1. Go to Fathom Settings → Integrations/Webhooks"
echo "2. Add webhook URL:"
echo -e "   ${GREEN}$WEBHOOK_URL${NC}"
echo ""
echo "3. Select events:"
echo "   ✅ Recording Ready"
echo "   ✅ Transcript Ready (if available)"
echo "   ✅ Summary Ready (if available)"
echo ""
echo "4. Save and test in Fathom dashboard"
echo ""

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                       Summary                                  ║${NC}"
echo -e "${BLUE}╠════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║${NC} User Email: $USER_EMAIL"
echo -e "${BLUE}║${NC} Webhook URL: $WEBHOOK_URL"
echo -e "${BLUE}║${NC} Test Status: HTTP $HTTP_STATUS"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Verify integration exists in database (see query above)"
echo "2. Configure webhook in Fathom settings"
echo "3. Record a test meeting"
echo "4. Check CRM for new meeting after ~5 minutes"
echo ""

# Cleanup
rm -f /tmp/webhook_response.json

echo -e "${GREEN}✅ Configuration check complete!${NC}"
