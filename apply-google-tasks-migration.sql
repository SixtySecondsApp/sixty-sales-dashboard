-- Google Tasks Sync Tables
-- This migration adds support for bidirectional sync with Google Tasks

-- Table to store Google Task Lists
CREATE TABLE IF NOT EXISTS google_task_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID NOT NULL REFERENCES google_integrations(id) ON DELETE CASCADE,
  google_list_id TEXT NOT NULL,
  title TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(integration_id, google_list_id)
);

-- Table to map local tasks to Google Tasks
CREATE TABLE IF NOT EXISTS google_task_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  google_task_id TEXT NOT NULL,
  google_list_id TEXT NOT NULL,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sync_direction TEXT DEFAULT 'bidirectional' CHECK (sync_direction IN ('bidirectional', 'to_google', 'from_google')),
  etag TEXT, -- For efficient change detection
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(task_id),
  UNIQUE(google_task_id, google_list_id)
);

-- Table to track sync status and conflicts
CREATE TABLE IF NOT EXISTS google_tasks_sync_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_full_sync_at TIMESTAMP WITH TIME ZONE,
  last_incremental_sync_at TIMESTAMP WITH TIME ZONE,
  sync_state TEXT DEFAULT 'idle' CHECK (sync_state IN ('idle', 'syncing', 'error', 'conflict')),
  error_message TEXT,
  tasks_synced_count INTEGER DEFAULT 0,
  conflicts_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Table to store sync conflicts for user resolution
CREATE TABLE IF NOT EXISTS google_tasks_sync_conflicts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  google_task_id TEXT,
  google_list_id TEXT,
  conflict_type TEXT NOT NULL CHECK (conflict_type IN ('update_conflict', 'delete_conflict', 'create_duplicate')),
  local_data JSONB,
  google_data JSONB,
  resolved BOOLEAN DEFAULT false,
  resolution TEXT CHECK (resolution IN ('keep_local', 'keep_google', 'keep_both', 'merge')),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add columns to tasks table for Google Tasks integration
DO $$ 
BEGIN
  -- Add google_task_id column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'tasks' AND column_name = 'google_task_id') THEN
    ALTER TABLE tasks ADD COLUMN google_task_id TEXT;
  END IF;

  -- Add google_list_id column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'tasks' AND column_name = 'google_list_id') THEN
    ALTER TABLE tasks ADD COLUMN google_list_id TEXT;
  END IF;

  -- Add sync_status column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'tasks' AND column_name = 'sync_status') THEN
    ALTER TABLE tasks ADD COLUMN sync_status TEXT DEFAULT 'local_only' 
      CHECK (sync_status IN ('local_only', 'synced', 'pending_sync', 'sync_error'));
  END IF;

  -- Add last_synced_at column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'tasks' AND column_name = 'last_synced_at') THEN
    ALTER TABLE tasks ADD COLUMN last_synced_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Add google_position column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'tasks' AND column_name = 'google_position') THEN
    ALTER TABLE tasks ADD COLUMN google_position TEXT;
  END IF;

  -- Add google_etag column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'tasks' AND column_name = 'google_etag') THEN
    ALTER TABLE tasks ADD COLUMN google_etag TEXT;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_google_task_lists_integration_id ON google_task_lists(integration_id);
