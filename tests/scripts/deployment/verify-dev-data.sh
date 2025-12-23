#!/bin/bash

# Quick script to verify development branch has data

echo "🔍 Checking development branch data..."

PGPASSWORD="kbpjsDPWVsFqGtZrgHYVMOkHvOyUZRpA" psql \
  "postgresql://postgres:kbpjsDPWVsFqGtZrgHYVMOkHvOyUZRpA@aws-1-us-west-1.pooler.supabase.com:6543/postgres?dbname=postgres" \
  -c "SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    (SELECT COUNT(*) FROM pg_class WHERE relname = tablename) as exists
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
  LIMIT 10;"

echo ""
echo "✅ If you see tables listed above, the sync was successful!"
