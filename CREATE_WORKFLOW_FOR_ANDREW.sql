-- CREATE WORKFLOW FOR ANDREW BRYCE
-- This script creates the Fathom workflow for your specific user

-- ========================================
-- STEP 1: Find or identify the correct user
-- ========================================
SELECT 
    'Looking for Andrew Bryce user...' as status,
    id as user_id,
    email,
    created_at
FROM auth.users
WHERE email IN (
    'andrew.bryce@sixtyseconds.video',
    'andrew.bryce@sixty.ai',
    'andrew@sixtyseconds.video',
    'andrew@sixty.ai'
)
ORDER BY created_at DESC;

-- ========================================
-- STEP 2: Create workflow with specific user ID
-- ========================================
-- IMPORTANT: Replace 'YOUR_USER_ID_HERE' with your actual user ID from auth.users
-- If you can't find your user, use one of the test user IDs from the previous query

DO $$
DECLARE
    v_user_id UUID;
    v_workflow_id UUID;
BEGIN
    -- Try to find Andrew's user first
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email IN (
        'andrew.bryce@sixtyseconds.video',
        'andrew.bryce@sixty.ai',
        'andrew@sixtyseconds.video',
        'andrew@sixty.ai'
    )
    LIMIT 1;
    
    -- If not found, use the first available test user
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id
        FROM auth.users
        WHERE email IN (
            'playwright.test@gmail.com',
            'test@playwright.local',
            'rishirais24@gmail.com'
        )
        ORDER BY created_at DESC
        LIMIT 1;
        
        IF v_user_id IS NOT NULL THEN
            RAISE NOTICE '⚠️ Could not find andrew.bryce user, using test user instead';
        END IF;
    ELSE
        RAISE NOTICE '✅ Found Andrew Bryce user!';
    END IF;
    
    -- If we still don't have a user, use the hardcoded one you mentioned
    IF v_user_id IS NULL THEN
        -- Use the user ID you referenced in your original request
        v_user_id := '053aab56-8fc6-4fe1-9cbe-702092b7780b'::UUID;
        RAISE NOTICE '⚠️ Using hardcoded Andrew Bryce user ID from original request';
    END IF;
    
    -- Now create the workflow
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
        v_user_id,
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
    RETURNING id INTO v_workflow_id;
    
    IF v_workflow_id IS NOT NULL THEN
        RAISE NOTICE '';
        RAISE NOTICE '========================================';
        RAISE NOTICE '✅ SUCCESS: WORKFLOW CREATED!';
        RAISE NOTICE '========================================';
        RAISE NOTICE '📋 Workflow ID: %', v_workflow_id;
        RAISE NOTICE '👤 User ID: %', v_user_id;
        RAISE NOTICE '';
        RAISE NOTICE '🔗 WEBHOOK URL:';
        RAISE NOTICE 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/workflow-webhook/%', v_workflow_id;
        RAISE NOTICE '========================================';
    ELSE
        RAISE NOTICE '⚠️ Workflow may already exist. Checking...';
    END IF;
END $$;

-- ========================================
-- STEP 3: Show ALL workflows (in case one already exists)
-- ========================================
SELECT 
    '>>> ALL FATHOM WORKFLOWS <<<' as section,
    id as workflow_id,
    user_id,
    rule_name,
    is_active,
    created_at,
    'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/workflow-webhook/' || id as webhook_url
FROM public.user_automation_rules
WHERE rule_name = 'Fathom Meeting Integration'
ORDER BY created_at DESC;

-- ========================================
-- STEP 4: Get the most recent workflow for testing
-- ========================================
SELECT 
    '>>> USE THIS FOR TESTING <<<' as instruction,
    id as workflow_id,
    'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/workflow-webhook/' || id as complete_webhook_url
FROM public.user_automation_rules
WHERE rule_name = 'Fathom Meeting Integration'
AND is_active = true
ORDER BY created_at DESC
LIMIT 1;