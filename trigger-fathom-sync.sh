#!/bin/bash
# Manual Fathom Sync Trigger Script
# This will sync meetings from the last 30 days

# Get your Supabase project details from .env
source .env 2>/dev/null || true

# Check if SUPABASE_URL and SUPABASE_ANON_KEY are set
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
  echo "❌ Error: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set"
  echo "Please check your .env file"
  exit 1
fi

echo "🔄 Triggering manual Fathom sync..."
echo "📅 This will sync meetings from the last 30 days"
echo ""

# Trigger the sync
curl -X POST "${VITE_SUPABASE_URL}/functions/v1/fathom-sync" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "sync_type": "manual"
  }' | jq '.'

echo ""
echo "✅ Sync request sent!"
echo "📊 Check your Meetings page to see new meetings appear"
echo "🔔 Toast notifications will appear when tasks are auto-created"
