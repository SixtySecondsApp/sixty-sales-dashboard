#!/bin/bash
set -e

echo "🔄 Production → Development-v2 Sync (via Supavisor IPv4)"
echo "=========================================================="
echo ""
echo "Using Supavisor Session Mode (port 5432) for IPv4 compatibility"
echo ""

PROD_PASSWORD="SzPNQeGOhxM09pdX"
DEV_PASSWORD="gbWfdhlBSgtoXnoHeDMXfssiLDhFIQWh"
PROD_REF="ewtuefzeogytgmsnkpmb"
DEV_REF="jczngsvpywgrlgdwzjbr"

# Supavisor Session Mode (port 5432) - IPv4 compatible
PROD_DB="postgres://postgres.${PROD_REF}:${PROD_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
DEV_DB="postgres://postgres.${DEV_REF}:${DEV_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"

echo "📦 Step 1: Dumping production data (public schema)..."
echo ""

pg_dump "$PROD_DB" \
  --no-owner \
  --no-privileges \
  --schema=public \
  --data-only \
  -Fc \
  -f production_dump.sql

if [ $? -eq 0 ]; then
  SIZE=$(du -h production_dump.sql | cut -f1)
  echo "✅ Dump complete: $SIZE"
else
  echo "❌ Dump failed"
  exit 1
fi

echo ""
echo "📥 Step 2: Restoring to development-v2..."
echo ""

pg_restore "$DEV_DB" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  -d postgres \
  production_dump.sql 2>&1 | grep -v "does not exist" | head -50

echo ""
echo "✅ Data restored!"
echo ""

echo "🔍 Step 3: Verifying..."
node check-dev-v2-tables.mjs

echo ""
echo "🧹 Cleanup..."
rm -f production_dump.sql

echo ""
echo "✅ Sync complete! Run: npm run dev"
