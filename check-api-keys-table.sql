-- Check the current structure of the api_keys table
SELECT 'Checking api_keys table structure:' as info;

-- Get column information
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'api_keys'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if table exists and row count
SELECT 'Table row count:' as info;
SELECT COUNT(*) as row_count FROM api_keys;

-- Check RLS status
SELECT 'RLS status:' as info;
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    hasrls as has_rls_policies
FROM pg_tables pt
LEFT JOIN pg_class pc ON pt.tablename = pc.relname
WHERE pt.tablename = 'api_keys';

-- List RLS policies
SELECT 'RLS policies:' as info;
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'api_keys'
AND schemaname = 'public';

-- Test a simple insert/delete with service role (should work)
SELECT 'Testing basic operations:' as info;

-- Try to insert a test record
INSERT INTO api_keys (name, key_hash, key_preview, user_id, permissions, rate_limit) 
VALUES (
    'test_key', 
    'test_hash_' || extract(epoch from now()), 
    'sk_test...1234', 
    '00000000-0000-0000-0000-000000000000'::uuid,
    ARRAY['test:read'],
    500
) ON CONFLICT (key_hash) DO NOTHING;

-- Check if insert worked
SELECT COUNT(*) as test_records_count FROM api_keys WHERE name = 'test_key';

-- Clean up test record
DELETE FROM api_keys WHERE name = 'test_key';

SELECT 'Test complete - if no errors above, table structure is working' as result;