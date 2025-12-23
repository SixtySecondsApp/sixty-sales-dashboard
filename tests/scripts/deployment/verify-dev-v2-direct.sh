#!/bin/bash

echo "🔍 Verifying development-v2 data (direct connection)..."
echo ""

# Use the dev-v2 password
DB_PASSWORD="gbWfdhlBSgtoXnoHeDMXfssiLDhFIQWh"

# Direct connection to development-v2 branch database
DEV_DB="postgresql://postgres:${DB_PASSWORD}@db.jczngsvpywgrlgdwzjbr.supabase.co:5432/postgres"

echo "📊 Table sizes and data verification..."
echo ""

psql "$DEV_DB" -c "
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'deals', 'activities', 'meetings', 'tasks', 'organizations', 'contacts', 'audit_logs', 'communication_events')
ORDER BY pg_total_relation_size('public.'||tablename) DESC;
"

echo ""
echo "📈 Row counts for key tables..."
echo ""

psql "$DEV_DB" -c "
SELECT 
  'profiles' as table_name, count(*) as row_count FROM profiles
UNION ALL
SELECT 'deals', count(*) FROM deals
UNION ALL
SELECT 'meetings', count(*) FROM meetings
UNION ALL
SELECT 'activities', count(*) FROM activities
UNION ALL
SELECT 'contacts', count(*) FROM contacts
UNION ALL
SELECT 'tasks', count(*) FROM tasks
ORDER BY table_name;
"

echo ""
echo "✅ Verification complete!"
