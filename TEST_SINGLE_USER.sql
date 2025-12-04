-- Test creating just ONE user to see the exact error
-- Run this to diagnose the problem

DO $$
DECLARE
    test_profile RECORD;
BEGIN
    -- Get the first profile
    SELECT id, email, created_at, updated_at
    INTO test_profile
    FROM profiles
    LIMIT 1;

    RAISE NOTICE 'Testing with: % (ID: %)', test_profile.email, test_profile.id;

    -- Try to insert
    BEGIN
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            created_at,
            updated_at,
            raw_app_meta_data,
            raw_user_meta_data,
            confirmation_token,
            recovery_token,
            email_change_token_new
        ) VALUES (
            '00000000-0000-0000-0000-000000000000'::uuid,
            test_profile.id,
            'authenticated',
            'authenticated',
            test_profile.email,
            crypt('TEST123', gen_salt('bf')),
            NOW(),
            COALESCE(test_profile.created_at, NOW()),
            COALESCE(test_profile.updated_at, NOW()),
            '{}'::jsonb,
            jsonb_build_object('email', test_profile.email),
            '',
            '',
            ''
        );

        RAISE NOTICE '✅ SUCCESS! User created.';

    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ ERROR: %', SQLERRM;
        RAISE NOTICE 'Error detail: %', SQLSTATE;
    END;

END $$;

-- Check if it worked
SELECT
    CASE
        WHEN COUNT(*) > 0 THEN '✅ User exists in auth.users'
        ELSE '❌ No users in auth.users'
    END as result
FROM auth.users;

-- Show what we have
SELECT
    (SELECT COUNT(*) FROM profiles) as profiles_count,
    (SELECT COUNT(*) FROM auth.users) as auth_users_count;
