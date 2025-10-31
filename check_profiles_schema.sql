-- Check profiles table schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- Check activities table schema for sales_rep field
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'activities' AND column_name IN ('user_id', 'sales_rep')
ORDER BY ordinal_position;
