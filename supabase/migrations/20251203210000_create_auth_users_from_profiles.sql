-- Migration: Create auth.users records from existing profiles
-- This preserves all data relationships by using the same UUIDs

-- Step 1: Disable the trigger that auto-creates profiles (to prevent conflicts)
ALTER TABLE auth.users DISABLE TRIGGER IF EXISTS on_auth_user_created;

-- Step 2: Insert auth.users records with IDs matching existing profiles
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
    p.id,  -- Use the same ID from profiles to preserve all relationships
    'authenticated' as aud,
    'authenticated' as role,
    p.email,
    crypt('TEMP_PASSWORD_' || substring(p.id::text, 1, 8), gen_salt('bf')) as encrypted_password,
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
)
ON CONFLICT (id) DO NOTHING;

-- Step 3: Re-enable the trigger
ALTER TABLE auth.users ENABLE TRIGGER IF EXISTS on_auth_user_created;

-- Step 4: Verify the migration
DO $$
DECLARE
    user_count INTEGER;
    profile_count INTEGER;
    match_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM auth.users;
    SELECT COUNT(*) INTO profile_count FROM profiles;
    SELECT COUNT(*) INTO match_count
    FROM profiles p
    INNER JOIN auth.users u ON p.id = u.id;

    RAISE NOTICE 'Migration completed:';
    RAISE NOTICE '  auth.users: % records', user_count;
    RAISE NOTICE '  profiles: % records', profile_count;
    RAISE NOTICE '  Matching IDs: % records', match_count;

    IF match_count = profile_count THEN
        RAISE NOTICE '✅ All profiles have matching auth.users records!';
    ELSE
        RAISE WARNING '⚠️  Some profiles are missing auth.users records!';
    END IF;
END $$;
