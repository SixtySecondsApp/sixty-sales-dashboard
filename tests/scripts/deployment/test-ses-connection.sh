#!/bin/bash
# Test AWS SES Connection via Edge Function
# This tests the SES setup using the deployed Edge Function

echo "🧪 Testing AWS SES Connection via Edge Function..."
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

echo "📡 Calling test endpoint..."
echo "   Project: $PROJECT_REF"
echo ""

# Call the test endpoint
RESPONSE=$(curl -s -X GET \
  "${SUPABASE_URL}/functions/v1/encharge-send-email?test=ses" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json")

echo "📊 Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if successful
SUCCESS=$(echo "$RESPONSE" | jq -r '.success' 2>/dev/null || echo "false")

if [ "$SUCCESS" = "true" ]; then
  echo "✅ SES connection test passed!"
  echo ""
  echo "📈 SES Quota Information:"
  echo "$RESPONSE" | jq -r '.data | "   Max 24h Send: \(.max24HourSend)\n   Max Send Rate: \(.maxSendRate)/sec\n   Sent Last 24h: \(.sentLast24Hours)"' 2>/dev/null || echo "   (Quota data available in response above)"
else
  echo "❌ SES connection test failed!"
  echo ""
  echo "Error details:"
  echo "$RESPONSE" | jq -r '.message' 2>/dev/null || echo "$RESPONSE"
  exit 1
fi
