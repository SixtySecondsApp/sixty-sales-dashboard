-- ================================================================
-- Get production auth user mappings
-- Run this on PRODUCTION database to get email → auth_id mappings
-- ================================================================

-- Query production auth users
SELECT
    email,
    id as prod_auth_id
FROM auth.users
ORDER BY email;

-- Save the output in this format for ULTIMATE-FIX.sql:
-- INSERT INTO prod_auth_users (email, prod_auth_id) VALUES
-- ('[email protected]', 'uuid-1'),
-- ('[email protected]', 'uuid-2'),
-- ...;
