#!/bin/bash

# Test API Key Creation with Your Token
echo "🔑 Testing API Key Creation with your session token..."
echo "=================================================="

# Your actual token from production
AUTH_TOKEN="eyJhbGciOiJIUzI1NiIsImtpZCI6IkVhTjhMd1RLM09IcU9WNVUiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2V3dHVlZnplb2d5dGdtc25rcG1iLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJhYzRlZmNhMi0xZmUxLTQ5YjMtOWQ1ZS02YWMzZDhiZjM0NTkiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzU2Mjg0NzM3LCJpYXQiOjE3NTYyODExMzcsImVtYWlsIjoiYW5kcmV3LmJyeWNlQHNpeHR5c2Vjb25kcy52aWRlbyIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWwiOiJhbmRyZXcuYnJ5Y2VAc2l4dHlzZWNvbmRzLnZpZGVvIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZ1bGxfbmFtZSI6ImFuZHJldyBCcnljZSIsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwic3ViIjoiYWM0ZWZjYTItMWZlMS00OWIzLTlkNWUtNmFjM2Q4YmYzNDU5In0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3NTYyODExMzd9XSwic2Vzc2lvbl9pZCI6IjJkMDg5YWI2LWU3OTUtNDNkMC1iOWYwLTVmZmFlNGRjZGZkNSIsImlzX2Fub255bW91cyI6ZmFsc2V9.Qz_MmYDOLllW927rUmE1AebzdhhWv-XNKlZx9cuaZs0"

# Supabase project details
SUPABASE_URL="https://ewtuefzeogytgmsnkpmb.supabase.co"

# You need to get this from your .env file - VITE_SUPABASE_ANON_KEY
echo "⚠️  Note: You need to add your ANON_KEY from .env file"
echo ""
read -p "Please enter your VITE_SUPABASE_ANON_KEY: " ANON_KEY

if [ -z "$ANON_KEY" ]; then
    echo "❌ Anon key is required!"
    exit 1
fi

echo ""
echo "📍 Testing against: $SUPABASE_URL"
echo "👤 User: andrew.bryce@sixtyseconds.video"
echo ""

# Test the API key creation
curl -X POST "${SUPABASE_URL}/functions/v1/create-api-key" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "apikey: ${ANON_KEY}" \
  -d '{
    "name": "Test API Key - '"$(date +%Y%m%d-%H%M%S)"'",
    "permissions": ["deals:read", "deals:write", "contacts:read"],
    "rate_limit": 1000
  }' \
  -w "\n\nHTTP Status: %{http_code}\n" \
  | python3 -m json.tool 2>/dev/null || cat

echo ""
echo "=================================================="
echo "✅ Test complete!"
echo ""
echo "Expected results:"
echo "- HTTP Status 201 = Success (API key created)"
echo "- HTTP Status 401 = Auth token issue"  
echo "- HTTP Status 500 = Database schema not updated"
echo ""

# Check if we got a success
if [ $? -eq 0 ]; then
    echo "💡 If you got a 500 error, run the SQL script:"
    echo "   manual-production-fix-v3.sql"
    echo ""
    echo "📋 Quick fix - run this SQL in Supabase Dashboard:"
    echo "   ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;"
fi