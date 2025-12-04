#!/bin/bash
set -e

echo "🔄 Syncing Production Data to Development-v2"
echo "=============================================="
echo ""

# Passwords
PROD_PASSWORD="SzPNQeGOhxM09pdX"
DEV_PASSWORD="gbWfdhlBSgtoXnoHeDMXfssiLDhFIQWh"

# Connection strings
PROD_REF="ewtuefzeogytgmsnkpmb"
DEV_REF="jczngsvpywgrlgdwzjbr"

# Use production pooler for export
PROD_DB="postgresql://postgres.${PROD_REF}:${PROD_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"

echo "📦 Step 1: Exporting production data..."
echo "  This will export all data including auth.users"
echo ""

# Export with custom format for better control
pg_dump "$PROD_DB" \
  --file=production_data.dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --verbose \
  2>&1 | grep -E "(dumping|completed)"

if [ $? -eq 0 ]; then
  SIZE=$(du -h production_data.dump | cut -f1)
  echo ""
  echo "✅ Export complete: $SIZE"
else
  echo "❌ Export failed"
  exit 1
fi

echo ""
echo "📥 Step 2: Restoring to development-v2..."
echo "  Using Supabase CLI to get correct connection..."
echo ""

# Get development-v2 connection via CLI
BRANCH_ID="17b178b9-bb9b-4ccd-a125-5e49398bb989"
DEV_DB_URL=$(supabase branches get $BRANCH_ID --project-ref $PROD_REF --output json --experimental 2>/dev/null | \
  jq -r '.database_host' | \
  sed "s|^|postgresql://postgres:${DEV_PASSWORD}@|" | \
  sed "s|$|:5432/postgres|")

if [ -z "$DEV_DB_URL" ] || [ "$DEV_DB_URL" == "postgresql://postgres:${DEV_PASSWORD}@:5432/postgres" ]; then
  echo "⚠️  Could not get branch connection from CLI, using direct format..."
  DEV_DB_URL="postgresql://postgres.${DEV_REF}:${DEV_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:6543/postgres"
fi

echo "📡 Target: development-v2"
echo ""

# Restore with proper handling
pg_restore \
  --dbname="$DEV_DB_URL" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --verbose \
  production_data.dump \
  2>&1 | grep -E "(restoring|processing|completed|error)" | head -50

echo ""
echo "✅ Restore initiated"
echo ""

echo "🔍 Step 3: Verifying data..."
echo ""

# Verify with Node script
node check-dev-v2-tables.mjs

echo ""
echo "🧹 Cleanup..."
rm -f production_data.dump

echo ""
echo "✅ Sync complete!"
