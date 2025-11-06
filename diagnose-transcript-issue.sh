#!/bin/bash

# Diagnose why transcripts aren't being fetched

echo "🔍 Diagnosing Fathom Transcript Issue"
echo "======================================"
echo ""

# Get Supabase credentials
SUPABASE_URL=$(grep "VITE_SUPABASE_URL" .env.local | cut -d '=' -f2)
SERVICE_ROLE_KEY=$(grep "VITE_SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d '=' -f2)

if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: Could not find Supabase credentials in .env.local"
    exit 1
fi

echo "1️⃣  Checking recent meetings..."
echo ""

# Get recent meetings
MEETINGS=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/meetings?select=id,title,fathom_recording_id,meeting_start,transcript_text,transcript_fetch_attempts,last_transcript_fetch_at,summary&order=meeting_start.desc&limit=10" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}")

echo "📊 Last 10 meetings:"
echo ""
echo "$MEETINGS" | jq -r '.[] | "📅 \(.meeting_start | split("T")[0]) - \(.title)\n   📝 Has Transcript: \(if .transcript_text then "✅ YES" else "❌ NO" end)\n   🔄 Fetch Attempts: \(.transcript_fetch_attempts // 0)\n   ⏰ Last Attempt: \(.last_transcript_fetch_at // "Never")\n   📋 Has Summary: \(if .summary then "✅ YES (\(.summary | length) chars)" else "❌ NO" end)\n"'

echo ""
echo "2️⃣  Analyzing transcript fetch status..."
echo ""

# Count meetings without transcripts
MISSING_COUNT=$(echo "$MEETINGS" | jq '[.[] | select(.transcript_text == null)] | length')
echo "⚠️  Meetings without transcripts: ${MISSING_COUNT}/10"

# Check for meetings hitting attempt limit
MAX_ATTEMPTS=$(echo "$MEETINGS" | jq '[.[] | select(.transcript_fetch_attempts >= 3)] | length')
if [ "$MAX_ATTEMPTS" -gt 0 ]; then
    echo "🚫 Meetings that hit max attempts (3): ${MAX_ATTEMPTS}"
    echo "$MEETINGS" | jq -r '.[] | select(.transcript_fetch_attempts >= 3) | "   - \(.title) (Recording: \(.fathom_recording_id))"'
fi

# Check for meetings in cooldown
NOW=$(date -u +%s)
IN_COOLDOWN=$(echo "$MEETINGS" | jq --arg now "$NOW" '[.[] | select(.last_transcript_fetch_at != null) | select((($now | tonumber) - (.last_transcript_fetch_at | fromdateiso8601)) < 300)] | length')
if [ "$IN_COOLDOWN" -gt 0 ]; then
    echo "⏳ Meetings in cooldown period (<5 min): ${IN_COOLDOWN}"
fi

echo ""
echo "3️⃣  Checking Fathom integration..."
echo ""

# Check active integrations
INTEGRATIONS=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/fathom_integrations?select=user_id,fathom_user_email,is_active,created_at&is_active=eq.true" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}")

INT_COUNT=$(echo "$INTEGRATIONS" | jq 'length')
echo "✅ Active Fathom integrations: ${INT_COUNT}"
echo "$INTEGRATIONS" | jq -r '.[] | "   - \(.fathom_user_email) (Connected: \(.created_at | split("T")[0]))"'

echo ""
echo "4️⃣  Recent activities with meeting summaries..."
echo ""

# Check recent activities to see if summaries are too long
ACTIVITIES=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/activities?select=id,client_name,details,meeting_id&type=eq.meeting&order=created_at.desc&limit=5" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}")

echo "$ACTIVITIES" | jq -r '.[] | "🎯 \(.client_name)\n   Details length: \(.details | length) characters\n   Preview: \(.details[0:100])...\n"'

echo ""
echo "5️⃣  Recommendations:"
echo ""

if [ "$MISSING_COUNT" -gt 0 ]; then
    echo "📋 Action items:"
    echo "   1. Run ./check-and-sync-transcripts.sh to retry transcript fetching"
    echo "   2. Check Fathom API credentials and permissions"
    echo "   3. Verify recordings have completed processing in Fathom"
fi

if [ "$MAX_ATTEMPTS" -gt 0 ]; then
    echo "   4. Some meetings hit max retry attempts - they need manual reset"
    echo "      Reset attempts with: UPDATE meetings SET transcript_fetch_attempts = 0 WHERE transcript_fetch_attempts >= 3"
fi

echo ""
echo "✅ Diagnosis complete!"
