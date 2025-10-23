-- Check Workflow Tables Current Status
-- This script analyzes the current state of workflow-related tables

-- ========================================
-- SECTION 1: Check if tables exist
-- ========================================
SELECT 
    'Table Existence Check' as check_type,
    table_name,
    table_schema
FROM information_schema.tables 
WHERE table_name IN ('user_automation_rules', 'workflow_executions', 'meeting_action_items')
AND table_schema = 'public';

-- ========================================
-- SECTION 2: Check columns if user_automation_rules exists
-- ========================================
SELECT 
    'Column Check for user_automation_rules' as check_type,
    ordinal_position,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_automation_rules'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- ========================================
-- SECTION 3: Check constraints
-- ========================================
SELECT 
    'Constraint Check' as check_type,
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.user_automation_rules'::regclass;

-- ========================================
-- SECTION 4: Check if auth.users has any records
-- ========================================
SELECT 
    'User Check' as check_type,
    COUNT(*) as user_count,
    MIN(created_at) as oldest_user,
    MAX(created_at) as newest_user
FROM auth.users;

-- ========================================
-- SECTION 5: Get sample user IDs for testing
-- ========================================
SELECT 
    'Sample Users' as check_type,
    id as user_id,
    email,
    created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;
