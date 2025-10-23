-- Perfect Spacing for Fathom Workflow - Professional Layout with No Overlaps

UPDATE user_automation_rules
SET canvas_data = jsonb_build_object(
    'nodes', jsonb_build_array(
      
      -- 1. FATHOM WEBHOOK (Start - Far Left)
      jsonb_build_object(
        'id', 'fathom-webhook-trigger',
        'type', 'fathomWebhook',
        'position', jsonb_build_object('x', 50, 'y', 500),
        'data', (canvas_data->'nodes'->0->'data')
      ),
      
      -- 2. CONDITIONAL BRANCH (Router - with 350px gap)
      jsonb_build_object(
        'id', 'payload-router',
        'type', 'conditionalBranch',
        'position', jsonb_build_object('x', 400, 'y', 500),
        'data', (canvas_data->'nodes'->1->'data')
      ),
      
      -- TOP BRANCH - TRANSCRIPT PATH
      -- 3. GOOGLE DOCS CREATOR (Top - with 400px gap from branch)
      jsonb_build_object(
        'id', 'create-transcript-doc',
        'type', 'googleDocsCreator',
        'position', jsonb_build_object('x', 800, 'y', 100),
        'data', (canvas_data->'nodes'->2->'data')
      ),
      
      -- MIDDLE BRANCH - ACTION ITEMS PATH
      -- 4. ACTION ITEM PROCESSOR (Middle - with 400px gap from branch)
      jsonb_build_object(
        'id', 'process-actions',
        'type', 'actionItemProcessor',
        'position', jsonb_build_object('x', 800, 'y', 500),
        'data', (canvas_data->'nodes'->3->'data')
      ),
      
      -- 5. CREATE TASKS (Continuation of middle branch - with 500px gap)
      jsonb_build_object(
        'id', 'create-tasks',
        'type', 'action',
        'position', jsonb_build_object('x', 1300, 'y', 500),
        'data', (canvas_data->'nodes'->4->'data')
      ),
      
      -- BOTTOM BRANCH - SUMMARY PATH
      -- 6. AI AGENT (Bottom - with 400px gap from branch)
      jsonb_build_object(
        'id', 'ai-summary-analyzer',
        'type', 'aiAgent',
        'position', jsonb_build_object('x', 800, 'y', 900),
        'data', (canvas_data->'nodes'->5->'data')
      ),
      
      -- CONVERGENCE POINT
      -- 7. MEETING UPSERT (Convergence - with plenty of room)
      jsonb_build_object(
        'id', 'upsert-meeting',
        'type', 'meetingUpsert',
        'position', jsonb_build_object('x', 1800, 'y', 500),
        'data', (canvas_data->'nodes'->6->'data')
      ),
      
      -- 8. FINAL NOTIFICATION (End - with 500px gap)
      jsonb_build_object(
        'id', 'send-notifications',
        'type', 'action',
        'position', jsonb_build_object('x', 2300, 'y', 500),
        'data', (canvas_data->'nodes'->7->'data')
      )
    ),
    
    'edges', (canvas_data->'edges')  -- Keep all connections unchanged
  ),
  updated_at = NOW()
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';

-- Display the new layout summary
SELECT 
    'Perfect Spacing Applied' as status,
    jsonb_pretty(
      jsonb_build_object(
        'horizontal_flow', jsonb_build_object(
          'stage_1_webhook', 'x: 50',
          'stage_2_branch', 'x: 400 (350px gap)',
          'stage_3_parallel', 'x: 800 (400px gap)',
          'stage_4_tasks', 'x: 1300 (500px gap)',
          'stage_5_upsert', 'x: 1800 (500px gap)',
          'stage_6_notify', 'x: 2300 (500px gap)'
        ),
        'vertical_separation', jsonb_build_object(
          'top_branch', 'y: 100 (transcript)',
          'middle_branch', 'y: 500 (actions & main flow)',
          'bottom_branch', 'y: 900 (AI summary)',
          'spacing', '400px between branches'
        ),
        'total_width', '2300px',
        'total_height', '900px'
      )
    ) as layout_metrics
FROM user_automation_rules
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';