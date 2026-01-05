#!/bin/bash

# Script to generate initial API Monitor data
# This calls the edge function to create a snapshot

set -e

echo "📊 Generating API Monitor Data"
echo "=============================="
echo ""

# Get Supabase URL and anon key from env or config
SUPABASE_URL="${VITE_SUPABASE_URL:-https://ygdpgliavpxeugaajgrb.supabase.co}"
SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY}"

if [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "❌ VITE_SUPABASE_ANON_KEY not set"
  echo "Please set it in your .env file or export it"
  exit 1
fi

# Calculate time range (last 24 hours)
TO_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
FROM_DATE=$(date -u -v-24H +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "24 hours ago" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v-1d +"%Y-%m-%dT%H:%M:%SZ")

echo "Time range: $FROM_DATE to $TO_DATE"
echo ""

# Create snapshot
echo "📸 Creating snapshot..."
RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/api-monitor/snapshot" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"from\": \"${FROM_DATE}\",
    \"to\": \"${TO_DATE}\"
  }")

if echo "$RESPONSE" | grep -q "success"; then
  echo "✅ Snapshot created successfully"
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
else
  echo "⚠️  Snapshot creation response:"
  echo "$RESPONSE"
fi

echo ""
echo "=============================="
echo "✅ Data generation complete!"
echo ""
echo "You can now view the data at:"
echo "http://localhost:5175/platform/dev/api-monitor"
