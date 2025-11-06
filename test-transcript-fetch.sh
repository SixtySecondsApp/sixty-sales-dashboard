#!/bin/bash
# Test transcript fetch for a specific recording

# Get environment variables
SUPABASE_URL=$(grep "VITE_SUPABASE_URL" .env.local | cut -d '=' -f2)
SERVICE_ROLE_KEY=$(grep "VITE_SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d '=' -f2)

# Get user's Fathom access token
echo "Getting Fathom access token..."
ACCESS_TOKEN=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/fathom_integrations?select=access_token&is_active=eq.true&limit=1" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq -r '.[0].access_token')

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" == "null" ]; then
  echo "❌ No active Fathom integration found"
  exit 1
fi

echo "✅ Got access token: ${ACCESS_TOKEN:0:20}..."

# Test with recording ID 99690200 (Viewpoint/SixtySeconds - 2 attempts failed)
RECORDING_ID="99690200"

echo ""
echo "Testing transcript fetch for recording: $RECORDING_ID"
echo "========================================"

curl -v "https://api.fathom.ai/external/v1/recordings/${RECORDING_ID}/transcript" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" 2>&1
