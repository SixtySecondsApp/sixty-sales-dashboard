-- First, let's see what we have
SELECT 
  COUNT(*) as total_items,
  COUNT(importance) as items_with_importance,
  COUNT(*) FILTER (WHERE importance = 'high') as high_count,
  COUNT(*) FILTER (WHERE importance = 'medium') as medium_count,
  COUNT(*) FILTER (WHERE importance = 'low') as low_count,
  COUNT(*) FILTER (WHERE importance IS NULL) as null_count
FROM meeting_action_items;

-- Backfill strategy: Use priority if it exists, otherwise default to 'medium'
-- This makes existing items visible with default 'medium' importance
UPDATE meeting_action_items
SET importance = CASE
  WHEN priority = 'high' THEN 'high'
  WHEN priority = 'medium' THEN 'medium'
  WHEN priority = 'low' THEN 'low'
  ELSE 'medium'  -- Default for items without priority
END
WHERE importance IS NULL;

-- Verify the update
SELECT 
  COUNT(*) as total_items,
  COUNT(*) FILTER (WHERE importance = 'high') as high_count,
  COUNT(*) FILTER (WHERE importance = 'medium') as medium_count,
  COUNT(*) FILTER (WHERE importance = 'low') as low_count,
  COUNT(*) FILTER (WHERE importance IS NULL) as null_count
FROM meeting_action_items;
