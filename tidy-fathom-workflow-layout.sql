-- Tidy up Fathom Workflow Layout with Proper Spacing and Organization

UPDATE user_automation_rules
SET canvas_data = jsonb_build_object(
    'nodes', jsonb_build_array(
      
      -- 1. FATHOM WEBHOOK (Far left)
      jsonb_build_object(
        'id', 'fathom-webhook-trigger',
        'type', 'fathomWebhook',
        'position', jsonb_build_object('x', 50, 'y', 250),
        'data', (canvas_data->'nodes'->0->'data')
      ),
      
      -- 2. CONDITIONAL BRANCH (Left-center)
      jsonb_build_object(
        'id', 'payload-router',
        'type', 'conditionalBranch',
        'position', jsonb_build_object('x', 300, 'y', 250),
        'data', (canvas_data->'nodes'->1->'data')
      ),
      
      -- TRANSCRIPT BRANCH (Top path)
      -- 3. GOOGLE DOCS CREATOR
      jsonb_build_object(
        'id', 'create-transcript-doc',
        'type', 'googleDocsCreator',
        'position', jsonb_build_object('x', 550, 'y', 100),
        'data', (canvas_data->'nodes'->2->'data')
      ),
      
      -- ACTION ITEMS BRANCH (Middle path)
      -- 4. ACTION ITEM PROCESSOR
      jsonb_build_object(
        'id', 'process-actions',
        'type', 'actionItemProcessor',
        'position', jsonb_build_object('x', 550, 'y', 250),
        'data', (canvas_data->'nodes'->3->'data')
      ),
      
      -- 5. CREATE TASKS
      jsonb_build_object(
        'id', 'create-tasks',
        'type', 'action',
        'position', jsonb_build_object('x', 800, 'y', 250),
        'data', (canvas_data->'nodes'->4->'data')
      ),
      
      -- SUMMARY BRANCH (Bottom path)
      -- 6. AI AGENT
      jsonb_build_object(
        'id', 'ai-summary-analyzer',
        'type', 'aiAgent',
        'position', jsonb_build_object('x', 550, 'y', 400),
        'data', (canvas_data->'nodes'->5->'data')
      ),
      
      -- CONVERGENCE POINT
      -- 7. MEETING UPSERT (Right-center)
      jsonb_build_object(
        'id', 'upsert-meeting',
        'type', 'meetingUpsert',
        'position', jsonb_build_object('x', 1050, 'y', 250),
        'data', (canvas_data->'nodes'->6->'data')
      ),
      
      -- 8. NOTIFICATION (Far right)
      jsonb_build_object(
        'id', 'send-notifications',
        'type', 'action',
        'position', jsonb_build_object('x', 1300, 'y', 250),
        'data', (canvas_data->'nodes'->7->'data')
      )
    ),
    
    'edges', (canvas_data->'edges')  -- Keep the existing edges unchanged
  ),
  updated_at = NOW()
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';

-- Verify the update
SELECT 
    'Layout Updated' as status,
    jsonb_pretty(
      jsonb_build_object(
        'node_positions', 
        (SELECT jsonb_agg(
          jsonb_build_object(
            'id', value->>'id',
            'type', value->>'type',
            'x', value->'position'->>'x',
            'y', value->'position'->>'y'
          )
        )
        FROM jsonb_array_elements(canvas_data->'nodes'))
      )
    ) as positions
FROM user_automation_rules
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';