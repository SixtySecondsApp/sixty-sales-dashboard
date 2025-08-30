-- Test script to verify the API keys database schema
-- Run this in your Supabase SQL editor or psql to verify the schema

-- Check if the api_keys table exists and has the correct structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'api_keys' 
ORDER BY ordinal_position;

-- Check if the api_requests table exists and has the correct structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'api_requests' 
ORDER BY ordinal_position;

-- Check if the required indexes exist
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('api_keys', 'api_requests')
ORDER BY tablename, indexname;

-- Check if the required functions exist
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name IN (
    'generate_api_key',
    'hash_api_key',
    'validate_api_key',
    'check_rate_limit',
    'log_api_request'
)
ORDER BY routine_name;

-- Check RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('api_keys', 'api_requests')
ORDER BY tablename, policyname;

-- Test the generate_api_key function (this will generate a test key)
SELECT 
    'Testing generate_api_key function:' as test_description,
    generate_api_key() as generated_key;

-- Test the hash_api_key function
SELECT 
    'Testing hash_api_key function:' as test_description,
    hash_api_key('test_key_123') as hashed_key;

-- Test the validate_api_key function with a non-existent key
SELECT 
    'Testing validate_api_key function with invalid key:' as test_description,
    * FROM validate_api_key('invalid_key');

-- Check if there are any existing API keys (should be empty on fresh install)
SELECT 
    'Current API keys count:' as description,
    COUNT(*) as count
FROM api_keys;

-- Check if there are any API requests logged (should be empty on fresh install)
SELECT 
    'Current API requests count:' as description,
    COUNT(*) as count
FROM api_requests;