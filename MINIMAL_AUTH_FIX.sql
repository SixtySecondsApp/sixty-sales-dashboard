-- ================================================================
-- CREATE AUTH USERS - MINIMAL VERSION
-- Only uses id and email from profiles
-- ================================================================

DO $$
DECLARE
    profile_record RECORD;
    success_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Creating auth.users from profiles...';
    RAISE NOTICE '================================================';

    -- Loop through each profile
    FOR profile_record IN
        SELECT id, email, created_at, updated_at
        FROM profiles
        WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = profiles.id)
        ORDER BY created_at
    LOOP
        BEGIN
            -- Insert into auth.users
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
                profile_record.id,
                'authenticated',
                'authenticated',
                profile_record.email,
                crypt('TEMP_' || substring(profile_record.id::text, 1, 8), gen_salt('bf')),
                NOW(),
                COALESCE(profile_record.created_at, NOW()),
                COALESCE(profile_record.updated_at, NOW()),
                '{}'::jsonb,
                jsonb_build_object('email', profile_record.email),
                '',
                '',
                ''
            );

            success_count := success_count + 1;
            RAISE NOTICE '✅ %: %', success_count, profile_record.email;

        EXCEPTION
            WHEN unique_violation THEN
                RAISE NOTICE '⚠️  Skipped: %', profile_record.email;
            WHEN OTHERS THEN
                error_count := error_count + 1;
                RAISE NOTICE '❌ Error for %: %', profile_record.email, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE '================================================';
    RAISE NOTICE 'COMPLETE! Created: %, Errors: %', success_count, error_count;
    RAISE NOTICE '================================================';

END $$;

-- Verification
SELECT
    'auth.users' as table_name,
    COUNT(*) as count
FROM auth.users
UNION ALL
SELECT
    'profiles' as table_name,
    COUNT(*) as count
FROM profiles
UNION ALL
SELECT
    'matching_ids' as table_name,
    COUNT(*) as count
FROM profiles p
INNER JOIN auth.users u ON p.id = u.id;

-- Show each profile status
SELECT
    p.email,
    CASE WHEN u.id IS NOT NULL THEN '✅' ELSE '❌' END as has_auth,
    CASE WHEN p.id = u.id THEN '✅' ELSE '❌' END as ids_match
FROM profiles p
LEFT JOIN auth.users u ON p.id = u.id
ORDER BY p.email;
