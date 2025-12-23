#!/bin/bash
set -euo pipefail

cd /Users/andrewbryce/Documents/sixty-sales-dashboard

# Source .env
set -a
source .env 2>/dev/null || true
set +a

echo "🎬 Testing Thumbnail Generation with REAL Meeting Data"
echo "======================================================="
echo ""
echo "⚠️  IMPORTANT: Update these values with real data from your database!"
echo ""
echo "Run this SQL in Supabase Dashboard first:"
echo "  SELECT id, title, share_url, fathom_embed_url, fathom_recording_id"
echo "  FROM meetings"
echo "  WHERE share_url IS NOT NULL OR fathom_embed_url IS NOT NULL"
echo "  ORDER BY created_at DESC LIMIT 5;"
echo ""
echo "Then update the variables below with a real meeting's data:"
echo ""

# ============================================================================
# 🔧 UPDATE THESE VALUES WITH REAL DATA FROM YOUR DATABASE
# ============================================================================
MEETING_ID="REPLACE_WITH_REAL_MEETING_ID"           # e.g., "abc-123-def"
RECORDING_ID="REPLACE_WITH_REAL_RECORDING_ID"       # e.g., "fathom-rec-456"
SHARE_URL="REPLACE_WITH_REAL_SHARE_URL"             # e.g., "https://share.fathom.video/abc123"
FATHOM_EMBED_URL="REPLACE_WITH_REAL_EMBED_URL"      # e.g., "https://fathom.video/embed/abc123"
TIMESTAMP=30                                         # Timestamp in seconds
# ============================================================================

if [[ "$MEETING_ID" == "REPLACE_WITH_REAL_MEETING_ID" ]]; then
  echo "❌ ERROR: You must update the variables in this script first!"
  echo ""
  echo "Steps:"
  echo "1. Open Supabase Dashboard SQL Editor"
  echo "2. Run: SELECT id, share_url, fathom_embed_url, recording_id FROM meetings WHERE share_url IS NOT NULL LIMIT 5;"
  echo "3. Copy one meeting's data into this script (lines 25-28)"
  echo "4. Run this script again"
  echo ""
  exit 1
fi

echo "📋 Using Meeting Data:"
echo "-------------------------------------------"
echo "Meeting ID:       $MEETING_ID"
echo "Recording ID:     $RECORDING_ID"
echo "Share URL:        $SHARE_URL"
echo "Fathom Embed URL: $FATHOM_EMBED_URL"
echo "Timestamp:        ${TIMESTAMP}s"
echo ""

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
    echo "✅ Open this URL in your browser to verify the screenshot!"
    echo ""
    echo "Expected: Should show the actual video content at ${TIMESTAMP} seconds"
    echo "NOT: Fathom login screen or marketing page"
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
echo "📝 Troubleshooting:"
echo "1. Verify the meeting data is correct (run SQL query)"
echo "2. Check that the share_url or fathom_embed_url is publicly accessible"
echo "3. Test the App URL manually:"
echo "   https://sales.sixtyseconds.video/meetings/thumbnail/${MEETING_ID}?shareUrl=${FATHOM_EMBED_URL}&recordingId=${RECORDING_ID}&t=${TIMESTAMP}"
echo "4. Check Supabase function logs"
echo ""
