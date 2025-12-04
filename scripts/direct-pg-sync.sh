#!/bin/bash
set -e

echo "🔄 Direct PostgreSQL Sync: Production → Development-v2"
echo "=========================================================="
echo ""

PROD_PASSWORD="SzPNQeGOhxM09pdX"
DEV_PASSWORD="gbWfdhlBSgtoXnoHeDMXfssiLDhFIQWh"
PROD_REF="ewtuefzeogytgmsnkpmb"
DEV_REF="jczngsvpywgrlgdwzjbr"

PROD_DB="postgresql://postgres.${PROD_REF}:${PROD_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
DEV_DB="postgresql://postgres.${DEV_REF}:${DEV_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:6543/postgres"

echo "📦 Step 1: Dumping production data (public schema only first)..."
echo "This may take a few minutes for large datasets..."
echo ""

# Use pg_dump directly with data-only for public schema
PGPASSWORD="${PROD_PASSWORD}" pg_dump \
  -h aws-0-us-west-1.pooler.supabase.com \
  -p 5432 \
  -U "postgres.${PROD_REF}" \
  -d postgres \
  --data-only \
  --schema=public \
  --disable-triggers \
  --no-owner \
  --no-privileges \
  -f production-data.sql 2>&1 | grep -v "^$"

if [ $? -eq 0 ]; then
  SIZE=$(du -h production-data.sql | cut -f1)
  echo "✅ Dump complete: $SIZE"
else
  echo "❌ Dump failed"
  exit 1
fi

echo ""
echo "📥 Step 2: Restoring to development-v2..."
echo ""

# Restore to dev-v2
PGPASSWORD="${DEV_PASSWORD}" psql \
  -h aws-0-us-west-1.pooler.supabase.com \
  -p 6543 \
  -U "postgres.${DEV_REF}" \
  -d postgres \
  -f production-data.sql 2>&1 | grep -E "(INSERT|COPY|ERROR)" | head -50

echo ""
echo "✅ Data restored!"
echo ""

echo "🔍 Step 3: Verifying..."
node check-dev-v2-tables.mjs

echo ""
echo "🧹 Cleanup..."
rm -f production-data.sql

echo ""
echo "✅ Sync complete! Run: npm run dev"
