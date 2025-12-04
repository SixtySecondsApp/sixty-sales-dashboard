-- ================================================================
-- LINK development-v2 data to PRODUCTION auth users
-- This updates profile IDs to match production auth.users IDs
-- ================================================================

-- Step 1: First, let's see what we're working with
SELECT 'Current state:' as info;

SELECT
    'development-v2 profiles' as table_name,
    COUNT(*) as count,
    MIN(email) as sample_email
FROM profiles;

-- Step 2: Get production auth user IDs by email
-- You'll need to provide the production auth.users data
-- Format: email -> auth_user_id mapping

-- Create a temp table with the production auth user IDs
CREATE TEMP TABLE prod_auth_mapping (
    email TEXT PRIMARY KEY,
    prod_auth_id UUID NOT NULL
);

-- INSERT YOUR PRODUCTION AUTH USER EMAIL->ID MAPPINGS HERE
-- Example:
-- INSERT INTO prod_auth_mapping (email, prod_auth_id) VALUES
-- ('[email protected]', '00000000-0000-0000-0000-000000000001'),
-- ('[email protected]', '00000000-0000-0000-0000-000000000002');

-- You can get this data by running this query on PRODUCTION:
-- SELECT email, id FROM auth.users ORDER BY email;

SELECT 'Waiting for production auth user mappings...' as next_step;
SELECT 'Run this query on PRODUCTION and paste the results:' as instruction;
SELECT 'SELECT email, id FROM auth.users ORDER BY email;' as query_to_run;
