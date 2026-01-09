-- Migration to set up Playwright test user with same data and permissions as andrew.bryce@sixtyseconds.video
-- This ensures the test user has identical access and views for testing purposes

-- Create or update the Playwright test user in profiles
DO $$ 
DECLARE
    andrew_user_id uuid;
    playwright_user_id uuid;
BEGIN
    -- Get andrew.bryce's user ID
    SELECT id INTO andrew_user_id 
    FROM auth.users 
    WHERE email = 'andrew.bryce@sixtyseconds.video'
    LIMIT 1;

    -- Get or create playwright test user ID
    SELECT id INTO playwright_user_id 
    FROM auth.users 
    WHERE email = 'playwright@test.com'
    LIMIT 1;

    -- If playwright user doesn't exist, we'll need to handle this differently
    -- For now, we'll create/update the profile assuming the user exists
    IF playwright_user_id IS NOT NULL AND andrew_user_id IS NOT NULL THEN
        
        -- Copy profile data from andrew.bryce to playwright user
        INSERT INTO public.profiles (
            id, 
            email, 
            full_name, 
            organization_name, 
            is_admin, 
            role,
            created_at,
            updated_at
        )
        SELECT 
            playwright_user_id,
            'playwright@test.com',
            'Playwright Test User',
            organization_name,
            is_admin,
            role,
            NOW(),
            NOW()
        FROM public.profiles
        WHERE id = andrew_user_id
        ON CONFLICT (id) DO UPDATE SET
            organization_name = EXCLUDED.organization_name,
            is_admin = EXCLUDED.is_admin,
            role = EXCLUDED.role,
            updated_at = NOW();

        -- Copy organization membership
        INSERT INTO public.organizations (id, name, created_at, updated_at)
        SELECT DISTINCT o.id, o.name, o.created_at, o.updated_at
        FROM public.organizations o
        JOIN public.organization_members om ON o.id = om.organization_id
        WHERE om.user_id = andrew_user_id
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.organization_members (
            organization_id,
            user_id,
            role,
            created_at
        )
        SELECT 
            organization_id,
            playwright_user_id,
            role,
            NOW()
        FROM public.organization_members
        WHERE user_id = andrew_user_id
        ON CONFLICT (organization_id, user_id) DO UPDATE SET
            role = EXCLUDED.role;

        -- Copy team memberships
        INSERT INTO public.team_members (
            team_id,
            user_id,
            role,
            created_at
        )
        SELECT 
            team_id,
            playwright_user_id,
            role,
            NOW()
        FROM public.team_members
        WHERE user_id = andrew_user_id
        ON CONFLICT (team_id, user_id) DO UPDATE SET
            role = EXCLUDED.role;

        -- Copy Google Calendar integration settings
        INSERT INTO public.calendar_integrations (
            user_id,
            provider,
            enabled,
            access_token,
            refresh_token,
            calendar_id,
            settings,
            created_at,
            updated_at
        )
        SELECT 
            playwright_user_id,
            provider,
            enabled,
            -- For testing, we'll copy the tokens but they may need to be refreshed
            access_token,
            refresh_token,
            calendar_id,
            settings,
            NOW(),
            NOW()
        FROM public.calendar_integrations
        WHERE user_id = andrew_user_id
        ON CONFLICT (user_id, provider) DO UPDATE SET
            enabled = EXCLUDED.enabled,
            calendar_id = EXCLUDED.calendar_id,
            settings = EXCLUDED.settings,
            updated_at = NOW();

        -- Copy user preferences and settings
        INSERT INTO public.user_preferences (
            user_id,
            preferences,
            created_at,
            updated_at
        )
        SELECT 
            playwright_user_id,
            preferences,
            NOW(),
            NOW()
        FROM public.user_preferences
        WHERE user_id = andrew_user_id
        ON CONFLICT (user_id) DO UPDATE SET
            preferences = EXCLUDED.preferences,
            updated_at = NOW();

        -- Grant same permissions to test user for all tables
        -- This ensures RLS policies work the same way
        
        -- Copy notification settings
        INSERT INTO public.notification_settings (
            user_id,
            email_notifications,
            push_notifications,
            notification_types,
            created_at,
            updated_at
        )
        SELECT 
            playwright_user_id,
            email_notifications,
            push_notifications,
            notification_types,
            NOW(),
            NOW()
        FROM public.notification_settings
        WHERE user_id = andrew_user_id
        ON CONFLICT (user_id) DO UPDATE SET
            email_notifications = EXCLUDED.email_notifications,
            push_notifications = EXCLUDED.push_notifications,
            notification_types = EXCLUDED.notification_types,
            updated_at = NOW();

        -- Copy API keys and integrations (for testing purposes)
        INSERT INTO public.api_keys (
            user_id,
            name,
            key_hash,
            provider,
            is_active,
            created_at,
            updated_at
        )
        SELECT 
            playwright_user_id,
            name || ' (Test Copy)',
            key_hash,
            provider,
            is_active,
            NOW(),
            NOW()
        FROM public.api_keys
        WHERE user_id = andrew_user_id
        ON CONFLICT (user_id, name) DO UPDATE SET
            provider = EXCLUDED.provider,
            is_active = EXCLUDED.is_active,
            updated_at = NOW();

        -- Create sample test data that mirrors andrew.bryce's data structure
        -- Copy recent deals for testing
        INSERT INTO public.deals (
            id,
            deal_name,
            company_name,
            contact_name,
            contact_email,
            value,
            stage,
            created_by,
            assigned_to,
            probability,
            expected_close_date,
            notes,
            created_at,
            updated_at
        )
        SELECT 
            gen_random_uuid(),
            deal_name || ' (Test)',
            company_name,
            contact_name,
            contact_email,
            value,
            stage,
            playwright_user_id,
            playwright_user_id,
            probability,
            expected_close_date,
            'Test copy for Playwright testing',
            NOW(),
            NOW()
        FROM public.deals
        WHERE created_by = andrew_user_id
        LIMIT 10
        ON CONFLICT (id) DO NOTHING;

        -- Copy recent tasks for testing
        INSERT INTO public.tasks (
            id,
            title,
            description,
            assigned_to,
            created_by,
            due_date,
            priority,
            status,
            tags,
            created_at,
            updated_at
        )
        SELECT 
            gen_random_uuid(),
            title || ' (Test)',
            description,
            playwright_user_id,
            playwright_user_id,
            due_date,
            priority,
            status,
            tags,
            NOW(),
            NOW()
        FROM public.tasks
        WHERE assigned_to = andrew_user_id
        LIMIT 10
        ON CONFLICT (id) DO NOTHING;

        -- Copy recent calendar events for testing
        INSERT INTO public.calendar_events (
            id,
            user_id,
            title,
            description,
            start_time,
            end_time,
            location,
            attendees,
            category,
            all_day,
            recurring,
            google_event_id,
            created_at,
            updated_at
        )
        SELECT 
            gen_random_uuid(),
            playwright_user_id,
            title || ' (Test)',
            description,
            start_time,
            end_time,
            location,
            attendees,
            category,
            all_day,
            recurring,
            NULL, -- Don't copy Google event IDs
            NOW(),
            NOW()
        FROM public.calendar_events
        WHERE user_id = andrew_user_id
        LIMIT 20
        ON CONFLICT (id) DO NOTHING;

        -- Copy recent contacts
        INSERT INTO public.contacts (
            id,
            user_id,
            name,
            email,
            phone,
            company,
            title,
            notes,
            tags,
            created_at,
            updated_at
        )
        SELECT 
            gen_random_uuid(),
            playwright_user_id,
            name,
            email,
            phone,
            company,
            title,
            'Test contact for Playwright',
            tags,
            NOW(),
            NOW()
        FROM public.contacts
        WHERE user_id = andrew_user_id
        LIMIT 20
        ON CONFLICT (id) DO NOTHING;

        -- Copy recent activities
        INSERT INTO public.activities (
            id,
            user_id,
            type,
            title,
            description,
            related_to,
            related_type,
            metadata,
            created_at
        )
        SELECT 
            gen_random_uuid(),
            playwright_user_id,
            type,
            title || ' (Test)',
            description,
            related_to,
            related_type,
            metadata,
            NOW()
        FROM public.activities
        WHERE user_id = andrew_user_id
        LIMIT 30
        ON CONFLICT (id) DO NOTHING;

        RAISE NOTICE 'Successfully set up Playwright test user with data from andrew.bryce@sixtyseconds.video';
    ELSE
        IF andrew_user_id IS NULL THEN
            RAISE NOTICE 'Andrew user not found. Skipping data copy.';
        END IF;
        IF playwright_user_id IS NULL THEN
            RAISE NOTICE 'Playwright test user not found. Please create the user first.';
        END IF;
    END IF;
END $$;

-- Create a function to sync test user data with andrew.bryce's data
CREATE OR REPLACE FUNCTION sync_playwright_test_user()
RETURNS void AS $$
DECLARE
    andrew_user_id uuid;
    playwright_user_id uuid;
BEGIN
    -- Get user IDs
    SELECT id INTO andrew_user_id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video';
    SELECT id INTO playwright_user_id FROM auth.users WHERE email = 'playwright@test.com';
    
    IF andrew_user_id IS NOT NULL AND playwright_user_id IS NOT NULL THEN
        -- Sync profile settings
        UPDATE public.profiles p1
        SET 
            organization_name = p2.organization_name,
            is_admin = p2.is_admin,
            role = p2.role,
            updated_at = NOW()
        FROM public.profiles p2
        WHERE p1.id = playwright_user_id 
        AND p2.id = andrew_user_id;
        
        RAISE NOTICE 'Test user synced with andrew.bryce settings';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION sync_playwright_test_user() IS 'Syncs the Playwright test user data with andrew.bryce@sixtyseconds.video for consistent testing';