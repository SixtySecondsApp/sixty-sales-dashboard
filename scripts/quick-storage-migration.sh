#!/bin/bash
# Quick storage migration - tries to use existing .env keys

set -e

cd "$(dirname "$0")/.."

echo "🚀 Quick Storage Migration"
echo "=========================="
echo ""

# Load from .env if it exists
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Project refs
OLD_PROJECT_REF="ewtuefzeogytgmsnkpmb"
NEW_PROJECT_REF="ygdpgliavpxeugaajgrb"

# Set URLs
export OLD_SUPABASE_URL="https://${OLD_PROJECT_REF}.supabase.co"
export NEW_SUPABASE_URL="${VITE_SUPABASE_URL:-https://${NEW_PROJECT_REF}.supabase.co}"

# Try to map existing keys
# For old project, you'll need to get the service role key manually
export OLD_SUPABASE_SERVICE_KEY="${OLD_SUPABASE_SERVICE_KEY:-}"

# For new project, use existing key
export NEW_SUPABASE_SERVICE_KEY="${NEW_SUPABASE_SERVICE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-${VITE_SUPABASE_SERVICE_ROLE_KEY}}}"

echo "Configuration:"
echo "  Old project: ${OLD_SUPABASE_URL}"
echo "  New project: ${NEW_SUPABASE_URL}"
echo ""

if [ -z "$OLD_SUPABASE_SERVICE_KEY" ]; then
  echo "⚠️  OLD project service role key not found!"
  echo ""
  echo "You need to get the service role key for the OLD project:"
  echo "  Project: ${OLD_PROJECT_REF} (Internal Sales Dashboard)"
  echo "  URL: https://supabase.com/dashboard/project/${OLD_PROJECT_REF}/settings/api"
  echo ""
  echo "Then run:"
  echo "  export OLD_SUPABASE_SERVICE_KEY='your-old-key'"
  echo "  export NEW_SUPABASE_SERVICE_KEY='${NEW_SUPABASE_SERVICE_KEY:-your-new-key}'"
  echo "  node scripts/migrate-storage.mjs"
  echo ""
  exit 1
fi

if [ -z "$NEW_SUPABASE_SERVICE_KEY" ]; then
  echo "⚠️  NEW project service role key not found!"
  echo ""
  echo "Set it via:"
  echo "  export NEW_SUPABASE_SERVICE_KEY='your-new-key'"
  echo "  # Or add SUPABASE_SERVICE_ROLE_KEY to .env"
  echo ""
  exit 1
fi

echo "✅ Keys configured, starting migration..."
echo ""

node scripts/migrate-storage.mjs
