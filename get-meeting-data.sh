#!/bin/bash
set -euo pipefail

cd /Users/andrewbryce/Documents/sixty-sales-dashboard

# Source .env
set -a
source .env 2>/dev/null || true
set +a

PROJECT_REF=$(echo "$VITE_SUPABASE_URL" | sed 's|https://||' | cut -d'.' -f1)
FUNCTIONS_URL="https://${PROJECT_REF}.functions.supabase.co"

echo "🔍 Fetching recent meeting data..."
echo ""

# Use Supabase REST API to get meetings
curl -s -X POST "${VITE_SUPABASE_URL}/rest/v1/rpc/get_recent_meetings" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" 2>/dev/null || {

  # If RPC doesn't exist, try direct query
  echo "Trying direct query..."
  curl -s "${VITE_SUPABASE_URL}/rest/v1/meetings?select=id,title,recording_id,share_url,duration_minutes&recording_id=not.is.null&share_url=not.is.null&order=created_at.desc&limit=3" \
    -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}"
}
