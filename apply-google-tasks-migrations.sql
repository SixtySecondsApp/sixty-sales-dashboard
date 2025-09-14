-- Apply Google Tasks migrations safely
-- This script checks for existing objects before creating them

-- ============================================
-- 1. First Migration: Basic Google Tasks Sync
-- ============================================

-- Check if tables exist before creating
DO $$ 
BEGIN
  -- Create google_task_lists if it doesn't exist
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'google_task_lists') THEN
    CREATE TABLE google_task_lists (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      google_list_id TEXT NOT NULL,
      title TEXT NOT NULL,
      is_default BOOLEAN DEFAULT false,
      etag TEXT,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      UNIQUE(google_list_id)
    );
  END IF;

  -- Create google_task_mappings if it doesn't exist
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'google_task_mappings') THEN
    CREATE TABLE google_task_mappings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      google_task_id TEXT NOT NULL,
      google_list_id TEXT NOT NULL,
      last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      sync_direction TEXT DEFAULT 'bidirectional' CHECK (sync_direction IN ('bidirectional', 'to_google', 'from_google')),
      etag TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      sync_config_id UUID,
      priority_at_sync TEXT,
      
      UNIQUE(task_id),
      UNIQUE(google_task_id, google_list_id)
    );
  END IF;

  -- Create google_tasks_sync_status if it doesn't exist
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'google_tasks_sync_status') THEN
    CREATE TABLE google_tasks_sync_status (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      last_full_sync_at TIMESTAMP WITH TIME ZONE,
      last_incremental_sync_at TIMESTAMP WITH TIME ZONE,
      sync_status TEXT DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
      error_message TEXT,
      tasks_synced_count INTEGER DEFAULT 0,
      conflicts_count INTEGER DEFAULT 0,
      selected_list_id TEXT,
      selected_list_title TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      UNIQUE(user_id)
    );
  ELSE
    -- Table exists, add missing columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'google_tasks_sync_status' AND column_name = 'selected_list_id') THEN
      ALTER TABLE google_tasks_sync_status ADD COLUMN selected_list_id TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'google_tasks_sync_status' AND column_name = 'selected_list_title') THEN
      ALTER TABLE google_tasks_sync_status ADD COLUMN selected_list_title TEXT;
    END IF;
  END IF;

  -- Create google_tasks_sync_conflicts if it doesn't exist
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'google_tasks_sync_conflicts') THEN
    CREATE TABLE google_tasks_sync_conflicts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
      google_task_id TEXT,
      google_list_id TEXT,
      conflict_type TEXT NOT NULL CHECK (conflict_type IN ('update_conflict', 'delete_conflict', 'create_duplicate')),
      local_data JSONB,
      google_data JSONB,
      resolved BOOLEAN DEFAULT false,
      resolved_at TIMESTAMP WITH TIME ZONE,
      resolution_action TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      CHECK (task_id IS NOT NULL OR google_task_id IS NOT NULL)
    );
  END IF;
END $$;

-- Add columns to tasks table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'google_task_id') THEN
    ALTER TABLE tasks ADD COLUMN google_task_id TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'google_list_id') THEN
    ALTER TABLE tasks ADD COLUMN google_list_id TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'sync_status') THEN
    ALTER TABLE tasks ADD COLUMN sync_status TEXT DEFAULT 'local_only' CHECK (sync_status IN ('local_only', 'synced', 'pending_sync', 'conflict'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'last_synced_at') THEN
    ALTER TABLE tasks ADD COLUMN last_synced_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'google_position') THEN
    ALTER TABLE tasks ADD COLUMN google_position TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'google_etag') THEN
    ALTER TABLE tasks ADD COLUMN google_etag TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'synced_to_lists') THEN
    ALTER TABLE tasks ADD COLUMN synced_to_lists JSONB DEFAULT '[]'::jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'primary_google_list_id') THEN
    ALTER TABLE tasks ADD COLUMN primary_google_list_id TEXT;
  END IF;
END $$;