CREATE INDEX IF NOT EXISTS idx_google_task_mappings_task_id ON google_task_mappings(task_id);
CREATE INDEX IF NOT EXISTS idx_google_task_mappings_google_task_id ON google_task_mappings(google_task_id, google_list_id);
CREATE INDEX IF NOT EXISTS idx_google_tasks_sync_status_user_id ON google_tasks_sync_status(user_id);
CREATE INDEX IF NOT EXISTS idx_google_tasks_sync_conflicts_user_id ON google_tasks_sync_conflicts(user_id);
CREATE INDEX IF NOT EXISTS idx_google_tasks_sync_conflicts_resolved ON google_tasks_sync_conflicts(resolved);
CREATE INDEX IF NOT EXISTS idx_tasks_google_task_id ON tasks(google_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sync_status ON tasks(sync_status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_google_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to update updated_at
DROP TRIGGER IF EXISTS update_google_task_lists_updated_at ON google_task_lists;
CREATE TRIGGER update_google_task_lists_updated_at
BEFORE UPDATE ON google_task_lists
FOR EACH ROW
EXECUTE FUNCTION update_google_tasks_updated_at();

DROP TRIGGER IF EXISTS update_google_task_mappings_updated_at ON google_task_mappings;
CREATE TRIGGER update_google_task_mappings_updated_at
BEFORE UPDATE ON google_task_mappings
FOR EACH ROW
EXECUTE FUNCTION update_google_tasks_updated_at();

DROP TRIGGER IF EXISTS update_google_tasks_sync_status_updated_at ON google_tasks_sync_status;
CREATE TRIGGER update_google_tasks_sync_status_updated_at
BEFORE UPDATE ON google_tasks_sync_status
FOR EACH ROW
EXECUTE FUNCTION update_google_tasks_updated_at();

-- RLS Policies
ALTER TABLE google_task_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_task_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_tasks_sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_tasks_sync_conflicts ENABLE ROW LEVEL SECURITY;

-- Policies for google_task_lists
DROP POLICY IF EXISTS "Users can view their own task lists" ON google_task_lists;
CREATE POLICY "Users can view their own task lists" ON google_task_lists
  FOR SELECT USING (
    integration_id IN (
      SELECT id FROM google_integrations WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage their own task lists" ON google_task_lists;
CREATE POLICY "Users can manage their own task lists" ON google_task_lists
  FOR ALL USING (
    integration_id IN (
      SELECT id FROM google_integrations WHERE user_id = auth.uid()
    )
  );

-- Policies for google_task_mappings
DROP POLICY IF EXISTS "Users can view their own task mappings" ON google_task_mappings;
CREATE POLICY "Users can view their own task mappings" ON google_task_mappings
  FOR SELECT USING (
    task_id IN (
      SELECT id FROM tasks WHERE assigned_to = auth.uid() OR created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage their own task mappings" ON google_task_mappings;
CREATE POLICY "Users can manage their own task mappings" ON google_task_mappings
  FOR ALL USING (
    task_id IN (
      SELECT id FROM tasks WHERE assigned_to = auth.uid() OR created_by = auth.uid()
    )
  );

-- Policies for google_tasks_sync_status
DROP POLICY IF EXISTS "Users can view their own sync status" ON google_tasks_sync_status;
CREATE POLICY "Users can view their own sync status" ON google_tasks_sync_status
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage their own sync status" ON google_tasks_sync_status;
CREATE POLICY "Users can manage their own sync status" ON google_tasks_sync_status
  FOR ALL USING (user_id = auth.uid());

-- Policies for google_tasks_sync_conflicts
DROP POLICY IF EXISTS "Users can view their own sync conflicts" ON google_tasks_sync_conflicts;
CREATE POLICY "Users can view their own sync conflicts" ON google_tasks_sync_conflicts
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage their own sync conflicts" ON google_tasks_sync_conflicts;
CREATE POLICY "Users can manage their own sync conflicts" ON google_tasks_sync_conflicts
  FOR ALL USING (user_id = auth.uid());

-- Function to handle task sync status updates
CREATE OR REPLACE FUNCTION update_task_sync_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When a task is created or updated, mark it as pending sync if it has a Google mapping
  IF NEW.google_task_id IS NOT NULL AND OLD IS DISTINCT FROM NULL THEN
    NEW.sync_status = 'pending_sync';
  END IF;
  
  -- Update last_synced_at when sync_status changes to 'synced'
  IF NEW.sync_status = 'synced' AND (OLD IS NULL OR OLD.sync_status != 'synced') THEN
    NEW.last_synced_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update task sync status
DROP TRIGGER IF EXISTS update_task_sync_status_trigger ON tasks;
CREATE TRIGGER update_task_sync_status_trigger
BEFORE INSERT OR UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION update_task_sync_status();

-- Function to get or create sync status for a user
CREATE OR REPLACE FUNCTION get_or_create_sync_status(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_sync_status_id UUID;
BEGIN
  -- Try to get existing sync status
  SELECT id INTO v_sync_status_id
  FROM google_tasks_sync_status
  WHERE user_id = p_user_id;
  
  -- If not found, create new sync status
  IF v_sync_status_id IS NULL THEN
    INSERT INTO google_tasks_sync_status (user_id)
    VALUES (p_user_id)
    RETURNING id INTO v_sync_status_id;
  END IF;
  
  RETURN v_sync_status_id;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT ALL ON google_task_lists TO authenticated;
GRANT ALL ON google_task_mappings TO authenticated;
GRANT ALL ON google_tasks_sync_status TO authenticated;
GRANT ALL ON google_tasks_sync_conflicts TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_sync_status TO authenticated;