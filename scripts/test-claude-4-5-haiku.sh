#!/bin/bash
# Test Claude 4.5 Haiku via the Edge Function
# This will use your configured OpenRouter API key from user_settings

echo "🧪 Testing Claude 4.5 Haiku via Edge Function..."
echo ""

# Get Supabase URL and anon key from .env
if [ -f .env ]; then
  export $(grep -E 'VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY' .env | xargs)
fi

if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
  echo "❌ Missing Supabase environment variables"
  echo "Please ensure .env has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"
  exit 1
fi

# Get auth token (you'll need to be logged in)
echo "📝 Note: This test requires you to be logged in to the app"
echo "   Please get your auth token from the browser's localStorage or Network tab"
echo ""
read -p "Enter your Supabase auth token (or press Enter to skip): " AUTH_TOKEN

if [ -z "$AUTH_TOKEN" ]; then
  echo "⚠️  Skipping test - no auth token provided"
  echo ""
  echo "To test manually:"
  echo "1. Open your app in the browser"
  echo "2. Open DevTools → Application → Local Storage"
  echo "3. Find 'sb-<project>-auth-token' and copy the access_token value"
  echo "4. Run this script again with that token"
  exit 0
fi

FUNCTIONS_URL="${VITE_SUPABASE_URL}/functions/v1"

echo "🚀 Calling analyze_focus_areas endpoint..."
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  "${FUNCTIONS_URL}/generate-proposal" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "action": "analyze_focus_areas",
    "transcripts": ["Test transcript: We discussed improving our sales process and implementing a new CRM system."],
    "contact_name": "Test Contact",
    "company_name": "Test Company"
  }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "📊 Response Status: $HTTP_STATUS"
echo ""
echo "📋 Response Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ Test passed! Claude 4.5 Haiku is working correctly."
else
  echo "❌ Test failed with status $HTTP_STATUS"
  echo "Check the response above for details"
fi


