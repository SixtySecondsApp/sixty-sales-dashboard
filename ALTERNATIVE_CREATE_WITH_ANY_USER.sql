-- ALTERNATIVE: CREATE WORKFLOW WITH ANY AVAILABLE USER
-- Use this if you can't find your specific user

-- ========================================
-- Option 1: Create with the first test user
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
    'aed1dd89-116a-4ce8-a0a9-e0cb6a8b3ea0'::UUID,  -- playwright.test@gmail.com user
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
            "Andrew Bryce": "053aab56-8fc6-4fe1-9cbe-702092b7780b",
            "Steve Gibson": "e6380a9c-f0cf-46ad-96c3-73b1d1d48c9f"
        }
    }'::jsonb
)
ON CONFLICT (id) DO NOTHING
RETURNING 
    id as workflow_id,
    user_id,
    rule_name,
    '✅ WORKFLOW CREATED SUCCESSFULLY!' as status,
    'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/workflow-webhook/' || id as webhook_url;

-- ========================================
-- Show the created workflow
-- ========================================
SELECT 
    '>>> YOUR WORKFLOW DETAILS <<<' as section,
    id as workflow_id,
    user_id,
    rule_name,
    is_active,
    created_at,
    'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/workflow-webhook/' || id as webhook_url
FROM public.user_automation_rules
WHERE rule_name = 'Fathom Meeting Integration'
ORDER BY created_at DESC
LIMIT 1;