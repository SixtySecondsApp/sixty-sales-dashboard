#!/bin/bash
set -euo pipefail

cd /Users/andrewbryce/Documents/sixty-sales-dashboard

# Source .env
set -a
source .env 2>/dev/null || true
set +a

# Verify we have the vars
if [ -z "$VITE_SUPABASE_URL" ]; then
  echo "❌ VITE_SUPABASE_URL not found in .env"
  exit 1
fi

PROJECT_REF=$(echo "$VITE_SUPABASE_URL" | sed 's|https://||' | cut -d'.' -f1)
FUNCTIONS_URL="https://${PROJECT_REF}.functions.supabase.co"

echo "🚀 Testing generate-video-thumbnail Edge Function"
echo "=================================================="
echo ""
echo "📍 Functions URL: $FUNCTIONS_URL"
echo ""

# Try to fetch a recent meeting
if command -v psql >/dev/null 2>&1 && [ -n "${DATABASE_URL:-}" ]; then
  echo "🔍 Fetching recent meeting from database..."
  MEETING_DATA=$(psql "$DATABASE_URL" -t -A -F'|' -c "SELECT id, COALESCE(share_url,''), COALESCE(fathom_recording_id::text,''), GREATEST(5, COALESCE(duration_minutes,0)*60/2)::int FROM meetings WHERE (share_url IS NOT NULL OR fathom_recording_id IS NOT NULL) ORDER BY updated_at DESC LIMIT 1;" 2>/dev/null)
  
  if [ -n "$MEETING_DATA" ]; then
    MEETING_ID=$(echo "$MEETING_DATA" | cut -d'|' -f1)
    SHARE_URL=$(echo "$MEETING_DATA" | cut -d'|' -f2)
    RECORDING_ID=$(echo "$MEETING_DATA" | cut -d'|' -f3)
    TIMESTAMP=$(echo "$MEETING_DATA" | cut -d'|' -f4)
    
    echo "✅ Found meeting:"
    echo "   ID: $MEETING_ID"
    echo "   Recording ID: $RECORDING_ID"
    echo "   Share URL: ${SHARE_URL:0:50}..."
    echo "   Timestamp: ${TIMESTAMP}s"
    echo ""
  else
    echo "❌ No meetings found in database"
    exit 1
  fi
else
  echo "❌ psql not available or DATABASE_URL not set"
  exit 1
fi

# Build request body
REQUEST_BODY=$(jq -n \
  --arg rid "$RECORDING_ID" \
  --arg url "$SHARE_URL" \
  --arg mid "$MEETING_ID" \
  --argjson ts "$TIMESTAMP" \
  '{recording_id: $rid, share_url: $url, timestamp_seconds: $ts, meeting_id: $mid}')

echo "📤 Request body:"
echo "$REQUEST_BODY" | jq '.'
echo ""

echo "🔄 Calling generate-video-thumbnail... (this may take 30-60 seconds)"
echo ""

# Make the request
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "${FUNCTIONS_URL}/generate-video-thumbnail" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "$REQUEST_BODY")

# Extract status and body
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "📊 Response:"
echo "   HTTP Status: $HTTP_STATUS"
echo ""

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
  echo "✅ Thumbnail generation successful!"
  echo ""
  echo "Response body:"
  echo "$RESPONSE_BODY" | jq '.'
  echo ""
  
  # Extract thumbnail URL
  THUMBNAIL_URL=$(echo "$RESPONSE_BODY" | jq -r '.thumbnail_url // empty')
  
  if [ -n "$THUMBNAIL_URL" ]; then
    echo "=================================================="
    echo "🎉 S3 THUMBNAIL URL:"
    echo "$THUMBNAIL_URL"
    echo "=================================================="
  else
    echo "⚠️  No thumbnail_url in response"
  fi
else
  echo "❌ Thumbnail generation failed!"
  echo ""
  echo "Error response:"
  echo "$RESPONSE_BODY"
fi

echo ""

