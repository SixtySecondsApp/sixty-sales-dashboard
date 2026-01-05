#!/bin/bash
set -e

# Use newer PostgreSQL tools
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_8e5eef8735fc3f15ed2544a5ad9508a902f2565f}"

echo "🔄 Production → Staging Sync (via Supabase CLI Connection)"
echo "=========================================================="
echo ""

PROD_REF="ygdpgliavpxeugaajgrb"
STAGING_REF="dzypskjhoupsdwfsrkeo"
STAGING_PASSWORD="afPwkmKLLzfMaJVVKfRDOmhysExLeKEe"

echo "📊 Source: Production ($PROD_REF)"
echo "📊 Target: Staging ($STAGING_REF)"
echo ""

echo "⚠️  This will overwrite existing data in staging!"
read -p "Continue? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Aborted"
  exit 1
fi

echo ""
echo "📦 Step 1: Getting production connection details..."
# Get connection details from Supabase CLI
DUMP_SCRIPT=$(supabase db dump --linked --dry-run 2>&1 | grep -A 50 "pg_dump" | head -60)

# Extract connection details
PGHOST=$(echo "$DUMP_SCRIPT" | grep "export PGHOST" | cut -d'"' -f2)
PGPORT=$(echo "$DUMP_SCRIPT" | grep "export PGPORT" | cut -d'"' -f2)
PGUSER=$(echo "$DUMP_SCRIPT" | grep "export PGUSER" | cut -d'"' -f2)
PGPASSWORD=$(echo "$DUMP_SCRIPT" | grep "export PGPASSWORD" | cut -d'"' -f2)
PGDATABASE=$(echo "$DUMP_SCRIPT" | grep "export PGDATABASE" | cut -d'"' -f2)

if [ -z "$PGHOST" ]; then
  echo "❌ Could not get connection details from Supabase CLI"
  exit 1
fi

echo "✅ Got connection details"
echo "   Host: $PGHOST:$PGPORT"
echo ""

echo "📦 Step 2: Dumping production data..."
export PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE

pg_dump \
  --data-only \
  --schema=public \
  --schema=auth \
  --no-owner \
  --no-privileges \
  --file=production-to-staging.sql \
  2>&1 | grep -E "(dumping|COPY|completed)" || true

if [ ! -f production-to-staging.sql ] || [ ! -s production-to-staging.sql ]; then
  echo "❌ Dump failed or empty"
  exit 1
fi

SIZE=$(du -h production-to-staging.sql | cut -f1)
echo "✅ Dump completed: $SIZE"
echo ""

echo "📥 Step 3: Restoring to staging..."
STAGING_URL="postgresql://postgres.${STAGING_REF}:${STAGING_PASSWORD}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

PGPASSWORD="${STAGING_PASSWORD}" psql "$STAGING_URL" \
  -f production-to-staging.sql \
  2>&1 | grep -E "(COPY|INSERT|ERROR)" | head -50 || echo "⚠️  Some errors may have occurred"

echo ""
echo "✅ Migration completed!"
echo ""

echo "🧹 Cleanup..."
rm -f production-to-staging.sql

echo ""
echo "📝 Verify in Supabase Dashboard:"
echo "   https://app.supabase.com/project/${PROD_REF}/branches/${STAGING_REF}"

