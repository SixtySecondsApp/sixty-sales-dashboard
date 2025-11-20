#!/bin/bash
# Test the Edge Function with Claude 4.5 Haiku
# This uses your configured OpenRouter API key from user_settings

echo "🧪 Testing Edge Function with Claude 4.5 Haiku..."
echo ""

# Get Supabase URL and anon key from .env
if [ -f .env ]; then
  export $(grep -E '^VITE_SUPABASE_URL|^VITE_SUPABASE_ANON_KEY' .env | xargs)
fi

if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
  echo "❌ Missing Supabase environment variables"
  echo "Please ensure .env has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"
  exit 1
fi

FUNCTIONS_URL="${VITE_SUPABASE_URL}/functions/v1"

echo "📡 Edge Function URL: $FUNCTIONS_URL/generate-proposal"
echo ""
echo "📝 Note: This test requires authentication."
echo "   The Edge Function will use your OpenRouter API key from user_settings"
echo "   and will test with Claude 4.5 Haiku (hardcoded for testing)"
echo ""
echo "⚠️  To test, you need to:"
echo "   1. Be logged into the app"
echo "   2. Get your auth token from browser DevTools"
echo "   3. Or test directly in the app UI"
echo ""
echo "The Edge Function is configured to use Claude 4.5 Haiku for this test."
echo "Try generating a proposal in the app to see if it works!"


