-- Set Database Configuration for Next-Actions
-- IMPORTANT: Replace the placeholder values with your actual values before running

-- Replace YOUR-PROJECT with your actual Supabase project reference
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://YOUR-PROJECT.supabase.co';

-- Replace YOUR-SERVICE-ROLE-KEY with your actual service role key
-- Get it from: Supabase Dashboard → Settings → API → service_role key
ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR-SERVICE-ROLE-KEY';
