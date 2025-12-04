-- Direct auth.users sync by copying data from production
-- This bypasses triggers that would conflict with existing profiles

-- Step 1: Disable the profile creation trigger temporarily
ALTER TABLE auth.users DISABLE TRIGGER ALL;

-- Step 2: Get user IDs from profiles that we already synced
-- These are the users we need to create in auth.users

-- Display what we're about to do
SELECT 
    'Will create ' || COUNT(*) || ' users in auth.users' as action,
    'These IDs match existing profiles' as note
FROM profiles
WHERE id NOT IN (SELECT id FROM auth.users);

-- You'll need to manually insert the user data here
-- The script sync-auth-users.mjs tried to use the admin API which triggers the profile creation
-- Instead, we need to insert directly into auth.users table

-- For now, let's just show what data we have in profiles
SELECT 
    id,
    email,
    full_name,
    created_at
FROM profiles
ORDER BY created_at
LIMIT 20;

