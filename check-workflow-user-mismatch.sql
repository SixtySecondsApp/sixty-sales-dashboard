-- Check for user ID mismatch on Fathom workflow
-- Run this in Supabase SQL editor to diagnose the issue

-- 1. Show the Fathom workflow details
SELECT 
    'Fathom Workflow Details' as check_type,
    id,
    user_id,
    rule_name,
    is_active,
    CASE 
        WHEN canvas_data IS NOT NULL AND canvas_data::text != 'null' 
        THEN 'Yes (' || jsonb_array_length(canvas_data->'nodes') || ' nodes)'
        ELSE 'No'
    END as has_canvas_data,
    created_at,
    updated_at
FROM user_automation_rules
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';

-- 2. Show all unique user_ids that have workflows
SELECT 
    'Users with Workflows' as check_type,
    user_id,
    COUNT(*) as workflow_count
FROM user_automation_rules
GROUP BY user_id
ORDER BY workflow_count DESC;

-- 3. Show all workflows (to see if Fathom is there)
SELECT 
    'All Workflows' as check_type,
    id,
    user_id,
    rule_name,
    is_active,
    trigger_type,
    action_type
FROM user_automation_rules
ORDER BY created_at DESC;

-- 4. Get your actual user ID from the auth.users table
-- You can match this with your email
SELECT 
    'Auth Users' as check_type,
    id as user_id,
    email,
    created_at
FROM auth.users
WHERE email = 'YOUR_EMAIL@example.com';  -- Replace with your actual email

-- If you need to update the workflow to your user ID, use this:
-- UPDATE user_automation_rules 
-- SET user_id = 'YOUR_USER_ID_HERE'
-- WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';