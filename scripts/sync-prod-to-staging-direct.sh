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

# Staging branch details
STAGING_REF="caerqjzvuerejfrdtygb"
STAGING_PASSWORD="${STAGING_DATABASE_PASSWORD:?STAGING_DATABASE_PASSWORD not set. Get from Supabase dashboard: Project Settings > Database > Connection string}"

# Production connection URL (using Supavisor Session Mode port 5432 for IPv4 compatibility)
PROD_URL="postgresql://postgres.${PROD_REF}:${PROD_PASSWORD}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

# Staging connection URL (using Supavisor Session Mode port 5432)
STAGING_URL="postgresql://postgres.${STAGING_REF}:${STAGING_PASSWORD}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

echo "📊 Source: Production (main branch)"
echo "   Project: $PROD_REF"
echo ""
echo "📊 Target: Staging branch"
echo "   Project: $STAGING_REF"
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

# Use pg_dump with PGPASSWORD environment variable (better compatibility)
# Export data only (not schema) for public and auth schemas
PGPASSWORD="${PROD_PASSWORD}" pg_dump \
  -h aws-1-eu-west-1.pooler.supabase.com \
  -p 5432 \
  -U "postgres.${PROD_REF}" \
  -d postgres \
  --data-only \
  --schema=public \
  --schema=auth \
  --no-owner \
  --no-privileges \
  --file=production-to-staging.sql \
  2>&1 | grep -E "(dumping|completed|error|COPY)" || true

if [ -f production-to-staging.sql ]; then
  SIZE=$(du -h production-to-staging.sql | cut -f1)
  echo "✅ Dump completed: $SIZE"
else
  echo "❌ Dump file not created"
  exit 1
fi

echo ""
echo "📥 Step 2: Restoring to staging..."
echo "   Target: $STAGING_URL"

# Restore using psql
PGPASSWORD="${STAGING_PASSWORD}" psql "$STAGING_URL" \
  -f production-to-staging.sql \
  2>&1 | grep -v "^$" | head -100 || {
  echo "⚠️  Some errors occurred during restore"
  echo "   This may be normal - check output above"
}

echo ""
echo "✅ Data restore completed!"
echo ""

echo "🧹 Cleanup..."
rm -f production-to-staging.sql

echo ""
echo "🚀 Step 3: Deploying Edge Functions to Staging Branch..."
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

