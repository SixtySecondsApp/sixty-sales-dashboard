-- Get the actual profiles table schema from the database
-- Run this in Supabase SQL Editor to see what columns really exist

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;
