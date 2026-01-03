#!/bin/bash
# Helper script to run storage migration with proper environment setup

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "🚀 Storage Migration Setup"
echo "=========================="
echo ""

# Default project refs (from Supabase project list)
OLD_PROJECT_REF="ewtuefzeogytgmsnkpmb"
NEW_PROJECT_REF="ygdpgliavpxeugaajgrb"

OLD_SUPABASE_URL="https://${OLD_PROJECT_REF}.supabase.co"
NEW_SUPABASE_URL="https://${NEW_PROJECT_REF}.supabase.co"

echo "Projects identified:"
echo "  Old: ${OLD_PROJECT_REF} (Internal Sales Dashboard)"
echo "  New: ${NEW_PROJECT_REF} (USE60_External)"
echo ""

# Check for existing .env file
if [ -f .env ]; then
  echo "📋 Found .env file, checking for existing keys..."
  
  # Try to source relevant vars (safely)
  if grep -q "OLD_SUPABASE_SERVICE_KEY" .env 2>/dev/null; then
    export $(grep "^OLD_SUPABASE_SERVICE_KEY=" .env | head -1)
  fi
  
  if grep -q "SUPABASE_SERVICE_ROLE_KEY" .env 2>/dev/null; then
    export $(grep "^SUPABASE_SERVICE_ROLE_KEY=" .env | head -1)
    # Also set as NEW_SUPABASE_SERVICE_KEY if not already set
    if [ -z "$NEW_SUPABASE_SERVICE_KEY" ]; then
      export NEW_SUPABASE_SERVICE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
    fi
  fi
  
  if grep -q "VITE_SUPABASE_URL" .env 2>/dev/null; then
    export $(grep "^VITE_SUPABASE_URL=" .env | head -1)
  fi
fi

# Set defaults if not already set
export OLD_SUPABASE_URL="${OLD_SUPABASE_URL:-https://ewtuefzeogytgmsnkpmb.supabase.co}"
export NEW_SUPABASE_URL="${NEW_SUPABASE_URL:-${VITE_SUPABASE_URL:-https://ygdpgliavpxeugaajgrb.supabase.co}}"

# Check if we have the required keys
if [ -z "$OLD_SUPABASE_SERVICE_KEY" ] || [ -z "$NEW_SUPABASE_SERVICE_KEY" ]; then
  echo "⚠️  Missing service role keys!"
  echo ""
  echo "To run the migration, you need:"
  echo "  1. Old project service role key (from ${OLD_PROJECT_REF})"
  echo "  2. New project service role key (from ${NEW_PROJECT_REF})"
  echo ""
  echo "You can get these from:"
  echo "  - Supabase Dashboard → Project Settings → API → service_role key"
  echo ""
  echo "Set them in one of these ways:"
  echo ""
  echo "Option 1: Export before running:"
  echo "  export OLD_SUPABASE_SERVICE_KEY='your-old-key'"
  echo "  export NEW_SUPABASE_SERVICE_KEY='your-new-key'"
  echo "  node scripts/migrate-storage.mjs"
  echo ""
  echo "Option 2: Add to .env.local:"
  echo "  OLD_SUPABASE_SERVICE_KEY=your-old-key"
  echo "  NEW_SUPABASE_SERVICE_KEY=your-new-key"
  echo ""
  echo "Option 3: Run interactively (will prompt for keys):"
  echo "  read -sp 'Old project service key: ' OLD_KEY && export OLD_SUPABASE_SERVICE_KEY=\"\$OLD_KEY\""
  echo "  read -sp 'New project service key: ' NEW_KEY && export NEW_SUPABASE_SERVICE_KEY=\"\$NEW_KEY\""
  echo "  node scripts/migrate-storage.mjs"
  echo ""
  
  # Offer to prompt interactively
  read -p "Would you like to enter the keys now? (y/N) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -sp "Old project (${OLD_PROJECT_REF}) service role key: " OLD_KEY
    echo ""
    export OLD_SUPABASE_SERVICE_KEY="$OLD_KEY"
    
    read -sp "New project (${NEW_PROJECT_REF}) service role key: " NEW_KEY
    echo ""
    export NEW_SUPABASE_SERVICE_KEY="$NEW_KEY"
  else
    echo "Exiting. Please set the keys and run again."
    exit 1
  fi
fi

echo ""
echo "✅ Environment configured"
echo "   Old: ${OLD_SUPABASE_URL}"
echo "   New: ${NEW_SUPABASE_URL}"
echo ""
echo "Starting migration..."
echo ""

# Run the migration
node scripts/migrate-storage.mjs
