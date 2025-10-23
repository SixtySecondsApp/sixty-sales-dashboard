-- CREATE FATHOM WORKFLOW - FINAL
-- This creates the workflow with Andrew Bryce's actual user ID

-- ========================================
-- Create the Fathom Workflow
-- ========================================
INSERT INTO public.user_automation_rules (
    user_id,
    rule_name,
    rule_description,
    trigger_type,
    action_type,
    is_active,
    canvas_data,
    trigger_conditions,
    action_config
)
VALUES (
    'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'::UUID,  -- Andrew Bryce's actual user ID
    'Fathom Meeting Integration',
    'Process Fathom webhook payloads for meetings',
    'webhook',
    'webhook_process',
    true,
    '{
        "nodes": [
            {
                "id": "webhook-trigger",
                "type": "fathomWebhook",
                "position": {"x": 100, "y": 200},
                "data": {
                    "label": "Fathom Webhook",
                    "isConfigured": true
                }
            },
            {
                "id": "conditional-branch",
                "type": "conditionalBranch",
                "position": {"x": 350, "y": 200},
                "data": {
                    "label": "Route by Type",
                    "isConfigured": true
                }
            },
            {
                "id": "meeting-upsert",
                "type": "meetingUpsert",
                "position": {"x": 600, "y": 100},
                "data": {
                    "label": "Upsert Meeting",
                    "isConfigured": true
                }
            },
            {
                "id": "docs-creator",
                "type": "googleDocsCreator",
                "position": {"x": 600, "y": 200},
                "data": {
                    "label": "Create Google Doc",
                    "isConfigured": true
                }
            },
            {
                "id": "action-processor",
                "type": "actionItemProcessor",
                "position": {"x": 600, "y": 300},
                "data": {
                    "label": "Process Actions",
                    "isConfigured": true
                }
            }
        ],
        "edges": [
            {
                "id": "e1",
                "source": "webhook-trigger",
                "target": "conditional-branch"
            },
            {
                "id": "e2",
                "source": "conditional-branch",
                "sourceHandle": "summary",
                "target": "meeting-upsert"
            },
            {
                "id": "e3",
                "source": "conditional-branch",
                "sourceHandle": "transcript",
                "target": "docs-creator"
            },
            {
                "id": "e4",
                "source": "conditional-branch",
                "sourceHandle": "action_items",
                "target": "action-processor"
            }
        ]
    }'::jsonb,
    '{"webhook_type": "fathom"}'::jsonb,
    '{
        "process_type": "meeting_integration",
        "priority_mapping": {
            "urgent": "eeb122d5-d850-4381-b914-2ad09e48421b",
            "high": "42641fa1-9e6c-48fd-8c08-ada611ccc92a",
            "medium": "e6153e53-d1c7-431a-afde-cd7c21b02ebb",
            "low": "1c00bc94-5358-4348-aaf3-cb2baa4747c4"
        },
        "user_mapping": {
            "Andrew Bryce": "ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459",
            "Steve Gibson": "e6380a9c-f0cf-46ad-96c3-73b1d1d48c9f"
        }
    }'::jsonb
)
ON CONFLICT (id) DO NOTHING
RETURNING 
    id as workflow_id,
    user_id,
    rule_name,
    '✅ WORKFLOW CREATED SUCCESSFULLY!' as status;

-- ========================================
-- Display the Workflow Details
-- ========================================
SELECT 
    '========================================' as info,
    '✅ FATHOM WORKFLOW CREATED!' as status
UNION ALL
SELECT 
    '========================================' as info,
    'Check details below:' as status;

-- Get the workflow ID
SELECT 
    '📋 WORKFLOW ID' as label,
    id::text as value
FROM public.user_automation_rules
WHERE rule_name = 'Fathom Meeting Integration'
AND user_id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'::UUID
ORDER BY created_at DESC
LIMIT 1;

-- Get the webhook URL
SELECT 
    '🔗 WEBHOOK URL' as label,
    'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/workflow-webhook/' || id as value
FROM public.user_automation_rules
WHERE rule_name = 'Fathom Meeting Integration'
AND user_id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'::UUID
ORDER BY created_at DESC
LIMIT 1;

-- Show user info
SELECT 
    '👤 USER' as label,
    'andrew.bryce@sixtyseconds.video' as value;

-- Show next steps
SELECT 
    '📝 NEXT STEPS' as instruction,
    'Follow these steps in order' as details
UNION ALL
SELECT 
    '1️⃣ Step 1' as instruction,
    'Copy the Workflow ID above' as details
UNION ALL
SELECT 
    '2️⃣ Step 2' as instruction,
    'Open /test-fathom-workflow.html' as details
UNION ALL
SELECT 
    '3️⃣ Step 3' as instruction,
    'Paste the Workflow ID' as details
UNION ALL
SELECT 
    '4️⃣ Step 4' as instruction,
    'Test all three payload types' as details
UNION ALL
SELECT 
    '5️⃣ Step 5' as instruction,
    'Configure Fathom to use the webhook URL' as details;

-- ========================================
-- Verify the workflow was created
-- ========================================
SELECT 
    '========================================' as divider,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Workflow ready for testing!'
        ELSE '❌ Workflow creation failed - check for errors above'
    END as final_status
FROM public.user_automation_rules
WHERE rule_name = 'Fathom Meeting Integration'
AND user_id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'::UUID;