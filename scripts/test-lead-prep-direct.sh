#!/bin/bash
# Direct test of process-lead-prep edge function using curl

# Load .env file if it exists
if [ -f .env ]; then
  set -a
  source <(grep -v '^#' .env | sed -e 's/^/export /')
  set +a
fi

SUPABASE_URL="${VITE_SUPABASE_URL:-${SUPABASE_URL}}"
SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-${SUPABASE_ANON_KEY}}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "❌ Missing Supabase credentials"
  exit 1
fi

FUNCTION_URL="${SUPABASE_URL}/functions/v1/process-lead-prep"

echo "🧪 Testing process-lead-prep edge function directly..."
echo "   URL: $FUNCTION_URL"
echo ""

response=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "$FUNCTION_URL")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "HTTP Status: $http_code"
echo "Response:"
echo "$body" | jq '.' 2>/dev/null || echo "$body"

if [ "$http_code" -eq 200 ]; then
  echo ""
  echo "✅ Function executed successfully!"
  processed=$(echo "$body" | jq -r '.processed // 0' 2>/dev/null || echo "0")
  echo "   Processed: $processed lead(s)"
else
  echo ""
  echo "❌ Function returned error status: $http_code"
fi

