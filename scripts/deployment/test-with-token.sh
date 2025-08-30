#!/bin/bash

# Direct API Key Creation Test
# Replace these values with your actual credentials

SUPABASE_URL="https://ewtuefzeogytgmsnkpmb.supabase.co"  # From your .env
ANON_KEY="YOUR_ANON_KEY"  # From your .env VITE_SUPABASE_ANON_KEY
AUTH_TOKEN="YOUR_TOKEN_HERE"  # The token you extracted

echo "Testing API Key Creation..."
echo "================================"

curl -X POST "${SUPABASE_URL}/functions/v1/create-api-key" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "apikey: ${ANON_KEY}" \
  -d '{
    "name": "Test Key from Script",
    "permissions": ["deals:read", "deals:write"],
    "rate_limit": 1000
  }' | python3 -m json.tool

echo ""
echo "================================"
echo "Test complete!"