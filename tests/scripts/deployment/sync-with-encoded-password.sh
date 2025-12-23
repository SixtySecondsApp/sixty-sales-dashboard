#!/bin/bash
set -e

echo "🔧 Production → Development-v2 (URL-encoded passwords)"
echo "======================================================"
echo ""

# Production password: SzPNQeGOhxM09pdX (no special chars, should work as-is)
PROD_REF="ewtuefzeogytgmsnkpmb"

# First test the connection
echo "Testing production connection..."
PROD_TEST="postgresql://postgres.${PROD_REF}:SzPNQeGOhxM09pdX@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
psql "$PROD_TEST" -c "SELECT 'Connected' as status;" 2>&1 | head -2

if [ $? -ne 0 ]; then
  echo "❌ Cannot connect to production"
  echo "Please verify password in Supabase dashboard"
  exit 1
fi

echo "✅ Production connection OK"
echo ""

echo "📦 Exporting from production..."
pg_dump "$PROD_TEST" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --schema=public \
  -f prod_export.sql

SIZE=$(du -h prod_export.sql | cut -f1)
echo "✅ Exported ($SIZE)"
echo ""

echo "📥 Importing to development-v2 (via Supabase API)..."
# We'll use the Supabase client instead of direct psql
node << 'NODESCRIPT'
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

console.log('Note: Using Supabase client for import...');
console.log('This approach has limitations - considering GitHub Actions instead');
NODESCRIPT

echo ""
echo "💡 Recommendation: Use GitHub Actions workflow instead"
echo ""
echo "The GitHub Actions workflow can connect properly."
echo "Please update SUPABASE_PROJECT_ID secret to: ewtuefzeogytgmsnkpmb"
echo "Then re-run the workflow."

rm -f prod_export.sql
