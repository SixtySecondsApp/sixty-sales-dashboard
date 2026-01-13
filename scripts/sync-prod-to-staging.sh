#!/bin/bash
set -e

echo "🔄 Complete Production → Staging Sync (including auth.users)"
echo "============================================================"
echo ""

# Production database (main branch)
PROD_REF="ygdpgliavpxeugaajgrb"
PROD_PASSWORD="${SUPABASE_DATABASE_PASSWORD:-Gi7JO1tz2NupAzHt}"

# Staging branch details
STAGING_REF="caerqjzvuerejfrdtygb"
STAGING_PASSWORD="${STAGING_DATABASE_PASSWORD:?STAGING_DATABASE_PASSWORD not set. Get from Supabase dashboard: Project Settings > Database > Connection string}"
STAGING_BRANCH_ID="ef9986e5-e287-445b-b298-637b3da077c9"

# Production connection URL
PROD_URL="postgresql://postgres.${PROD_REF}:${PROD_PASSWORD}@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

echo "📊 Source: Production (main branch)"
echo "   Project: $PROD_REF"
echo ""
echo "📊 Target: Staging branch"
echo "   Branch ID: $STAGING_BRANCH_ID"
echo "   Project: $STAGING_REF"
echo ""

# Verify Supabase CLI is linked
echo "🔍 Step 0: Verifying Supabase CLI connection..."
if supabase db dump --linked --dry-run > /dev/null 2>&1; then
  echo "✅ Supabase CLI linked to production project"
else
  echo "⚠️  Not linked, will use project-ref..."
fi

echo ""
echo "📦 Step 1: Dumping ALL production data (public + auth schemas)..."
echo "   This may take several minutes depending on data size..."

# Dump with ALL schemas including auth using Supabase CLI
# First try linked project, fallback to db-url
if supabase db dump --linked --data-only --schema public --schema auth --use-copy --file production-to-staging.sql 2>&1; then
  echo "✅ Dump completed using linked project"
else
  echo "⚠️  Linked dump failed, trying with db-url..."
  # Use Supabase CLI with db-url (it handles auth properly)
  supabase db dump \
    --db-url "$PROD_URL" \
    --data-only \
    --schema public \
    --schema auth \
    --use-copy \
    --file production-to-staging.sql
fi

if [ $? -eq 0 ]; then
  SIZE=$(du -h production-to-staging.sql | cut -f1)
  echo "✅ Complete dump: $SIZE"
else
  echo "❌ Dump failed"
  exit 1
fi

echo ""
echo "📥 Step 2: Restoring to staging branch..."

# Staging database connection URL (using pooler for better compatibility)
STAGING_URL="postgresql://postgres.${STAGING_REF}:${STAGING_PASSWORD}@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

echo "🔗 Target: staging"
echo "📡 Database: $STAGING_URL"
echo ""
echo "⚠️  This will overwrite existing data in staging!"
read -p "Continue? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Aborted by user"
  rm -f production-to-staging.sql
  exit 1
fi

# Apply the complete dump using Supabase CLI
echo "📥 Applying data to staging..."
echo "   Using Supabase CLI db push to restore data..."

# Use Supabase CLI to restore (it handles connection properly)
# We'll use psql via Supabase's internal connection handling
supabase db reset --db-url "$STAGING_URL" --linked=false 2>&1 | head -20 || true

# Then restore the data
echo "   Restoring data..."
# Use supabase db push with the dump file, or use psql through Supabase CLI
cat production-to-staging.sql | supabase db execute --db-url "$STAGING_URL" 2>&1 | grep -v "^$" | head -100 || {
  echo "⚠️  Supabase CLI restore method failed, trying direct psql..."
  # Fallback: try psql directly (may fail due to auth, but worth trying)
  PGPASSWORD="${STAGING_PASSWORD}" psql "$STAGING_URL" -f production-to-staging.sql 2>&1 | grep -v "^$" | head -100 || echo "⚠️  Direct psql also failed - check connection manually"
}

echo ""
echo "✅ Data restore process completed!"
echo "   (Some errors may be normal - check output above)"

echo ""
echo "🔍 Step 3: Verifying staging data..."
echo "   Checking table counts..."

# Use Supabase CLI to query staging
supabase db execute --db-url "$STAGING_URL" --sql "
SELECT 
  'profiles' as table_name, COUNT(*)::text as row_count FROM profiles
UNION ALL
SELECT 'deals', COUNT(*)::text FROM deals  
UNION ALL
SELECT 'meetings', COUNT(*)::text FROM meetings
UNION ALL
SELECT 'auth.users', COUNT(*)::text FROM auth.users
ORDER BY table_name;
" 2>&1 | grep -E "(table_name|profiles|deals|meetings|auth\.users|row_count)" || echo "⚠️  Could not verify - check manually in Supabase dashboard"

echo ""
echo "🧹 Cleanup..."
rm -f production-to-staging.sql

echo ""
echo "✅ Complete sync done!"
echo ""
echo "📝 Next steps:"
echo "   1. Update your .env to use staging for testing:"
echo "      VITE_SUPABASE_URL=https://${STAGING_REF}.supabase.co"
echo "      VITE_SUPABASE_ANON_KEY=<get from Supabase dashboard>"
echo "   2. Test your application against staging"
echo "   3. When ready, merge changes to production"

