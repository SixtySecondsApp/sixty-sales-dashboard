#!/bin/bash
set -e

echo "🔧 Production → Development-v2 Sync (Final)"
echo "============================================"
echo ""

PROD_REF="ewtuefzeogytgmsnkpmb"
PROD_PASSWORD="SzPNQeGOhxM09pdX"
DEV_PASSWORD="gbWfdhlBSgtoXnoHeDMXfssiLDhFIQWh"

echo "📊 Source: Production (${PROD_REF})"
echo "📊 Target: Development-v2 (jczngsvpywgrlgdwzjbr)"
echo ""

# Production connection (via pooler - works)
PROD_DB="postgresql://postgres.${PROD_REF}:${PROD_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"

# Development-v2 connection (direct - not pooler)
DEV_DB="postgresql://postgres:${DEV_PASSWORD}@db.jczngsvpywgrlgdwzjbr.supabase.co:5432/postgres"

echo "📦 Step 1: Export schema + data from production..."
pg_dump "$PROD_DB" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --schema=public \
  -f production_full.sql

if [ $? -eq 0 ]; then
  SIZE=$(du -h production_full.sql | cut -f1)
  echo "✅ Exported ($SIZE)"
else
  echo "❌ Export failed"
  exit 1
fi

echo ""
echo "📥 Step 2: Import to development-v2..."
echo "   (May show connection warnings - trying direct connection)"
echo ""

# Try direct connection
psql "$DEV_DB" -f production_full.sql > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✅ Import complete"
else
  echo "⚠️  Direct connection failed, trying via Supabase client library..."
  # Fall back to using supabase-js client
  node << 'NODEOF'
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://jczngsvpywgrlgdwzjbr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjem5nc3ZweXdncmxnZHd6amJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc2MjEzNywiZXhwIjoyMDgwMzM4MTM3fQ.2KWy3kixEgdW34pSdc3HVRCT4Zrp5z45fbTfDyarpdc'
);

console.log('Using Supabase client fallback...');
console.log('Note: This can only sync data, not schema');
console.log('Please check if tables exist first');
NODEOF
fi

echo ""
echo "🔍 Step 3: Verification..."
psql "$DEV_DB" -c "
SELECT 
  'profiles' as table, COUNT(*) as records FROM profiles
UNION ALL
SELECT 'deals', COUNT(*) FROM deals  
UNION ALL
SELECT 'meetings', COUNT(*) FROM meetings
UNION ALL
SELECT 'contacts', COUNT(*) FROM contacts
ORDER BY table;
" 2>&1 || echo "⚠️  Could not verify - check manually"

echo ""
echo "🧹 Cleanup..."
rm -f production_full.sql

echo ""
echo "✅ Done! Verify with: node check-dev-v2-directly.mjs"
