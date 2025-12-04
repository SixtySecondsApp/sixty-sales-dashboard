#!/bin/bash
set -e

echo "🔄 Complete Production → Development-v2 Sync (including auth.users)"
echo "===================================================================="
echo ""

PROD_PASSWORD="SzPNQeGOhxM09pdX"
DEV_PASSWORD="gbWfdhlBSgtoXnoHeDMXfssiLDhFIQWh"
PROD_REF="ewtuefzeogytgmsnkpmb"
DEV_REF="jczngsvpywgrlgdwzjbr"
BRANCH_ID="17b178b9-bb9b-4ccd-a125-5e49398bb989"

PROD_URL="postgres://postgres.${PROD_REF}:${PROD_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"

echo "📦 Step 1: Dumping ALL production data (public + auth schemas)..."

# Dump with ALL schemas including auth
supabase db dump \
  --db-url "$PROD_URL" \
  --data-only \
  --schema public \
  --schema auth \
  --use-copy \
  --file production-complete.sql

if [ $? -eq 0 ]; then
  SIZE=$(du -h production-complete.sql | cut -f1)
  echo "✅ Complete dump: $SIZE"
else
  echo "❌ Dump failed"
  exit 1
fi

echo ""
echo "📥 Step 2: Restoring to development-v2..."

# Get branch connection
BRANCH_INFO=$(supabase branches get $BRANCH_ID --project-ref $PROD_REF --output json --experimental 2>/dev/null)
DB_HOST=$(echo "$BRANCH_INFO" | jq -r '.database_host')
DB_NAME=$(echo "$BRANCH_INFO" | jq -r '.database_name // "postgres"')

if [ -z "$DB_HOST" ] || [ "$DB_HOST" == "null" ]; then
  echo "⚠️  Using fallback connection..."
  DEV_DB_URL="postgresql://postgres.${DEV_REF}:${DEV_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:6543/postgres"
else
  DEV_DB_URL="postgresql://postgres:${DEV_PASSWORD}@${DB_HOST}:5432/${DB_NAME}"
fi

echo "🔗 Target: development-v2"
echo "📡 Database: $DEV_DB_URL"
echo ""

# Apply the complete dump
psql "$DEV_DB_URL" -f production-complete.sql 2>&1 | grep -v "^$" | head -100

echo ""
echo "✅ Data restored!"
echo ""

echo "🔍 Step 3: Verifying..."
node check-dev-v2-tables.mjs

echo ""
echo "🧹 Cleanup..."
rm -f production-complete.sql

echo ""
echo "✅ Complete sync done! Run: npm run dev"
