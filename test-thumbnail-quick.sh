#!/bin/bash
set -euo pipefail

cd /Users/andrewbryce/Documents/sixty-sales-dashboard

# Source .env
set -a
source .env 2>/dev/null || true
set +a

PROJECT_REF=$(echo "$VITE_SUPABASE_URL" | sed 's|https://||' | cut -d'.' -f1)
FUNCTIONS_URL="https://${PROJECT_REF}.functions.supabase.co"

echo "🚀 Testing Thumbnail Generation"
echo "================================"
echo ""
echo "Functions URL: $FUNCTIONS_URL"
echo ""

# Use a sample recording (you'll need to replace these with real values from your database)
MEETING_ID="test-meeting-123"
RECORDING_ID="test-recording-123"
SHARE_URL="https://fathom.video/share/abc123xyz"
TIMESTAMP=30

# Build request body
REQUEST_BODY=$(cat <<EOF
{
  "recording_id": "$RECORDING_ID",
  "share_url": "$SHARE_URL",
  "fathom_embed_url": "https://fathom.video/embed/abc123xyz",
  "timestamp_seconds": $TIMESTAMP,
  "meeting_id": "$MEETING_ID"
}
EOF
)

echo "📤 Request body:"
echo "$REQUEST_BODY" | jq '.'
echo ""

echo "🔄 Calling generate-video-thumbnail..."
echo "(This may take 30-60 seconds)"
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
