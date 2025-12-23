#!/bin/bash

# Test Fathom API directly to see why transcripts aren't fetching

echo "🧪 Testing Fathom API Directly"
echo "==============================="
echo ""

SUPABASE_URL=$(grep "VITE_SUPABASE_URL" .env.local | cut -d '=' -f2)
SERVICE_ROLE_KEY=$(grep "VITE_SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d '=' -f2)

# Get Fathom access token from active integration
echo "1️⃣  Getting Fathom access token..."
INTEGRATION=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/fathom_integrations?select=access_token,fathom_user_email&is_active=eq.true&limit=1" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}")

ACCESS_TOKEN=$(echo "$INTEGRATION" | jq -r '.[0].access_token')
USER_EMAIL=$(echo "$INTEGRATION" | jq -r '.[0].fathom_user_email')

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" == "null" ]; then
    echo "❌ Error: Could not get Fathom access token"
    exit 1
fi

echo "✅ Found active integration for: $USER_EMAIL"
echo "   Token: ${ACCESS_TOKEN:0:20}..."
echo ""

# Get a recent meeting without transcript
echo "2️⃣  Getting recent meeting without transcript..."
MEETING=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/meetings?select=fathom_recording_id,title&transcript_text=is.null&order=meeting_start.desc&limit=1" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}")

RECORDING_ID=$(echo "$MEETING" | jq -r '.[0].fathom_recording_id')
TITLE=$(echo "$MEETING" | jq -r '.[0].title')

echo "📋 Testing with meeting: $TITLE"
echo "   Recording ID: $RECORDING_ID"
echo ""

# Test transcript endpoint
echo "3️⃣  Testing transcript endpoint..."
echo "   URL: https://api.fathom.ai/external/v1/recordings/$RECORDING_ID/transcript"
echo ""

TRANSCRIPT_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}\n" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.fathom.ai/external/v1/recordings/$RECORDING_ID/transcript")

HTTP_STATUS=$(echo "$TRANSCRIPT_RESPONSE" | grep "HTTP_STATUS" | cut -d ':' -f2)
TRANSCRIPT_BODY=$(echo "$TRANSCRIPT_RESPONSE" | sed '/HTTP_STATUS/d')

echo "   HTTP Status: $HTTP_STATUS"
echo ""

if [ "$HTTP_STATUS" == "200" ]; then
    echo "✅ Success! Transcript available"
    echo ""
    echo "Response preview:"
    echo "$TRANSCRIPT_BODY" | jq '.' 2>/dev/null | head -30
elif [ "$HTTP_STATUS" == "404" ]; then
    echo "⚠️  404 Not Found - Transcript not yet available"
    echo "   Fathom may still be processing this recording"
    echo ""
    echo "Response:"
    echo "$TRANSCRIPT_BODY"
elif [ "$HTTP_STATUS" == "401" ] || [ "$HTTP_STATUS" == "403" ]; then
    echo "❌ Authentication Error (${HTTP_STATUS})"
    echo "   Access token may be expired or invalid"
    echo ""
    echo "Response:"
    echo "$TRANSCRIPT_BODY"
else
    echo "❌ Error: HTTP $HTTP_STATUS"
    echo ""
    echo "Response:"
    echo "$TRANSCRIPT_BODY"
fi

echo ""
echo "4️⃣  Testing summary endpoint..."
echo "   URL: https://api.fathom.ai/external/v1/recordings/$RECORDING_ID/summary"
echo ""

SUMMARY_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}\n" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.fathom.ai/external/v1/recordings/$RECORDING_ID/summary")

SUMMARY_HTTP_STATUS=$(echo "$SUMMARY_RESPONSE" | grep "HTTP_STATUS" | cut -d ':' -f2)
SUMMARY_BODY=$(echo "$SUMMARY_RESPONSE" | sed '/HTTP_STATUS/d')

echo "   HTTP Status: $SUMMARY_HTTP_STATUS"
echo ""

if [ "$SUMMARY_HTTP_STATUS" == "200" ]; then
    echo "✅ Success! Summary available"
    echo ""
    echo "Response preview:"
    echo "$SUMMARY_BODY" | jq '.' 2>/dev/null | head -20
else
    echo "❌ Error: HTTP $SUMMARY_HTTP_STATUS"
    echo ""
    echo "Response:"
    echo "$SUMMARY_BODY"
fi

echo ""
echo "📊 Summary"
echo "=========="
echo "Transcript endpoint: HTTP $HTTP_STATUS"
echo "Summary endpoint: HTTP $SUMMARY_HTTP_STATUS"
echo ""

if [ "$HTTP_STATUS" == "404" ]; then
    echo "💡 Recommendation: Recordings may still be processing in Fathom"
    echo "   Wait 5-10 minutes after recording completes, then try sync again"
elif [ "$HTTP_STATUS" == "401" ] || [ "$HTTP_STATUS" == "403" ]; then
    echo "💡 Recommendation: Reconnect Fathom integration"
    echo "   Access token may have expired"
elif [ "$HTTP_STATUS" == "200" ]; then
    echo "💡 Recommendation: Transcript is available! The sync function should work"
    echo "   Check Edge Function logs for errors during sync"
fi
