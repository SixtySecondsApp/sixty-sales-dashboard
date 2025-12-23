#!/bin/bash

# Manual Webhook Test Script
# This sends a test payload to your webhook to see the actual error

# REPLACE THIS WITH YOUR ACTUAL SUPABASE URL
SUPABASE_URL="https://ewtuefzeogytgmsnkpmb.supabase.co"

# Test payload (minimal valid structure)
PAYLOAD='{
  "recording_id": "test-123",
  "recorded_by": {
    "email": "test@example.com"
  },
  "recording": {
    "recording_share_url": "https://fathom.video/share/test-123",
    "recording_url": "https://fathom.video/calls/12345"
  },
  "meeting": {
    "title": "Test Meeting",
    "scheduled_start_time": "2025-12-02T10:00:00Z"
  }
}'

echo "Testing webhook endpoint..."
echo "URL: ${SUPABASE_URL}/functions/v1/fathom-webhook"
echo ""
echo "Response:"
curl -X POST "${SUPABASE_URL}/functions/v1/fathom-webhook" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  -w "\n\nHTTP Status: %{http_code}\n" \
  2>&1 | tee webhook-test-result.txt

echo ""
echo "Full response saved to: webhook-test-result.txt"
