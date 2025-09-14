-- Add user preference columns to google_tasks_sync_status table
ALTER TABLE google_tasks_sync_status 
ADD COLUMN IF NOT EXISTS selected_list_id TEXT,
ADD COLUMN IF NOT EXISTS selected_list_title TEXT;

-- Add comment for clarity
COMMENT ON COLUMN google_tasks_sync_status.selected_list_id IS 'User selected Google Task list ID for syncing';
COMMENT ON COLUMN google_tasks_sync_status.selected_list_title IS 'User selected Google Task list title for display';

-- Update the get_or_create_sync_status function to include default list preferences
CREATE OR REPLACE FUNCTION get_or_create_sync_status(p_user_id UUID)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  sync_status TEXT,
  last_full_sync_at TIMESTAMPTZ,
  last_incremental_sync_at TIMESTAMPTZ,
  selected_list_id TEXT,
  selected_list_title TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Try to get existing sync status
  RETURN QUERY
  SELECT 
    s.id,
    s.user_id,
    s.sync_status,
    s.last_full_sync_at,
    s.last_incremental_sync_at,
    s.selected_list_id,
    s.selected_list_title
  FROM google_tasks_sync_status s
  WHERE s.user_id = p_user_id;
  
  -- If not found, create it
  IF NOT FOUND THEN
    RETURN QUERY
    INSERT INTO google_tasks_sync_status (
      user_id,
      sync_status,
      selected_list_id,
      selected_list_title
    )
    VALUES (
      p_user_id,
      'idle',
      NULL,
      NULL
    )
    RETURNING 
      google_tasks_sync_status.id,
      google_tasks_sync_status.user_id,
      google_tasks_sync_status.sync_status,
      google_tasks_sync_status.last_full_sync_at,
      google_tasks_sync_status.last_incremental_sync_at,
      google_tasks_sync_status.selected_list_id,
      google_tasks_sync_status.selected_list_title;
  END IF;
END;
$$;