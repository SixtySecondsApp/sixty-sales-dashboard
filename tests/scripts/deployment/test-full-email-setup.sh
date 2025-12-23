#!/bin/bash
# Full Email Setup Test
# Tests the complete email sending flow including SES and Encharge tracking

echo "🧪 Full Email Setup Test"
echo "========================"
echo ""

# Get Supabase URL and anon key from .env or environment
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

SUPABASE_URL="${VITE_SUPABASE_URL:-${SUPABASE_URL}}"
SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-${SUPABASE_ANON_KEY}}"

if [ -z "$SUPABASE_URL" ]; then
  echo "❌ SUPABASE_URL not found. Please set it in .env or environment."
  exit 1
fi

if [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "❌ SUPABASE_ANON_KEY not found. Please set it in .env or environment."
  exit 1
fi

# Extract project ref from URL
PROJECT_REF=$(echo $SUPABASE_URL | sed -E 's|https://([^.]+)\.supabase\.co.*|\1|')

echo "📡 Testing SES Connection..."
echo ""

# Test 1: SES Connection
SES_TEST=$(curl -s -X GET \
  "${SUPABASE_URL}/functions/v1/encharge-send-email?test=ses" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json")

SES_SUCCESS=$(echo "$SES_TEST" | jq -r '.success' 2>/dev/null || echo "false")

if [ "$SES_SUCCESS" = "true" ]; then
  echo "✅ SES Connection: OK"
  echo "$SES_TEST" | jq -r '.data | "   Max 24h: \(.max24HourSend) | Rate: \(.maxSendRate)/sec | Sent: \(.sentLast24Hours)"' 2>/dev/null
else
  echo "❌ SES Connection: FAILED"
  echo "$SES_TEST" | jq -r '.message' 2>/dev/null || echo "$SES_TEST"
  exit 1
fi

echo ""
echo "📧 Testing Email Sending..."
echo ""

# Test 2: Send a test email
# First, check if we have a welcome template
TEMPLATE_CHECK=$(curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/encharge_email_templates?template_type=eq.welcome&is_active=eq.true&select=*" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json")

TEMPLATE_COUNT=$(echo "$TEMPLATE_CHECK" | jq '. | length' 2>/dev/null || echo "0")

if [ "$TEMPLATE_COUNT" = "0" ]; then
  echo "⚠️  No 'welcome' template found. Creating a test template..."
  
  # Create a test template
  TEMPLATE_CREATE=$(curl -s -X POST \
    "${SUPABASE_URL}/rest/v1/encharge_email_templates" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d '{
      "template_name": "Test Welcome Email",
      "template_type": "welcome",
      "subject_line": "Test Email from Sixty Seconds",
      "html_body": "<html><body><h1>Hello {{user_name}}!</h1><p>This is a test email from the Sixty Seconds platform.</p><p>If you received this, the email system is working correctly.</p></body></html>",
      "text_body": "Hello {{user_name}}! This is a test email from the Sixty Seconds platform. If you received this, the email system is working correctly.",
      "is_active": true
    }')
  
  echo "✅ Test template created"
fi

# Get test email from user or use default
TEST_EMAIL="${1:-test@example.com}"

if [ "$TEST_EMAIL" = "test@example.com" ]; then
  echo "⚠️  Using default test email: $TEST_EMAIL"
  echo "   To test with your email, run: ./test-full-email-setup.sh your@email.com"
  echo ""
fi

# Send test email
echo "📤 Sending test email to: $TEST_EMAIL"
echo ""

EMAIL_SEND=$(curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/encharge-send-email" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"template_type\": \"welcome\",
    \"to_email\": \"$TEST_EMAIL\",
    \"to_name\": \"Test User\",
    \"variables\": {
      \"user_name\": \"Test User\",
      \"user_email\": \"$TEST_EMAIL\"
    }
  }")

EMAIL_SUCCESS=$(echo "$EMAIL_SEND" | jq -r '.success' 2>/dev/null || echo "false")

if [ "$EMAIL_SUCCESS" = "true" ]; then
  MESSAGE_ID=$(echo "$EMAIL_SEND" | jq -r '.message_id' 2>/dev/null || echo "unknown")
  EVENT_TRACKED=$(echo "$EMAIL_SEND" | jq -r '.event_tracked' 2>/dev/null || echo "unknown")
  
  echo "✅ Email Sent Successfully!"
  echo "   Message ID: $MESSAGE_ID"
  echo "   Event Tracked: $EVENT_TRACKED"
  echo ""
  echo "📬 Check your inbox at: $TEST_EMAIL"
  echo ""
  echo "⚠️  Note about Gmail warnings:"
  echo "   If Gmail shows a warning about the sender, you need to:"
  echo "   1. Verify your domain in AWS SES"
  echo "   2. Set up SPF, DKIM, and DMARC records"
  echo "   3. Request production access if in sandbox mode"
  echo ""
  echo "   See: https://docs.aws.amazon.com/ses/latest/dg/verify-domains.html"
else
  echo "❌ Email Send Failed!"
  echo ""
  echo "Error details:"
  echo "$EMAIL_SEND" | jq -r '.error' 2>/dev/null || echo "$EMAIL_SEND"
  exit 1
fi

echo ""
echo "📊 Test Summary:"
echo "   ✅ SES Connection: OK"
echo "   ✅ Email Template: OK"
echo "   ✅ Email Sending: OK"
echo ""
echo "🎉 Full email setup test completed successfully!"
