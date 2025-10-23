-- Fix AI Agent position to be after Google Docs Creator
-- The flow should be: Google Docs Creator -> AI Agent -> Conditional Branch

-- First, let's check the current positions
SELECT 
  elem->>'id' as node_id,
  elem->>'type' as node_type,
  elem->'position' as position,
  elem->'data'->>'label' as label
FROM user_automation_rules,
  jsonb_array_elements(canvas_data->'nodes') AS elem
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f'
ORDER BY (elem->'position'->>'x')::int;

-- Update the AI Agent position and fix the edges
UPDATE user_automation_rules 
SET canvas_data = jsonb_set(
  jsonb_set(
    canvas_data,
    '{nodes}',
    (
      SELECT jsonb_agg(
        CASE 
          WHEN elem->>'id' = 'ai-summary-analyzer' THEN
            -- Position AI Agent after Google Docs Creator (which is at x:600)
            jsonb_set(
              jsonb_set(
                elem,
                '{position}',
                '{"x": 850, "y": 100}'::jsonb  -- Move to the right of Google Docs
              ),
              '{data,label}',
              '"Sales Coaching AI"'::jsonb
            )
          WHEN elem->>'id' = 'google-docs-creator' THEN
            -- Keep Google Docs Creator at its position
            jsonb_set(
              elem,
              '{position}',
              '{"x": 600, "y": 100}'::jsonb
            )
          WHEN elem->>'id' = 'conditional-branch' THEN
            -- Move Conditional Branch further right after AI Agent
            jsonb_set(
              elem,
              '{position}',
              '{"x": 1100, "y": 100}'::jsonb
            )
          ELSE elem
        END
      )
      FROM jsonb_array_elements(canvas_data->'nodes') AS elem
    )
  ),
  '{edges}',
  (
    SELECT jsonb_agg(
      CASE 
        -- Edge from Google Docs to AI Agent (was e3)
        WHEN elem->>'source' = 'google-docs-creator' AND elem->>'target' = 'conditional-branch' THEN
          jsonb_set(
            jsonb_set(
              elem,
              '{target}',
              '"ai-summary-analyzer"'::jsonb  -- Change target to AI Agent
            ),
            '{label}',
            '"Meeting Transcript"'::jsonb
          )
        -- Add new edge from AI Agent to Conditional Branch
        WHEN elem->>'id' = 'e-ai-to-branch' THEN
          elem  -- Keep existing if already there
        -- Remove old direct connection from router to AI Agent if it exists
        WHEN elem->>'source' = 'router' AND elem->>'target' = 'ai-summary-analyzer' THEN
          NULL  -- Remove this edge
        ELSE elem
      END
    )
    FROM jsonb_array_elements(canvas_data->'edges') AS elem
    WHERE elem IS NOT NULL
  )
)
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';

-- Add the new edge from AI Agent to Conditional Branch if it doesn't exist
UPDATE user_automation_rules 
SET canvas_data = jsonb_set(
  canvas_data,
  '{edges}',
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 
      FROM jsonb_array_elements(canvas_data->'edges') AS elem 
      WHERE elem->>'source' = 'ai-summary-analyzer' 
        AND elem->>'target' = 'conditional-branch'
    ) 
    THEN canvas_data->'edges' || jsonb_build_array(
      jsonb_build_object(
        'id', 'e-ai-to-branch',
        'source', 'ai-summary-analyzer',
        'target', 'conditional-branch',
        'type', 'custom',
        'label', 'AI Analysis',
        'labelBgColor', '#7c3aed',
        'labelTextColor', '#ffffff',
        'data', jsonb_build_object(
          'label', 'AI Analysis',
          'labelBgColor', '#7c3aed',
          'labelTextColor', '#ffffff'
        )
      )
    )
    ELSE canvas_data->'edges'
  END
)
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';

-- Verify the final positions and connections
SELECT 
  'Nodes:' as info,
  jsonb_pretty(canvas_data->'nodes') as data
FROM user_automation_rules 
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f'
UNION ALL
SELECT 
  'Edges:' as info,
  jsonb_pretty(canvas_data->'edges') as data
FROM user_automation_rules 
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';