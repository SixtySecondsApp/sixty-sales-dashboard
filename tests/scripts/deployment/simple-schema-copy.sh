#!/bin/bash

echo "🚀 Simple Schema Copy: Production → Development-v2"
echo ""

# Production
PROD_REF="ewtuefzeogytgmsnkpmb"
PROD_DB="postgresql://postgres.${PROD_REF}:${SUPABASE_DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"

# Development-v2
DEV_REF="jczngsvpywgrlgdwzjbr"
DEV_DB="postgresql://postgres.${DEV_REF}:${SUPABASE_DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"

echo "📦 Step 1: Dump production schema (schema only, no data)..."
pg_dump "$PROD_DB" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --schema=public \
  -f production_schema.sql 2>&1 | head -20

if [ -f production_schema.sql ]; then
  SCHEMA_SIZE=$(du -h production_schema.sql | cut -f1)
  echo "✅ Schema dumped: $SCHEMA_SIZE"
else
  echo "❌ Schema dump failed"
  exit 1
fi

echo ""
echo "📦 Step 2: Apply schema to development-v2..."
psql "$DEV_DB" < production_schema.sql 2>&1 | head -50

echo ""
echo "✅ Schema copy complete!"
echo ""
echo "📦 Step 3: Now sync data..."
echo "Run: node sync-data-via-api.mjs"