-- Drop and recreate the get_or_create_sync_status function with new return type
DROP FUNCTION IF EXISTS get_or_create_sync_status(UUID);

CREATE FUNCTION get_or_create_sync_status(p_user_id UUID)
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

-- ============================================
-- 2. Third Migration: Multi-List Sync Support
-- ============================================

-- Create table for managing multiple Google Task list configurations
CREATE TABLE IF NOT EXISTS google_tasks_list_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_list_id TEXT NOT NULL,
  list_title TEXT NOT NULL,
  sync_direction TEXT NOT NULL DEFAULT 'bidirectional' CHECK (sync_direction IN ('bidirectional', 'to_google', 'from_google')),
  is_primary BOOLEAN DEFAULT false,
  priority_filter TEXT[] DEFAULT '{}',
  task_categories TEXT[] DEFAULT '{}',
  status_filter TEXT[] DEFAULT '{}',
  auto_create_in_list BOOLEAN DEFAULT true,
  sync_enabled BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, google_list_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_task_configs_user_id ON google_tasks_list_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_task_configs_enabled ON google_tasks_list_configs(sync_enabled);

-- Add RLS policies
ALTER TABLE google_tasks_list_configs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'google_tasks_list_configs' 
    AND policyname = 'Users can view their own list configs'
  ) THEN
    CREATE POLICY "Users can view their own list configs" ON google_tasks_list_configs
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'google_tasks_list_configs' 
    AND policyname = 'Users can insert their own list configs'
  ) THEN
    CREATE POLICY "Users can insert their own list configs" ON google_tasks_list_configs
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'google_tasks_list_configs' 
    AND policyname = 'Users can update their own list configs'
  ) THEN
    CREATE POLICY "Users can update their own list configs" ON google_tasks_list_configs
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'google_tasks_list_configs' 
    AND policyname = 'Users can delete their own list configs'
  ) THEN
    CREATE POLICY "Users can delete their own list configs" ON google_tasks_list_configs
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create or replace the view for easy access to task list configurations
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
      c.priority_filter = '{}' 
      OR p_priority = ANY(c.priority_filter)
    )
    AND (
      c.task_categories = '{}' 
      OR p_category IS NULL
      OR p_category = ANY(c.task_categories)
    )
  ORDER BY 
    CASE WHEN c.priority_filter != '{}' THEN 0 ELSE 1 END,
    c.is_primary DESC,
    c.display_order;
END;
$$;

-- Migration function to convert existing single list config to new multi-list system
CREATE OR REPLACE FUNCTION migrate_existing_list_configs()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r RECORD;
BEGIN
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
      true,
      'bidirectional',
      '{}',
      true
    )
    ON CONFLICT (user_id, google_list_id) DO NOTHING;
  END LOOP;
END;
$$;

-- Run the migration
SELECT migrate_existing_list_configs();

-- Add comments for clarity
COMMENT ON TABLE google_tasks_list_configs IS 'Configuration for syncing tasks with multiple Google Task lists with filtering rules';
COMMENT ON COLUMN google_tasks_list_configs.priority_filter IS 'Array of task priorities that should sync to this list (e.g., {high, critical})';
COMMENT ON COLUMN google_tasks_list_configs.task_categories IS 'Array of task categories to sync to this list';
COMMENT ON COLUMN google_tasks_list_configs.is_primary IS 'Primary list receives all tasks by default unless filtered to other lists';

-- Grant necessary permissions
GRANT ALL ON google_task_lists TO authenticated;
GRANT ALL ON google_task_mappings TO authenticated;
GRANT ALL ON google_tasks_sync_status TO authenticated;
GRANT ALL ON google_tasks_sync_conflicts TO authenticated;
GRANT ALL ON google_tasks_list_configs TO authenticated;
GRANT SELECT ON user_task_list_configs TO authenticated;

GRANT EXECUTE ON FUNCTION get_or_create_sync_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_task_target_lists(UUID, TEXT, TEXT) TO authenticated;

-- Final message
DO $$
BEGIN
  RAISE NOTICE 'Google Tasks migrations applied successfully!';
END $$;