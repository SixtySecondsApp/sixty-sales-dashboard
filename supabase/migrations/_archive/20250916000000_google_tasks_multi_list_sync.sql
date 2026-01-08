-- Create table for managing multiple Google Task list configurations
CREATE TABLE IF NOT EXISTS google_tasks_list_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_list_id TEXT NOT NULL,
  list_title TEXT NOT NULL,
  sync_direction TEXT NOT NULL DEFAULT 'bidirectional' CHECK (sync_direction IN ('bidirectional', 'to_google', 'from_google')),
  is_primary BOOLEAN DEFAULT false,
  priority_filter TEXT[] DEFAULT '{}', -- Array of priorities that should sync to this list
  task_categories TEXT[] DEFAULT '{}', -- Array of task categories to sync
  status_filter TEXT[] DEFAULT '{}', -- Array of statuses to sync
  auto_create_in_list BOOLEAN DEFAULT true, -- Whether to auto-create tasks in this list
  sync_enabled BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, google_list_id)
);

-- Add indexes
CREATE INDEX idx_task_configs_user_id ON google_tasks_list_configs(user_id);
CREATE INDEX idx_task_configs_enabled ON google_tasks_list_configs(sync_enabled);

-- Add RLS policies
ALTER TABLE google_tasks_list_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own list configs" ON google_tasks_list_configs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own list configs" ON google_tasks_list_configs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own list configs" ON google_tasks_list_configs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own list configs" ON google_tasks_list_configs
  FOR DELETE USING (auth.uid() = user_id);

-- Update google_task_mappings to support multiple lists
ALTER TABLE google_task_mappings 
ADD COLUMN IF NOT EXISTS sync_config_id UUID REFERENCES google_tasks_list_configs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS priority_at_sync TEXT;

-- Create a view for easy access to task list configurations
CREATE OR REPLACE VIEW user_task_list_configs AS
SELECT 
  c.*,
  CASE 
    WHEN c.priority_filter = '{}' THEN 'All priorities'
    WHEN 'high' = ANY(c.priority_filter) AND 'critical' = ANY(c.priority_filter) THEN 'High & Critical only'
    WHEN 'high' = ANY(c.priority_filter) THEN 'High priority only'
    WHEN 'medium' = ANY(c.priority_filter) THEN 'Medium and above'
    ELSE 'Custom filter'
  END as priority_description,
  CASE
    WHEN c.is_primary THEN 'Primary list'
    WHEN array_length(c.priority_filter, 1) > 0 THEN 'Filtered list'
    ELSE 'Secondary list'
  END as list_type
FROM google_tasks_list_configs c
WHERE c.sync_enabled = true
ORDER BY c.is_primary DESC, c.display_order, c.created_at;

-- Function to get the appropriate list for a task based on priority
CREATE OR REPLACE FUNCTION get_task_target_lists(
  p_user_id UUID,
  p_priority TEXT,
  p_category TEXT DEFAULT NULL
)
RETURNS TABLE(
  config_id UUID,
  google_list_id TEXT,
  list_title TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as config_id,
    c.google_list_id,
    c.list_title
  FROM google_tasks_list_configs c
  WHERE 
    c.user_id = p_user_id
    AND c.sync_enabled = true
    AND (
      -- Include if no priority filter or priority matches
      c.priority_filter = '{}' 
      OR p_priority = ANY(c.priority_filter)
    )
    AND (
      -- Include if no category filter or category matches
      c.task_categories = '{}' 
      OR p_category IS NULL
      OR p_category = ANY(c.task_categories)
    )
  ORDER BY 
    -- Prioritize lists with specific filters over catch-all lists
    CASE WHEN c.priority_filter != '{}' THEN 0 ELSE 1 END,
    c.is_primary DESC,
    c.display_order;
END;
$$;

-- Update the tasks table to track which lists a task is synced to
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS synced_to_lists JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS primary_google_list_id TEXT;

-- Migration function to convert existing single list config to new multi-list system
CREATE OR REPLACE FUNCTION migrate_existing_list_configs()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r RECORD;
BEGIN
  -- Migrate existing configurations from google_tasks_sync_status
  FOR r IN 
    SELECT 
      user_id,
      selected_list_id,
      selected_list_title
    FROM google_tasks_sync_status
    WHERE selected_list_id IS NOT NULL
  LOOP
    INSERT INTO google_tasks_list_configs (
      user_id,
      google_list_id,
      list_title,
      is_primary,
      sync_direction,
      priority_filter,
      auto_create_in_list
    ) VALUES (
      r.user_id,
      r.selected_list_id,
      r.selected_list_title,
      true, -- Mark as primary since it was the only list
      'bidirectional',
      '{}', -- No filter, sync all priorities
      true
    )
    ON CONFLICT (user_id, google_list_id) DO NOTHING;
  END LOOP;
END;
$$;

-- Run the migration
SELECT migrate_existing_list_configs();

-- Add comment for clarity
COMMENT ON TABLE google_tasks_list_configs IS 'Configuration for syncing tasks with multiple Google Task lists with filtering rules';
COMMENT ON COLUMN google_tasks_list_configs.priority_filter IS 'Array of task priorities that should sync to this list (e.g., {high, critical})';
COMMENT ON COLUMN google_tasks_list_configs.task_categories IS 'Array of task categories to sync to this list';
COMMENT ON COLUMN google_tasks_list_configs.is_primary IS 'Primary list receives all tasks by default unless filtered to other lists';