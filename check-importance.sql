-- Check if importance column exists and what values are in it
SELECT 
  COUNT(*) as total_items,
  COUNT(importance) as items_with_importance,
  COUNT(*) FILTER (WHERE importance = 'high') as high_count,
  COUNT(*) FILTER (WHERE importance = 'medium') as medium_count,
  COUNT(*) FILTER (WHERE importance = 'low') as low_count,
  COUNT(*) FILTER (WHERE importance IS NULL) as null_count
FROM meeting_action_items;
