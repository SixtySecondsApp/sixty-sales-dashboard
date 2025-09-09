-- Fix form URLs to use port 5173 instead of 5175
-- Run this in your Supabase SQL Editor

-- Update workflow forms table
UPDATE workflow_forms 
SET config = jsonb_set(
  jsonb_set(
    config,
    '{testUrl}',
    to_jsonb(replace(config->>'testUrl', ':5175/', ':5173/'))
  ),
  '{productionUrl}',
  to_jsonb(replace(config->>'productionUrl', ':5175/', ':5173/'))
)
WHERE config->>'testUrl' LIKE '%:5175/%' 
   OR config->>'productionUrl' LIKE '%:5175/%';

-- Update user_automation_rules canvas_data for form nodes
UPDATE user_automation_rules 
SET canvas_data = jsonb_set(
  canvas_data,
  '{nodes}',
  (
    SELECT jsonb_agg(
      CASE 
        WHEN node->>'type' = 'form' AND node->'data'->'config'->>'testUrl' LIKE '%:5175/%'
        THEN jsonb_set(
          jsonb_set(
            node,
            '{data,config,testUrl}',
            to_jsonb(replace(node->'data'->'config'->>'testUrl', ':5175/', ':5173/'))
          ),
          '{data,config,productionUrl}',
          to_jsonb(replace(node->'data'->'config'->>'productionUrl', ':5175/', ':5173/'))
        )
        ELSE node
      END
    )
    FROM jsonb_array_elements(canvas_data->'nodes') AS node
  )
)
WHERE canvas_data->'nodes' IS NOT NULL
  AND EXISTS (
    SELECT 1 
    FROM jsonb_array_elements(canvas_data->'nodes') AS node
    WHERE node->>'type' = 'form' 
      AND (node->'data'->'config'->>'testUrl' LIKE '%:5175/%' 
           OR node->'data'->'config'->>'productionUrl' LIKE '%:5175/%')
  );

-- Success message
SELECT 'Form URLs updated successfully! Port 5175 changed to 5173.' as result;