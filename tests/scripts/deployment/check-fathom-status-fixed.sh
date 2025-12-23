#!/bin/bash
# Check Fathom Integration Status (Fixed Column Names)

source .env 2>/dev/null || true

if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
  echo "❌ Error: Environment variables not set"
  exit 1
fi

echo "🔍 Checking Fathom Integration Status..."
echo ""

# 1. Check if Fathom integration exists
echo "1️⃣ Checking for active Fathom integrations..."
curl -s "${VITE_SUPABASE_URL}/rest/v1/fathom_integrations?select=id,user_id,is_active,token_expires_at,last_sync_at,created_at&order=created_at.desc&limit=5" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'

echo ""
echo "2️⃣ Checking existing meetings count..."
curl -s "${VITE_SUPABASE_URL}/rest/v1/meetings?select=count" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -H "Prefer: count=exact" | jq '.'

echo ""
echo "3️⃣ Checking for any meetings in database..."
curl -s "${VITE_SUPABASE_URL}/rest/v1/meetings?select=id,title,fathom_recording_id,meeting_start,created_at&order=created_at.desc&limit=3" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'

echo ""
echo "4️⃣ Checking for tasks linked to meetings..."
curl -s "${VITE_SUPABASE_URL}/rest/v1/tasks?select=id,title,meeting_id&meeting_id=not.is.null&order=created_at.desc&limit=5" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'

echo ""
echo "5️⃣ Checking sync logs..."
curl -s "${VITE_SUPABASE_URL}/rest/v1/cron_job_logs?select=*&order=created_at.desc&limit=5" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'

echo ""
echo "✅ Diagnosis complete!"
echo ""
echo "📋 Analysis:"
echo "   - Meetings in DB: Check item 2"
echo "   - Active integrations: Check item 1"
echo "   - Recent sync status: Check item 5"
echo ""
echo "🔧 Troubleshooting:"
echo "   - If 0 integrations → Run: npm run dev and connect Fathom via UI"
echo "   - If token expired → Reconnect Fathom OAuth"
echo "   - If 0 meetings but integration exists → Trigger manual sync"
echo "   - If meetings exist → Success! Check task counts"
