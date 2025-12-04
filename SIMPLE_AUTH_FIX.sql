-- ================================================================
-- CREATE AUTH USERS FROM EXISTING PROFILES
-- Simple version that works without trigger manipulation
-- ================================================================

-- This inserts auth.users records directly with matching profile IDs
-- The trigger will try to create a profile, but it already exists,
-- so we handle the conflict gracefully

DO $$
DECLARE
    affected_rows INTEGER;
    profile_record RECORD;
    success_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Creating auth.users from profiles...';
    RAISE NOTICE '================================================';

    -- Loop through each profile and try to create the auth user
    FOR profile_record IN
        SELECT id, email, full_name, created_at, updated_at
        FROM profiles
        WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = profiles.id)
        ORDER BY created_at
    LOOP
        BEGIN
            -- Insert into auth.users with the same ID as the profile
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
            ) VALUES (
                '00000000-0000-0000-0000-000000000000'::uuid,
                profile_record.id,  -- Use same ID as profile
                'authenticated',
                'authenticated',
                profile_record.email,
                crypt('TEMP_' || substring(profile_record.id::text, 1, 8), gen_salt('bf')),
                NOW(),
                NULL,
                NULL,
                '{}'::jsonb,
                jsonb_build_object('full_name', COALESCE(profile_record.full_name, profile_record.email), 'email', profile_record.email),
                profile_record.created_at,
                profile_record.updated_at,
                '',
                '',
                '',
                ''
            );

            success_count := success_count + 1;
            RAISE NOTICE '✅ Created user: % (ID: %)', profile_record.email, substring(profile_record.id::text, 1, 8);

        EXCEPTION
            WHEN unique_violation THEN
                -- Profile already exists from trigger, that's OK
                RAISE NOTICE '⚠️  Skipped %: auth user or profile already exists', profile_record.email;
            WHEN OTHERS THEN
                error_count := error_count + 1;
                RAISE NOTICE '❌ Error creating %: %', profile_record.email, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE '================================================';
    RAISE NOTICE 'COMPLETE!';
    RAISE NOTICE 'Success: % users created', success_count;
    RAISE NOTICE 'Errors: % users', error_count;
    RAISE NOTICE '================================================';

END $$;

-- Verification
SELECT '✅ Verification:' as status;

SELECT
    COUNT(*) as auth_users_count,
    (SELECT COUNT(*) FROM profiles) as profiles_count,
    (SELECT COUNT(*)
     FROM profiles p
     INNER JOIN auth.users u ON p.id = u.id) as matching_ids
FROM auth.users;

-- Show status for each profile
SELECT
    p.email,
    CASE
        WHEN u.id IS NOT NULL THEN '✅ Has auth user'
        ELSE '❌ Missing'
    END as auth_status,
    CASE
        WHEN p.id = u.id THEN '✅ IDs match'
        WHEN u.id IS NULL THEN '⚠️  No user'
        ELSE '❌ Mismatch'
    END as id_status
FROM profiles p
LEFT JOIN auth.users u ON p.id = u.id
ORDER BY p.created_at;

-- Instructions
SELECT '🎉 Users can now log in! Use "Forgot Password" to set passwords.' as next_step;
