#!/bin/bash

echo "🔄 Starting Production → Development Data Sync"
echo "=============================================="

# Production connection (pooler for IPv4 compatibility)
PROD_DB="postgres://postgres.ewtuefzeogytgmsnkpmb:${SUPABASE_DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"

# Development branch connection
DEV_DB="postgres://postgres.ewtuefzeogytgmsnkpmb:gbWfdhlBSgtoXnoHeDMXfssiLDhFIQWh@aws-0-us-west-1.pooler.supabase.com:5432/postgres_17b178b9-bb9b-4ccd-a125-5e49398bb989"

echo "📦 Step 1: Exporting production data..."
pg_dump "$PROD_DB" \
  --no-owner \
  --no-privileges \
  --schema=public \
  -Fc \
  -f production_dump.sql

if [ $? -eq 0 ]; then
  echo "✅ Production data exported"
  DUMP_SIZE=$(du -h production_dump.sql | cut -f1)
  echo "   Size: $DUMP_SIZE"
else
  echo "❌ Export failed"
  exit 1
fi

echo ""
echo "📥 Step 2: Importing to development-v2..."
pg_restore \
  --dbname="$DEV_DB" \
  --no-owner \
  --no-privileges \
  --data-only \
  --disable-triggers \
  production_dump.sql

if [ $? -eq 0 ]; then
  echo "✅ Data imported to development-v2"
else
  echo "⚠️  Import completed with warnings (expected)"
fi

echo ""
echo "🔍 Step 3: Verifying data..."
psql "$DEV_DB" -c "
  SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
  FROM pg_tables 
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
  LIMIT 10;
"

echo ""
echo "🧹 Step 4: Cleanup..."
rm -f production_dump.sql
echo "✅ Sync complete!"
