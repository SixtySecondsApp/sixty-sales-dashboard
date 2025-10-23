-- VERIFY WORKFLOW SUCCESS
-- Run this after COMPLETE_WORKFLOW_FIX.sql to verify everything worked

-- ========================================
-- Check 1: Tables exist
-- ========================================
SELECT 
    '✅ Tables Created' as status,
    string_agg(table_name, ', ') as tables
FROM information_schema.tables 
WHERE table_name IN ('user_automation_rules', 'workflow_executions', 'meeting_action_items')
AND table_schema = 'public';

-- ========================================
-- Check 2: Workflow created
-- ========================================
SELECT 
    '✅ Workflow Created' as status,
    COUNT(*) as workflow_count
FROM public.user_automation_rules
WHERE rule_name = 'Fathom Meeting Integration';

-- ========================================
-- Check 3: Get your workflow details
-- ========================================
SELECT 
    '📋 YOUR WORKFLOW DETAILS' as section,
    id as workflow_id,
    user_id,
    rule_name,
    is_active,
    created_at
FROM public.user_automation_rules
WHERE rule_name = 'Fathom Meeting Integration'
ORDER BY created_at DESC
LIMIT 1;

-- ========================================
-- Check 4: Your webhook URL
-- ========================================
SELECT 
    '🔗 YOUR WEBHOOK URL' as section,
    'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/workflow-webhook/' || id as full_webhook_url
FROM public.user_automation_rules
WHERE rule_name = 'Fathom Meeting Integration'
AND is_active = true
LIMIT 1;

-- ========================================
-- Check 5: Test readiness
-- ========================================
SELECT 
    '🧪 TEST READINESS' as section,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Ready to test! Use the webhook URL above in /test-fathom-workflow.html'
        ELSE '❌ No workflow found - please run COMPLETE_WORKFLOW_FIX.sql first'
    END as status
FROM public.user_automation_rules
WHERE rule_name = 'Fathom Meeting Integration';