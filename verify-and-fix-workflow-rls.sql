-- Verify and fix workflow visibility issues

-- 1. First, check if the workflow actually exists (bypassing RLS)
SELECT 
    'Direct Query (No RLS)' as check_type,
    COUNT(*) as workflow_count
FROM user_automation_rules
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';

-- 2. Check all workflows in the table
SELECT 
    'All Workflows' as check_type,
    id,
    user_id,
    rule_name,
    is_active,
    created_at
FROM user_automation_rules
ORDER BY created_at DESC;

-- 3. Check RLS status on the table
SELECT 
    'RLS Status' as check_type,
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'user_automation_rules';

-- 4. Check RLS policies
SELECT 
    'RLS Policies' as check_type,
    polname as policy_name,
    polcmd as command,
    polpermissive as permissive,
    polroles::text as roles,
    polqual::text as qual_condition,
    polwithcheck::text as with_check
FROM pg_policy 
WHERE polrelid = 'user_automation_rules'::regclass;

-- 5. Get your current user from auth
SELECT 
    'Current Auth User' as check_type,
    id,
    email
FROM auth.users
WHERE email LIKE '%@%'  -- Show all users
ORDER BY created_at DESC
LIMIT 5;

-- If RLS is enabled and blocking, we need to fix it
-- Option 1: Disable RLS temporarily (for testing)
ALTER TABLE user_automation_rules DISABLE ROW LEVEL SECURITY;

-- Option 2: Create a proper RLS policy if missing
-- First drop any existing policies
DROP POLICY IF EXISTS "Users can view their own workflows" ON user_automation_rules;
DROP POLICY IF EXISTS "Users can create their own workflows" ON user_automation_rules;
DROP POLICY IF EXISTS "Users can update their own workflows" ON user_automation_rules;
DROP POLICY IF EXISTS "Users can delete their own workflows" ON user_automation_rules;

-- Create new comprehensive policies
CREATE POLICY "Users can view their own workflows" 
ON user_automation_rules FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own workflows" 
ON user_automation_rules FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workflows" 
ON user_automation_rules FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workflows" 
ON user_automation_rules FOR DELETE 
USING (auth.uid() = user_id);

-- Re-enable RLS with proper policies
ALTER TABLE user_automation_rules ENABLE ROW LEVEL SECURITY;

-- Now verify the workflow exists and is accessible
SELECT 
    'Final Check' as check_type,
    id,
    user_id,
    rule_name,
    is_active
FROM user_automation_rules
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';