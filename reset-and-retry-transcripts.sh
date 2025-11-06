#!/bin/bash

# Reset transcript fetch cooldowns and retry

echo "🔄 Reset Transcript Fetch Cooldowns and Retry"
echo "=============================================="
echo ""

SUPABASE_URL=$(grep "VITE_SUPABASE_URL" .env.local | cut -d '=' -f2)
SERVICE_ROLE_KEY=$(grep "VITE_SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d '=' -f2)

if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: Could not find Supabase credentials in .env.local"
    exit 1
fi

echo "1️⃣  Finding meetings without transcripts..."
MEETINGS=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/meetings?select=id,title,transcript_fetch_attempts,last_transcript_fetch_at&transcript_text=is.null&order=meeting_start.desc&limit=10" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}")

COUNT=$(echo "$MEETINGS" | jq 'length')
echo "   Found ${COUNT} meetings without transcripts"
echo ""

if [ "$COUNT" -eq 0 ]; then
    echo "✅ All meetings have transcripts!"
    exit 0
fi

echo "Meetings to reset:"
echo "$MEETINGS" | jq -r '.[] | "   📅 \(.title)\n      Attempts: \(.transcript_fetch_attempts // 0) | Last: \(.last_transcript_fetch_at // "Never")"'
echo ""

echo "ℹ️  This will:"
echo "   - Reset transcript_fetch_attempts to 0"
echo "   - Clear last_transcript_fetch_at (removes cooldown)"
echo "   - Trigger a new sync to retry transcript fetching"
echo ""

read -p "Continue? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 0
fi

echo ""
echo "2️⃣  Resetting cooldowns..."

# Reset all meetings without transcripts
RESET_RESULT=$(curl -s -X PATCH "${SUPABASE_URL}/rest/v1/meetings?transcript_text=is.null" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"transcript_fetch_attempts": 0, "last_transcript_fetch_at": null}')

echo "   ✅ Reset ${COUNT} meeting(s)"
echo ""

echo "3️⃣  Waiting 2 seconds before triggering sync..."
sleep 2
echo ""

echo "4️⃣  Triggering fathom-sync..."

# Get user ID
USER_ID=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/fathom_integrations?select=user_id&is_active=eq.true&limit=1" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq -r '.[0].user_id')

if [ -z "$USER_ID" ] || [ "$USER_ID" == "null" ]; then
    echo "❌ Error: Could not find active Fathom integration user"
    exit 1
fi

# Trigger sync
SYNC_RESULT=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/fathom-sync" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"sync_type\": \"incremental\",
    \"user_id\": \"${USER_ID}\"
  }")

SYNCED=$(echo "$SYNC_RESULT" | jq -r '.meetings_synced // 0')
echo "   ✅ Synced ${SYNCED} meeting(s)"
echo ""

# Check result
ERRORS=$(echo "$SYNC_RESULT" | jq -r '.errors // [] | length')
if [ "$ERRORS" -gt 0 ]; then
    echo "   ⚠️  Errors occurred:"
    echo "$SYNC_RESULT" | jq -r '.errors[] | "      - \(.)"'
    echo ""
fi

echo "5️⃣  Waiting for transcripts to be fetched..."
sleep 10
echo ""

echo "6️⃣  Checking results..."
FINAL_STATUS=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/meetings?select=id,title,transcript_text&transcript_text=is.null&order=meeting_start.desc&limit=10" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}")

FINAL_COUNT=$(echo "$FINAL_STATUS" | jq 'length')

echo ""
echo "📊 Results:"
echo "   Before: ${COUNT} meetings without transcripts"
echo "   After:  ${FINAL_COUNT} meetings without transcripts"

if [ "$FINAL_COUNT" -lt "$COUNT" ]; then
    FIXED=$((COUNT - FINAL_COUNT))
    echo ""
    echo "✅ Successfully fetched ${FIXED} transcript(s)!"
elif [ "$FINAL_COUNT" -eq "$COUNT" ]; then
    echo ""
    echo "⚠️  No transcripts were fetched. Possible causes:"
    echo "   1. Recordings are still processing in Fathom (wait 5-10 mins)"
    echo "   2. Edge function error (check Supabase logs)"
    echo "   3. API authentication issue"
    echo ""
    echo "💡 Try running: ./test-fathom-api.sh to verify API access"
fi
