#!/bin/bash
set -euo pipefail

cd /Users/andrewbryce/Documents/sixty-sales-dashboard

# Source .env
set -a
source .env 2>/dev/null || true
set +a

echo "🎬 Testing Thumbnail Generation with REAL Meeting"
echo "=================================================="
echo ""
echo "✅ Using REAL meeting from database:"
echo "   Meeting ID: 41537c13-f88a-4537-9dbd-9e657af53e66"
echo "   Title: Challenger Lighting - Catch Up"
echo ""

# Real meeting data from user's database
MEETING_ID="41537c13-f88a-4537-9dbd-9e657af53e66"
RECORDING_ID="95852639"
SHARE_URL="https://fathom.video/share/C2stxF1L9toaJSFmsy6WfrYpu1ayzJNJ"
FATHOM_EMBED_URL="https://app.fathom.video/recording/95852639"
TIMESTAMP=30

PROJECT_REF=$(echo "$VITE_SUPABASE_URL" | sed 's|https://||' | cut -d'.' -f1)
FUNCTIONS_URL="https://${PROJECT_REF}.functions.supabase.co"

REQUEST_BODY=$(cat <<EOF
{
  "recording_id": "$RECORDING_ID",
  "share_url": "$SHARE_URL",
  "fathom_embed_url": "$FATHOM_EMBED_URL",
  "timestamp_seconds": $TIMESTAMP,
  "meeting_id": "$MEETING_ID"
}
EOF
)

echo "📤 Request Payload:"
echo "$REQUEST_BODY" | jq '.'
echo ""

echo "🔄 Generating thumbnail (this may take 15-20 seconds)..."
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "${FUNCTIONS_URL}/generate-video-thumbnail" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "$REQUEST_BODY")

# Extract status and body
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "📊 Response Status: $HTTP_STATUS"
echo ""

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
  echo "✅ SUCCESS! Thumbnail generated!"
  echo ""
  echo "Response:"
  echo "$RESPONSE_BODY" | jq '.'
  echo ""

  THUMBNAIL_URL=$(echo "$RESPONSE_BODY" | jq -r '.thumbnail_url // empty')

  if [ -n "$THUMBNAIL_URL" ]; then
    echo "=================================================="
    echo "🎉 S3 THUMBNAIL URL:"
    echo "$THUMBNAIL_URL"
    echo "=================================================="
    echo ""
    echo "✅ Open this URL in your browser to verify!"
    echo ""
    echo "Expected: Full-screen video at 30 seconds"
    echo "   - Video player visible"
    echo "   - No Fathom UI tabs/summary"
    echo "   - Just the video content"
  fi
else
  echo "❌ FAILED! Thumbnail generation failed"
  echo ""
  echo "Error Response:"
  echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"
  echo ""
  echo "🔍 Check Supabase Dashboard function logs for details"
fi

echo ""
echo "📝 App URL for manual testing:"
echo "https://sales.sixtyseconds.video/meetings/thumbnail/${MEETING_ID}?shareUrl=$(echo $SHARE_URL | jq -sRr @uri)&t=${TIMESTAMP}"
echo ""
echo "🔍 Check logs at: Supabase Dashboard → Edge Functions → generate-video-thumbnail → Logs"
echo ""
