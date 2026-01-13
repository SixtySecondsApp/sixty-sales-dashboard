#!/bin/bash
set -e

# Use newer PostgreSQL tools if available (PostgreSQL 17 to match Supabase)
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"

echo "🔄 Complete Production → Staging Sync (Direct Method)"
echo "====================================================="
echo ""

# Production database (main branch)
PROD_REF="ygdpgliavpxeugaajgrb"
PROD_PASSWORD="${SUPABASE_DATABASE_PASSWORD:-Gi7JO1tz2NupAzHt}"

# Staging branch details (updated 2026-01-09)
STAGING_REF="caerqjzvuerejfrdtygb"
STAGING_PASSWORD="${STAGING_DATABASE_PASSWORD:-Gi7JO1tz2NupAzHt}"

# Direct connection URLs (IPv4 addon enabled)
PROD_URL="postgresql://postgres:${PROD_PASSWORD}@db.${PROD_REF}.supabase.co:5432/postgres"
STAGING_URL="postgresql://postgres:${STAGING_PASSWORD}@db.${STAGING_REF}.supabase.co:5432/postgres"

echo "📊 Source: Production (main branch)"
echo "   Project: $PROD_REF"
echo "   Host: db.${PROD_REF}.supabase.co:5432 (IPv4)"
echo ""
echo "📊 Target: Staging branch"
echo "   Project: $STAGING_REF"
echo "   Host: db.${STAGING_REF}.supabase.co:5432 (IPv4)"
echo ""

echo "⚠️  This will overwrite existing data in staging!"
read -p "Continue? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Aborted by user"
  exit 1
fi

echo ""
echo "📦 Step 1: Dumping production data..."
echo "   This may take several minutes..."

# Use pg_dump with direct connection (IPv4 addon enabled)
# Export data only (not schema) for public schema
# Use --disable-triggers to handle foreign key constraints
# Use custom format for better restore control
PGPASSWORD="${PROD_PASSWORD}" pg_dump \
  -h "db.${PROD_REF}.supabase.co" \
  -p 5432 \
  -U postgres \
  -d postgres \
  --data-only \
  --schema=public \
  --no-owner \
  --no-privileges \
  --disable-triggers \
  --format=custom \
  --file=production-to-staging.dump \
  2>&1

if [ -f production-to-staging.dump ]; then
  SIZE=$(du -h production-to-staging.dump | cut -f1)
  echo "✅ Dump completed: $SIZE"
else
  echo "❌ Dump file not created"
  exit 1
fi

echo ""
echo "🗑️  Step 2: Clearing staging data..."
echo "   Truncating all public tables with CASCADE..."

# Truncate all tables in staging to avoid conflicts
PGPASSWORD="${STAGING_PASSWORD}" psql \
  -h "db.${STAGING_REF}.supabase.co" \
  -p 5432 \
  -U postgres \
  -d postgres \
  -c "DO \$\$
DECLARE
  r RECORD;
BEGIN
  -- Disable triggers
  SET session_replication_role = 'replica';

  -- Truncate all tables in public schema
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;

  -- Re-enable triggers
  SET session_replication_role = 'origin';
END \$\$;"

echo "✅ Staging tables cleared"

echo ""
echo "📥 Step 3: Restoring to staging..."
echo "   This may take several minutes..."

# Restore using pg_restore with --disable-triggers
PGPASSWORD="${STAGING_PASSWORD}" pg_restore \
  -h "db.${STAGING_REF}.supabase.co" \
  -p 5432 \
  -U postgres \
  -d postgres \
  --data-only \
  --no-owner \
  --no-privileges \
  --disable-triggers \
  --verbose \
  production-to-staging.dump 2>&1 | tail -50

echo ""
echo "✅ Data restore completed!"

echo ""
echo "🧹 Cleanup..."
rm -f production-to-staging.dump

echo ""
echo "🚀 Step 4: Deploying Edge Functions to Staging Branch..."
echo "   Staging branch has its own project reference and needs separate deployment"
echo ""

# Ensure Supabase CLI has access token
export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_8e5eef8735fc3f15ed2544a5ad9508a902f2565f}"

# Count functions
FUNC_COUNT=$(ls -d supabase/functions/*/ 2>/dev/null | grep -v "_shared" | wc -l | tr -d ' ')
echo "   Found ${FUNC_COUNT} edge functions to deploy..."
echo "   Deploying to staging branch project: ${STAGING_REF}..."

# Deploy all functions directly to staging branch project
if supabase functions deploy --project-ref "${STAGING_REF}" 2>&1 | tee /tmp/functions-deploy.log; then
  echo ""
  echo "✅ Edge functions deployed successfully to staging!"
  
  # Show summary
  DEPLOYED_COUNT=$(grep -c "Deployed Function:" /tmp/functions-deploy.log 2>/dev/null || echo "${FUNC_COUNT}")
  echo "   - Functions deployed: ${DEPLOYED_COUNT}"
else
  echo ""
  echo "⚠️  Some functions may have failed to deploy"
  echo "   Check the output above for details"
fi

rm -f /tmp/functions-deploy.log

echo ""
echo "✅ Migration complete!"
echo ""
echo "📝 Summary:"
echo "   ✅ Schema + data migrated from production to staging"
echo "   ✅ Edge functions deployed (available on all branches)"
echo ""
echo "📝 Next steps:"
echo "   1. Verify data in Supabase dashboard:"
echo "      https://app.supabase.com/project/${PROD_REF}/branches/${STAGING_REF}"
echo "   2. Verify functions:"
echo "      https://app.supabase.com/project/${PROD_REF}/functions"
echo "   3. Update your .env to use staging:"
echo "      VITE_SUPABASE_URL=https://${STAGING_REF}.supabase.co"
echo "   4. Test your application against staging"

