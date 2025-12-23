#!/bin/bash
# Verify Email Setup - Check DNS records and email structure

DOMAIN="use60.com"
EMAIL="app@use60.com"

echo "🔍 Verifying Email Setup for $DOMAIN"
echo "======================================"
echo ""

# Check SPF record
echo "1️⃣ Checking SPF Record..."
SPF=$(dig +short TXT $DOMAIN | grep -i "v=spf1" || echo "NOT FOUND")
if [[ $SPF == *"amazonses.com"* ]]; then
  echo "✅ SPF record found and includes amazonses.com"
  echo "   $SPF"
else
  echo "❌ SPF record missing or incorrect"
  echo "   Expected: v=spf1 include:amazonses.com ~all"
  echo "   Found: $SPF"
fi
echo ""

# Check DMARC record
echo "2️⃣ Checking DMARC Record..."
DMARC=$(dig +short TXT _dmarc.$DOMAIN | grep -i "v=dmarc1" || echo "NOT FOUND")
if [[ $DMARC == *"v=DMARC1"* ]]; then
  echo "✅ DMARC record found"
  echo "   $DMARC"
else
  echo "⚠️  DMARC record not found (recommended but not required)"
  echo "   Add: _dmarc.$DOMAIN TXT \"v=DMARC1; p=quarantine; rua=mailto:dmarc@$DOMAIN\""
fi
echo ""

# Check DKIM records (AWS provides 3)
echo "3️⃣ Checking DKIM Records..."
DKIM_COUNT=$(dig +short TXT default._domainkey.$DOMAIN 2>/dev/null | wc -l)
if [ "$DKIM_COUNT" -gt 0 ]; then
  echo "✅ DKIM records found (check AWS SES console for all 3 CNAME records)"
else
  echo "⚠️  DKIM records not found via DNS lookup"
  echo "   Check AWS SES console → Verified identities → $DOMAIN → DKIM"
  echo "   Should have 3 CNAME records like: [token]._domainkey.$DOMAIN"
fi
echo ""

# Test SES connection
echo "4️⃣ Testing SES Connection..."
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

SUPABASE_URL="${VITE_SUPABASE_URL:-${SUPABASE_URL}}"
SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-${SUPABASE_ANON_KEY}}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "⚠️  Cannot test SES - missing Supabase credentials"
else
  SES_TEST=$(curl -s -X GET \
    "${SUPABASE_URL}/functions/v1/encharge-send-email?test=ses" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json")
  
  SES_SUCCESS=$(echo "$SES_TEST" | jq -r '.success' 2>/dev/null || echo "false")
  
  if [ "$SES_SUCCESS" = "true" ]; then
    echo "✅ SES connection working"
    echo "$SES_TEST" | jq -r '.data | "   Max 24h: \(.max24HourSend) | Rate: \(.maxSendRate)/sec | Sent: \(.sentLast24Hours)"' 2>/dev/null
  else
    echo "❌ SES connection failed"
    echo "$SES_TEST" | jq -r '.message' 2>/dev/null || echo "$SES_TEST"
  fi
fi
echo ""

# Summary
echo "📊 Summary:"
echo "   Domain: $DOMAIN"
echo "   Sender Email: $EMAIL"
echo ""
echo "To improve deliverability:"
echo "   1. ✅ Domain verified in AWS SES"
echo "   2. ⚠️  Ensure SPF record includes amazonses.com"
echo "   3. ⚠️  Add DMARC record (recommended)"
echo "   4. ⚠️  Verify all 3 DKIM CNAME records in DNS"
echo "   5. ⚠️  Request production access if in sandbox mode"
echo ""
echo "For spam issues:"
echo "   - Check bounce/complaint rates in AWS SES dashboard"
echo "   - Monitor sending statistics"
echo "   - Ensure email content follows best practices"
echo "   - Warm up domain gradually (start with low volume)"











