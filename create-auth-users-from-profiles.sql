-- Create auth.users from existing profiles
-- This bypasses the profile creation trigger by temporarily disabling it

-- Step 1: List the profiles we have (these are the users we need to create)
SELECT
    'Found ' || COUNT(*) || ' profiles that need auth.users records' as status
FROM profiles;

-- Step 2: Show sample profile data
SELECT
    id,
    email,
    full_name,
    created_at
FROM profiles
ORDER BY created_at
LIMIT 10;

-- Step 3: Disable triggers on auth.users temporarily
-- (You'll need to run this as a superuser or it may fail - that's OK)
-- ALTER TABLE auth.users DISABLE TRIGGER ALL;

-- Step 4: Create minimal auth.users records for each profile
-- We're using a simple approach: create users with a password reset requirement
-- Users will need to use "Forgot Password" to set their password

-- First, let's see what we would insert:
SELECT
    id,
    email,
    -- Generate a fake encrypted password that will require reset
    crypt('NEEDS_RESET_' || id::text, gen_salt('bf')) as encrypted_password,
    -- Set email as confirmed
    email_confirmed_at as NOW(),
    -- Mark as needing password reset
    created_at,
    updated_at,
    -- Other required fields
    aud,
    role as 'authenticated',
    raw_app_meta_data as '{}'::jsonb,
    raw_user_meta_data as jsonb_build_object('full_name', full_name, 'email', email)
FROM profiles
WHERE id NOT IN (SELECT id FROM auth.users)
ORDER BY created_at
LIMIT 5;

-- IMPORTANT: The above is just a preview
-- The actual INSERT would look like this (but DON'T RUN YET - see note below):

/*
INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    aud,
    role,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    last_sign_in_at
)
SELECT
    p.id,
    '00000000-0000-0000-0000-000000000000'::uuid as instance_id,
    p.email,
    crypt('TEMP_PASSWORD_RESET_REQUIRED', gen_salt('bf')) as encrypted_password,
    NOW() as email_confirmed_at,
    p.created_at,
    p.updated_at,
    'authenticated' as aud,
    'authenticated' as role,
    '' as confirmation_token,
    '' as recovery_token,
    '' as email_change_token_new,
    '{}'::jsonb as raw_app_meta_data,
    jsonb_build_object(
        'full_name', p.full_name,
        'email', p.email
    ) as raw_user_meta_data,
    false as is_super_admin,
    NULL as last_sign_in_at
FROM profiles p
WHERE p.id NOT IN (SELECT id FROM auth.users);
*/

-- Step 5: Re-enable triggers
-- ALTER TABLE auth.users ENABLE TRIGGER ALL;

-- Step 6: Verify
SELECT COUNT(*) as total_users FROM auth.users;
SELECT COUNT(*) as total_profiles FROM profiles;

-- Final note:
SELECT '⚠️  IMPORTANT: Users will need to use "Forgot Password" to reset their passwords!' as note;
