#!/bin/bash

# Check and sync missing transcripts for recent meetings
# This script identifies meetings without transcripts and triggers a manual sync

echo "🔍 Checking for meetings without transcripts..."
echo ""

# Get Supabase credentials
SUPABASE_URL=$(grep "VITE_SUPABASE_URL" .env.local | cut -d '=' -f2)
SERVICE_ROLE_KEY=$(grep "VITE_SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d '=' -f2)

if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: Could not find Supabase credentials in .env.local"
    exit 1
fi

echo "📊 Fetching recent meetings without transcripts..."
echo ""

# Query meetings without transcripts from last 30 days
RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/get_meetings_without_transcripts" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"days_back": 30}')

# Alternative: Direct query to meetings table
MEETINGS=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/meetings?select=id,title,fathom_recording_id,meeting_start,transcript_text,transcript_fetch_attempts,last_transcript_fetch_at&transcript_text=is.null&meeting_start=gte.$(date -u -v-30d +%Y-%m-%dT%H:%M:%S.000Z)&order=meeting_start.desc&limit=20" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}")

echo "$MEETINGS" | jq -r '.[] | "📅 \(.title) - \(.meeting_start) - Recording: \(.fathom_recording_id) - Attempts: \(.transcript_fetch_attempts // 0)"'

MEETING_COUNT=$(echo "$MEETINGS" | jq 'length')
echo ""
echo "Found ${MEETING_COUNT} meetings without transcripts"
echo ""

if [ "$MEETING_COUNT" -eq 0 ]; then
    echo "✅ All recent meetings have transcripts!"
    exit 0
fi

# Ask user if they want to sync
read -p "Do you want to trigger transcript sync for these meetings? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Sync cancelled"
    exit 0
fi

echo "🔄 Starting transcript sync..."
echo ""

# Get first user's ID for sync (we'll use service role)
USER_ID=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/fathom_integrations?select=user_id&is_active=eq.true&limit=1" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq -r '.[0].user_id')

if [ -z "$USER_ID" ] || [ "$USER_ID" == "null" ]; then
    echo "❌ Error: Could not find active Fathom integration user"
    exit 1
fi

echo "Using user ID: $USER_ID"
echo ""

# Trigger fathom-sync for each meeting
echo "$MEETINGS" | jq -c '.[]' | while read -r meeting; do
    MEETING_ID=$(echo "$meeting" | jq -r '.id')
    TITLE=$(echo "$meeting" | jq -r '.title')
    RECORDING_ID=$(echo "$meeting" | jq -r '.fathom_recording_id')

    echo "🔄 Syncing: $TITLE"

    # Reset transcript fetch attempts to allow retry
    curl -s -X PATCH "${SUPABASE_URL}/rest/v1/meetings?id=eq.${MEETING_ID}" \
      -H "apikey: ${SERVICE_ROLE_KEY}" \
      -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=minimal" \
      -d "{\"transcript_fetch_attempts\": 0, \"last_transcript_fetch_at\": null}" > /dev/null

    # Trigger sync
    SYNC_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/fathom-sync" \
      -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
      -H "Content-Type: application/json" \
      -d "{
        \"sync_type\": \"incremental\",
        \"user_id\": \"${USER_ID}\",
        \"force_transcript_fetch\": true
      }")

    # Check if sync was successful
    if echo "$SYNC_RESPONSE" | jq -e '.meetings_synced' > /dev/null 2>&1; then
        SYNCED=$(echo "$SYNC_RESPONSE" | jq -r '.meetings_synced')
        echo "   ✅ Synced ${SYNCED} meeting(s)"
    else
        echo "   ⚠️  Sync response: $(echo "$SYNC_RESPONSE" | jq -r '.message // .error // "Unknown status"')"
    fi

    # Wait 2 seconds between syncs to avoid rate limiting
    sleep 2
done

echo ""
echo "✅ Transcript sync completed!"
echo ""
echo "🔍 Checking results..."
sleep 5

# Check how many now have transcripts
UPDATED_MEETINGS=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/meetings?select=id,title,transcript_text&id=in.($(echo "$MEETINGS" | jq -r '.[].id' | tr '\n' ',' | sed 's/,$//'))" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}")

WITH_TRANSCRIPTS=$(echo "$UPDATED_MEETINGS" | jq '[.[] | select(.transcript_text != null)] | length')
echo "📊 ${WITH_TRANSCRIPTS} out of ${MEETING_COUNT} now have transcripts"
