-- Update AI Agent position to come after Google Docs Creator
-- This moves the AI agent to the right position for sales coaching analysis

UPDATE user_automation_rules 
SET canvas_data = jsonb_set(
  jsonb_set(
    canvas_data,
    '{nodes}',
    (
      SELECT jsonb_agg(
        CASE 
          WHEN elem->>'id' = 'ai-summary-analyzer' THEN
            jsonb_set(
              jsonb_set(
                elem,
                '{position}',
                '{"x": 850, "y": 100}'::jsonb
              ),
              '{data,label}',
              '"Sales Coaching AI"'::jsonb
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
        WHEN elem->>'id' = 'e3' THEN
          jsonb_set(
            jsonb_set(
              elem,
              '{target}',
              '"ai-summary-analyzer"'::jsonb
            ),
            '{label}',
            '"Transcript for Coaching"'::jsonb
          )
        WHEN elem->>'id' = 'e7' THEN
          NULL  -- Remove this edge as AI agent no longer connects directly from router
        WHEN elem->>'id' = 'e8' THEN
          jsonb_set(
            elem,
            '{label}',
            '"Sales Coaching Data"'::jsonb
          )
        ELSE elem
      END
    )
    FROM jsonb_array_elements(canvas_data->'edges') AS elem
    WHERE elem IS NOT NULL
  )
)
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';

-- Verify the update
SELECT 
  jsonb_pretty(canvas_data->'nodes') as nodes,
  jsonb_pretty(canvas_data->'edges') as edges
FROM user_automation_rules 
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';