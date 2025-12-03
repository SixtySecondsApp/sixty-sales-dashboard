#!/bin/bash
set -e

echo "🔧 Sync via Supabase CLI"
echo "========================"
echo ""

read -sp "Enter production database password: " DB_PASSWORD
echo ""
echo ""

PROD_REF="ewtuefzeogytgmsnkpmb"
BRANCH_ID="17b178b9-bb9b-4ccd-a125-5e49398bb989"

echo "📦 Step 1: Export from production..."
PROD_DB="postgresql://postgres.${PROD_REF}:${DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"

pg_dump "$PROD_DB" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --schema=public \
  --exclude-table='supabase_migrations.schema_migrations' \
  -f production_full.sql

if [ $? -eq 0 ]; then
  SIZE=$(du -h production_full.sql | cut -f1)
  echo "✅ Exported ($SIZE)"
else
  echo "❌ Export failed"
  exit 1
fi

echo ""
echo "📥 Step 2: Get branch connection details..."

# Get the branch database connection URL
BRANCH_INFO=$(supabase branches get $BRANCH_ID --project-ref $PROD_REF --experimental --output json 2>&1)

echo "$BRANCH_INFO" | jq -r '.database_host' > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "⚠️  Could not parse branch connection info"
  echo "Using pooler connection instead..."
  DEV_DB="postgresql://postgres.jczngsvpywgrlgdwzjbr:${DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
else
  # Extract connection details
  DB_HOST=$(echo "$BRANCH_INFO" | jq -r '.database_host')
  DB_NAME=$(echo "$BRANCH_INFO" | jq -r '.database_name // "postgres"')
  DEV_DB="postgresql://postgres:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}"
fi

echo "✅ Connection ready"
echo ""

echo "📥 Step 3: Apply to development-v2..."
echo "   (This will recreate all tables and import data)"
echo ""

psql "$DEV_DB" -f production_full.sql 2>&1 | \
  grep -E "(CREATE TABLE|INSERT|ERROR)" | head -50

echo ""
echo "✅ Import complete"
echo ""

echo "🔍 Verification..."
psql "$DEV_DB" -c "
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'deals', 'meetings', 'contacts')
ORDER BY tablename;
" || echo "⚠️  Verification query failed"

echo ""
echo "🧹 Cleanup..."
rm -f production_full.sql

echo ""
echo "✅ Done! Test with: node check-dev-v2-directly.mjs"
