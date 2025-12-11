-- Run this in Supabase SQL Editor to check realtime status

-- 1. All tables currently in the realtime publication
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- 2. Check if publication exists and its settings
SELECT * FROM pg_publication WHERE pubname = 'supabase_realtime';

-- 3. Alternative: Check via realtime schema if it exists
-- SELECT * FROM realtime.subscription;
