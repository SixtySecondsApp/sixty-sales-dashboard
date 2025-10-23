-- Verify Webhook Results
-- Run these queries in Supabase SQL Editor to check the data created by the webhook

-- 1. Check the workflow that was created/updated
SELECT 
    id,
    user_id,
    rule_name,
    is_active,
    created_at,
    updated_at
FROM user_automation_rules
WHERE id = 'b224bdca-7bfa-4bc3-b30e-68e0045a64f8';

-- 2. Check workflow executions
SELECT 
    id,
    workflow_id,
    status,
    input_data,
    result,
    created_at,
    completed_at
FROM workflow_executions
WHERE workflow_id = 'b224bdca-7bfa-4bc3-b30e-68e0045a64f8'
ORDER BY created_at DESC
LIMIT 5;

-- 3. Check meetings created
SELECT 
    m.id,
    m.title,
    m.meeting_date,
    m.owner_user_id,
    m.external_id,
    m.created_at,
    COUNT(mai.id) as action_items_count
FROM meetings m
LEFT JOIN meeting_action_items mai ON m.id = mai.meeting_id
WHERE m.created_at > NOW() - INTERVAL '1 hour'
GROUP BY m.id, m.title, m.meeting_date, m.owner_user_id, m.external_id, m.created_at
ORDER BY m.created_at DESC
LIMIT 10;

-- 4. Check action items created
SELECT 
    mai.id,
    mai.text,
    mai.owner,
    mai.due_date,
    mai.is_sales_rep_task,
    mai.linked_task_id,
    mai.completed,
    m.title as meeting_title
FROM meeting_action_items mai
LEFT JOIN meetings m ON mai.meeting_id = m.id
WHERE mai.created_at > NOW() - INTERVAL '1 hour'
ORDER BY mai.created_at DESC
LIMIT 10;

-- 5. Check tasks created from action items
SELECT 
    t.id,
    t.title,
    t.category,
    t.due_date,
    t.meeting_id,
    t.meeting_action_item_id,
    t.completed,
    t.user_id,
    p.email as assigned_to
FROM tasks t
LEFT JOIN profiles p ON t.user_id = p.id
WHERE t.meeting_id IS NOT NULL 
  AND t.created_at > NOW() - INTERVAL '1 hour'
ORDER BY t.created_at DESC
LIMIT 10;

-- 6. Verify sync triggers are working
SELECT 
    t.id as task_id,
    t.title,
    t.completed as task_completed,
    mai.id as action_item_id,
    mai.text as action_item_text,
    mai.completed as action_item_completed,
    CASE 
        WHEN t.completed = mai.completed THEN '✅ Synced'
        ELSE '❌ Out of sync'
    END as sync_status
FROM tasks t
INNER JOIN meeting_action_items mai ON t.meeting_action_item_id = mai.id
WHERE t.created_at > NOW() - INTERVAL '1 hour'
LIMIT 10;