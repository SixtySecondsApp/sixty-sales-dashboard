#!/bin/bash
set -euo pipefail

cd /Users/andrewbryce/Documents/sixty-sales-dashboard

# Source .env
set -a
source .env 2>/dev/null || true
set +a

echo "🚀 Testing Thumbnail Generation Deployment"
echo "==========================================="
echo ""

# Test 1: Verify deployment
echo "📋 Test 1: Verify Edge Function Deployment"
echo "-------------------------------------------"
PROJECT_REF=$(echo "$VITE_SUPABASE_URL" | sed 's|https://||' | cut -d'.' -f1)
FUNCTIONS_URL="https://${PROJECT_REF}.functions.supabase.co"
echo "✅ Functions URL: $FUNCTIONS_URL"
echo ""

# Test 2: Check environment variables
echo "📋 Test 2: Check Supabase Secrets"
echo "-------------------------------------------"
echo "Checking critical secrets..."
supabase secrets list | grep -E "(BROWSERLESS|AWS_)" || echo "Some secrets missing"
echo ""

# Test 3: Test with real Fathom URL
echo "📋 Test 3: Generate Thumbnail (this will take 15-20 seconds)"
echo "-------------------------------------------"
echo "Using sample Fathom video: https://share.fathom.video/kzXlgUdF"
echo ""

MEETING_ID="test-deployment-$(date +%s)"
RECORDING_ID="sample-recording"
SHARE_URL="https://share.fathom.video/kzXlgUdF"

REQUEST_BODY=$(cat <<EOF
{
  "recording_id": "$RECORDING_ID",
  "share_url": "$SHARE_URL",
  "fathom_embed_url": "https://fathom.video/embed/kzXlgUdF",
  "timestamp_seconds": 30,
  "meeting_id": "$MEETING_ID"
}
EOF
)

echo "📤 Request:"
echo "$REQUEST_BODY" | jq '.'
echo ""

echo "🔄 Calling generate-video-thumbnail..."
echo "(This may take 15-20 seconds due to improved timing...)"
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
    echo "✅ Open this URL in your browser to see the thumbnail!"
  fi
else
  echo "❌ FAILED! Thumbnail generation failed"
  echo ""
  echo "Error Response:"
  echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"
  echo ""
  echo "🔍 Troubleshooting:"
  echo "1. Check function logs in Supabase Dashboard"
  echo "2. Verify BROWSERLESS secrets are set"
  echo "3. Ensure AWS S3 credentials are valid"
  echo "4. Check if Microlink API is accessible"
fi

echo ""
echo "📝 Next Steps:"
echo "1. Check the S3 URL in your browser"
echo "2. Verify the screenshot shows the video at ~30 seconds"
echo "3. Check Supabase Dashboard for function logs"
echo ""
