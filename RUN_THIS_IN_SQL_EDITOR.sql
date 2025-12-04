-- ================================================================
-- CREATE AUTH USERS FROM EXISTING PROFILES
-- Run this in Supabase Dashboard → SQL Editor
-- ================================================================

-- This will create auth.users records with the SAME UUIDs as your
-- existing profiles, preserving all data relationships.

DO $$
DECLARE
    affected_rows INTEGER;
BEGIN
    -- Step 1: Disable the trigger that auto-creates profiles
    -- We need to do this without IF EXISTS in EXECUTE
    BEGIN
        EXECUTE 'ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created';
        RAISE NOTICE 'Step 1: Disabled profile creation trigger';
    EXCEPTION
        WHEN undefined_object THEN
            RAISE NOTICE 'Step 1: Trigger does not exist, continuing...';
    END;

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
        p.id,  -- CRITICAL: Use same ID from profiles
        'authenticated' as aud,
        'authenticated' as role,
        p.email,
        crypt('TEMP_PASS_' || substring(p.id::text, 1, 8), gen_salt('bf')) as encrypted_password,
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

    GET DIAGNOSTICS affected_rows = ROW_COUNT;

    RAISE NOTICE 'Step 2: Created % auth.users records', affected_rows;

    -- Step 3: Re-enable the trigger
    BEGIN
        EXECUTE 'ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created';
        RAISE NOTICE 'Step 3: Re-enabled profile creation trigger';
    EXCEPTION
        WHEN undefined_object THEN
            RAISE NOTICE 'Step 3: Trigger does not exist, skipping...';
    END;

    -- Step 4: Display results
    RAISE NOTICE '================================================';
    RAISE NOTICE 'MIGRATION COMPLETE!';
    RAISE NOTICE '================================================';

END $$;

-- Verification queries
SELECT '✅ Verification Results:' as status;

SELECT
    COUNT(*) as auth_users_total,
    (SELECT COUNT(*) FROM profiles) as profiles_total,
    (SELECT COUNT(*) FROM profiles p INNER JOIN auth.users u ON p.id = u.id) as matching_ids
FROM auth.users;

-- Show which profiles have auth users
SELECT
    p.email,
    CASE
        WHEN u.id IS NOT NULL THEN '✅ Has auth user'
        ELSE '❌ Missing auth user'
    END as auth_status,
    CASE
        WHEN p.id = u.id THEN '✅ IDs match'
        WHEN u.id IS NULL THEN '⚠️  No user'
        ELSE '❌ ID mismatch'
    END as id_status
FROM profiles p
LEFT JOIN auth.users u ON p.id = u.id
ORDER BY p.created_at;

-- Final message
SELECT
    '🎉 All users can now log in using "Forgot Password" to set their password!' as next_step;
