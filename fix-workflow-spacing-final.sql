-- Fix Fathom Workflow with Proper Spacing - No Overlaps

UPDATE user_automation_rules
SET canvas_data = jsonb_build_object(
    'nodes', jsonb_build_array(
      
      -- 1. FATHOM WEBHOOK (Far left)
      jsonb_build_object(
        'id', 'fathom-webhook-trigger',
        'type', 'fathomWebhook',
        'position', jsonb_build_object('x', 50, 'y', 300),
        'data', (canvas_data->'nodes'->0->'data')
      ),
      
      -- 2. CONDITIONAL BRANCH (After webhook with good spacing)
      jsonb_build_object(
        'id', 'payload-router',
        'type', 'conditionalBranch',
        'position', jsonb_build_object('x', 350, 'y', 300),
        'data', (canvas_data->'nodes'->1->'data')
      ),
      
      -- TRANSCRIPT BRANCH (Top path - well separated)
      -- 3. GOOGLE DOCS CREATOR
      jsonb_build_object(
        'id', 'create-transcript-doc',
        'type', 'googleDocsCreator',
        'position', jsonb_build_object('x', 650, 'y', 50),
        'data', (canvas_data->'nodes'->2->'data')
      ),
      
      -- ACTION ITEMS BRANCH (Middle path)
      -- 4. ACTION ITEM PROCESSOR
      jsonb_build_object(
        'id', 'process-actions',
        'type', 'actionItemProcessor',
        'position', jsonb_build_object('x', 650, 'y', 300),
        'data', (canvas_data->'nodes'->3->'data')
      ),
      
      -- 5. CREATE TASKS (Further right from processor)
      jsonb_build_object(
        'id', 'create-tasks',
        'type', 'action',
        'position', jsonb_build_object('x', 950, 'y', 300),
        'data', (canvas_data->'nodes'->4->'data')
      ),
      
      -- SUMMARY BRANCH (Bottom path - well separated)
      -- 6. AI AGENT
      jsonb_build_object(
        'id', 'ai-summary-analyzer',
        'type', 'aiAgent',
        'position', jsonb_build_object('x', 650, 'y', 550),
        'data', (canvas_data->'nodes'->5->'data')
      ),
      
      -- CONVERGENCE POINT (Right side with room for all connections)
      -- 7. MEETING UPSERT
      jsonb_build_object(
        'id', 'upsert-meeting',
        'type', 'meetingUpsert',
        'position', jsonb_build_object('x', 1250, 'y', 300),
        'data', (canvas_data->'nodes'->6->'data')
      ),
      
      -- 8. NOTIFICATION (Far right - final step)
      jsonb_build_object(
        'id', 'send-notifications',
        'type', 'action',
        'position', jsonb_build_object('x', 1550, 'y', 300),
        'data', (canvas_data->'nodes'->7->'data')
      )
    ),
    
    'edges', (canvas_data->'edges')  -- Keep the existing edges unchanged
  ),
  updated_at = NOW()
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';

-- Verify the new spacing
SELECT 
    'Spacing Fixed' as status,
    jsonb_pretty(
      jsonb_build_object(
        'layout', jsonb_build_object(
          'horizontal_flow', 'x: 50 → 350 → 650 → 950/1250 → 1550',
          'vertical_separation', 'y: 50 (top), 300 (middle), 550 (bottom)',
          'spacing', '250-300px horizontal, 250px vertical'
        ),
        'nodes', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'node', value->>'id',
              'position', concat('(', value->'position'->>'x', ', ', value->'position'->>'y', ')')
            ) ORDER BY (value->'position'->>'x')::int
          )
          FROM jsonb_array_elements(canvas_data->'nodes')
        )
      )
    ) as layout_details
FROM user_automation_rules
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';