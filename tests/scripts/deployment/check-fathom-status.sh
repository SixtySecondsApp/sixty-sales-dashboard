#!/bin/bash
# Check Fathom Integration Status
# This script diagnoses why meetings aren't syncing

source .env 2>/dev/null || true

if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
  echo "❌ Error: Environment variables not set"
  exit 1
fi

echo "🔍 Checking Fathom Integration Status..."
echo ""

# 1. Check if Fathom integration exists
echo "1️⃣ Checking for active Fathom integrations..."
curl -s "${VITE_SUPABASE_URL}/rest/v1/fathom_integrations?select=id,user_id,connected,token_expires_at,created_at&order=created_at.desc&limit=5" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'

echo ""
echo "2️⃣ Checking existing meetings count..."
curl -s "${VITE_SUPABASE_URL}/rest/v1/meetings?select=count" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -H "Prefer: count=exact" | jq '.'

echo ""
echo "3️⃣ Checking recent sync logs..."
curl -s "${VITE_SUPABASE_URL}/rest/v1/cron_job_logs?select=*&order=created_at.desc&limit=5" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'

echo ""
echo "4️⃣ Checking for any meetings in database..."
curl -s "${VITE_SUPABASE_URL}/rest/v1/meetings?select=id,title,created_at,external_id&order=created_at.desc&limit=3" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.'

echo ""
echo "✅ Diagnosis complete!"
echo ""
echo "📋 Next steps based on results:"
echo "   - If no integrations found → Need to connect Fathom OAuth"
echo "   - If token_expires_at is past → Need to refresh OAuth token"
echo "   - If logs show errors → Check error messages"
echo "   - If no meetings → Check Fathom API connection"
