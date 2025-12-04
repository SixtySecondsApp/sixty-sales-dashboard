#!/bin/bash
set -e

echo "🔄 Syncing Production to Development-v2 via Supabase CLI"
echo "=========================================================="
echo ""

PROD_PASSWORD="SzPNQeGOhxM09pdX"
DEV_PASSWORD="gbWfdhlBSgtoXnoHeDMXfssiLDhFIQWh"
PROD_URL="postgres://postgres.ewtuefzeogytgmsnkpmb:${PROD_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
BRANCH_ID="17b178b9-bb9b-4ccd-a125-5e49398bb989"

echo "📦 Step 1: Dumping production data..."
supabase db dump \
  --db-url "$PROD_URL" \
  --data-only \
  --use-copy \
  --file production-data.sql

if [ $? -eq 0 ]; then
  SIZE=$(du -h production-data.sql | cut -f1)
  echo "✅ Dump complete: $SIZE"
else
  echo "❌ Dump failed"
  exit 1
fi

echo ""
echo "📥 Step 2: Restoring to development-v2 branch..."

# Get branch connection via CLI
BRANCH_INFO=$(supabase branches get $BRANCH_ID --project-ref ewtuefzeogytgmsnkpmb --output json --experimental 2>/dev/null)
DB_HOST=$(echo "$BRANCH_INFO" | jq -r '.database_host')
DB_NAME=$(echo "$BRANCH_INFO" | jq -r '.database_name // "postgres"')

if [ -z "$DB_HOST" ] || [ "$DB_HOST" == "null" ]; then
  echo "❌ Could not get branch connection details"
  exit 1
fi

DEV_DB_URL="postgresql://postgres:${DEV_PASSWORD}@${DB_HOST}:5432/${DB_NAME}"

echo "🔗 Target: development-v2 ($BRANCH_ID)"
echo "🌐 Host: $DB_HOST"
echo "💾 Database: $DB_NAME"
echo ""

# Apply the dump
psql "$DEV_DB_URL" -f production-data.sql

echo ""
echo "✅ Data restored!"
echo ""

echo "🔍 Step 3: Verifying..."
node check-dev-v2-tables.mjs

echo ""
echo "🧹 Cleanup..."
rm -f production-data.sql

echo ""
echo "✅ Sync complete! You can now run: npm run dev"
