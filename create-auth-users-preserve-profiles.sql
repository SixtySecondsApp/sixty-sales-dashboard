-- Create auth.users records that match existing profiles
-- This preserves all existing data relationships

-- Step 1: First, let's see what profiles we have
SELECT
    id,
    email,
    full_name,
    created_at
FROM profiles
ORDER BY created_at;

-- Step 2: We need to insert directly into auth.users with the SAME IDs as profiles
-- This requires superuser access, but we can try via a migration

-- Create a migration that inserts users with matching IDs
-- The key insight: We use the SAME UUID from profiles for auth.users.id

-- IMPORTANT: This must be run as a Supabase migration, not via SQL Editor
-- Save this as: supabase/migrations/YYYYMMDDHHMMSS_create_auth_users_from_profiles.sql

-- Temporarily disable the trigger that creates profiles
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

-- Insert users with IDs matching existing profiles
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
)
SELECT
    '00000000-0000-0000-0000-000000000000'::uuid as instance_id,
    p.id,  -- CRITICAL: Use the same ID from profiles
    'authenticated' as aud,
    'authenticated' as role,
    p.email,
    crypt('NEEDS_PASSWORD_RESET_' || p.id::text, gen_salt('bf')) as encrypted_password,
    NOW() as email_confirmed_at,
    NULL as recovery_sent_at,
    NULL as last_sign_in_at,
    '{}'::jsonb as raw_app_meta_data,
    jsonb_build_object(
        'full_name', COALESCE(p.full_name, p.email),
        'email', p.email
    ) as raw_user_meta_data,
    p.created_at,
    p.updated_at,
    '' as confirmation_token,
    '' as email_change,
    '' as email_change_token_new,
    '' as recovery_token
FROM profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = p.id
);

-- Re-enable the trigger
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

-- Verify the insert worked
SELECT
    'Created ' || COUNT(*) || ' auth.users records' as result
FROM auth.users;

SELECT
    'Total profiles: ' || COUNT(*) as result
FROM profiles;

-- Verify IDs match
SELECT
    p.email,
    CASE
        WHEN u.id IS NOT NULL THEN '✅ Has auth user'
        ELSE '❌ Missing auth user'
    END as status,
    p.id as profile_id,
    u.id as user_id,
    CASE
        WHEN p.id = u.id THEN '✅ IDs match'
        WHEN u.id IS NULL THEN '⚠️  No user'
        ELSE '❌ ID mismatch!'
    END as id_check
FROM profiles p
LEFT JOIN auth.users u ON p.id = u.id
ORDER BY p.created_at;
