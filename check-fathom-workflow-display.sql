-- Check if the Fathom workflow exists and has proper visualization data

-- 1. Check if the Fathom workflow exists
SELECT 
    'Fathom Workflow' as check_type,
    id,
    user_id,
    rule_name,
    is_active,
    action_config::text as config_preview
FROM user_automation_rules
WHERE rule_name LIKE '%Fathom%' OR rule_name LIKE '%fathom%'
LIMIT 5;

-- 2. Check the workflow for our specific user
SELECT 
    'User Workflows' as check_type,
    id,
    rule_name,
    is_active,
    created_at
FROM user_automation_rules
WHERE user_id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check the specific Fathom workflow we created
SELECT 
    'Specific Fathom Workflow' as check_type,
    id,
    user_id,
    rule_name,
    is_active,
    action_config
FROM user_automation_rules
WHERE id = '1e9b4a4a-8e4a-4b9b-8e4a-1e9b4a4a8e4a';

-- 4. If it doesn't exist with that ID, let's check all workflows
SELECT 
    'All Workflows' as check_type,
    id,
    rule_name,
    user_id,
    is_active,
    created_at
FROM user_automation_rules
ORDER BY created_at DESC
LIMIT 20;