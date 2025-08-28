#!/bin/bash

# Test all API endpoints with your API key
# This uses the API key we created earlier

API_KEY="sk_f3e0066b9f7b47a99c766a5c04dc7e25"
SUPABASE_URL="https://ewtuefzeogytgmsnkpmb.supabase.co"

echo "🧪 Testing API Endpoints with API Key"
echo "====================================="
echo ""

# Test contacts endpoint first
echo "Testing contacts endpoint..."
curl -X GET "${SUPABASE_URL}/functions/v1/api-v1-contacts" \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo "====================================="
echo "Note: If you get 500 errors, run fix-api-validation.sql first"
