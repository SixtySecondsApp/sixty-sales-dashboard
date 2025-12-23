#!/bin/bash
# Test Fathom Sync with Verbose Output

source .env 2>/dev/null || true

if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
  echo "❌ Error: Environment variables not set"
  exit 1
fi

echo "🔄 Testing Fathom Sync (Manual - Last 30 Days)..."
echo "📍 Endpoint: ${VITE_SUPABASE_URL}/functions/v1/fathom-sync"
echo ""

# Get current user to check if we need service role key
echo "1️⃣ Checking current user session..."
curl -s "${VITE_SUPABASE_URL}/auth/v1/user" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.id, .email' || echo "No session found"

echo ""
echo "2️⃣ Triggering sync with full error output..."
RESPONSE=$(curl -s -w "\n%{http_code}" "${VITE_SUPABASE_URL}/functions/v1/fathom-sync" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "sync_type": "manual"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo ""
echo "📊 Response Status: $HTTP_CODE"
echo "📄 Response Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"

echo ""
echo "3️⃣ Checking for new meetings after sync..."
curl -s "${VITE_SUPABASE_URL}/rest/v1/meetings?select=count" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -H "Prefer: count=exact" | jq '.'

echo ""
echo "4️⃣ Checking Fathom integration status..."
curl -s "${VITE_SUPABASE_URL}/rest/v1/fathom_integrations?select=id,is_active,last_sync_at,token_expires_at" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'

echo ""
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Sync request completed (check body for details)"
else
  echo "❌ Sync failed with status $HTTP_CODE"
  echo ""
  echo "Common issues:"
  echo "  401 - No authentication / invalid token"
  echo "  403 - No Fathom integration found for user"
  echo "  500 - Server error (check Edge Function logs)"
fi
