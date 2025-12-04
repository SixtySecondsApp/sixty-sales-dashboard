#!/bin/bash

echo "🔍 Verifying development-v2 has production data..."
echo ""

# Use the dev-v2 password
DB_PASSWORD="gbWfdhlBSgtoXnoHeDMXfssiLDhFIQWh"

# Connection string for development-v2 via pooler
DEV_DB="postgresql://postgres.jczngsvpywgrlgdwzjbr:${DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"

echo "📊 Checking table sizes and row counts..."
echo ""

psql "$DEV_DB" -c "
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS size,
  (SELECT count(*) FROM public.profiles WHERE tablename = 'profiles') as profile_count,
  (SELECT count(*) FROM public.deals WHERE tablename = 'deals') as deal_count,
  (SELECT count(*) FROM public.meetings WHERE tablename = 'meetings') as meeting_count,
  (SELECT count(*) FROM public.activities WHERE tablename = 'activities') as activity_count,
  (SELECT count(*) FROM public.contacts WHERE tablename = 'contacts') as contact_count
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'deals', 'activities', 'meetings', 'tasks', 'organizations', 'contacts', 'audit_logs')
ORDER BY pg_total_relation_size('public.'||tablename) DESC
LIMIT 10;
" 2>&1

echo ""
echo "✅ Verification complete!"
