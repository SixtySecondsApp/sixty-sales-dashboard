#!/bin/bash

echo "Testing development-v2 connection via psql..."
echo ""

# Get password from user
read -sp "Enter development-v2 database password (gbWfdhlBSgtoXnoHeDMXfssiLDhFIQWh): " DB_PASSWORD
echo ""
echo ""

# Connection string for development-v2 via pooler
DEV_DB="postgresql://postgres.jczngsvpywgrlgdwzjbr:${DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"

echo "Connecting to development-v2..."
echo ""

psql "$DEV_DB" <<SQL
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'deals', 'activities', 'meetings', 'tasks', 'organizations', 'contacts', 'communication_events')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
SQL

echo ""
echo "Test complete!"
