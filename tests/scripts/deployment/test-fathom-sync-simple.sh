#!/bin/bash

# Simple Fathom Sync Test
# Tests the edge function with a single mock call

set -e

PROJECT_URL="https://ewtuefzeogytgmsnkpmb.supabase.co"

# Get service role key
if [ -f ".env" ]; then
    SERVICE_ROLE_KEY=$(grep VITE_SUPABASE_SERVICE_ROLE_KEY .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
fi

if [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "❌ Service role key not found in .env"
    exit 1
fi

# Get user ID from database
USER_ID=$(curl -s -X POST "$PROJECT_URL/rest/v1/rpc/get_current_user_id" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  | jq -r '.')

echo "=========================================="
echo "🧪 Testing Fathom Sync (Simple)"
echo "=========================================="
echo ""
echo "Project: $PROJECT_URL"
echo ""

# Create mock Fathom webhook payload
PAYLOAD='{
  "sync_type": "webhook",
  "user_id": "USER_ID_PLACEHOLDER",
  "call_id": "fathom_test_simple_001",
  "meeting_data": {
    "id": "fathom_test_simple_001",
    "title": "SIMPLE TEST: Discovery Call - TestCorp",
    "start_time": "'$(date -u -v-2H +"%Y-%m-%dT%H:%M:%SZ")'",
    "duration": 30,
    "host_email": "admin@salesdemo.com",
    "participants": [
      {
        "name": "Test Client",
        "email": "test@testcorp.com"
      },
      {
        "name": "Internal Rep",
        "email": "admin@salesdemo.com"
      }
    ],
    "summary": "Test meeting to verify Fathom sync is working",
    "action_items": [
      {
        "title": "SIMPLE TEST: Send follow-up email",
        "assignee": "admin@salesdemo.com",
        "priority": "high",
        "deadline": 2
      }
    ]
  }
}'

echo "📡 Calling Fathom Sync Edge Function..."
echo ""

# Call the edge function (bypass auth by passing user_id directly)
RESPONSE=$(curl -s -X POST "$PROJECT_URL/functions/v1/fathom-sync" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo "📊 Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if successful
if echo "$RESPONSE" | grep -q '"success":true\|"meeting_id"'; then
    echo "✅ Fathom sync test PASSED!"
    echo ""
    echo "To verify in database:"
    echo "SELECT * FROM meetings WHERE fathom_recording_id = 'fathom_test_simple_001';"
else
    echo "❌ Fathom sync test FAILED"
    echo "Check edge function logs:"
    echo "https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/logs/edge-functions"
fi

echo ""
echo "=========================================="
