-- Script to create the Playwright test user directly in Supabase
-- Run this in the Supabase SQL editor

-- First, create the auth user if it doesn't exist
DO $$
DECLARE
    test_user_id uuid;
BEGIN
    -- Check if user exists
    SELECT id INTO test_user_id
    FROM auth.users
    WHERE email = 'playwright@test.com';

    -- If user doesn't exist, create it
    IF test_user_id IS NULL THEN
        -- Note: You'll need to create the user through Supabase Dashboard or Auth API
        -- as direct SQL insertion into auth.users requires special permissions
        RAISE NOTICE 'User playwright@test.com does not exist. Please create through Supabase Dashboard.';
        RAISE NOTICE 'Email: playwright@test.com';
        RAISE NOTICE 'Password: TestPassword123!';
    ELSE
        -- User exists, ensure profile is set up
        INSERT INTO public.profiles (
            id,
            email,
            full_name,
            organization_name,
            is_admin,
            role,
            created_at,
            updated_at
        ) VALUES (
            test_user_id,
            'playwright@test.com',
            'Playwright Test User',
            'Sixty Seconds',
            true, -- Set as admin to match andrew.bryce
            'admin',
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            organization_name = EXCLUDED.organization_name,
            is_admin = EXCLUDED.is_admin,
            role = EXCLUDED.role,
            updated_at = NOW();

        RAISE NOTICE 'Profile created/updated for playwright@test.com';
    END IF;
END $$;