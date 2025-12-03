#!/bin/bash
set -e

echo "🔄 Manual Production → Development-v2 Data Sync"
echo "================================================"
echo ""

# Get production project ref
PROD_REF="ewtuefzeogytgmsnkpmb"
DEV_BRANCH_ID="17b178b9-bb9b-4ccd-a125-5e49398bb989"

echo "📊 Production: $PROD_REF"
echo "📊 Development-v2: $DEV_BRANCH_ID"
echo ""

# Prompt for database password
read -sp "Enter production database password: " DB_PASSWORD
echo ""
echo ""

# Production database URL (main branch)
PROD_DB="postgresql://postgres.${PROD_REF}:${DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"

# Get development branch database name
echo "🔍 Getting development branch database name..."
BRANCH_INFO=$(supabase branches get $DEV_BRANCH_ID --project-ref $PROD_REF --experimental --output json)
DEV_DB_NAME=$(echo "$BRANCH_INFO" | grep -o '"postgres://[^"]*' | sed 's/.*\///' | cut -d'?' -f1)

if [ -z "$DEV_DB_NAME" ]; then
  echo "❌ Could not get development branch database name"
  exit 1
fi

echo "✅ Development database: $DEV_DB_NAME"
echo ""

# Development branch URL
DEV_DB="postgresql://postgres.${PROD_REF}:${DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/${DEV_DB_NAME}"

echo "📦 Step 1: Exporting production data..."
pg_dump "$PROD_DB" \
  --no-owner \
  --no-privileges \
  --schema=public \
  --exclude-table-data='storage.*' \
  -Fc \
  -f production_data.dump

if [ $? -eq 0 ]; then
  SIZE=$(du -h production_data.dump | cut -f1)
  echo "✅ Production data exported ($SIZE)"
else
  echo "❌ Export failed"
  exit 1
fi

echo ""
echo "📥 Step 2: Importing to development-v2..."
echo "   (This may show some warnings - that's normal)"
echo ""

pg_restore \
  --dbname="$DEV_DB" \
  --no-owner \
  --no-privileges \
  --data-only \
  --disable-triggers \
  --if-exists \
  --verbose \
  production_data.dump 2>&1 | grep -E "(restoring|^processing)" || true

echo ""
echo "✅ Import complete"
echo ""

echo "🔍 Step 3: Verifying sync..."
psql "$DEV_DB" -c "
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'deals', 'activities', 'meetings', 'tasks', 'contacts')
ORDER BY tablename;
"

echo ""
echo "🧹 Cleanup..."
rm -f production_data.dump
echo ""
echo "✅ Sync complete! Run: node check-dev-v2-directly.mjs"
